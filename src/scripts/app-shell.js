import { getConfigIssues, hasBackendConfig } from './config.js';
import {
  analyzeTender,
  competitiveIntel,
  decisionScore,
  documentDossier,
  getCurrentUser,
  getTenderDetail,
  getOnboardingState,
  healthCheck,
  observabilityEvent,
  opsAdmin,
  recordAuditEvent,
  proposalCopilot,
  proposalReview,
  runAlerts,
  searchTenders,
  signOut,
  systemHealth,
  trackTender,
  updateCurrentUser,
  updateCompanyProfile,
  workflowTender
} from './api-client.js';
import { qs, readForm, setBusy, setText } from './dom.js';

const state = {
  user: null,
  onboarding: null,
  lastResults: [],
  selectedTender: null,
  selectedDetail: null,
  lastAnalysis: null,
  lastWorkflow: null,
  lastProposal: null,
  lastDossier: null,
  lastCompetitive: null,
  lastOps: null,
  canUseOperations: null,
  userSettings: {},
  aiSettings: {},
  selectedTenderIds: new Set()
};

const USER_SETTINGS_KEY = 'licitia_user_settings';
const AI_SETTINGS_KEY = 'licitia_ai_settings';
const GPT_MODEL_OPTIONS = [
  { id: 'gpt-5.5', label: 'GPT-5.5' },
  { id: 'gpt-5.4', label: 'GPT-5.4' },
  { id: 'gpt-5.4-mini', label: 'GPT-5.4 mini' }
];
const DEFAULT_GPT_MODEL = GPT_MODEL_OPTIONS[0].id;

async function requireSession() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      window.location.href = './acceso.html';
      return null;
    }
    return user;
  } catch {
    window.location.href = './acceso.html';
    return null;
  }
}

async function loadHealth() {
  const status = qs('#systemStatus');
  if (!status) return;
  if (!hasBackendConfig()) {
    status.textContent = `Pendiente de configurar backend: ${getConfigIssues().join(', ')}`;
    status.classList.add('is-warning');
    return;
  }
  try {
    const health = await healthCheck();
    status.textContent = health.ok ? 'API operativa' : (health.message || 'API sin confirmar');
    status.classList.toggle('is-warning', !health.ok);
  } catch (error) {
    status.textContent = `API no disponible: ${error.message}`;
    status.classList.add('is-warning');
  }
}

async function loadSystemHealth() {
  const target = qs('#systemHealthPanel');
  const stateLabel = qs('#healthState');
  if (!target) return;
  target.replaceChildren(row('Cargando salud operativa...', ''));
  try {
    const health = await systemHealth({});
    stateLabel && (stateLabel.textContent = health.state === 'ok' ? 'Operativo' : 'Revisar');
    stateLabel?.classList.toggle('is-warning', health.state !== 'ok');
    target.replaceChildren();
    const checks = health.checks || {};
    [
      ['API', checks.api || '-'],
      ['Base de datos', checks.database || '-'],
      ['Ingesta oficial', checks.ingestion || '-'],
      ['Notificaciones', checks.notifications || '-'],
      ['IA', checks.ai || '-'],
      ['Alertas activas', String(health.workload?.activeAlerts || 0)],
      ['Oportunidades seguidas', String(health.workload?.trackedTenders || 0)],
      ['Tareas pendientes', String(health.workload?.pendingTasks || 0)]
    ].forEach(([title, detail]) => target.append(row(title, detail)));
  } catch (error) {
    stateLabel && (stateLabel.textContent = 'Sin permisos o error');
    target.replaceChildren(row('No se pudo cargar salud del sistema', error.message));
  }
}

function moneyFromCents(cents) {
  const value = Number(cents || 0);
  if (!value) return '';
  return String(Math.round(value / 100));
}

function join(value) {
  return Array.isArray(value) ? value.join(', ') : String(value || '');
}

function row(title, detail) {
  const item = document.createElement('div');
  item.className = 'data-row';
  const strong = document.createElement('strong');
  strong.textContent = title;
  const span = document.createElement('span');
  span.textContent = detail;
  item.append(strong, span);
  return item;
}

function button(label, onClick, variant = 'secondary-button') {
  const el = document.createElement('button');
  el.type = 'button';
  el.className = variant;
  el.textContent = label;
  el.addEventListener('click', onClick);
  return el;
}

function showToast(message, tone = 'info') {
  const region = qs('#toastRegion');
  if (!region) return;
  const toast = document.createElement('div');
  toast.className = `toast toast-${tone}`;
  toast.textContent = message;
  region.append(toast);
  window.setTimeout(() => {
    toast.classList.add('is-hiding');
    window.setTimeout(() => toast.remove(), 220);
  }, 4200);
}

function safeErrorMessage(error) {
  const message = String(error?.message || error || '');
  if (/permission|permis|role|forbidden|unauthorized|insufficient/i.test(message)) {
    return 'No tienes permisos para esta accion con tu rol actual.';
  }
  if (/network|fetch|failed|http|jwt|token|edge|supabase|relation|column/i.test(message)) {
    return 'No se ha podido completar la accion. Reintenta y, si sigue pasando, revisa el panel de errores.';
  }
  return message || 'No se ha podido completar la accion.';
}

function renderEmptyState(title, detail, action = null) {
  const empty = document.createElement('div');
  empty.className = 'empty-state empty-state-actionable';
  empty.append(textBlock('strong', title), textBlock('p', detail));
  if (action) {
    const actions = document.createElement('div');
    actions.className = 'action-row';
    actions.append(action);
    empty.append(actions);
  }
  return empty;
}

function renderErrorState(target, title, error, retry) {
  if (!target) return;
  target.replaceChildren(renderEmptyState(title, safeErrorMessage(error), retry ? button('Reintentar', retry, 'secondary-button') : null));
  showToast(safeErrorMessage(error), 'error');
}

function renderSkeleton(target, rows = 3, className = 'skeleton-row') {
  if (!target) return;
  target.replaceChildren();
  Array.from({ length: rows }).forEach(() => {
    const item = document.createElement('div');
    item.className = className;
    item.setAttribute('aria-hidden', 'true');
    target.append(item);
  });
}

function cleanMetricMetadata(metadata = {}) {
  return Object.fromEntries(Object.entries(metadata).filter(([, value]) => {
    if (value === null || value === undefined) return false;
    return ['string', 'number', 'boolean'].includes(typeof value);
  }).slice(0, 12));
}

function trackProductEvent(action, metadata = {}, resource = {}) {
  return recordAuditEvent({
    action,
    organizationId: state.onboarding?.organization?.id || null,
    resourceType: resource.resourceType || null,
    resourceId: resource.resourceId || null,
    metadata: cleanMetricMetadata(metadata)
  }).catch(() => null);
}

function getUserFullName(user = state.user) {
  return String(user?.user_metadata?.full_name || user?.raw_user_meta_data?.full_name || '').trim();
}

function displayUserName(user = state.user) {
  return getUserFullName(user) || String(user?.email || 'Usuario LicitIA');
}

function userInitials(user = state.user) {
  const label = displayUserName(user);
  const words = label.split(/\s+|@/).filter(Boolean);
  return (words[0]?.[0] || 'U').concat(words[1]?.[0] || '').toUpperCase();
}

function loadUserSettings() {
  try {
    return JSON.parse(localStorage.getItem(USER_SETTINGS_KEY) || '{}');
  } catch {
    return {};
  }
}

function normalizeGptModel(value) {
  const id = String(value || '').trim();
  return GPT_MODEL_OPTIONS.some((option) => option.id === id) ? id : DEFAULT_GPT_MODEL;
}

function gptModelLabel(value) {
  const id = normalizeGptModel(value);
  return GPT_MODEL_OPTIONS.find((option) => option.id === id)?.label || id;
}

function loadAiSettings() {
  try {
    const stored = JSON.parse(localStorage.getItem(AI_SETTINGS_KEY) || '{}');
    return {
      openaiApiKey: String(stored.openaiApiKey || ''),
      openaiModel: normalizeGptModel(stored.openaiModel)
    };
  } catch {
    return { openaiApiKey: '', openaiModel: DEFAULT_GPT_MODEL };
  }
}

function saveAiSettings(settings = {}) {
  state.aiSettings = {
    openaiApiKey: String(settings.openaiApiKey || '').trim(),
    openaiModel: normalizeGptModel(settings.openaiModel)
  };
  localStorage.setItem(AI_SETTINGS_KEY, JSON.stringify(state.aiSettings));
}

function proposalAiPayload() {
  const model = normalizeGptModel(state.aiSettings.openaiModel);
  const payload = { openaiModel: model };
  const apiKey = String(state.aiSettings.openaiApiKey || '').trim();
  if (apiKey) payload.openaiApiKey = apiKey;
  return payload;
}

function saveUserSettings(settings) {
  state.userSettings = {
    defaultView: settings.defaultView || 'hoy',
    density: settings.density || 'comfortable',
    notificationCadence: settings.notificationCadence || 'daily'
  };
  localStorage.setItem(USER_SETTINGS_KEY, JSON.stringify(state.userSettings));
  applyUserSettings();
}

function applyUserSettings() {
  document.body.dataset.density = state.userSettings.density || 'comfortable';
}

function renderUserIdentity() {
  const name = displayUserName();
  const email = state.user?.email || 'usuario';
  setText('#userDisplayName', name);
  setText('#userMenuEmail', email);
  setText('#userEmailMetric', name);
  setText('#userInitials', userInitials());
}

function displayPlanName(subscription = {}) {
  const raw = String(subscription?.plans?.name || subscription?.status || 'Beta gratuita').trim();
  if (!raw) return 'Beta gratuita';
  if (/beta gratuita/i.test(raw)) return 'Beta gratuita';
  return raw;
}

function fillAccountSettingsForm() {
  const form = qs('#accountSettingsForm');
  if (!form) return;
  form.elements.fullName.value = getUserFullName() || '';
  form.elements.defaultView.value = state.userSettings.defaultView || 'hoy';
  form.elements.density.value = state.userSettings.density || 'comfortable';
  form.elements.notificationCadence.value = state.userSettings.notificationCadence || 'daily';
  const email = qs('#accountEmail');
  if (email) email.value = state.user?.email || '';
}

function fillAiSettingsForm() {
  const form = qs('#aiSettingsForm');
  if (!form) return;
  form.elements.openaiApiKey.value = state.aiSettings.openaiApiKey || '';
  form.elements.openaiModel.value = normalizeGptModel(state.aiSettings.openaiModel);
}

function renderSystemSettings() {
  const target = qs('#systemSettingsPanel');
  if (!target) return;
  const membership = state.onboarding?.membership || {};
  const subscription = state.onboarding?.subscription || {};
  const planName = displayPlanName(subscription);
  target.replaceChildren(
    textBlock('h3', 'Configuracion del sistema'),
    row('Rol', membership.role || 'usuario'),
    row('Plan', planName),
    row('Backend', hasBackendConfig() ? 'Configurado' : `Pendiente: ${getConfigIssues().join(', ')}`),
    row('GPT', state.aiSettings.openaiApiKey ? 'Clave local configurada' : 'Sin clave local'),
    row('Modelo GPT', gptModelLabel(state.aiSettings.openaiModel)),
    row('Vista inicial', state.userSettings.defaultView || 'hoy'),
    row('Densidad', state.userSettings.density === 'compact' ? 'Compacta' : 'Comoda')
  );
}

function closeUserMenu() {
  const buttonEl = qs('#userMenuButton');
  const panel = qs('#userMenuPanel');
  if (!buttonEl || !panel) return;
  buttonEl.setAttribute('aria-expanded', 'false');
  panel.hidden = true;
}

function openSettingsAnchor(anchorId) {
  showView(anchorId === 'operaciones' ? 'operaciones' : 'ajustes');
  window.setTimeout(() => {
    const target = qs(`#${anchorId}`);
    target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    target?.focus?.({ preventScroll: true });
  }, 0);
}

function setupUserMenu() {
  const buttonEl = qs('#userMenuButton');
  const panel = qs('#userMenuPanel');
  if (!buttonEl || !panel) return;
  buttonEl.addEventListener('click', (event) => {
    event.stopPropagation();
    const nextOpen = panel.hidden;
    panel.hidden = !nextOpen;
    buttonEl.setAttribute('aria-expanded', nextOpen ? 'true' : 'false');
  });
  panel.addEventListener('click', (event) => {
    const action = event.target.closest('[data-user-menu-action]')?.dataset.userMenuAction;
    if (!action) return;
    const targets = {
      cuenta: 'cuenta',
      empresa: 'ajustes',
      equipo: 'equipo',
      sistema: 'cuenta',
      operaciones: 'operaciones'
    };
    closeUserMenu();
    openSettingsAnchor(targets[action] || 'cuenta');
  });
  document.addEventListener('click', (event) => {
    if (event.target.closest('.user-menu')) return;
    closeUserMenu();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeUserMenu();
  });
}

function setActiveNav(targetId) {
  document.querySelectorAll('[data-nav-link]').forEach((link) => {
    const active = link.getAttribute('data-nav-link') === targetId;
    link.classList.toggle('is-active', active);
    if (active) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });
}

const viewTitles = {
  hoy: 'Hoy',
  oportunidades: 'Oportunidades',
  expedientes: 'Expedientes',
  propuestas: 'Propuestas',
  inteligencia: 'Inteligencia',
  operaciones: 'Operaciones',
  ajustes: 'Ajustes'
};

const viewAliases = {
  cockpit: 'hoy',
  alertas: 'hoy',
  equipo: 'ajustes'
};

function panelMatches(panel, targetId) {
  return String(panel.getAttribute('data-view-panel') || '').split(/\s+/).includes(targetId);
}

function showView(targetId, options = {}) {
  const normalized = viewAliases[targetId] || targetId;
  let next = viewTitles[normalized] ? normalized : 'hoy';
  if (next === 'operaciones' && state.canUseOperations === false) {
    next = 'hoy';
    showToast('Operaciones esta disponible solo para owner/admin.', 'warning');
  }
  document.querySelectorAll('[data-view-panel]').forEach((panel) => {
    const adminOnly = panel.hasAttribute('data-admin-only');
    panel.hidden = (adminOnly && state.canUseOperations !== true) || !panelMatches(panel, next);
  });
  setActiveNav(next);
  setText('#viewTitle', viewTitles[next]);
  if (options.updateUrl !== false) window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}#${next}`);
  if (options.scroll !== false) window.scrollTo({ top: 0, behavior: 'auto' });
}

function toggleAdminNavigation(canUseOperations) {
  state.canUseOperations = Boolean(canUseOperations);
  document.querySelectorAll('[data-admin-only]').forEach((node) => {
    if (!state.canUseOperations) node.hidden = true;
    else if (!node.hasAttribute('data-view-panel')) node.hidden = false;
  });
  if (!state.canUseOperations && window.location.hash === '#operaciones') {
    showView('hoy', { updateUrl: true, scroll: false });
    return;
  }
  showView(window.location.hash.replace('#', '') || 'hoy', { updateUrl: false, scroll: false });
}

function setupSidebarNavigation() {
  const links = Array.from(document.querySelectorAll('[data-nav-link]'));
  if (!links.length) return;

  qs('.app-brand')?.addEventListener('click', (event) => {
    event.preventDefault();
    showView('hoy');
  });

  links.forEach((link) => {
    link.addEventListener('click', (event) => {
      event.preventDefault();
      const targetId = link.getAttribute('data-nav-link');
      if (targetId) showView(targetId);
    });
  });

  const initialId = window.location.hash.replace('#', '');
  const defaultView = state.userSettings.defaultView || 'hoy';
  showView(initialId || defaultView, { updateUrl: Boolean(initialId), scroll: false });
}

function activateOpsTab(tabId) {
  document.querySelectorAll('[data-ops-tab]').forEach((tab) => {
    const active = tab.dataset.opsTab === tabId;
    tab.classList.toggle('is-active', active);
    tab.setAttribute('aria-selected', active ? 'true' : 'false');
  });
  document.querySelectorAll('[data-ops-panel]').forEach((panel) => {
    const active = panel.dataset.opsPanel === tabId;
    panel.classList.toggle('is-active', active);
    panel.hidden = !active;
  });
}

function setupOpsTabs() {
  const tabs = Array.from(document.querySelectorAll('[data-ops-tab]'));
  if (!tabs.length) return;
  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      activateOpsTab(tab.dataset.opsTab);
      trackProductEvent('ops_tab_changed', { tab: tab.dataset.opsTab });
    });
  });
  activateOpsTab('salud');
}

function setupGlobalSearch() {
  const form = qs('#globalSearchForm');
  const input = qs('#globalSearchInput');
  const tenderForm = qs('#tenderSearchForm');
  if (!form || !input || !tenderForm) return;
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const query = String(input.value || '').trim();
    if (tenderForm.elements.query) tenderForm.elements.query.value = query;
    showView('oportunidades');
    if (query) tenderForm.requestSubmit();
  });
}

function setupErrorTracking() {
  const seen = new Set();
  const report = (payload) => {
    const key = `${payload.message}:${payload.url || ''}`.slice(0, 180);
    if (seen.has(key)) return;
    seen.add(key);
    observabilityEvent({
      source: 'frontend',
      severity: 'error',
      organizationId: state.onboarding?.organization?.id || null,
      ...payload
    }).catch(() => null);
  };
  window.addEventListener('error', (event) => {
    report({
      message: event.message,
      stack: event.error?.stack || '',
      url: event.filename || window.location.href,
      context: { line: event.lineno, column: event.colno }
    });
  });
  window.addEventListener('unhandledrejection', (event) => {
    report({
      message: event.reason?.message || String(event.reason || 'Unhandled promise rejection'),
      stack: event.reason?.stack || '',
      url: window.location.href,
      context: { type: 'unhandledrejection' }
    });
  });
}

function eur(cents) {
  const value = Number(cents || 0);
  if (!value) return '-';
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(value / 100);
}

function dateLabel(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString('es-ES');
}

function daysUntil(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return Math.ceil((date.getTime() - Date.now()) / (24 * 60 * 60 * 1000));
}

function deadlineTone(value) {
  const days = daysUntil(value);
  if (days === null) return 'neutral';
  if (days < 0) return 'danger';
  if (days <= 7) return 'warning';
  return 'ok';
}

function statusText(tender) {
  if (tender.tracked?.internal_status) return tender.tracked.internal_status;
  if (tender.status) return tender.status;
  return 'sin seguir';
}

function createPill(text, tone = 'neutral') {
  const pill = document.createElement('span');
  pill.className = `ui-pill ui-pill-${tone}`;
  pill.textContent = text;
  return pill;
}

function tableCell(className, ...children) {
  const cell = document.createElement('div');
  cell.className = className;
  children.forEach((child) => {
    if (child === null || child === undefined) return;
    if (typeof child === 'string') cell.append(document.createTextNode(child));
    else cell.append(child);
  });
  return cell;
}

function updateOpportunitySelection() {
  const count = state.selectedTenderIds.size;
  setText('#opportunitySelectionState', count === 1 ? '1 seleccionada' : `${count} seleccionadas`);
}

function renderActiveFilterChips(payload) {
  const target = qs('#activeFilterChips');
  if (!target) return;
  target.replaceChildren();
  const filters = payload.filters || {};
  const chips = [];
  if (filters.query) chips.push(['Texto', filters.query]);
  if (filters.cpv?.length) chips.push(['CPV', filters.cpv.join(', ')]);
  if (filters.contracting_body) chips.push(['Organismo', filters.contracting_body]);
  if (filters.region) chips.push(['Territorio', filters.region]);
  if (filters.status) chips.push(['Estado', filters.status]);
  if (filters.procedure_type) chips.push(['Procedimiento', filters.procedure_type]);
  if (filters.amount_min_cents) chips.push(['Min', eur(filters.amount_min_cents)]);
  if (filters.amount_max_cents) chips.push(['Max', eur(filters.amount_max_cents)]);
  if (filters.only_open) chips.push(['Filtro', 'Solo abiertas']);
  if (filters.with_documents) chips.push(['Filtro', 'Con documentos']);
  if (!chips.length) {
    target.append(createPill('Sin filtros activos', 'neutral'));
    return;
  }
  chips.forEach(([label, value]) => target.append(createPill(`${label}: ${value}`, 'neutral')));
}

function syncOpportunityUrl(payload) {
  const params = new URLSearchParams();
  const filters = payload.filters || {};
  if (filters.query) params.set('q', filters.query);
  if (filters.cpv?.length) params.set('cpv', filters.cpv.join(','));
  if (filters.contracting_body) params.set('body', filters.contracting_body);
  if (filters.region) params.set('region', filters.region);
  if (filters.status) params.set('status', filters.status);
  if (filters.procedure_type) params.set('procedure', filters.procedure_type);
  if (filters.amount_min_cents) params.set('min', String(Math.round(filters.amount_min_cents / 100)));
  if (filters.amount_max_cents) params.set('max', String(Math.round(filters.amount_max_cents / 100)));
  if (filters.only_open) params.set('open', '1');
  if (filters.with_documents) params.set('docs', '1');
  if (payload.sort && payload.sort !== 'score') params.set('sort', payload.sort);
  const search = params.toString();
  window.history.replaceState(null, '', `${window.location.pathname}${search ? `?${search}` : ''}#oportunidades`);
}

function restoreOpportunitySearchFromUrl() {
  const form = qs('#tenderSearchForm');
  if (!form) return;
  const params = new URLSearchParams(window.location.search);
  if (params.has('q')) form.elements.query.value = params.get('q') || '';
  if (params.has('cpv')) form.elements.cpv.value = params.get('cpv') || '';
  if (params.has('body')) form.elements.contractingBody.value = params.get('body') || '';
  if (params.has('region')) form.elements.region.value = params.get('region') || '';
  if (params.has('status')) form.elements.status.value = params.get('status') || '';
  if (params.has('procedure')) form.elements.procedureType.value = params.get('procedure') || '';
  if (params.has('min')) form.elements.amountMin.value = params.get('min') || '';
  if (params.has('max')) form.elements.amountMax.value = params.get('max') || '';
  if (params.has('sort')) form.elements.sort.value = params.get('sort') || 'score';
  form.elements.onlyOpen.checked = params.get('open') !== '0';
  form.elements.withDocuments.checked = params.get('docs') === '1';
}

function markActiveTenderRow(tenderId) {
  document.querySelectorAll('[data-tender-row]').forEach((rowEl) => {
    rowEl.classList.toggle('is-selected', rowEl.getAttribute('data-tender-row') === tenderId);
  });
}

function renderList(selector, items, emptyText, mapItem) {
  const target = qs(selector);
  if (!target) return;
  target.replaceChildren();
  if (!items?.length) {
    target.append(renderEmptyState(emptyText, 'Aparecera aqui cuando haya actividad registrada.'));
    return;
  }
  items.forEach((item) => target.append(mapItem(item)));
}

function fillProfileForm(profile, organizationId) {
  const form = qs('#profileEditForm');
  if (!form || !profile) return;
  qs('#profileOrganizationId').value = organizationId || '';
  form.elements.legalName.value = profile.legal_name || '';
  form.elements.tradeName.value = profile.trade_name || '';
  form.elements.servicesDescription.value = profile.services_description || '';
  form.elements.targetCpvs.value = join(profile.target_cpvs);
  form.elements.regions.value = join(profile.operating_regions);
  form.elements.revenueRange.value = profile.annual_revenue_range || '';
  form.elements.employeeRange.value = profile.employee_range || '';
  form.elements.amountMin.value = moneyFromCents(profile.min_contract_value_cents);
  form.elements.amountMax.value = moneyFromCents(profile.max_contract_value_cents);
  form.elements.contractTypes.value = join(profile.target_contract_types);
}

function renderOnboarding(data) {
  state.onboarding = data;
  const organization = data.organization || {};
  const profile = data.companyProfile || {};
  const subscription = data.subscription || {};
  const planName = displayPlanName(subscription);
  const membershipRole = String(data.membership?.role || '').toLowerCase();
  toggleAdminNavigation(['owner', 'admin'].includes(membershipRole));
  setText('#cockpitSubtitle', organization.name ? `${organization.name} · entorno beta gratuita` : 'Onboarding pendiente');
  setText('#activeOrgName', organization.name || 'Organizacion');
  setText('#sidebarOrgName', organization.name || 'LicitIA beta');
  setText('#planStatus', planName);
  setText('#profileProgress', `${Number(profile.onboarding_progress || 0)}%`);
  setText('#savedSearchCount', String(data.savedSearches?.length || 0));
  fillAccountSettingsForm();
  fillAiSettingsForm();
  renderSystemSettings();
  fillProfileForm(profile, organization.id);

  renderList('#savedSearchList', data.savedSearches || [], 'Sin busquedas guardadas', (search) => {
    const filters = search.filters || {};
    const cpv = Array.isArray(filters.cpv) && filters.cpv.length ? ` · CPV ${filters.cpv.join(', ')}` : '';
    return row(search.name || search.query, `${search.query || ''}${cpv}`);
  });

  renderList('#invitationList', data.invitations || [], 'Sin invitaciones', (invite) => {
    return row(invite.email, `${invite.role} · ${invite.status}`);
  });

  const auditTarget = qs('#auditList');
  if (auditTarget) {
    auditTarget.replaceChildren();
    const events = data.auditEvents || [];
    if (!events.length) {
      const item = document.createElement('li');
      item.textContent = 'Sin eventos recientes';
      auditTarget.append(item);
    } else {
      events.forEach((event) => {
        const item = document.createElement('li');
        const date = new Date(event.created_at).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' });
        item.textContent = `${date} · ${event.action}`;
        auditTarget.append(item);
      });
    }
  }
}

async function loadOnboarding() {
  try {
    const data = await getOnboardingState();
    if (!data.hasOrganization) {
      window.location.href = './acceso.html';
      return;
    }
    renderOnboarding(data);
  } catch (error) {
    setText('#cockpitSubtitle', `No se pudo cargar el estado: ${error.message}`);
  }
}

async function handleAccountSettings(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const data = readForm(form);
  const nextName = String(data.fullName || '').trim();
  setBusy(form, true);
  setText('#accountSaveState', 'Guardando');
  try {
    const currentName = getUserFullName();
    if (nextName && nextName !== currentName) {
      state.user = await updateCurrentUser({ fullName: nextName });
      await recordAuditEvent({
        action: 'user_settings.updated',
        organizationId: state.onboarding?.organization?.id || null,
        metadata: { changed_name: true }
      }).catch(() => null);
    }
    saveUserSettings({
      defaultView: data.defaultView,
      density: data.density,
      notificationCadence: data.notificationCadence
    });
    renderUserIdentity();
    fillAccountSettingsForm();
    renderSystemSettings();
    setText('#accountSaveState', 'Guardado');
    showToast('Configuracion de cuenta guardada.', 'success');
  } catch (error) {
    setText('#accountSaveState', safeErrorMessage(error));
    showToast(safeErrorMessage(error), 'error');
  } finally {
    setBusy(form, false);
  }
}

async function handleAiSettings(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const data = readForm(form);
  const openaiApiKey = String(data.openaiApiKey || '').trim();
  const openaiModel = normalizeGptModel(data.openaiModel);
  setBusy(form, true);
  setText('#aiSaveState', 'Guardando');
  try {
    saveAiSettings({ openaiApiKey, openaiModel });
    fillAiSettingsForm();
    renderSystemSettings();
    await recordAuditEvent({
      action: 'user_settings.updated',
      organizationId: state.onboarding?.organization?.id || null,
      metadata: { gpt_model: openaiModel, openai_key_configured: Boolean(openaiApiKey) }
    }).catch(() => null);
    setText('#aiSaveState', 'Guardado');
    showToast('Configuracion GPT guardada.', 'success');
  } catch (error) {
    setText('#aiSaveState', safeErrorMessage(error));
    showToast(safeErrorMessage(error), 'error');
  } finally {
    setBusy(form, false);
  }
}

function handleClearAiKey() {
  saveAiSettings({ openaiApiKey: '', openaiModel: normalizeGptModel(state.aiSettings.openaiModel) });
  fillAiSettingsForm();
  renderSystemSettings();
  setText('#aiSaveState', 'Clave borrada');
  showToast('Clave GPT borrada de este navegador.', 'success');
}

async function handleProfileUpdate(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const data = readForm(form);
  setBusy(form, true);
  setText('#profileSaveState', 'Guardando');
  try {
    await updateCompanyProfile({
      organizationId: data.organizationId,
      companyProfile: {
        legal_name: data.legalName,
        trade_name: data.tradeName,
        services_description: data.servicesDescription,
        target_cpvs: data.targetCpvs,
        operating_regions: data.regions,
        annual_revenue_range: data.revenueRange,
        employee_range: data.employeeRange,
        min_contract_value_eur: data.amountMin,
        max_contract_value_eur: data.amountMax,
        target_contract_types: data.contractTypes
      }
    });
    setText('#profileSaveState', 'Guardado');
    await loadOnboarding();
  } catch (error) {
    setText('#profileSaveState', error.message);
  } finally {
    setBusy(form, false);
  }
}

function buildSearchPayload(form) {
  const data = readForm(form);
  const amountMin = Number(data.amountMin || 0);
  const amountMax = Number(data.amountMax || 0);
  return {
    sort: data.sort || 'score',
    limit: 25,
    filters: {
      query: data.query || '',
      cpv: data.cpv ? String(data.cpv).split(',').map((item) => item.trim()).filter(Boolean) : [],
      contracting_body: data.contractingBody || '',
      region: data.region || '',
      status: data.status || '',
      procedure_type: data.procedureType || '',
      amount_min_cents: amountMin > 0 ? Math.round(amountMin * 100) : null,
      amount_max_cents: amountMax > 0 ? Math.round(amountMax * 100) : null,
      only_open: data.onlyOpen === 'on',
      with_documents: data.withDocuments === 'on'
    }
  };
}

function renderTenderResults(results) {
  const target = qs('#tenderResults');
  if (!target) return;
  state.selectedTenderIds.clear();
  updateOpportunitySelection();
  setText('#opportunityResultSummary', results.length ? `${results.length} oportunidades encontradas` : 'Sin oportunidades para estos filtros');
  target.replaceChildren();
  if (!results.length) {
    target.className = 'opportunity-empty';
    target.append(renderEmptyState(
      'Sin resultados accionables',
      'Prueba con menos filtros, amplia territorio o elimina el CPV para detectar concursos cercanos.',
      button('Limpiar filtros', () => {
        const form = qs('#tenderSearchForm');
        form?.reset();
        form?.requestSubmit();
      }, 'secondary-button')
    ));
    return;
  }
  target.className = 'opportunity-table';
  const header = document.createElement('div');
  header.className = 'opportunity-row opportunity-head';
  header.setAttribute('role', 'row');
  ['Score', 'Oportunidad', 'Organismo', 'Importe', 'Plazo', 'Estado', 'Accion'].forEach((label) => {
    header.append(tableCell('opportunity-cell', label));
  });
  target.append(header);
  results.forEach((tender) => {
    const amount = eur(tender.base_budget_cents || tender.estimated_value_cents);
    const deadline = tender.submission_deadline;
    const score = Number(tender.match_score || 0);
    const item = document.createElement('article');
    item.className = 'opportunity-row';
    item.dataset.tenderRow = tender.id;
    item.tabIndex = 0;
    item.setAttribute('role', 'button');
    item.setAttribute('aria-label', `Abrir ficha de ${tender.title}`);

    const scoreCell = tableCell('opportunity-cell score-cell');
    const scoreBadge = document.createElement('strong');
    scoreBadge.textContent = `${score}`;
    const scoreSub = document.createElement('span');
    scoreSub.textContent = '/100';
    scoreCell.append(scoreBadge, scoreSub);

    const titleBox = document.createElement('div');
    titleBox.className = 'opportunity-title';
    const title = document.createElement('strong');
    title.textContent = tender.title;
    const meta = document.createElement('span');
    meta.textContent = `CPV ${join(tender.cpv_codes) || '-'} · ${tender.procedure_type || 'procedimiento no informado'}`;
    titleBox.append(title, meta);

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'row-selector';
    checkbox.setAttribute('aria-label', `Seleccionar ${tender.title}`);
    checkbox.addEventListener('click', (event) => {
      event.stopPropagation();
      if (checkbox.checked) state.selectedTenderIds.add(tender.id);
      else state.selectedTenderIds.delete(tender.id);
      updateOpportunitySelection();
    });

    item.append(
      tableCell('opportunity-cell', scoreCell),
      tableCell('opportunity-cell title-cell', checkbox, titleBox),
      tableCell('opportunity-cell muted-cell', tender.contracting_body || 'Organismo no informado'),
      tableCell('opportunity-cell amount-cell', amount),
      tableCell('opportunity-cell', createPill(dateLabel(deadline), deadlineTone(deadline))),
      tableCell('opportunity-cell', createPill(statusText(tender), tender.tracked ? 'ok' : 'neutral')),
      tableCell('opportunity-cell action-cell', button('Ver ficha', () => loadTenderDetail(tender.id), 'secondary-button'))
    );
    item.addEventListener('click', (event) => {
      if (event.target.closest('button, a, input')) return;
      loadTenderDetail(tender.id);
    });
    item.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      loadTenderDetail(tender.id);
    });
    target.append(item);
  });
}

function scoreLabel(value) {
  if (!value) return '-';
  if (value === 'go') return 'GO';
  if (value === 'no_go') return 'NO-GO';
  return 'REVISAR';
}

function renderScore(score, tracked) {
  const target = qs('#decisionPanel');
  if (!target) return;
  target.replaceChildren();
  const model = document.createElement('div');
  model.className = 'go-score-model';
  const header = document.createElement('div');
  header.className = 'score-header';
  const total = document.createElement('strong');
  total.textContent = `${score.total}/100`;
  const status = document.createElement('span');
  status.className = `score-pill score-${score.recommendation}`;
  status.textContent = scoreLabel(score.recommendation);
  header.append(total, status);
  const meta = document.createElement('p');
  meta.textContent = `Confianza ${score.confidence}/100${tracked?.decision ? ` · decision manual: ${scoreLabel(tracked.decision)}` : ''}`;

  const drivers = document.createElement('div');
  drivers.className = 'score-drivers';
  const positives = (score.factors || []).filter((factor) => Number(factor.score || 0) >= 70).slice(0, 2);
  const risks = (score.factors || []).filter((factor) => Number(factor.score || 0) < 55).slice(0, 2);
  const up = document.createElement('div');
  up.append(row('Por que sube', positives.length ? positives.map((factor) => factor.label).join(', ') : 'Sin palancas fuertes detectadas'));
  const down = document.createElement('div');
  down.append(row('Por que baja', risks.length ? risks.map((factor) => factor.label).join(', ') : 'Sin riesgos criticos detectados'));
  drivers.append(up, down);

  const factors = document.createElement('div');
  factors.className = 'factor-list';
  (score.factors || []).forEach((factor) => {
    const item = document.createElement('div');
    item.className = 'factor-item';
    const top = document.createElement('div');
    top.className = 'factor-top';
    const name = document.createElement('strong');
    name.textContent = factor.label;
    const value = document.createElement('span');
    value.textContent = `${factor.score}/100`;
    top.append(name, value);
    const bar = document.createElement('i');
    bar.style.width = `${Math.max(0, Math.min(100, Number(factor.score || 0)))}%`;
    const explanation = document.createElement('p');
    explanation.textContent = factor.explanation;
    item.append(top, bar, explanation);
    factors.append(item);
  });
  model.append(header, meta, drivers, factors);
  target.append(model);
}

function renderAnalysis(data) {
  const target = qs('#analysisPanel');
  if (!target) return;
  target.replaceChildren();
  if (!data?.analysis) {
    target.append(row('Sin analisis', 'Pulsa Analizar IA en la ficha.'));
    return;
  }
  const analysis = data.analysis;
  const title = document.createElement('h3');
  title.textContent = 'Analisis con citas';
  const summary = document.createElement('p');
  summary.textContent = analysis.summary;
  const facts = document.createElement('div');
  facts.className = 'mini-list';
  (analysis.official_facts || []).forEach((fact) => {
    const citation = fact.citations?.[0];
    facts.append(row(fact.label, `${fact.value}${citation?.title ? ` · ${citation.title}` : ''}`));
  });
  const risksTitle = document.createElement('h4');
  risksTitle.textContent = 'Riesgos inferidos';
  const risks = document.createElement('div');
  risks.className = 'mini-list';
  const riskItems = analysis.inferred_risks?.length ? analysis.inferred_risks : [{ label: 'Sin riesgos criticos', reason: 'No se han detectado factores por debajo del umbral.' }];
  riskItems.forEach((risk) => risks.append(row(risk.label, risk.reason || risk.level || '-')));
  target.append(title, summary, facts, risksTitle, risks);
  if (data.warning) target.append(row('Aviso IA', `Se ha usado analisis determinista: ${data.warning}`));
}

function renderWorkflow(data) {
  const target = qs('#workflowPanel');
  if (!target) return;
  target.replaceChildren();
  if (!data) {
    target.append(row('Sin expediente preparado', 'Pulsa Preparar expediente en la ficha.'));
    return;
  }
  const title = document.createElement('h3');
  title.textContent = 'Checklist, tareas e hitos';
  const columns = document.createElement('div');
  columns.className = 'workflow-grid';
  const checklist = document.createElement('div');
  checklist.append(row('Checklist documental', `${data.checklist?.items?.length || 0} items`));
  (data.checklist?.items || []).slice(0, 7).forEach((item) => {
    checklist.append(row(item.title, `${item.status || 'pending'} · vence ${dateLabel(item.due_at)}`));
  });
  const tasks = document.createElement('div');
  tasks.append(row('Tareas', `${data.tasks?.length || 0} abiertas/creadas`));
  (data.tasks || []).slice(0, 6).forEach((task) => {
    tasks.append(row(task.title, `${task.status} · ${task.priority || 'normal'} · ${dateLabel(task.due_at)}`));
  });
  const milestones = document.createElement('div');
  milestones.append(row('Hitos', `${data.milestones?.length || 0} calendario`));
  (data.milestones || []).slice(0, 6).forEach((milestone) => {
    milestones.append(row(milestone.title, `${milestone.milestone_type} · ${dateLabel(milestone.due_at)}`));
  });
  columns.append(checklist, tasks, milestones);
  target.append(title, columns);
}

function downloadBase64(filename, mimeType, base64) {
  const link = document.createElement('a');
  link.href = `data:${mimeType};base64,${base64}`;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
}

function textBlock(tagName, text, className = '') {
  const el = document.createElement(tagName);
  if (className) el.className = className;
  el.textContent = text;
  return el;
}

function selectedTenderContext() {
  const detail = state.selectedDetail || {};
  return {
    tender: detail.tender || state.selectedTender || null,
    tracked: detail.tracked || null,
    documents: Array.isArray(detail.documents) ? detail.documents : [],
    versions: Array.isArray(detail.versions) ? detail.versions : []
  };
}

function markdownHeadings(markdown) {
  const headings = [];
  String(markdown || '').replace(/^(#{1,3})\s+(.+)$/gm, (_match, level, text) => {
    headings.push({ level: level.length, text: String(text).trim() });
    return '';
  });
  return headings.slice(0, 9);
}

function reviewTone(score) {
  const value = Number(score || 0);
  if (value >= 75) return 'ok';
  if (value >= 50) return 'warning';
  return 'danger';
}

function dossierStatusLabel(status) {
  const labels = {
    pending: 'Pendiente',
    attached: 'Adjunto',
    not_applicable: 'No aplica',
    draft: 'Borrador',
    ready: 'Listo',
    exported: 'Exportado'
  };
  return labels[status] || String(status || 'Pendiente');
}

function dossierStatusTone(status) {
  if (['attached', 'not_applicable', 'ready', 'exported'].includes(String(status))) return 'ok';
  if (String(status) === 'draft') return 'warning';
  return 'neutral';
}

function renderProposalEvidence() {
  const target = qs('#proposalEvidencePanel');
  if (!target) return;
  const { tender, tracked, documents, versions } = selectedTenderContext();
  target.replaceChildren(textBlock('span', 'Fuentes', 'eyebrow'), textBlock('h3', 'Contexto oficial'));

  if (!tender) {
    target.append(textBlock('p', 'Selecciona una licitacion para fijar requisitos, documentos y datos de trabajo.'));
    return;
  }

  const badges = document.createElement('div');
  badges.className = 'detail-badges';
  badges.append(
    createPill(statusText(tender), tracked ? 'ok' : 'neutral'),
    createPill(`Limite ${dateLabel(tender.submission_deadline)}`, deadlineTone(tender.submission_deadline)),
    createPill(eur(tender.base_budget_cents || tender.estimated_value_cents), 'neutral')
  );

  const facts = document.createElement('div');
  facts.className = 'source-stack';
  facts.append(
    row('Oportunidad activa', tender.title || 'Licitacion sin titulo'),
    row('Organismo', tender.contracting_body || 'Organismo no informado'),
    row('CPV', join(tender.cpv_codes) || '-'),
    row('Documentos oficiales', String(documents.length)),
    row('Cambios normalizados', String(versions.length))
  );

  if (documents.length) {
    const docs = document.createElement('div');
    docs.className = 'source-docs';
    docs.append(textBlock('strong', 'Fuentes clave'));
    documents.slice(0, 4).forEach((doc) => {
      docs.append(row(doc.title || doc.filename || 'Documento oficial', doc.official_url || doc.storage_path || 'Referencia interna'));
    });
    target.append(badges, facts, docs);
    return;
  }

  target.append(badges, facts, row('Siguiente accion', 'Revisa el enlace oficial y ejecuta ingestion si faltan pliegos.'));
}

function renderProposalReviewEmpty() {
  const target = qs('#proposalReviewPanel');
  if (!target) return;
  target.replaceChildren(
    textBlock('span', 'Revision', 'eyebrow'),
    textBlock('h3', 'Calidad y riesgos'),
    textBlock('p', 'Cuando revises la propuesta veras puntuacion por seccion, riesgos y mejoras concretas.')
  );
}

function renderProposal(data) {
  const target = qs('#proposalPanel');
  if (!target) return;
  renderProposalEvidence();
  renderProposalReviewEmpty();
  const { tender } = selectedTenderContext();
  target.replaceChildren(textBlock('span', 'Editor', 'eyebrow'));

  if (!data?.version) {
    target.append(
      textBlock('h3', 'Copiloto de propuesta'),
      textBlock('p', tender ? 'Genera un borrador tecnico editable, versionado y trazado contra la ficha activa.' : 'Selecciona una oportunidad y genera el primer borrador editable.')
    );
    if (tender) {
      const actions = document.createElement('div');
      actions.className = 'action-row';
      actions.append(
        button('Generar propuesta', () => handleGenerateProposal(), 'primary-button'),
        button('Preparar dossier', () => handlePrepareDossier(), 'secondary-button')
      );
      target.append(actions);
    }
    return;
  }

  const markdown = String(data.markdown || data.version.content_markdown || '');
  const header = document.createElement('div');
  header.className = 'proposal-editor-header';
  const titleWrap = document.createElement('div');
  titleWrap.append(
    textBlock('h3', `Propuesta v${data.version.version_number}`),
    textBlock('p', data.project?.title || 'Borrador tecnico editable')
  );
  header.append(titleWrap, createPill(data.warning ? 'Fallback IA' : 'Versionada', data.warning ? 'warning' : 'ok'));

  const meta = document.createElement('div');
  meta.className = 'proposal-meta-grid';
  meta.append(
    row('Trazabilidad', data.version.ai_run_id ? 'Con AI run registrado' : 'Generacion determinista'),
    row('Formato', String(data.version.format || 'markdown').toUpperCase()),
    row('Secciones', String(markdownHeadings(markdown).length || 1))
  );
  if (data.warning) meta.append(row('Aviso', `Fallback conservador: ${data.warning}`));

  const outline = document.createElement('ol');
  outline.className = 'proposal-outline';
  const headings = markdownHeadings(markdown);
  (headings.length ? headings : [{ level: 1, text: 'Borrador tecnico' }]).forEach((heading) => {
    const item = document.createElement('li');
    item.className = `heading-level-${heading.level}`;
    item.textContent = heading.text;
    outline.append(item);
  });
  const outlineBox = document.createElement('div');
  outlineBox.className = 'proposal-outline-box';
  outlineBox.append(textBlock('strong', 'Indice de trabajo'), outline);

  const preview = document.createElement('pre');
  preview.className = 'proposal-preview';
  preview.textContent = markdown;

  const actions = document.createElement('div');
  actions.className = 'action-row';
  actions.append(
    button('Revisar propuesta', () => handleReviewProposal(data.version.id), 'primary-button'),
    button('Exportar DOCX', () => handleExportProposal(data.version.id), 'secondary-button')
  );

  target.append(header, meta, outlineBox, preview, actions);
}

function renderProposalReview(review) {
  const target = qs('#proposalReviewPanel');
  if (!target || !review) return;
  target.replaceChildren(textBlock('span', 'Revision', 'eyebrow'));
  const header = document.createElement('div');
  header.className = 'quality-header';
  const titleWrap = document.createElement('div');
  titleWrap.append(textBlock('h3', 'Calidad y riesgos'), textBlock('p', `Revision generada el ${dateLabel(review.reviewed_at)}.`));
  const score = document.createElement('strong');
  score.textContent = `${review.total}/100`;
  header.append(titleWrap, score, createPill(reviewTone(review.total) === 'ok' ? 'Solida' : 'Revisar', reviewTone(review.total)));

  const grid = document.createElement('div');
  grid.className = 'quality-grid';
  (review.sections || []).forEach((section) => {
    const card = document.createElement('div');
    card.className = 'quality-card';
    card.append(
      createPill(`${section.score}/100`, reviewTone(section.score)),
      textBlock('strong', section.label || 'Seccion'),
      textBlock('p', section.suggestion || 'Sin sugerencia especifica.')
    );
    grid.append(card);
  });

  const advice = document.createElement('div');
  advice.className = 'review-advice';
  const suggestions = [...(review.risks || []), ...(review.suggestions || [])].slice(0, 5);
  advice.append(textBlock('strong', 'Siguientes mejoras'));
  if (!suggestions.length) advice.append(row('Sin bloqueos criticos', 'La propuesta mantiene una calidad razonable para revision humana.'));
  suggestions.forEach((item) => advice.append(row('Ajuste recomendado', item)));

  target.append(header, grid, advice);
}

function discountDistribution(awards) {
  const discounts = (awards || []).map((award) => Number(award.discount_pct)).filter(Number.isFinite);
  const buckets = [
    { label: '0-5%', min: 0, max: 5 },
    { label: '5-10%', min: 5, max: 10 },
    { label: '10-15%', min: 10, max: 15 },
    { label: '+15%', min: 15, max: Infinity }
  ];
  return buckets.map((bucket) => {
    const count = discounts.filter((value) => value >= bucket.min && value < bucket.max).length;
    const percent = discounts.length ? Math.round((count / discounts.length) * 100) : 0;
    return { ...bucket, count, percent };
  });
}

function competitiveRisk(data) {
  const summary = data?.summary || {};
  const total = Number(summary.totalAwards || 0);
  const median = Number(summary.medianDiscountPct || summary.averageDiscountPct || 0);
  const topThree = (summary.topAwardees || []).slice(0, 3).reduce((acc, item) => acc + Number(item.awards || 0), 0);
  const concentration = total ? topThree / total : 0;
  const score = Math.min(100, Math.round((total ? 12 : 38) + median * 2.1 + concentration * 42));
  const tone = score >= 70 ? 'danger' : score >= 45 ? 'warning' : 'ok';
  const label = tone === 'danger' ? 'Alto' : tone === 'warning' ? 'Medio' : 'Bajo';
  const reasons = [];
  if (!total) reasons.push('Sin historico suficiente para benchmark fiable.');
  if (median >= 15) reasons.push(`La baja mediana esta en ${median}%.`);
  if (concentration >= 0.55) reasons.push('Mercado concentrado en pocos adjudicatarios.');
  if (!reasons.length) reasons.push('Mercado con presion competitiva moderada.');
  return { score, tone, label, reasons };
}

function renderPricingScenarioPanel(data, savedScenario = null) {
  const target = qs('#pricingScenarioPanel');
  if (!target) return;
  const summary = data?.summary || {};
  const { tender } = selectedTenderContext();
  const discountPct = Number(savedScenario?.discount_pct ?? summary.medianDiscountPct ?? summary.averageDiscountPct ?? 5);
  const baseCents = Number(savedScenario?.base_amount_cents || tender?.base_budget_cents || tender?.estimated_value_cents || 0);
  const bidCents = Number(savedScenario?.bid_amount_cents || (baseCents ? Math.round(baseCents * (1 - discountPct / 100)) : 0));
  target.replaceChildren(
    textBlock('span', 'Escenario', 'eyebrow'),
    textBlock('h3', savedScenario ? 'Escenario guardado' : 'Oferta economica')
  );
  target.append(
    row('Baja de referencia', `${discountPct || 0}%`),
    row('Presupuesto base', eur(baseCents)),
    row('Oferta simulada', eur(bidCents)),
    row('Probabilidad', savedScenario?.win_probability_pct ? `${savedScenario.win_probability_pct}%` : '35% base')
  );
  const actions = document.createElement('div');
  actions.className = 'action-row';
  actions.append(button(savedScenario ? 'Guardar otro escenario' : 'Guardar escenario base', () => handleSaveScenario(), 'secondary-button'));
  target.append(actions);
}

function renderMarketRiskPanel(data) {
  const target = qs('#marketRiskPanel');
  if (!target) return;
  const risk = competitiveRisk(data);
  target.replaceChildren(
    textBlock('span', 'Riesgo', 'eyebrow'),
    textBlock('h3', 'Lectura ejecutiva')
  );
  const meter = document.createElement('div');
  meter.className = `risk-meter risk-${risk.tone}`;
  const bar = document.createElement('i');
  bar.style.width = `${risk.score}%`;
  meter.append(bar);
  target.append(createPill(`Riesgo ${risk.label}`, risk.tone), meter);
  risk.reasons.forEach((reason) => target.append(row('Lectura', reason)));
}

function renderCompetitive(data) {
  const target = qs('#competitivePanel');
  if (!target) return;
  target.replaceChildren();
  const summary = data?.summary || {};
  const awards = data?.awards || [];
  target.append(
    textBlock('span', 'Mercado', 'eyebrow'),
    textBlock('h3', 'Dashboard competitivo'),
    textBlock('p', 'Historico de adjudicaciones, bajas y concentracion para decidir posicionamiento de oferta.')
  );

  const kpis = document.createElement('div');
  kpis.className = 'intel-kpi-grid';
  kpis.append(
    row('Adjudicaciones', String(summary.totalAwards || 0)),
    row('Baja media', summary.averageDiscountPct === null || summary.averageDiscountPct === undefined ? 'Sin datos' : `${summary.averageDiscountPct}%`),
    row('Baja mediana', summary.medianDiscountPct === null || summary.medianDiscountPct === undefined ? 'Sin datos' : `${summary.medianDiscountPct}%`)
  );

  const lists = document.createElement('div');
  lists.className = 'intel-list-grid';
  const competitors = document.createElement('div');
  competitors.className = 'intel-list';
  competitors.append(textBlock('strong', 'Adjudicatarios recurrentes'));
  const topAwardees = (summary.topAwardees || []).slice(0, 5);
  if (!topAwardees.length) competitors.append(row('Sin historico', 'Importa adjudicaciones o espera a la ingesta.'));
  topAwardees.forEach((item) => {
    competitors.append(row(item.awardee_name, `${item.awards} adjudicaciones · baja media ${item.average_discount_pct ?? '-'}% · ${eur(item.amount_cents)}`));
  });

  const bodies = document.createElement('div');
  bodies.className = 'intel-list';
  bodies.append(textBlock('strong', 'Organismos con mas datos'));
  const byBody = (summary.byContractingBody || []).slice(0, 5);
  if (!byBody.length) bodies.append(row('Sin organismos', 'No hay suficiente muestra todavia.'));
  byBody.forEach((item) => bodies.append(row(item.name, `${item.count} adjudicaciones`)));
  lists.append(competitors, bodies);

  const distribution = document.createElement('div');
  distribution.className = 'discount-distribution';
  distribution.append(textBlock('strong', 'Distribucion de bajas'));
  discountDistribution(awards).forEach((bucket) => {
    const item = document.createElement('div');
    item.className = 'discount-bucket';
    const label = textBlock('span', `${bucket.label} · ${bucket.count}`);
    const track = document.createElement('i');
    track.style.width = `${bucket.percent}%`;
    item.append(label, track);
    distribution.append(item);
  });

  const actions = document.createElement('div');
  actions.className = 'action-row';
  actions.append(
    button('Simular oferta', () => handleSaveScenario(), 'secondary-button'),
    button('Export CSV', () => handleExportCompetitiveCsv(), 'secondary-button')
  );

  target.append(kpis, lists, distribution, actions);
  renderPricingScenarioPanel(data);
  renderMarketRiskPanel(data);
}

function renderDossier(data) {
  const target = qs('#dossierPanel');
  if (!target) return;
  const { tender } = selectedTenderContext();
  target.replaceChildren(textBlock('span', 'Dossier', 'eyebrow'));
  if (!data?.dossier) {
    target.append(
      textBlock('h3', 'Dossier de candidatura'),
      textBlock('p', tender ? 'Prepara el checklist documental desde la oportunidad activa.' : 'Selecciona una oportunidad para preparar checklist documental y export ZIP.')
    );
    if (tender) {
      const actions = document.createElement('div');
      actions.className = 'action-row';
      actions.append(button('Preparar dossier', () => handlePrepareDossier(), 'primary-button'));
      target.append(actions);
    }
    return;
  }
  const items = data.items || [];
  const required = items.filter((item) => item.required !== false);
  const attached = required.filter((item) => ['attached', 'not_applicable'].includes(String(item.status)));
  const score = Number(data.completenessScore ?? data.dossier.completeness_score ?? 0);
  const header = document.createElement('div');
  header.className = 'dossier-title-row';
  const titleWrap = document.createElement('div');
  titleWrap.append(textBlock('h3', data.dossier.title || 'Dossier'), textBlock('p', `${attached.length}/${required.length || items.length} obligatorios cubiertos`));
  header.append(titleWrap, createPill(dossierStatusLabel(data.dossier.status), dossierStatusTone(data.dossier.status)));

  const progress = document.createElement('div');
  progress.className = 'dossier-progress';
  const bar = document.createElement('i');
  bar.style.width = `${Math.max(0, Math.min(100, score))}%`;
  progress.append(bar);

  const summary = document.createElement('div');
  summary.className = 'dossier-summary-grid';
  summary.append(
    row('Completitud', `${score}%`),
    row('Items', String(items.length)),
    row('Biblioteca', `${(data.documents || []).length} documentos`)
  );

  const list = document.createElement('div');
  list.className = 'dossier-items';
  items.slice(0, 10).forEach((item) => {
    const card = document.createElement('div');
    card.className = 'dossier-item';
    card.append(
      createPill(dossierStatusLabel(item.status), dossierStatusTone(item.status)),
      textBlock('strong', item.title || 'Documento'),
      textBlock('span', item.required ? 'Obligatorio' : 'Referencia oficial')
    );
    list.append(card);
  });

  const actions = document.createElement('div');
  actions.className = 'action-row';
  actions.append(button('Exportar ZIP', () => handleExportDossier(data.dossier.id), 'secondary-button'));
  target.append(header, progress, summary, list, actions);
}

function dateTimeLabel(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' });
}

function statusTone(value) {
  const normalized = String(value || '').toLowerCase();
  if (['passed', 'succeeded', 'active', 'resolved', 'ready'].includes(normalized)) return 'ok';
  if (['warning', 'pending', 'draft', 'open'].includes(normalized)) return 'warning';
  if (['failed', 'critical', 'error', 'blocked'].includes(normalized)) return 'danger';
  return 'neutral';
}

function metricCard(label, value, detail, tone = 'neutral') {
  const card = document.createElement('div');
  card.className = `ops-metric ops-metric-${tone}`;
  card.append(textBlock('span', label), textBlock('strong', value), textBlock('p', detail));
  return card;
}

function eventRecorded(data, names) {
  const actions = new Set((data?.audits || []).map((event) => String(event.action || '')));
  return names.some((name) => actions.has(name));
}

function renderOpsOverview(data) {
  const target = qs('#opsOverviewPanel');
  if (!target) return;
  const openErrors = (data?.errors || []).filter((event) => !event.resolved_at);
  const openAlerts = (data?.alerts || []).filter((alert) => alert.status === 'open');
  const failedChecks = (data?.checks || []).filter((check) => ['failed', 'critical'].includes(String(check.status)));
  target.replaceChildren(
    metricCard('Errores abiertos', String(openErrors.length), openErrors[0]?.message || 'Sin errores bloqueantes', openErrors.length ? 'danger' : 'ok'),
    metricCard('Alertas internas', String(openAlerts.length), openAlerts[0]?.title || 'Todo estable', openAlerts.length ? 'warning' : 'ok'),
    metricCard('Backups', String(data?.backups?.length || 0), data?.backups?.[0] ? `Ultimo ${dateTimeLabel(data.backups[0].created_at)}` : 'Sin backup reciente', data?.backups?.length ? 'ok' : 'warning'),
    metricCard('Release', failedChecks.length ? `${failedChecks.length} fallan` : 'Listo', `${data?.checks?.length || 0} checks registrados`, failedChecks.length ? 'danger' : 'ok')
  );
}

function renderOpsHealth(data) {
  const target = qs('#opsHealthPanel');
  if (!target) return;
  const organizations = data?.organizations || [];
  const currentOrg = organizations[0] || state.onboarding?.organization || {};
  const openErrors = (data?.errors || []).filter((event) => !event.resolved_at);
  target.replaceChildren(
    textBlock('span', 'Salud', 'eyebrow'),
    textBlock('h3', 'Salud operativa'),
    row('Organizacion activa', currentOrg.name || state.onboarding?.organization?.name || 'Organizacion beta'),
    row('Estado', currentOrg.status || 'active'),
    row('Errores sin resolver', String(openErrors.length)),
    row('Organizaciones visibles', String(organizations.length || 1))
  );
  const actions = document.createElement('div');
  actions.className = 'action-row';
  actions.append(button('Refrescar', () => loadOpsDashboard(), 'secondary-button'));
  target.append(actions);
}

function renderBackupsPanel(data) {
  const target = qs('#opsPanel');
  if (!target) return;
  const organizations = data?.organizations || [];
  const currentOrg = organizations[0] || state.onboarding?.organization || {};
  target.replaceChildren(textBlock('span', 'Backups', 'eyebrow'), textBlock('h3', 'Backups y organizaciones'));
  target.append(
    row('Estado organizacion', currentOrg.status || 'active'),
    row('Retencion backup', '30 dias'),
    row('Backups recientes', String(data?.backups?.length || 0))
  );
  const backups = document.createElement('div');
  backups.className = 'ops-list';
  if (!data?.backups?.length) {
    backups.append(renderEmptyState('Sin backups recientes', 'Lanza un backup antes de cambios sensibles o demos con cliente.'));
  } else {
    data.backups.slice(0, 6).forEach((backup) => {
      const item = document.createElement('div');
      item.className = 'ops-list-item';
      item.append(
        createPill(backup.status || 'succeeded', statusTone(backup.status)),
        textBlock('strong', backup.backup_type || 'organization_export'),
        textBlock('span', `Creado ${dateTimeLabel(backup.created_at)} · retencion ${dateLabel(backup.retention_until)}`)
      );
      backups.append(item);
    });
  }
  const actions = document.createElement('div');
  actions.className = 'action-row';
  actions.append(
    button('Exportar backup', () => handleExportOrgBackup(), 'secondary-button'),
    button('Bloquear org', () => handleOrganizationStatus('blockOrganization'), 'secondary-button'),
    button('Desbloquear org', () => handleOrganizationStatus('unblockOrganization'), 'secondary-button')
  );
  target.append(backups, actions);
}

function renderObservabilityPanel(data) {
  const target = qs('#observabilityPanel');
  if (!target) return;
  const errors = data?.errors || [];
  const alerts = data?.alerts || [];
  target.replaceChildren(textBlock('span', 'Errores', 'eyebrow'), textBlock('h3', 'Errores y alertas'));
  target.append(
    row('Errores recientes', String(errors.length)),
    row('Alertas abiertas', String(alerts.filter((alert) => alert.status === 'open').length))
  );
  const list = document.createElement('div');
  list.className = 'ops-list';
  if (!errors.length) {
    list.append(renderEmptyState('Sin errores registrados', 'Los errores frontend y backend apareceran aqui con severidad, fuente y fecha.'));
  } else {
    errors.slice(0, 10).forEach((event) => {
      const item = document.createElement('div');
      item.className = 'ops-list-item';
      item.append(
        createPill(event.severity || 'error', statusTone(event.severity)),
        textBlock('strong', event.message || 'Error sin mensaje'),
        textBlock('span', `${event.source || 'frontend'} · ${dateTimeLabel(event.created_at)} · ${event.resolved_at ? 'resuelto' : 'abierto'}`)
      );
      list.append(item);
    });
  }
  target.append(list);
}

function renderUsersPanel(data) {
  const target = qs('#opsUsersPanel');
  if (!target) return;
  const organizations = data?.organizations || [];
  const members = organizations.flatMap((org) => org.organization_members || []);
  const invitations = data?.invitations || [];
  target.replaceChildren(textBlock('span', 'Usuarios', 'eyebrow'), textBlock('h3', 'Usuarios e invitaciones'));
  const list = document.createElement('div');
  list.className = 'ops-list';
  if (!members.length && !invitations.length) {
    list.append(renderEmptyState('Sin usuarios adicionales', 'Las invitaciones y miembros activos apareceran aqui para control admin.'));
  }
  members.slice(0, 8).forEach((member) => {
    const item = document.createElement('div');
    item.className = 'ops-list-item';
    item.append(
      createPill(member.status || 'active', statusTone(member.status)),
      textBlock('strong', member.invited_email || member.user_id || 'Usuario'),
      textBlock('span', `Rol ${member.role || '-'} · miembro`)
    );
    list.append(item);
  });
  invitations.slice(0, 8).forEach((invite) => {
    const item = document.createElement('div');
    item.className = 'ops-list-item';
    item.append(
      createPill(invite.status || 'pending', statusTone(invite.status)),
      textBlock('strong', invite.email || 'Invitacion'),
      textBlock('span', `Rol ${invite.role || '-'} · expira ${dateLabel(invite.expires_at)}`)
    );
    list.append(item);
  });
  target.append(row('Miembros', String(members.length)), row('Invitaciones', String(invitations.length)), list);
}

function renderReleasePanel(data) {
  const target = qs('#releasePanel');
  if (!target) return;
  const checks = data?.checks || [];
  target.replaceChildren(textBlock('span', 'Release', 'eyebrow'), textBlock('h3', 'Checks de salida'));
  target.append(row('Checks registrados', String(checks.length)));
  const list = document.createElement('div');
  list.className = 'ops-list';
  if (!checks.length) {
    list.append(renderEmptyState('Sin checks registrados', 'Registra los checks P0 antes de abrir una beta con usuarios reales.'));
  }
  checks.slice(0, 12).forEach((check) => {
    const item = document.createElement('div');
    item.className = 'ops-list-item';
    item.append(
      createPill(check.status || 'pending', statusTone(check.status)),
      textBlock('strong', check.title || 'Check'),
      textBlock('span', `${check.check_type || '-'} · ${dateTimeLabel(check.checked_at)}`)
    );
    list.append(item);
  });
  const actions = document.createElement('div');
  actions.className = 'action-row';
  actions.append(button('Registrar checks P0', () => handleRecordReleaseChecks(), 'secondary-button'));
  target.append(list, actions);
}

function renderUxMetricsPanel(data) {
  const target = qs('#uxMetricsPanel');
  if (!target) return;
  const metrics = [
    ['signup_started', ['signup_started']],
    ['onboarding_completed', ['onboarding_completed', 'onboarding.completed']],
    ['search_executed', ['search_executed']],
    ['tender_tracked', ['tender_tracked']],
    ['decision_recorded', ['decision_recorded']],
    ['proposal_exported', ['proposal_exported']],
    ['dossier_exported', ['dossier_exported']]
  ];
  target.replaceChildren(textBlock('span', 'Medicion', 'eyebrow'), textBlock('h3', 'Medicion de producto'));
  target.append(row('Eventos auditados', String((data?.audits || []).length)), row('Politica', 'Sin datos sensibles: solo accion, recurso y contadores.'));
  const list = document.createElement('div');
  list.className = 'ops-list metric-event-list';
  metrics.forEach(([label, names]) => {
    const recorded = eventRecorded(data, names);
    const item = document.createElement('div');
    item.className = 'ops-list-item';
    item.append(
      createPill(recorded ? 'registrado' : 'preparado', recorded ? 'ok' : 'warning'),
      textBlock('strong', label),
      textBlock('span', recorded ? 'Hay evidencia en auditoria reciente.' : 'Instrumentado; aparecera al ejecutar el flujo.')
    );
    list.append(item);
  });
  target.append(list);
}

function renderOps(data) {
  state.lastOps = data;
  const stateLabel = qs('#opsState');
  if (stateLabel) stateLabel.textContent = 'Operativo';
  renderOpsOverview(data);
  renderOpsHealth(data);
  renderObservabilityPanel(data);
  renderBackupsPanel(data);
  renderUsersPanel(data);
  renderReleasePanel(data);
  renderUxMetricsPanel(data);
}

async function loadOpsDashboard() {
  const target = qs('#opsPanel');
  if (!target || state.canUseOperations === false) return;
  ['#opsOverviewPanel', '#opsHealthPanel', '#observabilityPanel', '#opsPanel', '#opsUsersPanel', '#releasePanel', '#uxMetricsPanel'].forEach((selector) => {
    renderSkeleton(qs(selector), selector === '#opsOverviewPanel' ? 4 : 3, selector === '#opsOverviewPanel' ? 'skeleton-card' : 'skeleton-row');
  });
  try {
    const response = await opsAdmin({ action: 'dashboard' });
    renderOps(response);
  } catch (error) {
    setText('#opsState', 'Sin permisos o error');
    renderErrorState(target, 'No se pudo cargar operaciones', error, () => loadOpsDashboard());
  }
}

async function handleExportOrgBackup() {
  const target = qs('#opsPanel');
  if (!window.confirm('Vas a generar y descargar un backup organizativo. Quedara registrado en auditoria.')) return;
  try {
    const response = await opsAdmin({
      action: 'exportOrganization',
      organizationId: state.onboarding?.organization?.id || null
    });
    const exported = response.export;
    downloadBase64(exported.filename, exported.mimeType, exported.base64);
    showToast('Backup exportado y auditado.', 'success');
    await loadOpsDashboard();
  } catch (error) {
    renderErrorState(target, 'No se pudo exportar backup', error, () => handleExportOrgBackup());
  }
}

async function handleRecordReleaseChecks() {
  const target = qs('#releasePanel');
  try {
    const response = await opsAdmin({
      action: 'recordReleaseChecks',
      organizationId: state.onboarding?.organization?.id || null
    });
    target && target.append(row('Checks registrados', `${response.checks?.length || 0} controles actualizados`));
    showToast('Checks P0 registrados.', 'success');
    await loadOpsDashboard();
  } catch (error) {
    renderErrorState(target, 'No se pudieron registrar checks', error, () => handleRecordReleaseChecks());
  }
}

async function handleOrganizationStatus(action) {
  const target = qs('#opsPanel');
  const isBlocking = action === 'blockOrganization';
  const message = isBlocking
    ? 'Vas a bloquear la organizacion beta. Los usuarios afectados pueden perder acceso operativo.'
    : 'Vas a reactivar la organizacion beta.';
  if (!window.confirm(`${message} ¿Confirmas la accion?`)) return;
  try {
    await opsAdmin({
      action,
      organizationId: state.onboarding?.organization?.id || null,
      reason: action === 'blockOrganization' ? 'Bloqueo manual de beta desde operaciones' : ''
    });
    showToast(isBlocking ? 'Organizacion bloqueada.' : 'Organizacion desbloqueada.', 'success');
    await loadOpsDashboard();
  } catch (error) {
    renderErrorState(target, 'No se pudo actualizar organizacion', error, () => handleOrganizationStatus(action));
  }
}

function selectedTenderId() {
  return state.selectedDetail?.tender?.id || state.selectedTender?.id || null;
}

async function handleDecisionScore(decision = null) {
  const tenderId = selectedTenderId();
  if (!tenderId) return;
  if (decision === 'no_go' && !window.confirm('Vas a marcar esta oportunidad como NO-GO. La decision quedara auditada.')) return;
  const stateTarget = qs('#decisionState');
  stateTarget && (stateTarget.textContent = decision ? 'Guardando decision' : 'Calculando score');
  try {
    const response = await decisionScore({
      tenderId,
      persist: Boolean(decision),
      decision,
      reason: decision ? 'Decision marcada desde ficha 360' : ''
    });
    renderScore(response.score, response.tracked);
    stateTarget && (stateTarget.textContent = decision ? `Decision ${scoreLabel(decision)} guardada` : 'Score calculado');
    if (decision) {
      trackProductEvent('decision_recorded', {
        decision,
        score_total: Number(response.score?.total || 0)
      }, { resourceType: 'tender', resourceId: tenderId });
      showToast(`Decision ${scoreLabel(decision)} guardada.`, 'success');
      await loadTenderDetail(tenderId);
    }
  } catch (error) {
    stateTarget && (stateTarget.textContent = safeErrorMessage(error));
    showToast(safeErrorMessage(error), 'error');
  }
}

async function handleAnalyzeTender() {
  const tenderId = selectedTenderId();
  if (!tenderId) return;
  const target = qs('#analysisPanel');
  target && target.replaceChildren(row('Analizando...', 'IA server-side con minimizacion y citas oficiales'));
  try {
    const response = await analyzeTender({ tenderId });
    state.lastAnalysis = response;
    renderAnalysis(response);
    if (response.analysis?.score) renderScore(response.analysis.score, state.selectedDetail?.tracked);
  } catch (error) {
    target && target.replaceChildren(row('No se pudo analizar', error.message));
  }
}

async function handleWorkflowBootstrap() {
  const tenderId = selectedTenderId();
  if (!tenderId) return;
  const target = qs('#workflowPanel');
  target && target.replaceChildren(row('Preparando expediente...', 'Creando checklist, tareas e hitos'));
  try {
    const response = await workflowTender({
      action: 'bootstrap',
      tenderId,
      aiRunId: state.lastAnalysis?.aiRunId || null
    });
    state.lastWorkflow = response;
    renderWorkflow(response);
  } catch (error) {
    target && target.replaceChildren(row('No se pudo preparar expediente', error.message));
  }
}

async function handleGenerateProposal() {
  const tenderId = selectedTenderId();
  if (!tenderId) return;
  const status = qs('#sprint5State');
  status && (status.textContent = 'Generando propuesta');
  const target = qs('#proposalPanel');
  renderProposalEvidence();
  renderProposalReviewEmpty();
  target && target.replaceChildren(textBlock('span', 'Editor', 'eyebrow'), row('Generando borrador profesional...', `Modelo ${gptModelLabel(state.aiSettings.openaiModel)} con versionado`));
  try {
    const response = await proposalCopilot({ action: 'draft', tenderId, ...proposalAiPayload() });
    state.lastProposal = response;
    renderProposal(response);
    status && (status.textContent = 'Propuesta generada');
  } catch (error) {
    target && target.replaceChildren(row('No se pudo generar propuesta', error.message));
    status && (status.textContent = 'Error propuesta');
  }
}

async function handleReviewProposal(proposalVersionId) {
  const target = qs('#proposalReviewPanel');
  target && target.replaceChildren(textBlock('span', 'Revision', 'eyebrow'), row('Revisando propuesta...', 'Analizando secciones, riesgos y evidencias'));
  try {
    const response = await proposalReview({ proposalVersionId });
    renderProposalReview(response.review);
  } catch (error) {
    target && target.append(row('No se pudo revisar propuesta', error.message));
  }
}

async function handleExportProposal(proposalVersionId) {
  const target = qs('#proposalReviewPanel') || qs('#proposalPanel');
  try {
    const response = await proposalCopilot({ action: 'export', proposalVersionId });
    const exported = response.export;
    downloadBase64(exported.filename, exported.mimeType, exported.base64);
    trackProductEvent('proposal_exported', { format: 'docx' }, { resourceType: 'proposal_version', resourceId: proposalVersionId });
    showToast('Propuesta DOCX exportada.', 'success');
  } catch (error) {
    target && target.append(row('No se pudo exportar DOCX', safeErrorMessage(error)));
    showToast(safeErrorMessage(error), 'error');
  }
}

async function loadCompetitiveDashboard() {
  const target = qs('#competitivePanel');
  if (!target) return;
  try {
    const response = await competitiveIntel({ action: 'dashboard', filters: {} });
    state.lastCompetitive = response;
    renderCompetitive(response);
  } catch (error) {
    target.replaceChildren(row('No se pudo cargar inteligencia competitiva', error.message));
    renderPricingScenarioPanel(null);
    renderMarketRiskPanel(null);
  }
}

async function handleSaveScenario() {
  const trackedTenderId = state.selectedDetail?.tracked?.id || state.lastWorkflow?.tracked?.id || state.lastDossier?.tracked?.id || null;
  const target = qs('#pricingScenarioPanel');
  if (!trackedTenderId) {
    target && target.append(row('Selecciona y guarda una oportunidad', 'Necesito una licitacion en seguimiento para simular.'));
    return;
  }
  try {
    const response = await competitiveIntel({
      action: 'saveScenario',
      trackedTenderId,
      discountPct: state.lastCompetitive?.summary?.medianDiscountPct || 5,
      winProbabilityPct: 35,
      name: 'Escenario base Sprint 5'
    });
    renderPricingScenarioPanel(state.lastCompetitive, response.scenario);
  } catch (error) {
    target && target.append(row('No se pudo guardar escenario', error.message));
  }
}

async function handleExportCompetitiveCsv() {
  const target = qs('#competitivePanel');
  try {
    const response = await competitiveIntel({ action: 'exportCsv', filters: {} });
    const blob = new Blob([response.csv || ''], { type: 'text/csv;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = response.filename || 'licitia-inteligencia-competitiva.csv';
    document.body.append(link);
    link.click();
    URL.revokeObjectURL(link.href);
    link.remove();
  } catch (error) {
    target && target.append(row('No se pudo exportar CSV', error.message));
  }
}

async function handlePrepareDossier() {
  const tenderId = selectedTenderId();
  if (!tenderId) return;
  const target = qs('#dossierPanel');
  target && target.replaceChildren(row('Preparando dossier...', 'Checklist documental y referencias oficiales'));
  try {
    const response = await documentDossier({ action: 'prepare', tenderId });
    state.lastDossier = response;
    renderDossier(response);
  } catch (error) {
    target && target.replaceChildren(row('No se pudo preparar dossier', error.message));
  }
}

async function handleExportDossier(dossierId) {
  const target = qs('#dossierPanel');
  try {
    const response = await documentDossier({ action: 'export', dossierId });
    const exported = response.export;
    downloadBase64(exported.filename, exported.mimeType, exported.base64);
    trackProductEvent('dossier_exported', { format: 'zip' }, { resourceType: 'dossier_package', resourceId: dossierId });
    showToast('Dossier ZIP exportado.', 'success');
  } catch (error) {
    target && target.append(row('No se pudo exportar dossier', safeErrorMessage(error)));
    showToast(safeErrorMessage(error), 'error');
  }
}

async function handleTenderSearch(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const payload = buildSearchPayload(form);
  setBusy(form, true);
  const target = qs('#tenderResults');
  renderActiveFilterChips(payload);
  syncOpportunityUrl(payload);
  if (target) {
    target.className = 'opportunity-empty';
    renderSkeleton(target, 5, 'skeleton-row skeleton-opportunity');
  }
  setText('#opportunityResultSummary', 'Buscando oportunidades...');
  try {
    const response = await searchTenders(payload);
    state.lastResults = response.results || [];
    renderTenderResults(state.lastResults);
    trackProductEvent('search_executed', {
      result_count: state.lastResults.length,
      has_query: Boolean(payload.filters?.query),
      filter_count: Object.values(payload.filters || {}).filter((value) => Array.isArray(value) ? value.length : Boolean(value)).length,
      sort: payload.sort || 'score'
    });
  } catch (error) {
    setText('#opportunityResultSummary', 'Error de busqueda');
    renderErrorState(target, 'No se pudo completar la busqueda', error, () => form.requestSubmit());
  } finally {
    setBusy(form, false);
  }
}

function renderTenderDetail(data) {
  const target = qs('#tenderDetail');
  if (!target) return;
  const tender = data.tender;
  state.selectedTender = tender;
  state.selectedDetail = data;
  markActiveTenderRow(tender.id);
  target.replaceChildren();

  const shell = document.createElement('div');
  shell.className = 'tender-360';
  const hero = document.createElement('div');
  hero.className = 'tender-360-hero';
  const eyebrow = document.createElement('span');
  eyebrow.className = 'eyebrow';
  eyebrow.textContent = 'Ficha 360';
  const title = document.createElement('h3');
  title.textContent = tender.title;
  const summary = document.createElement('p');
  summary.textContent = tender.contracting_body || 'Organismo no informado';
  const badges = document.createElement('div');
  badges.className = 'detail-badges';
  badges.append(
    createPill(statusText(tender), data.tracked ? 'ok' : 'neutral'),
    createPill(`Limite ${dateLabel(tender.submission_deadline)}`, deadlineTone(tender.submission_deadline)),
    createPill(eur(tender.base_budget_cents || tender.estimated_value_cents), 'neutral')
  );
  hero.append(eyebrow, title, summary, badges);

  const actions = document.createElement('div');
  actions.className = 'action-row sticky-actions';
  actions.append(
    button(data.tracked ? 'Actualizar seguimiento' : 'Guardar oportunidad', () => saveTrackedTender(tender.id), 'primary-button'),
    button('Calcular Go/No-Go', () => handleDecisionScore(), 'secondary-button'),
    button('Marcar GO', () => handleDecisionScore('go'), 'secondary-button'),
    button('Marcar NO-GO', () => handleDecisionScore('no_go'), 'secondary-button'),
    button('Analizar IA', () => handleAnalyzeTender(), 'secondary-button'),
    button('Preparar expediente', () => handleWorkflowBootstrap(), 'secondary-button'),
    button('Generar propuesta', () => handleGenerateProposal(), 'secondary-button'),
    button('Preparar dossier', () => handlePrepareDossier(), 'secondary-button')
  );
  if (tender.official_url) {
    const link = document.createElement('a');
    link.className = 'secondary-button link-button';
    link.href = tender.official_url;
    link.target = '_blank';
    link.rel = 'noreferrer';
    link.textContent = 'Abrir oficial';
    actions.append(link);
  }

  const tabList = document.createElement('div');
  tabList.className = 'detail-tabs';
  tabList.setAttribute('role', 'tablist');
  const tabPanel = document.createElement('div');
  tabPanel.className = 'detail-tab-panel';

  const renderMetaGrid = () => {
    const dl = document.createElement('dl');
    dl.className = 'detail-meta-grid';
    [
      ['Estado oficial', tender.status || '-'],
      ['Publicacion', dateLabel(tender.publication_date)],
      ['Fecha limite', dateLabel(tender.submission_deadline)],
      ['Importe', eur(tender.base_budget_cents || tender.estimated_value_cents)],
      ['CPV', join(tender.cpv_codes) || '-'],
      ['Documentos', String(data.documents?.length || 0)],
      ['Cambios', String(data.versions?.length || 0)],
      ['Seguimiento', data.tracked?.internal_status || 'Sin seguir']
    ].forEach(([key, value]) => {
      const dt = document.createElement('dt');
      dt.textContent = key;
      const dd = document.createElement('dd');
      dd.textContent = value;
      dl.append(dt, dd);
    });
    return dl;
  };

  const renderDocumentList = () => {
    const wrap = document.createElement('div');
    wrap.className = 'mini-list';
    const docs = data.documents || [];
    if (!docs.length) {
      wrap.append(row('Sin documentos normalizados', 'Abre la fuente oficial o ejecuta ingestion para completar enlaces.'));
      return wrap;
    }
    docs.slice(0, 8).forEach((doc) => {
      const item = row(doc.title || doc.filename || doc.document_type || 'Documento', doc.official_url || doc.storage_path || 'Referencia documental');
      if (doc.official_url) {
        const link = document.createElement('a');
        link.href = doc.official_url;
        link.target = '_blank';
        link.rel = 'noreferrer';
        link.className = 'secondary-button link-button';
        link.textContent = 'Abrir';
        item.append(link);
      }
      wrap.append(item);
    });
    return wrap;
  };

  const renderDecisionSummary = () => {
    const wrap = document.createElement('div');
    wrap.className = 'detail-decision-box';
    const breakdown = data.tracked?.decision_breakdown || null;
    const score = breakdown?.total || tender.match_score || 0;
    const recommendation = breakdown?.recommendation || 'review';
    const scoreBox = document.createElement('div');
    scoreBox.className = 'detail-score-box';
    const strong = document.createElement('strong');
    strong.textContent = `${score}`;
    const span = document.createElement('span');
    span.textContent = `/100 · ${scoreLabel(recommendation)}`;
    scoreBox.append(strong, span);
    const text = document.createElement('p');
    text.textContent = data.tracked?.decision
      ? `Decision manual registrada: ${scoreLabel(data.tracked.decision)}.`
      : 'Sin decision manual. Calcula score o marca GO/NO-GO para fijar criterio.';
    wrap.append(scoreBox, text);
    const localActions = document.createElement('div');
    localActions.className = 'action-row';
    localActions.append(
      button('Calcular score', () => handleDecisionScore(), 'secondary-button'),
      button('Marcar GO', () => handleDecisionScore('go'), 'secondary-button'),
      button('Marcar NO-GO', () => handleDecisionScore('no_go'), 'secondary-button')
    );
    wrap.append(localActions);
    return wrap;
  };

  const tabs = [
    ['resumen', 'Resumen', () => [renderMetaGrid()]],
    ['documentos', 'Documentos', () => [renderDocumentList()]],
    ['decision', 'Decision', () => [renderDecisionSummary()]],
    ['tareas', 'Tareas', () => [row('Expediente operativo', 'Prepara checklist, tareas e hitos desde la accion principal.')]],
    ['propuesta', 'Propuesta', () => [row('Propuesta y dossier', 'Genera borrador tecnico, revisa propuesta y exporta dossier desde esta oportunidad.')]],
    ['auditoria', 'Auditoria', () => {
      const versions = data.versions || [];
      if (!versions.length) return [row('Sin cambios registrados', 'Aun no hay versiones normalizadas para esta licitacion.')];
      return versions.slice(0, 6).map((version) => row(version.change_type || 'Cambio', `${dateLabel(version.created_at)} · ${version.summary || version.source_hash || '-'}`));
    }]
  ];

  function activateTab(tabId) {
    tabList.querySelectorAll('button').forEach((btn) => {
      const active = btn.dataset.detailTab === tabId;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    tabPanel.replaceChildren();
    const tab = tabs.find(([id]) => id === tabId) || tabs[0];
    tab[2]().forEach((node) => tabPanel.append(node));
  }

  tabs.forEach(([id, label], index) => {
    const tab = document.createElement('button');
    tab.type = 'button';
    tab.dataset.detailTab = id;
    tab.setAttribute('role', 'tab');
    tab.setAttribute('aria-selected', index === 0 ? 'true' : 'false');
    tab.textContent = label;
    tab.addEventListener('click', () => activateTab(id));
    tabList.append(tab);
  });

  shell.append(hero, actions, tabList, tabPanel);
  target.append(shell);
  activateTab('resumen');

  if (data.tracked?.decision_breakdown?.total) renderScore(data.tracked.decision_breakdown, data.tracked);
  else handleDecisionScore().catch(() => null);
  renderAnalysis(null);
  renderWorkflow(null);
  renderProposal(null);
  renderDossier(null);
}

async function loadTenderDetail(tenderId) {
  const target = qs('#tenderDetail');
  if (target) renderSkeleton(target, 4, 'skeleton-row');
  try {
    const detail = await getTenderDetail({ tenderId });
    renderTenderDetail(detail);
  } catch (error) {
    renderErrorState(target, 'No se pudo cargar la ficha', error, () => loadTenderDetail(tenderId));
  }
}

async function saveTrackedTender(tenderId) {
  const target = qs('#tenderDetail');
  try {
    await trackTender({
      tenderId,
      internalStatus: 'analysis',
      priority: 'normal',
      notes: 'Guardada desde busqueda Sprint 3'
    });
    trackProductEvent('tender_tracked', { source: 'ficha_360' }, { resourceType: 'tender', resourceId: tenderId });
    showToast('Oportunidad guardada en seguimiento.', 'success');
    await loadTenderDetail(tenderId);
  } catch (error) {
    if (target) target.append(row('Error guardando seguimiento', safeErrorMessage(error)));
    showToast(safeErrorMessage(error), 'error');
  }
}

async function handleRunAlerts() {
  const btn = qs('#runAlertsButton');
  if (btn) btn.textContent = 'Evaluando...';
  try {
    const response = await runAlerts({});
    if (btn) btn.textContent = `Alertas: ${response.eventsCreated || 0}`;
  } catch (error) {
    if (btn) btn.textContent = error.message;
  }
}

export async function initAppShell() {
  const user = await requireSession();
  if (!user) return;
  state.user = user;
  state.userSettings = loadUserSettings();
  state.aiSettings = loadAiSettings();
  applyUserSettings();
  renderUserIdentity();
  setupSidebarNavigation();
  setupOpsTabs();
  setupUserMenu();
  restoreOpportunitySearchFromUrl();
  setupGlobalSearch();
  const searchForm = qs('#tenderSearchForm');
  if (searchForm) renderActiveFilterChips(buildSearchPayload(searchForm));
  await loadHealth();
  await loadOnboarding();
  setupErrorTracking();
  await loadSystemHealth();
  await loadCompetitiveDashboard();
  await loadOpsDashboard();
  qs('#accountSettingsForm')?.addEventListener('submit', handleAccountSettings);
  qs('#aiSettingsForm')?.addEventListener('submit', handleAiSettings);
  qs('#clearAiKeyButton')?.addEventListener('click', handleClearAiKey);
  qs('#profileEditForm')?.addEventListener('submit', handleProfileUpdate);
  qs('#tenderSearchForm')?.addEventListener('submit', handleTenderSearch);
  qs('#runAlertsButton')?.addEventListener('click', handleRunAlerts);
  qs('#logoutButton')?.addEventListener('click', async () => {
    await recordAuditEvent({
      action: 'auth.logout',
      organizationId: state.onboarding?.organization?.id || null
    }).catch(() => null);
    await signOut();
    window.location.href = './acceso.html';
  });
}
