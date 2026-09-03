import { config, hasBackendConfig } from './config.js';

const TOKEN_KEY = 'licitia_access_token';
const REFRESH_KEY = 'licitia_refresh_token';
const USER_KEY = 'licitia_user';

function authHeaders(token = getAccessToken()) {
  const headers = {
    'Content-Type': 'application/json'
  };
  if (config.supabaseAnonKey) headers.apikey = config.supabaseAnonKey;
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

function authRedirectTo() {
  const path = window.location.pathname.replace(/[^/]*$/, 'acceso.html');
  return `${window.location.origin}${path}`;
}

function cleanAuthUrl(extraSearch = '') {
  const next = `${window.location.pathname}${extraSearch}`;
  window.history.replaceState({}, document.title, next);
}

async function storeSession(data) {
  const accessToken = data?.access_token || data?.session?.access_token || '';
  const refreshToken = data?.refresh_token || data?.session?.refresh_token || '';
  const user = data?.user || data?.session?.user || null;
  if (!accessToken) return null;
  sessionStorage.setItem(TOKEN_KEY, accessToken);
  sessionStorage.setItem(REFRESH_KEY, refreshToken || '');
  if (user) {
    sessionStorage.setItem(USER_KEY, JSON.stringify(user));
    return user;
  }
  return getCurrentUser();
}

async function parseResponse(resp) {
  const text = await resp.text();
  const data = text ? JSON.parse(text) : null;
  if (!resp.ok) {
    const message = data?.error_description || data?.msg || data?.message || data?.error || `HTTP ${resp.status}`;
    throw new Error(message);
  }
  return data;
}

export function getAccessToken() {
  return sessionStorage.getItem(TOKEN_KEY) || '';
}

export function getStoredUser() {
  try {
    return JSON.parse(sessionStorage.getItem(USER_KEY) || 'null');
  } catch {
    return null;
  }
}

export function clearSession() {
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(REFRESH_KEY);
  sessionStorage.removeItem(USER_KEY);
}

export async function signUp({ email, password, fullName }) {
  if (!hasBackendConfig()) throw new Error('Configura Supabase antes de registrar usuarios reales.');
  const resp = await fetch(`${config.supabaseUrl}/auth/v1/signup?redirect_to=${encodeURIComponent(authRedirectTo())}`, {
    method: 'POST',
    headers: authHeaders(''),
    body: JSON.stringify({
      email,
      password,
      data: { full_name: fullName || '' }
    })
  });
  return parseResponse(resp);
}

export async function signIn({ email, password }) {
  if (!hasBackendConfig()) throw new Error('Configura Supabase antes de iniciar sesion.');
  const resp = await fetch(`${config.supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: authHeaders(''),
    body: JSON.stringify({ email, password })
  });
  const data = await parseResponse(resp);
  await storeSession(data);
  return data;
}

export async function requestPasswordReset({ email }) {
  if (!hasBackendConfig()) throw new Error('Configura Supabase antes de recuperar contrasena.');
  const redirectTo = authRedirectTo();
  const resp = await fetch(`${config.supabaseUrl}/auth/v1/recover?redirect_to=${encodeURIComponent(redirectTo)}`, {
    method: 'POST',
    headers: authHeaders(''),
    body: JSON.stringify({ email })
  });
  return parseResponse(resp);
}

export async function verifyTokenHash({ tokenHash, type = 'email' }) {
  if (!hasBackendConfig()) throw new Error('Configura Supabase antes de verificar el email.');
  const resp = await fetch(`${config.supabaseUrl}/auth/v1/verify`, {
    method: 'POST',
    headers: authHeaders(''),
    body: JSON.stringify({
      token_hash: tokenHash,
      type
    })
  });
  const data = await parseResponse(resp);
  await storeSession(data);
  return data;
}

export async function consumeAuthRedirect() {
  const hash = new URLSearchParams(window.location.hash.startsWith('#') ? window.location.hash.slice(1) : '');
  const query = new URLSearchParams(window.location.search);
  const error = hash.get('error_description') || query.get('error_description') || hash.get('error') || query.get('error');
  if (error) {
    clearSession();
    cleanAuthUrl('');
    throw new Error(error.replace(/\+/g, ' '));
  }
  const accessToken = hash.get('access_token') || query.get('access_token');
  if (!accessToken) {
    if (query.get('confirmed') === '1') cleanAuthUrl('?confirmed=1');
    return null;
  }
  const data = {
    access_token: accessToken,
    refresh_token: hash.get('refresh_token') || query.get('refresh_token') || '',
    token_type: hash.get('token_type') || query.get('token_type') || 'bearer',
    expires_in: hash.get('expires_in') || query.get('expires_in') || '',
    type: hash.get('type') || query.get('type') || ''
  };
  const user = await storeSession(data);
  cleanAuthUrl('?confirmed=1');
  return { user, type: data.type };
}

export async function getCurrentUser() {
  const token = getAccessToken();
  if (!token) return null;
  const resp = await fetch(`${config.supabaseUrl}/auth/v1/user`, {
    headers: authHeaders(token)
  });
  const data = await parseResponse(resp);
  const user = data?.user || data;
  sessionStorage.setItem(USER_KEY, JSON.stringify(user));
  return user;
}

export async function updateCurrentUser({ fullName }) {
  const token = getAccessToken();
  if (!token || !hasBackendConfig()) throw new Error('No hay sesion activa para actualizar el usuario.');
  const resp = await fetch(`${config.supabaseUrl}/auth/v1/user`, {
    method: 'PUT',
    headers: authHeaders(token),
    body: JSON.stringify({
      data: {
        full_name: String(fullName || '').trim()
      }
    })
  });
  const data = await parseResponse(resp);
  const user = data?.user || data;
  sessionStorage.setItem(USER_KEY, JSON.stringify(user));
  return user;
}

export async function signOut() {
  const token = getAccessToken();
  if (token && config.supabaseUrl) {
    await fetch(`${config.supabaseUrl}/auth/v1/logout`, {
      method: 'POST',
      headers: authHeaders(token)
    }).catch(() => null);
  }
  clearSession();
}

export async function callFunction(name, payload = {}, { timeoutMs = 0 } = {}) {
  if (!hasBackendConfig()) throw new Error('Faltan variables publicas de backend.');
  const controller = timeoutMs > 0 ? new AbortController() : null;
  const timeoutId = controller
    ? window.setTimeout(() => controller.abort(), timeoutMs)
    : null;

  try {
    const resp = await fetch(`${config.functionsBaseUrl}/${name}`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(payload),
      signal: controller?.signal
    });
    return await parseResponse(resp);
  } catch (error) {
    if (controller?.signal.aborted) {
      throw new Error(`${name}_timeout`);
    }
    throw error;
  } finally {
    if (timeoutId !== null) window.clearTimeout(timeoutId);
  }
}

export async function getOnboardingState() {
  return callFunction('onboarding-state', {});
}

export async function completeOnboarding(payload) {
  return callFunction('complete-onboarding', payload);
}

export async function updateCompanyProfile(payload) {
  return callFunction('update-company-profile', payload);
}

export async function recordAuditEvent(payload) {
  return callFunction('audit-event', payload);
}

export async function searchTenders(payload) {
  return callFunction('search-tenders', payload);
}

export async function getTenderDetail(payload) {
  return callFunction('tender-detail', payload);
}

export async function decisionScore(payload) {
  return callFunction('decision-score', payload);
}

export async function analyzeTender(payload) {
  return callFunction('analyze-tender', payload);
}

export async function workflowTender(payload) {
  return callFunction('workflow-tender', payload);
}

export async function systemHealth(payload = {}) {
  return callFunction('system-health', payload);
}

export async function proposalCopilot(payload) {
  return callFunction('proposal-copilot', payload);
}

export async function proposalReview(payload) {
  return callFunction('proposal-review', payload);
}

export async function competitiveIntel(payload = {}) {
  return callFunction('competitive-intel', payload);
}

export async function documentDossier(payload) {
  return callFunction('document-dossier', payload);
}

export async function opsAdmin(payload = {}) {
  return callFunction('ops-admin', payload);
}

export async function observabilityEvent(payload = {}) {
  return callFunction('observability-event', payload);
}

export async function trackTender(payload) {
  return callFunction('track-tender', payload);
}

export async function runAlerts(payload = {}) {
  return callFunction('run-alerts', payload);
}

export async function healthCheck() {
  if (!config.functionsBaseUrl) return { ok: false, message: 'Backend no configurado' };
  const resp = await fetch(`${config.functionsBaseUrl}/health`, {
    headers: authHeaders('')
  });
  return parseResponse(resp);
}
