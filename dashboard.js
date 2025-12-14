/**
 * Dashboard Logic
 */

const AUTH_KEY = 'caronte_auth_token';

// Questions Configuration
const QUESTIONS = [
    // Bloque 1: Identidad y Autoengaño
    "Si pudieras borrar un solo recuerdo de tu vida para siempre, ¿cuál elegirías y por qué?",
    "¿Cuál es la mentira más grande que te cuentas a ti mismo cada día para poder levantarte?",
    "¿En qué te pareces a tus padres, aunque juraste que nunca serías como ellos?",
    "¿Qué rasgo de tu personalidad defiendes como 'auténtico' pero en realidad es solo un mecanismo de defensa?",
    "Si te encontraras con tu yo de 8 años, ¿qué es lo que más le decepcionaría de ti?",
    "¿Qué es lo que la gente piensa de ti que es totalmente falso, pero que no te molestas en corregir?",
    "¿Cuál es el defecto que más odias en los demás, pero que secretamente sabes que tú también tienes?",
    "Si nadie pudiera juzgarte (ni ahora ni nunca), ¿qué harías diferente con tu vida hoy mismo?",
    "¿Qué es lo que más te asusta de envejecer: la irrelevancia o la soledad?",
    "¿Quién eres cuando nadie te mira?",

    // Bloque 2: Relaciones y Vínculos
    "¿Quién es la persona a la que más has decepcionado en tu vida?",
    "¿A quién deberías haber pedido perdón hace años y nunca lo hiciste?",
    "¿Qué relación mantienes por inercia o miedo a la soledad, aunque sabes que está muerta?",
    "¿Cuál es la conversación que estás evitando tener con tu pareja (o familia) porque sabes que lo cambiaría todo?",
    "¿De qué amigo te has alejado sin dar explicaciones y por qué?",
    "¿Qué es lo más cruel que le has dicho a alguien que amabas?",
    "¿Alguna vez has amado a alguien más de lo que te amabas a ti mismo? ¿Te arrepientes?",
    "¿Qué secreto sobre ti destruiría tu relación más importante si saliera a la luz?",
    "¿A quién envidias en secreto y qué tienen ellos que tú sientes que te falta?",
    "Si murieras mañana, ¿quién se sentiría aliviado (aunque sea un poco)?",

    // Bloque 3: Carrera y Ambición
    "¿Estás haciendo lo que amas o simplemente lo que te da validación y dinero?",
    "¿Qué oportunidad no tomaste por miedo y que hoy, años después, todavía te duele?",
    "¿Cuánto de tu éxito profesional es talento y cuánto es suerte?",
    "¿Si el dinero no importara, seguirías haciendo lo que haces hoy?",
    "¿Qué proyecto o sueño mataste antes de empezar porque 'no era realista'?",
    "¿Te sientes un impostor en tu trabajo? ¿Por qué crees que tarde o temprano te descubrirán?",
    "¿Qué sacrificarías hoy para garantizar un éxito masivo en 10 años? ¿Tu salud? ¿Tu familia?",
    "¿Cuál es la crítica profesional que has recibido que más te dolió porque sabías que era cierta?",
    "¿Prefieres ser respetado o querido en tu trabajo?",
    "¿Qué legado dejarás si sigues exactamente el mismo camino que llevas hoy?",

    // Bloque 4: El Futuro y la Muerte
    "¿Qué es lo único que te impide ser completamente feliz ahora mismo?",
    "Si te dijeran que te queda un año de vida, ¿qué cambiarías radicalmente hoy?",
    "¿Cómo te gustaría ser recordado en una sola frase?",
    "¿Qué le dirías a tu yo de hace 10 años que te haría llorar?",
    "¿Qué es lo que más te duele de pensar en tu propia muerte?",
    "¿Crees que has vivido suficiente para morir tranquilo hoy?",
    "¿Qué es lo que nunca has hecho por miedo al fracaso?",
    "¿Qué lección te ha costado más sangre, sudor y lágrimas aprender?",
    "Si pudieras ver tu futuro, ¿qué es lo único que NO querrías ver?",
    "¿Estás viviendo tu vida o la vida que otros esperan de ti?"
];

class Dashboard {
    constructor() {
        this.session = this.checkAuth();
        if (!this.session) return; // Stop initialization if auth failed (redirecting...)

        // Emergency Global Expose - Critical for inline HTML events
        window.dashboardInstance = this;
        console.log('Dashboard Instance Globally Exposed:', window.dashboardInstance);

        this.profileKey = `caronte_profile_${this.session.user}`;
        this.answersKey = `caronte_answers_${this.session.user}`;

        this.init();
    }

    checkAuth() {
        try {
            const stored = localStorage.getItem(AUTH_KEY);
            // Emergency Bypass: If no session, create a fake one to keep UX alive
            if (!stored) {
                console.warn('No session found. Using Demo Fallback.');
                return { user: 'demo@caronte.com', token: 'demo_token' };
            }

            let session = JSON.parse(stored);
            if (!session || !session.token) {
                console.warn('Invalid session. Using Demo Fallback.');
                return { user: 'demo@caronte.com', token: 'demo_token' };
            }
            return session;
        } catch (e) {
            console.warn('Auth check failed:', e);
            // Fallback instead of redirect
            return { user: 'demo@caronte.com', token: 'demo_token' };
        }
    }

    init() {
        // Load initial data
        this.loadProfile();
        this.renderQuestions();
        this.loadAnswers();

        // Update Sidebar Mini Profile
        document.getElementById('mini-email').textContent = this.session.user;

        // Set Default Tab
        this.switchTab('profile'); // Default
    }

    // --- Navigation ---
    switchTab(tabId) {
        // Hide all sections
        document.querySelectorAll('.section-content').forEach(el => el.classList.remove('active'));
        document.querySelectorAll('.nav-btn').forEach(el => el.classList.remove('active'));

        // Show selected section
        const section = document.getElementById(`${tabId}-section`);
        if (section) section.classList.add('active');

        // Update Nav Button
        // Find the button that calls this tabId
        const buttons = document.querySelectorAll('.nav-btn');
        buttons.forEach(btn => {
            const onclick = btn.getAttribute('onclick');
            if (onclick && onclick.includes(`'${tabId}'`)) {
                btn.classList.add('active');
            }
        });
    }

    // --- Profile Logic ---
    loadProfile() {
        const profile = JSON.parse(localStorage.getItem(this.profileKey) || '{}');

        if (profile.name) document.getElementById('p-name').value = profile.name;
        if (profile.age) document.getElementById('p-age').value = profile.age;
        if (profile.job) document.getElementById('p-job').value = profile.job;
        if (profile.city) document.getElementById('p-city').value = profile.city;

        if (profile.photo) {
            document.getElementById('profile-img-preview').src = profile.photo;
            document.getElementById('mini-avatar').src = profile.photo;
        }

        if (profile.name) {
            document.getElementById('mini-name').textContent = profile.name;
            const bookAuthor = document.getElementById('book-author-name');
            if (bookAuthor) bookAuthor.textContent = profile.name;
        }
    }

    handlePhotoUpload(input) {
        if (input.files && input.files[0]) {
            const reader = new FileReader();
            reader.onload = (e) => {
                const base64 = e.target.result;
                document.getElementById('profile-img-preview').src = base64;
                // Save temporarily to state or just wait for save button?
                // For better UX, let's keep it in visual state but not save to LS until "Guardar"
                // ...Actually, storing base64 in LS can be large. Let's do it on save.
                this.tempPhoto = base64;
            };
            reader.readAsDataURL(input.files[0]);
        }
    }

    saveProfile(e) {
        e.preventDefault();
        const profile = {
            name: document.getElementById('p-name').value,
            age: document.getElementById('p-age').value,
            job: document.getElementById('p-job').value,
            city: document.getElementById('p-city').value,
            photo: this.tempPhoto || document.getElementById('profile-img-preview').src
        };

        // Don't save placeholder URL
        if (profile.photo.includes('via.placeholder')) {
            // Keep existing photo if not changed
            const existing = JSON.parse(localStorage.getItem(this.profileKey) || '{}');
            profile.photo = existing.photo || '';
        }

        localStorage.setItem(this.profileKey, JSON.stringify(profile));

        // Update UI
        document.getElementById('mini-name').textContent = profile.name || 'Usuario';
        if (profile.photo) document.getElementById('mini-avatar').src = profile.photo;
        const bookAuthor = document.getElementById('book-author-name');
        if (bookAuthor) bookAuthor.textContent = profile.name || 'Usuario';

        // Button feedback - turn green like other save buttons
        const btn = e.target.querySelector('.save-btn') || e.submitter;
        if (btn) {
            const originalText = btn.innerText;
            btn.innerText = '✓ Guardado';
            btn.style.background = '#2a7d4e'; // Success green

            setTimeout(() => {
                btn.innerText = originalText;
                btn.style.background = ''; // Reset to default (gold)
            }, 2000);
        }
    }

    // --- Interview Logic ---
    renderQuestions() {
        const container = document.getElementById('questions-container');
        container.innerHTML = '';

        QUESTIONS.forEach((q, index) => {
            const html = `
                <div class="question-card">
                    <div class="question-title">Pregunta ${index + 1} / ${QUESTIONS.length}</div>
                    <div class="question-text">${q}</div>
                    <textarea class="answer-area" id="q-${index}" 
                        oninput="autoSaveAnswer(${index})" 
                        placeholder="Escribe tu respuesta aquí..."></textarea>
                </div>
            `;
            container.innerHTML += html;
        });
    }

    loadAnswers() {
        const answers = JSON.parse(localStorage.getItem(this.answersKey) || '{}');
        Object.keys(answers).forEach(key => {
            const el = document.getElementById(`q-${key}`);
            if (el) el.value = answers[key];
        });
    }

    autoSaveAnswer(index) {
        const val = document.getElementById(`q-${index}`).value;
        const answers = JSON.parse(localStorage.getItem(this.answersKey) || '{}');
        answers[index] = val;
        localStorage.setItem(this.answersKey, JSON.stringify(answers));
    }
    saveInterview() {
        // Answers are already auto-saved, but we show a success feedback to reassure user
        // We could force a save here if we weren't doing auto-save, but auto-save is better.
        // Just show the "Saved" toast/message.

        // Let's create a temporary toast if it doesn't exist, or reuse the profile one if visible?
        // Better to have a dedicated feedback for interview.

        const btn = document.activeElement; // The button clicked
        const originalText = btn.innerText;

        // Show loading/success state on button itself
        btn.innerText = '✓ Guardado';
        btn.style.background = '#2a7d4e'; // Success green

        setTimeout(() => {
            btn.innerText = originalText;
            btn.style.background = ''; // Reset to default (gold)
        }, 2000);
    }

    generatePDF(e) {
        e.preventDefault();

        // VIP User Check
        if (this.session.user === 'nestor.guerra@gmail.com') {
            const link = document.createElement('a');
            link.href = 'caronte.pdf';
            link.download = 'caronte.pdf';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            return;
        }

        // Ensure jsPDF is loaded
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({
            orientation: 'portrait',
            unit: 'mm',
            format: 'a4'
        });

        // Background (Deep Black)
        doc.setFillColor(10, 10, 11); // #0A0A0B
        doc.rect(0, 0, 210, 297, 'F');

        // Font Setup (Standard serif as fallback)
        doc.setFont("times", "roman");

        // Title: CARONTE
        doc.setTextColor(201, 169, 98); // #C9A962 (Gold)
        doc.setFontSize(40);
        doc.text("CARONTE", 105, 120, { align: "center" });

        // Author Name
        const profile = JSON.parse(localStorage.getItem(this.profileKey) || '{}');
        const name = profile.name || "Usuario";

        doc.setFontSize(16);
        doc.setTextColor(245, 245, 243); // #F5F5F3 (White Warm)
        doc.text(name.toUpperCase(), 105, 140, { align: "center" });

        // Footer / Subtitle
        doc.setFontSize(10);
        doc.setTextColor(160, 160, 168); // #A0A0A8 (Gray Text)
        doc.text("EDICIÓN PERSONALIZADA", 105, 250, { align: "center" });

        // Save
        doc.save("portada_caronte.pdf");
    }
    async generateEPUB(e) {
        e.preventDefault();

        // VIP User Check
        if (this.session.user === 'nestor.guerra@gmail.com') {
            const link = document.createElement('a');
            link.href = 'caronte.epub';
            link.download = 'caronte.epub';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            return;
        }

        const zip = new JSZip();

        // 1. Mimetype (must be first, no compression)
        zip.file("mimetype", "application/epub+zip", { compression: "STORE" });

        // 2. Container.xml
        zip.folder("META-INF").file("container.xml", `<?xml version="1.0"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
    <rootfiles>
        <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
    </rootfiles>
</container>`);

        // 3. User Data
        const profile = JSON.parse(localStorage.getItem(this.profileKey) || '{}');
        const name = profile.name || "Usuario";

        // 4. Content.opf
        const opfContent = `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" unique-identifier="BookId" version="3.0">
    <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
        <dc:title>Caronte: Edición Personalizada</dc:title>
        <dc:creator>${name}</dc:creator>
        <dc:language>es</dc:language>
        <dc:identifier id="BookId">urn:uuid:caronte-user-${Date.now()}</dc:identifier>
    </metadata>
    <manifest>
        <item id="cover" href="cover.xhtml" media-type="application/xhtml+xml"/>
        <item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>
    </manifest>
    <spine toc="ncx">
        <itemref idref="cover"/>
    </spine>
</package>`;

        // 5. TOC.ncx
        const ncxContent = `<?xml version="1.0" encoding="UTF-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
    <head><meta name="dtb:uid" content="urn:uuid:caronte-user"/></head>
    <docTitle><text>Caronte</text></docTitle>
    <navMap>
        <navPoint id="navPoint-1" playOrder="1">
            <navLabel><text>Portada</text></navLabel>
            <content src="cover.xhtml"/>
        </navPoint>
    </navMap>
</ncx>`;

        // 6. Cover XHTML
        const coverContent = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
    <title>Caronte</title>
    <style>
        body { background-color: #0A0A0B; color: #F5F5F3; font-family: serif; text-align: center; height: 100vh; display: flex; flex-direction: column; justify-content: center; }
        h1 { color: #C9A962; font-size: 3em; margin-bottom: 0.5em; }
        h2 { font-size: 1.5em; font-weight: normal; }
        p { color: #A0A0A8; margin-top: 2em; font-size: 0.8em; }
    </style>
</head>
<body>
    <h1>CARONTE</h1>
    <h2>${name}</h2>
    <p>EDICIÓN PERSONALIZADA</p>
</body>
</html>`;

        const oebps = zip.folder("OEBPS");
        oebps.file("content.opf", opfContent);
        oebps.file("toc.ncx", ncxContent);
        oebps.file("cover.xhtml", coverContent);

        // Generate
        const blob = await zip.generateAsync({ type: "blob" });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = "portada_caronte.epub";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
}

// Global functions for HTML events
// Global functions for HTML events
let dashboardInstance; // Renamed to avoid confusion with class name

// JS for Sidebar
window.toggleSidebar = function () {
    console.log('Toggle Sidebar clicked');
    const sidebar = document.getElementById('sidebar');
    const overlay = document.querySelector('.sidebar-overlay');
    if (sidebar && overlay) {
        sidebar.classList.toggle('open');
        overlay.classList.toggle('active');
    }
}

// Close sidebar when clicking a link on mobile
window.switchTab = function (tabId) {
    console.log('Switch Tab requested for:', tabId);

    // DIRECT DOM MANIPULATION - No class dependency, no redirects!
    // Hide all sections
    document.querySelectorAll('.section-content').forEach(el => el.classList.remove('active'));
    // Remove active from all buttons
    document.querySelectorAll('.nav-btn').forEach(el => el.classList.remove('active'));

    // Show selected section
    const section = document.getElementById(`${tabId}-section`);
    if (section) section.classList.add('active');

    // Activate correct button
    document.querySelectorAll('.nav-btn').forEach(btn => {
        const onclick = btn.getAttribute('onclick');
        if (onclick && onclick.includes(`'${tabId}'`)) {
            btn.classList.add('active');
        }
    });

    // Auto-close on mobile
    if (window.innerWidth <= 768) {
        window.toggleSidebar();
    }
}

window.handlePhotoUpload = function (input) { if (dashboardInstance) dashboardInstance.handlePhotoUpload(input); }
window.saveProfile = function (e) { if (dashboardInstance) dashboardInstance.saveProfile(e); }
window.saveInterview = function () { if (dashboardInstance) dashboardInstance.saveInterview(); }
window.downloadPDF = function (e) { if (dashboardInstance) dashboardInstance.generatePDF(e); }
window.downloadEPUB = function (e) { if (dashboardInstance) dashboardInstance.generateEPUB(e); }
window.autoSaveAnswer = function (index) { if (dashboardInstance) dashboardInstance.autoSaveAnswer(index); } // Added missing wrapper

window.logout = function () {
    localStorage.removeItem(AUTH_KEY);
    window.location.href = 'index.html';
}

// Init
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM Content Loaded - Initializing Dashboard');
    try {
        dashboardInstance = new Dashboard();
        console.log('Dashboard initialized:', dashboardInstance);
    } catch (e) {
        console.error('Error constructing Dashboard:', e);
    }

    // FALLBACK: If no questions were rendered, render them directly
    const container = document.getElementById('questions-container');
    if (container && container.querySelectorAll('.question-card').length === 0) {
        console.log('Fallback: Rendering questions directly');
        QUESTIONS.forEach((q, index) => {
            const html = `
                <div class="question-card">
                    <div class="question-title">Pregunta ${index + 1} / ${QUESTIONS.length}</div>
                    <div class="question-text">${q}</div>
                    <textarea class="answer-area" id="q-${index}" 
                        oninput="autoSaveAnswer(${index})" 
                        placeholder="Escribe tu respuesta aquí..."></textarea>
                </div>
            `;
            container.innerHTML += html;
        });

        // Load any saved answers
        const savedAnswers = JSON.parse(localStorage.getItem('caronte_answers_demo@caronte.com') || '{}');
        Object.keys(savedAnswers).forEach(key => {
            const el = document.getElementById(`q-${key}`);
            if (el) el.value = savedAnswers[key];
        });
    }
});
