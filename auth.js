/**
 * Caronte Secure Authentication Module
 * Handles login, registration, session management, and security checks.
 */

const AUTH_CONFIG = {
    MAX_ATTEMPTS: 10,       // Increased from 3
    LOCKOUT_TIME: 10 * 1000, // Reduced to 10s
    API_DELAY: 1500,
    TOKEN_KEY: 'caronte_auth_token',
    ATTEMPTS_KEY: 'caronte_login_attempts_v2', // New key to reset history
    LOCKOUT_KEY: 'caronte_lockout_until_v2',     // New key to reset existing locks
    USERS_KEY: 'caronte_users_db'
};

// Seed initial demo user if empty
if (!localStorage.getItem(AUTH_CONFIG.USERS_KEY)) {
    const initialDB = {
        'demo@caronte.com': { pass: 'futuro2026', name: 'Demo User' },
        'nestor.guerra@gmail.com': { pass: 'caronte2026', name: 'Néstor Guerra' }
    };
    localStorage.setItem(AUTH_CONFIG.USERS_KEY, JSON.stringify(initialDB));
}

class AuthService {
    constructor() {
        this.mode = window.AUTH_MODE || 'login'; // 'login' or 'register'

        // Selectors
        this.form = document.getElementById(this.mode === 'register' ? 'register-form' : 'login-form');
        this.emailInput = document.getElementById('email');
        this.passwordInput = document.getElementById('password');
        this.submitBtn = document.getElementById('submit-btn');
        this.errorMsg = document.getElementById('error-message');

        // Register specific
        if (this.mode === 'register') {
            this.nameInput = document.getElementById('name');
            this.confirmPassInput = document.getElementById('confirm-password');
        }

        if (this.form) {
            this.init();
        }
    }

    init() {
        this.form.addEventListener('submit', (e) => this.handleSubmit(e));

        // Input listeners
        this.emailInput?.addEventListener('input', () => this.hideError());
        this.passwordInput?.addEventListener('input', () => this.hideError());
        if (this.mode === 'register') {
            this.confirmPassInput?.addEventListener('input', () => this.hideError());
        }

        // Login specifics
        if (this.mode === 'login') {
            this.checkLockout();
        }
    }

    checkLockout() {
        if (this.mode !== 'login') return false;

        const lockoutUntil = localStorage.getItem(AUTH_CONFIG.LOCKOUT_KEY);
        if (lockoutUntil && Date.now() < parseInt(lockoutUntil)) {
            const remaining = Math.ceil((parseInt(lockoutUntil) - Date.now()) / 1000);
            this.showError(`Demasiados intentos. Inténtalo de nuevo en ${remaining}s.`);
            this.disableForm(true);
            setTimeout(() => {
                this.disableForm(false);
                this.hideError();
                localStorage.removeItem(AUTH_CONFIG.LOCKOUT_KEY);
                localStorage.removeItem(AUTH_CONFIG.ATTEMPTS_KEY);
            }, remaining * 1000);
            return true;
        }
        return false;
    }

    async handleSubmit(e) {
        e.preventDefault();

        if (this.mode === 'login' && this.checkLockout()) return;

        const email = this.sanitize(this.emailInput.value);
        const password = this.passwordInput.value;

        // Validations
        if (!this.validateEmail(email)) {
            this.showError('Por favor, introduce un email válido.');
            return;
        }

        if (this.mode === 'register') {
            const name = this.sanitize(this.nameInput.value);
            const confirmPass = this.confirmPassInput.value;

            if (password.length < 6) {
                this.showError('La contraseña debe tener al menos 6 caracteres.');
                return;
            }
            if (password !== confirmPass) {
                this.showError('Las contraseñas no coinciden.');
                return;
            }
            if (name.length < 2) {
                this.showError('Por favor, introduce tu nombre completo.');
                return;
            }

            this.setLoading(true);
            try {
                await this.registerUser(email, password, name);
                this.loginSuccess(email);
            } catch (error) {
                this.showError(error.message);
            } finally {
                this.setLoading(false);
            }

        } else {
            // LOGIN MODE
            this.setLoading(true);
            try {
                await this.loginUser(email, password);
                this.loginSuccess(email);
            } catch (error) {
                this.handleLoginError();
            } finally {
                this.setLoading(false);
            }
        }
    }

    // --- Core Logic ---

    // Reads DB from LocalStorage
    getDB() {
        return JSON.parse(localStorage.getItem(AUTH_CONFIG.USERS_KEY) || '{}');
    }

    saveDB(db) {
        localStorage.setItem(AUTH_CONFIG.USERS_KEY, JSON.stringify(db));
    }

    registerUser(email, password, name) {
        return new Promise((resolve, reject) => {
            setTimeout(() => {
                const db = this.getDB();
                if (db[email]) {
                    reject(new Error('Este email ya está registrado.'));
                } else {
                    db[email] = { pass: password, name: name };
                    this.saveDB(db);
                    resolve();
                }
            }, AUTH_CONFIG.API_DELAY);
        });
    }

    loginUser(email, password) {
        return new Promise((resolve, reject) => {
            setTimeout(() => {
                const db = this.getDB();
                if (db[email] && db[email].pass === password) {
                    resolve({ token: this.generateToken() });
                } else {
                    reject(new Error('Invalid credentials'));
                }
            }, AUTH_CONFIG.API_DELAY);
        });
    }

    // --- Helpers ---

    sanitize(input) {
        const div = document.createElement('div');
        div.textContent = input;
        return div.innerHTML.trim();
    }

    validateEmail(email) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    }

    generateToken() {
        return 'jwt_' + Math.random().toString(36).substr(2) + Date.now().toString(36);
    }

    loginSuccess(email) {
        const session = {
            user: email,
            token: this.generateToken(),
            expires: Date.now() + (24 * 60 * 60 * 1000)
        };
        localStorage.setItem(AUTH_CONFIG.TOKEN_KEY, JSON.stringify(session));
        localStorage.removeItem(AUTH_CONFIG.ATTEMPTS_KEY);
        window.location.href = 'dashboard.html';
    }

    handleLoginError() {
        let attempts = parseInt(localStorage.getItem(AUTH_CONFIG.ATTEMPTS_KEY) || '0');
        attempts++;
        localStorage.setItem(AUTH_CONFIG.ATTEMPTS_KEY, attempts);

        if (attempts >= AUTH_CONFIG.MAX_ATTEMPTS) {
            const lockoutTime = Date.now() + AUTH_CONFIG.LOCKOUT_TIME;
            localStorage.setItem(AUTH_CONFIG.LOCKOUT_KEY, lockoutTime);
            this.checkLockout();
        } else {
            this.showError(`Credenciales incorrectas. Intentos restantes: ${AUTH_CONFIG.MAX_ATTEMPTS - attempts}`);
        }
    }

    setLoading(loading) {
        if (loading) {
            this.submitBtn.classList.add('loading');
            this.submitBtn.disabled = true;
        } else {
            this.submitBtn.classList.remove('loading');
            this.submitBtn.disabled = false;
        }
    }

    showError(msg) {
        this.errorMsg.textContent = msg;
        this.errorMsg.classList.add('visible');

        // Shake animation hint
        this.form.classList.add('shake');
        setTimeout(() => this.form.classList.remove('shake'), 500);
    }

    hideError() {
        this.errorMsg.classList.remove('visible');
    }

    disableForm(disable) {
        const allInputs = this.form.querySelectorAll('input, button');
        allInputs.forEach(el => el.disabled = disable);
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    new AuthService();
});
