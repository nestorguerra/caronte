import { config, getConfigIssues, hasBackendConfig } from './config.js';
import {
  clearSession,
  completeOnboarding,
  consumeAuthRedirect,
  getCurrentUser,
  getOnboardingState,
  observabilityEvent,
  recordAuditEvent,
  requestPasswordReset,
  signIn,
  signOut,
  signUp
} from './api-client.js';
import { qs, qsa, readForm, setBusy, setText, show } from './dom.js';

const state = {
  user: null,
  currentStep: 1,
  organization: null,
  companyProfile: null,
  savedSearches: [],
  alertRule: null,
  invitations: []
};

function setNotice(message, isError = false) {
  const notice = qs('#authNotice');
  if (!notice) return;
  notice.textContent = message || '';
  notice.classList.toggle('is-error', Boolean(isError));
  notice.hidden = !message;
}

function trackAnonymousProductEvent(eventName, metadata = {}) {
  observabilityEvent({
    source: 'frontend',
    severity: 'info',
    message: `product_event:${eventName}`,
    context: {
      event: eventName,
      surface: 'access',
      ...metadata
    }
  }).catch(() => null);
}

function activateAuthTab(tabName) {
  qsa('[data-auth-tab]').forEach((btn) => {
    btn.classList.toggle('is-active', btn.dataset.authTab === tabName);
  });
  qsa('[data-auth-panel]').forEach((panel) => {
    panel.hidden = panel.dataset.authPanel !== tabName;
  });
}

function activateStep(step) {
  state.currentStep = step;
  qsa('[data-onboarding-step]').forEach((panel) => {
    panel.hidden = Number(panel.dataset.onboardingStep) !== step;
  });
  qsa('[data-step-indicator]').forEach((indicator) => {
    const indicatorStep = Number(indicator.dataset.stepIndicator);
    indicator.classList.toggle('is-active', indicatorStep === step);
    indicator.classList.toggle('is-done', indicatorStep < step);
  });
}

function updateBackendStatus() {
  const issues = getConfigIssues();
  const status = hasBackendConfig()
    ? `Backend configurado · ${config.appEnv}`
    : `Pendiente de backend: ${issues.join(', ')}`;
  setText('#backendStatus', status);
}

function list(value) {
  return String(value || '').split(',').map((item) => item.trim()).filter(Boolean);
}

function lines(value) {
  return String(value || '').split(/\n|,/).map((item) => item.trim()).filter(Boolean);
}

function euroCents(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed * 100) : null;
}

function completionFromProfile(data) {
  const checks = [
    data.organizationName,
    data.sector,
    data.servicesDescription,
    data.targetSignal,
    list(data.regions).length,
    data.amountMin || data.amountMax
  ];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}

function updateProfileProgress(form) {
  const progress = completionFromProfile(readForm(form));
  setText('#profileProgressValue', `${progress}%`);
  const bar = qs('#profileProgressBar');
  if (bar) bar.style.width = `${progress}%`;
}

async function openOnboardingOrApp() {
  try {
    const remoteState = await getOnboardingState();
    if (remoteState?.onboardingComplete) {
      window.location.href = './app.html';
      return;
    }
  } catch {
    // If the state endpoint is unavailable, keep the user in onboarding.
  }
  show('#authShell', false);
  show('#onboardingShell', true);
  activateStep(1);
  recordAuditEvent({ action: 'onboarding.started' }).catch(() => null);
}

async function handleRegister(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const data = readForm(form);
  setBusy(form, true);
  setNotice('');
  try {
    trackAnonymousProductEvent('signup_started');
    await signUp({
      email: data.email,
      password: data.password,
      fullName: data.fullName
    });
    setNotice('Cuenta creada. Te hemos enviado un correo de LicitIA para confirmar el email. Al abrir el enlace volveras aqui.');
    activateAuthTab('login');
  } catch (error) {
    setNotice(error.message, true);
  } finally {
    setBusy(form, false);
  }
}

async function handleLogin(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const data = readForm(form);
  setBusy(form, true);
  setNotice('');
  try {
    const session = await signIn({ email: data.email, password: data.password });
    state.user = session.user;
    setText('#onboardingUserEmail', state.user?.email || data.email);
    await recordAuditEvent({ action: 'auth.login' }).catch(() => null);
    await openOnboardingOrApp();
  } catch (error) {
    setNotice(error.message, true);
  } finally {
    setBusy(form, false);
  }
}

async function handleRecover(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const data = readForm(form);
  setBusy(form, true);
  setNotice('');
  try {
    await requestPasswordReset({ email: data.email });
    setNotice('Te hemos enviado un enlace para recuperar la contrasena si el email existe en LicitIA.');
    activateAuthTab('login');
  } catch (error) {
    setNotice(error.message, true);
  } finally {
    setBusy(form, false);
  }
}

function extractCpvCodes(value) {
  return list(value)
    .map((item) => item.match(/\d{4,8}/)?.[0] || '')
    .filter(Boolean);
}

async function handleQuickOnboarding(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const data = readForm(form);
  const cpvCodes = extractCpvCodes(data.targetSignal);
  const targetSignals = cpvCodes.length ? cpvCodes : list(data.targetSignal);
  const query = [data.servicesDescription, data.targetSignal, data.sector].map((item) => String(item || '').trim()).filter(Boolean).join(' ');
  state.organization = {
    name: data.organizationName,
    tax_id: data.taxId || null,
    country: 'ES',
    sector: data.sector || ''
  };
  state.companyProfile = {
    legal_name: data.organizationName,
    trade_name: data.organizationName,
    tax_id: data.taxId || null,
    sectors: list(data.sector),
    cnae: null,
    services_description: data.servicesDescription || '',
    target_cpvs: targetSignals,
    certifications: [],
    business_classification: '',
    annual_revenue_range: '',
    employee_range: '',
    years_experience: null,
    operating_regions: list(data.regions),
    min_contract_value_cents: euroCents(data.amountMin),
    max_contract_value_cents: euroCents(data.amountMax),
    target_contract_types: [],
    preferences: {
      quick_onboarding: true,
      search_terms: list(data.targetSignal),
      onboarding_progress: completionFromProfile(data)
    }
  };
  state.savedSearches = [{
    name: `Busqueda inicial: ${data.sector || data.organizationName}`,
    query,
    filters: {
      cpv: cpvCodes,
      territory: data.regions || '',
      amount_min_cents: euroCents(data.amountMin),
      amount_max_cents: euroCents(data.amountMax),
      only_open: true
    }
  }];
  state.alertRule = {
    cadence: 'daily',
    channels: { email: true }
  };
  state.invitations = [];
  if (data.acceptLegal !== 'on') {
    setText('#freePlanMessage', 'Tienes que aceptar terminos, privacidad y aviso de IA para activar la beta.');
    show('#freePlanMessage', true);
    return;
  }
  setBusy(form, true);
  setText('#freePlanMessage', config.freeBetaMessage);
  show('#freePlanMessage', true);
  try {
    const completed = await completeOnboarding({
      organization: state.organization,
      companyProfile: state.companyProfile,
      savedSearches: state.savedSearches,
      alertRule: state.alertRule,
      invitations: state.invitations,
      legalAcceptance: {
        accepted: true,
        termsVersion: 'beta-2026-04',
        privacyVersion: 'beta-2026-04',
        aiNoticeVersion: 'beta-2026-04',
        communicationsConsent: data.communicationsConsent === 'on'
      }
    });
    await recordAuditEvent({
      action: 'onboarding_completed',
      organizationId: completed.organizationId,
      resourceType: 'organization',
      resourceId: completed.organizationId,
      metadata: {
        saved_searches: Number(completed.savedSearches?.requested || 0),
        payments_required: false
      }
    }).catch(() => null);
    setText('#freePlanMessage', `${config.freeBetaMessage} Preparando tu cockpit...`);
    setTimeout(() => {
      window.location.href = './app.html';
    }, 900);
  } catch (error) {
    setText('#freePlanMessage', error.message);
    qs('#freePlanMessage')?.classList.add('is-error');
  } finally {
    setBusy(form, false);
  }
}

async function restoreSession() {
  try {
    const redirectResult = await consumeAuthRedirect();
    if (redirectResult?.user) {
      setNotice('Email confirmado. Ya puedes completar las 7 preguntas y empezar.');
    } else if (new URLSearchParams(window.location.search).get('confirmed') === '1') {
      setNotice('Email confirmado. Inicia sesion para terminar las 7 preguntas.');
    }
    state.user = await getCurrentUser();
    if (!state.user) return;
    setText('#onboardingUserEmail', state.user.email || '');
    await openOnboardingOrApp();
  } catch {
    clearSession();
    setNotice('No hemos podido confirmar la sesion desde el enlace. Prueba a iniciar sesion con tu email y contrasena.', true);
  }
}

export function initAuthFlow() {
  updateBackendStatus();
  setText('#freePlanCopy', config.freeBetaMessage);
  qsa('[data-auth-tab]').forEach((btn) => {
    btn.addEventListener('click', () => activateAuthTab(btn.dataset.authTab));
  });
  qs('#registerForm')?.addEventListener('submit', handleRegister);
  qs('#loginForm')?.addEventListener('submit', handleLogin);
  qs('#recoverForm')?.addEventListener('submit', handleRecover);
  qs('#quickOnboardingForm')?.addEventListener('submit', handleQuickOnboarding);
  qs('#quickOnboardingForm')?.addEventListener('input', (event) => updateProfileProgress(event.currentTarget));
  qs('#logoutButton')?.addEventListener('click', async () => {
    await recordAuditEvent({ action: 'auth.logout' }).catch(() => null);
    await signOut();
    window.location.reload();
  });
  restoreSession();
}
