import { callFunction, clearSession, getStoredUser, signIn, signOut } from './api-client.js';
import { hasBackendConfig } from './config.js';

const ADMIN_TOKEN_KEY = 'future_book_admin_token';

const tokenForm = document.querySelector('#adminTokenForm');
const tokenInput = document.querySelector('#adminTokenInput');
const adminEmailInput = document.querySelector('#adminEmailInput');
const adminPasswordInput = document.querySelector('#adminPasswordInput');
const adminGate = document.querySelector('#adminGate');
const workspace = document.querySelector('#adminWorkspace');
const adminMode = document.querySelector('#adminMode');
const adminStatus = document.querySelector('#adminStatus');
const adminIdentity = document.querySelector('#adminIdentity');
const refreshButton = document.querySelector('#refreshAdminButton');
const adminLogoutButton = document.querySelector('#adminLogoutButton');
const opsHeadline = document.querySelector('#opsHeadline');
const opsSubline = document.querySelector('#opsSubline');
const opsSnapshot = document.querySelector('#opsSnapshot');
const auditChecklist = document.querySelector('#auditChecklist');
const accessToggleButton = document.querySelector('#accessToggleButton');
const deleteSessionForm = document.querySelector('#deleteSessionForm');
const deleteSessionInput = document.querySelector('#deleteSessionInput');
const metricsGrid = document.querySelector('#metricsGrid');
const monitorGrid = document.querySelector('#monitorGrid');
const costGrid = document.querySelector('#costGrid');
const securityGrid = document.querySelector('#securityGrid');
const retentionDryRunButton = document.querySelector('#retentionDryRunButton');
const retentionRunButton = document.querySelector('#retentionRunButton');
const privacyOpsForm = document.querySelector('#privacyOpsForm');
const privacySessionInput = document.querySelector('#privacySessionInput');
const securityReport = document.querySelector('#securityReport');
const observabilityGrid = document.querySelector('#observabilityGrid');
const syntheticRunButton = document.querySelector('#syntheticRunButton');
const autonomousMonitorButton = document.querySelector('#autonomousMonitorButton');
const deadLetterBody = document.querySelector('#deadLetterBody');
const observabilityReport = document.querySelector('#observabilityReport');
const viralAccessGrid = document.querySelector('#viralAccessGrid');
const accessPolicyForm = document.querySelector('#accessPolicyForm');
const accessModeInput = document.querySelector('#accessModeInput');
const accessCampaignCodeInput = document.querySelector('#accessCampaignCodeInput');
const fixedBetaEnabledInput = document.querySelector('#fixedBetaEnabledInput');
const waitlistEnabledInput = document.querySelector('#waitlistEnabledInput');
const accessCampaignForm = document.querySelector('#accessCampaignForm');
const campaignNameInput = document.querySelector('#campaignNameInput');
const campaignCodeInput = document.querySelector('#campaignCodeInput');
const campaignMaxSessionsInput = document.querySelector('#campaignMaxSessionsInput');
const campaignTtlInput = document.querySelector('#campaignTtlInput');
const accessInviteForm = document.querySelector('#accessInviteForm');
const inviteCampaignIdInput = document.querySelector('#inviteCampaignIdInput');
const inviteCountInput = document.querySelector('#inviteCountInput');
const inviteTtlInput = document.querySelector('#inviteTtlInput');
const inviteChildLimitInput = document.querySelector('#inviteChildLimitInput');
const viralInviteOutput = document.querySelector('#viralInviteOutput');
const accessCampaignBody = document.querySelector('#accessCampaignBody');
const accessInviteBody = document.querySelector('#accessInviteBody');
const providerGrid = document.querySelector('#providerGrid');
const sessionsBody = document.querySelector('#sessionsBody');
const sessionDetailForm = document.querySelector('#sessionDetailForm');
const sessionDetailInput = document.querySelector('#sessionDetailInput');
const sessionRepairForm = document.querySelector('#sessionRepairForm');
const repairSessionIdInput = document.querySelector('#repairSessionIdInput');
const repairStatusInput = document.querySelector('#repairStatusInput');
const repairBookStatusInput = document.querySelector('#repairBookStatusInput');
const repairPdfStatusInput = document.querySelector('#repairPdfStatusInput');
const repairReasonInput = document.querySelector('#repairReasonInput');
const repairClearErrorInput = document.querySelector('#repairClearErrorInput');
const sessionDetail = document.querySelector('#sessionDetail');
const caronteBody = document.querySelector('#caronteBody');
const manuscriptBody = document.querySelector('#manuscriptBody');
const pdfBody = document.querySelector('#pdfBody');
const printValidationStatus = document.querySelector('#printValidationStatus');
const printValidationPending = new Set();
const printQuotePanel = document.querySelector('#printQuotePanel');
const printQuoteForm = document.querySelector('#printQuoteForm');
const printQuoteSummary = document.querySelector('#printQuoteSummary');
const printQuoteActionStatus = document.querySelector('#printQuoteActionStatus');
const printQuoteConsent = document.querySelector('#printQuoteConsent');
const printQuoteCurrency = document.querySelector('#printQuoteCurrency');
const printShippingLevel = document.querySelector('#printShippingLevel');
const printShippingOptionsButton = document.querySelector('#printShippingOptionsButton');
const printQuoteCalculateButton = document.querySelector('#printQuoteCalculateButton');
const printAddressFields = Object.fromEntries(Object.entries({name:'Name',street1:'Street1',street2:'Street2',city:'City',postcode:'Postcode',country_code:'Country',state_code:'State',phone_number:'Phone',email:'Email'})
  .map(([key,suffix]) => [key,document.querySelector(`#printAddress${suffix}`)]));
let selectedPrintPdfId = '', selectedPrintBinding = null, printQuoteBusy = false, printShippingFingerprint = null;
const printPrepareOrderButton = document.querySelector('#printPrepareOrderButton');
const printOrderPanel = document.querySelector('#printOrderPanel');
const printOrderSummary = document.querySelector('#printOrderSummary');
const printOrderActionStatus = document.querySelector('#printOrderActionStatus');
const printOrderApprovalForm = document.querySelector('#printOrderApprovalForm');
const printOrderAmount = document.querySelector('#printOrderAmount');
const printOrderConsent = document.querySelector('#printOrderConsent');
const printManualPaymentConsent = document.querySelector('#printManualPaymentConsent');
const printPaymentPortal = document.querySelector('#printPaymentPortal');
const printOrderButtons = Object.fromEntries(['Approve','Submit','Status','Sync','Reconcile'].map(kind=>[kind.toLowerCase(),document.querySelector(`#printOrder${kind}Button`)]));
let lastPrintQuotation = null, confirmedPrintQuoteInput = null, selectedPrintOrderPdfId = '', selectedPrintOrder = null, printOrderBusy = false;
const pdfPreview = document.querySelector('#pdfPreview');
const coverPdfLink = document.querySelector('#coverPdfLink');
const previewMeta = document.querySelector('#previewMeta');
const adminAuditBody = document.querySelector('#adminAuditBody');
const bookJobsBody = document.querySelector('#bookJobsBody');
const bookJobStepsBody = document.querySelector('#bookJobStepsBody');
const bookJobSummary = document.querySelector('#bookJobSummary');
const bookRuntimeStatus = document.querySelector('#bookRuntimeStatus');
const bookJobReasonInput = document.querySelector('#bookJobReasonInput');
const bookJobActionStatus = document.querySelector('#bookJobActionStatus');
const resumeBookButton = document.querySelector('#resumeBookButton');
const cancelBookButton = document.querySelector('#cancelBookButton');
const printJobsBody = document.querySelector('#printJobsBody');
const printJobStepsBody = document.querySelector('#printJobStepsBody');
const printJobSummary = document.querySelector('#printJobSummary');
const printJobReasonInput = document.querySelector('#printJobReasonInput');
const printJobActionStatus = document.querySelector('#printJobActionStatus');
const resumePrintButton = document.querySelector('#resumePrintButton');
const cancelPrintButton = document.querySelector('#cancelPrintButton');
const morePrintJobsButton = document.querySelector('#morePrintJobsButton');
let selectedPrintJobId = '', selectedPrintJobDetail = null, printJobBusy = false, printJobUnconfirmed = false;
let printJobsPageState = null, printJobsPageBusy = false;

let adminToken = sessionStorage.getItem(ADMIN_TOKEN_KEY) || '';
let selectedSessionId = '';
let latestDashboardData = null;
let selectedBookJobId = '';
let bookJobActionPending = false;
let selectedBookJobDetail = null;

function setText(node, value) {
  if (node) node.textContent = value;
}


function shortId(value) {
  return String(value || '').slice(0, 8) || 'local';
}


function escapeHtml(value) {
  const entities = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  };
  return String(value ?? '').replace(/[&<>"']/g, (char) => entities[char]);
}

function formatDate(value) {
  if (!value) return 'n/a';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat('es-ES', {
    dateStyle: 'short',
    timeStyle: 'short'
  }).format(date);
}

function statusText(value) {
  const status = String(value || 'n/a');
  const labels = {
    created: 'Creada',
    payment_pending: 'Pago pendiente',
    interview_ready: 'Entrevista lista',
    interview_active: 'En entrevista',
    interview_completed: 'Entrevista cerrada',
    book_generating: 'Generando libro',
    pending_review: 'Pendiente de revision',
    approved: 'Aprobado',
    rejected: 'Rechazado',
    blocked: 'Bloqueado',
    queued: 'En cola',
    running: 'En proceso',
    cancelled: 'Cancelado',
    completed: 'Completado',
    started: 'Preparado',
    regeneration_requested: 'Regeneracion pedida',
    released_to_customer: 'Liberado',
    ready_for_print: 'Listo para imprimir',
    ready: 'Listo',
    quoted: 'Presupuesto confirmado',
    expired: 'Caducado',
    invalidated: 'Invalidado',
    not_quoted: 'Sin presupuesto',
    pending: 'Pendiente',
    normalized: 'Normalizado',
    failed: 'Fallido',
    unknown: 'Sin comprobar',
    submitting: 'Envío en curso; no repetir',
    uncertain: 'Conciliación necesaria',
    binding_changed: 'Archivos modificados; revisión necesaria',
    approval_required: 'Revisión necesaria',
    pending_external_preflight: 'Pendiente de Lulu',
    not_ready: 'No listo',
    configured: 'Configurado',
    not_configured: 'Sin configurar',
    placeholder: 'Pendiente',
    local_only: 'Solo local',
    n_a: 'n/a',
    'n/a': 'n/a'
  };
  return labels[status] || status.replaceAll('_', ' ');
}

function statusTone(value) {
  const status = String(value || '');
  if (['approved', 'configured', 'ready', 'ready_for_print', 'released_to_customer', 'open', 'active'].includes(status)) return 'good';
  if (['pending_review', 'book_generating', 'interview_active', 'interview_ready', 'regeneration_requested', 'paused', 'used', 'queued'].includes(status)) return 'warning';
  if (['rejected', 'blocked', 'degraded', 'failed', 'not_configured', 'disabled', 'not_ready', 'closed', 'expired', 'revoked'].includes(status)) return 'bad';
  return 'neutral';
}

function badge(value) {
  const status = String(value || 'n/a');
  return `<span class="status-pill status-${statusTone(status)}">${escapeHtml(statusText(status))}</span>`;
}

function providerKeyLabel(provider) {
  const labels = {
    elevenlabs: 'ElevenLabs API key',
    openai: 'GPT / OpenAI API key',
    anthropic: 'Claude / Anthropic API key',
    transcription: 'Transcription API key',
    lulu: 'Lulu API key'
  };
  return labels[provider] || `${provider} API key`;
}

function providerKeyPlaceholder(provider) {
  const placeholders = {
    elevenlabs: 'sk_...',
    openai: 'sk-proj-...',
    anthropic: 'sk-ant-...',
    transcription: 'Pegar clave STT',
    lulu: 'Pegar clave Lulu'
  };
  return placeholders[provider] || 'Pegar API key';
}

function providerOperationalLabel(provider) {
  const labels = {
    elevenlabs: 'Voz Caronte',
    openai: 'Redaccion GPT',
    anthropic: 'Revision Claude',
    transcription: 'Transcripcion',
    lulu: 'Fulfillment'
  };
  return labels[provider] || 'Proveedor';
}


async function adminAction(action, payload = {}, options = {}) {
  if (!hasBackendConfig()) throw new Error('backend_not_configured');
  return callFunction('future-book-session', { action, adminToken, ...payload }, options);
}


function renderMetrics(metrics) {
  const items = [
    ['booksDone', 'PDF entregados', 'Liberados a cliente'],
    ['inTransit', 'En transito', 'Fulfillment'],
    ['webVisitors', 'En web', 'Acceso activo'],
    ['activeSessions', 'Activas', 'Sesiones abiertas'],
    ['interviewing', 'En entrevista', 'Voz en curso'],
    ['waitingBook', 'Esperando libro', 'Entrevistas cerradas'],
    ['booksGenerating', 'En proceso', 'Libro/PDF en curso'],
    ['caronteMaps', 'Caronte', 'Mapas versionados'],
    ['pdfPendingReview', 'Por revisar', 'PDF sin aprobar'],
    ['pdfApproved', 'Aprobados', 'Listos para liberar'],
    ['pdfBlocked', 'Bloqueados', 'Rechazados o parados'],
    ['errors', 'Errores', 'Incidencias abiertas']
  ];
  metricsGrid.innerHTML = '';
  for (const [key, label, helper] of items) {
    const card = document.createElement('div');
    card.className = 'metric';
    card.innerHTML = `
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(metrics?.[key] ?? '—')}</strong>
      <small>${escapeHtml(helper)}</small>
    `;
    metricsGrid.append(card);
  }
}

function operationNumbers(data) {
  const sessions = data?.sessions || [];
  const pdfs = data?.pdfs || [];
  const metrics = data?.metrics || {};
  const doneFromPdfs = pdfs.filter((pdf) => pdfStatus(pdf) === 'released_to_customer').length;
  const transitFromPdfs = pdfs.filter((pdf) => {
    const lulu = pdf.luluMetadata || pdf.lulu_metadata || {};
    return ['in_transit', 'shipped'].includes(String(lulu.status || ''));
  }).length;
  const webNow = sessions.filter((item) => ['created', 'payment_pending', 'interview_ready', 'interview_active'].includes(item.status)).length;
  return {
    webNow: metrics.webVisitors ?? webNow,
    activeInterviews: metrics.interviewing ?? sessions.filter((item) => item.status === 'interview_active').length,
    inProcess: metrics.booksGenerating ?? sessions.filter((item) => ['interview_completed', 'book_generating', 'pending_review'].includes(item.status)).length,
    booksDone: metrics.booksDone ?? doneFromPdfs,
    inTransit: metrics.inTransit ?? transitFromPdfs,
    pendingReview: metrics.pdfPendingReview ?? pdfs.filter((pdf) => pdfStatus(pdf) === 'pending_review').length,
    revenue: data?.costs?.grossRevenueEur ?? '—',
    apiOk: (data?.providers || []).filter((provider) => provider.required && provider.configured).length,
    apiTotal: (data?.providers || []).filter((provider) => provider.required).length
  };
}

function renderOperationOverview(data) {
  const ops = operationNumbers(data);
  setText(opsHeadline, `${ops.activeInterviews} entrevistas en curso / ${ops.booksDone} PDF entregados / ${ops.inProcess} en proceso`);
  setText(opsSubline, `Backend sincronizado. Revision pendiente: ${ops.pendingReview}. Ingresos del corte: ${ops.revenue} EUR.`);
  if (!opsSnapshot) return;
  const items = [
    ['En web', ops.webNow, 'Usuarios y enlaces activos'],
    ['Entrevistas', ops.activeInterviews, 'Voz en curso'],
    ['PDF entregados', ops.booksDone, 'Liberados a cliente'],
    ['En proceso', ops.inProcess, 'Libro/PDF en curso'],
    ['En transito', ops.inTransit, 'Envíos confirmados'],
    ['Revision', ops.pendingReview, 'PDF esperando humano'],
    ['Claves', `${ops.apiOk}/${ops.apiTotal}`, 'Proveedores configurados']
  ];
  opsSnapshot.innerHTML = '';
  for (const [label, value, helper] of items) {
    const item = document.createElement('div');
    item.className = 'ops-chip';
    item.innerHTML = `
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
      <small>${escapeHtml(helper)}</small>
    `;
    opsSnapshot.append(item);
  }
}

function renderAuditChecklist(data) {
  if (!auditChecklist) return;
  const providers = data?.providers || [];
  const hasProvider = (provider) => providers.some((item) => item.provider === provider && item.configured);
  const items = [
    ['ElevenLabs', hasProvider('elevenlabs'), providers.find((item) => item.provider === 'elevenlabs')?.voiceName || 'voz no probada'],
    ['GPT', hasProvider('openai'), providers.find((item) => item.provider === 'openai')?.modelId || 'OpenAI'],
    ['Claude', hasProvider('anthropic'), providers.find((item) => item.provider === 'anthropic')?.modelId || 'Anthropic'],
    ['PDF manual', Number.isInteger(data?.metrics?.pdfPendingReview), `${data?.metrics?.pdfPendingReview ?? '—'} pendientes`],
    ['Acceso viral', data?.viralAccess?.policy?.mode ? true : false, data?.viralAccess?.policy?.mode || 'sin politica'],
    ['Retencion', (data?.security?.retentionPolicies || []).length > 0, `${(data?.security?.retentionPolicies || []).length} politicas`]
  ];
  auditChecklist.innerHTML = '';
  for (const [label, ok, helper] of items) {
    const item = document.createElement('div');
    item.className = `audit-check ${ok ? 'is-ok' : 'is-bad'}`;
    item.innerHTML = `
      <strong>${escapeHtml(label)}</strong>
      <span>${escapeHtml(ok ? 'OK' : 'REVISAR')}</span>
      <small>${escapeHtml(helper)}</small>
    `;
    auditChecklist.append(item);
  }
}

function renderMonitor(monitor) {
  if (!monitorGrid) return;
  const accessKnown = typeof monitor?.access?.disabled === 'boolean';
  const p0Counts = ['failedSessions', 'missingRequiredProviders', 'stalePendingPdfs']
    .map(key => monitor?.p0?.[key]);
  const p0Total = p0Counts.every(value => Number.isFinite(value))
    ? p0Counts.reduce((sum, value) => sum + value, 0) : '—';
  const items = [
    ['Acceso', accessKnown ? (monitor.access.disabled ? 'disabled' : 'open') : '—',
      accessKnown ? (monitor.access.disabled ? 'Cerrado para nuevos usuarios' : 'Disponible') : 'Sin información del servidor'],
    ['Alertas P0', p0Total, 'Bloqueos criticos'],
    ['Entrevista media', `${monitor?.averagesSeconds?.interview ?? 'n/a'} s`, 'Tiempo estimado'],
    ['Libro medio', `${monitor?.averagesSeconds?.bookGeneration ?? 'n/a'} s`, 'Generacion IA'],
    ['PDF medio', `${monitor?.averagesSeconds?.pdfAfterBook ?? 'n/a'} s`, 'Postproceso'],
    ['Alertas abiertas', Array.isArray(monitor?.alerts) ? monitor.alerts.length : '—', 'Revisar si sube']
  ];
  monitorGrid.innerHTML = '';
  for (const [label, value, helper] of items) {
    const card = document.createElement('div');
    card.className = `monitor-item ${label === 'Alertas P0' && Number(value) > 0 ? 'is-p0' : ''}`;
    card.innerHTML = `
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
      <small>${escapeHtml(helper)}</small>
    `;
    monitorGrid.append(card);
  }
  if (accessToggleButton) {
    accessToggleButton.disabled = !accessKnown;
    accessToggleButton.textContent = accessKnown ? (monitor.access.disabled ? 'Reabrir acceso' : 'Cerrar acceso') : 'Acceso sin información';
    if (accessKnown) accessToggleButton.dataset.disabledNow = monitor.access.disabled ? 'true' : 'false';
    else delete accessToggleButton.dataset.disabledNow;
  }
}

function renderCosts(costs) {
  if (!costGrid) return;
  const items = [
    ['Valor de sesiones', costs?.grossRevenueEur == null ? '—' : `${costs.grossRevenueEur} EUR`, 'Estimación, no ingresos cobrados'],
    ['Sesiones', costs?.sessionsInWindow ?? '—', 'Ventana operativa'],
    ['Accesos aprobados', costs?.paidOrApprovedSessions ?? '—', 'No acredita un pago real'],
    ['Respuestas', costs?.answersCaptured ?? '—', 'Transcripciones'],
    ['Llamadas IA', costs?.providerCallsApprox ?? '—', 'Estimacion interna'],
    ['Manuscritos', costs?.manuscriptsGenerated ?? '—', 'Caronte literario'],
    ['PDFs', costs?.pdfsGenerated ?? '—', 'Artefactos generados'],
    ['Revision', costs?.pendingEditorialCostDrivers ?? '—', 'Pendientes']
  ];
  costGrid.innerHTML = '';
  for (const [label, value, helper] of items) {
    const card = document.createElement('div');
    card.className = 'monitor-item';
    card.innerHTML = `
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
      <small>${escapeHtml(helper)}</small>
    `;
    costGrid.append(card);
  }
}

function renderSecurity(security) {
  if (!securityGrid) return;
  const policies = Array.isArray(security?.retentionPolicies) ? security.retentionPolicies : [];
  const ttl = type => {
    const days = policies.find(item => item.data_type === type)?.ttl_days;
    return days == null ? '—' : `${days} d`;
  };
  const items = [
    ['Bloqueos', security?.abuseBlocked ?? '—', 'Rate limit'],
    ['Challenges', security?.abuseChallenges ?? '—', 'Anti-abuso'],
    ['Eventos abuso', Array.isArray(security?.abuseEvents) ? security.abuseEvents.length : '—', 'Ultimos 120'],
    ['RGPD', Array.isArray(security?.privacyRequests) ? security.privacyRequests.length : '—', 'Solicitudes'],
    ['Politicas', Array.isArray(security?.retentionPolicies) ? policies.length : '—', 'Retencion'],
    ['Audio TTL', ttl('audio'), 'Storage privado'],
    ['Respuestas TTL', ttl('answers'), 'Datos sensibles'],
    ['Auditoria TTL', ttl('admin_audit'), 'Minimizada']
  ];
  securityGrid.innerHTML = '';
  for (const [label, value, helper] of items) {
    const card = document.createElement('div');
    card.className = 'monitor-item';
    card.innerHTML = `
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
      <small>${escapeHtml(helper)}</small>
    `;
    securityGrid.append(card);
  }
}

function renderDeadLetters(deadLetters) {
  if (!deadLetterBody) return;
  deadLetterBody.innerHTML = '';
  if (!Array.isArray(deadLetters)) {
    deadLetterBody.innerHTML = '<tr class="empty-row"><td colspan="6">Incidencias no disponibles.</td></tr>';
    return;
  }
  if (!deadLetters?.length) {
    deadLetterBody.innerHTML = '<tr class="empty-row"><td colspan="6">Sin dead letters abiertas.</td></tr>';
    return;
  }
  for (const item of deadLetters || []) {
    const row = document.createElement('tr');
    const id = escapeHtml(item.id);
    const status = String(item.status || 'open');
    const retryBlocked = !['open', 'retrying'].includes(status)
      || String(item.failed_action || item.failedAction || '').includes('book')
      || item.error_code === 'provider_submission_uncertain' || item.diagnostic?.uncertain === true;
    row.innerHTML = `
      <td>${escapeHtml(formatDate(item.created_at || item.createdAt))}</td>
      <td><code>${escapeHtml(shortId(item.session_id || item.sessionId || item.target_id))}</code></td>
      <td>${escapeHtml(item.failed_action || item.failedAction || 'n/a')}</td>
      <td>${badge(item.severity || 'warning')}</td>
      <td>${badge(status)}</td>
      <td>
        <div class="row-actions">
          <button type="button" data-retry-dead-letter="${id}" ${retryBlocked ? 'disabled' : ''}>Retry</button>
          <button class="secondary" type="button" data-resolve-dead-letter="${id}" ${!['open', 'retrying'].includes(status) ? 'disabled' : ''}>Resolver</button>
        </div>
      </td>
    `;
    deadLetterBody.append(row);
  }
}

function renderObservability(observability) {
  if (!observabilityGrid) return;
  const latestSynthetic = observability?.latestSynthetic || {};
  const latestSla = observability?.latestSla || {};
  const sla = latestSla.sla || {};
  const conversion = latestSla.conversion?.rates || {};
  const costAnomaly = latestSla.cost?.anomaly || {};
  const items = [
    ['Synthetic', latestSynthetic.status || 'n/a', latestSynthetic.duration_ms ? `${latestSynthetic.duration_ms} ms` : 'ultimo run'],
    ['Dead letters', observability?.deadLetterOpen ?? '—', 'Abiertas'],
    ['SLA', sla.health || 'n/a', 'Estado interno'],
    ['Stuck now', Array.isArray(observability?.stuckNow) ? observability.stuckNow.length : '—', 'Detectadas'],
    ['Release rate', conversion.released ?? '—', 'Conversion'],
    ['Book ready', conversion.bookReady ?? '—', 'Conversion'],
    ['Cost anomaly', typeof costAnomaly.anomaly === 'boolean' ? (costAnomaly.anomaly ? 'yes' : 'no') : '—', costAnomaly.reason || 'Sin evaluación'],
    ['Alert webhook', observability?.alertDeliveries?.[0]?.status || 'n/a', 'Ultimo envio']
  ];
  observabilityGrid.innerHTML = '';
  for (const [label, value, helper] of items) {
    const card = document.createElement('div');
    card.className = `monitor-item ${label === 'Dead letters' && Number(value) > 0 ? 'is-p0' : ''}`;
    card.innerHTML = `
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
      <small>${escapeHtml(helper)}</small>
    `;
    observabilityGrid.append(card);
  }
  renderDeadLetters(observability?.deadLetters);
}

function renderAccessCampaigns(campaigns) {
  if (!accessCampaignBody) return;
  accessCampaignBody.innerHTML = '';
  if (!campaigns?.length) {
    accessCampaignBody.innerHTML = '<tr class="empty-row"><td colspan="5">Sin campanas.</td></tr>';
    return;
  }
  for (const campaign of campaigns) {
    const row = document.createElement('tr');
    const id = escapeHtml(campaign.id);
    row.innerHTML = `
      <td><strong>${escapeHtml(campaign.code || campaign.name || shortId(campaign.id))}</strong><br><code>${escapeHtml(shortId(campaign.id))}</code></td>
      <td>${badge(campaign.status || 'active')}</td>
      <td>${escapeHtml(campaign.accessMode || campaign.access_mode || 'invite_required')}</td>
      <td>${escapeHtml(campaign.usedSessions ?? campaign.used_sessions ?? 0)} / ${escapeHtml(campaign.maxSessions ?? campaign.max_sessions ?? 0)}</td>
      <td>
        <div class="row-actions">
          <button type="button" data-campaign-invites="${id}">Usar</button>
          <button class="secondary" type="button" data-pause-campaign="${id}">Pausar</button>
          <button class="danger" type="button" data-close-campaign="${id}">Cerrar</button>
        </div>
      </td>
    `;
    accessCampaignBody.append(row);
  }
}

function renderAccessInvites(invites) {
  if (!accessInviteBody) return;
  accessInviteBody.innerHTML = '';
  if (!invites?.length) {
    accessInviteBody.innerHTML = '<tr class="empty-row"><td colspan="6">Sin enlaces emitidos.</td></tr>';
    return;
  }
  for (const invite of invites) {
    const row = document.createElement('tr');
    const id = escapeHtml(invite.id);
    row.innerHTML = `
      <td><code>...${escapeHtml(invite.tokenHint || invite.token_hint || shortId(invite.id))}</code></td>
      <td><code>${escapeHtml(shortId(invite.campaignId || invite.campaign_id))}</code></td>
      <td>${badge(invite.status || 'active')}</td>
      <td>${escapeHtml(invite.useCount ?? invite.use_count ?? 0)} / ${escapeHtml(invite.maxUses ?? invite.max_uses ?? 1)}</td>
      <td>${escapeHtml(formatDate(invite.expiresAt || invite.expires_at))}</td>
      <td><button class="secondary" type="button" data-revoke-invite="${id}" ${invite.status !== 'active' ? 'disabled' : ''}>Revocar</button></td>
    `;
    accessInviteBody.append(row);
  }
}

function renderViralAccess(viralAccess) {
  if (!viralAccessGrid) return;
  const policy = viralAccess?.policy || {};
  const metrics = viralAccess?.metrics || {};
  const items = [
    ['Modo', policy.mode || '—', typeof policy.fixedBetaEnabled === 'boolean' ? (policy.fixedBetaEnabled ? 'fixed beta abierto' : 'cerrado') : 'Sin información'],
    ['Campanas', metrics.activeCampaigns ?? '—', 'Activas'],
    ['Links abiertos', metrics.openInvites ?? '—', 'No consumidos'],
    ['Links usados', metrics.usedInvites ?? '—', 'Consumidos'],
    ['Caducados', metrics.expiredInvites ?? '—', 'TTL vencido'],
    ['Waitlist', metrics.waitlistQueued ?? '—', 'Cola opaca']
  ];
  viralAccessGrid.innerHTML = '';
  for (const [label, value, helper] of items) {
    const card = document.createElement('div');
    card.className = `monitor-item ${label === 'Modo' && value === 'invite_required' ? 'is-p0' : ''}`;
    card.innerHTML = `
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
      <small>${escapeHtml(helper)}</small>
    `;
    viralAccessGrid.append(card);
  }
  if (accessModeInput) accessModeInput.value = policy.mode || 'fixed_beta';
  if (accessCampaignCodeInput) accessCampaignCodeInput.value = policy.campaignCode || '';
  if (fixedBetaEnabledInput) fixedBetaEnabledInput.checked = policy.fixedBetaEnabled === true;
  if (waitlistEnabledInput) waitlistEnabledInput.checked = policy.waitlistEnabled !== false;
  renderAccessCampaigns(viralAccess?.campaigns || []);
  renderAccessInvites(viralAccess?.invites || []);
}

let luluCredentialSavePending = false;
function providerPermission(action) {
  const admin=latestDashboardData?.admin;
  return Array.isArray(admin?.permissions)?admin.permissions.includes('*')||admin.permissions.includes(action)
    :['owner','legacy_token','local_admin'].includes(admin?.role)||action==='adminTestProvider'&&admin?.role==='ops';
}
function renderLuluCredentialForm(provider) {
  const probe=providerPermission('adminTestProvider')?'<button class="secondary" type="button" data-test-provider="lulu">Probar OAuth</button>':'';
  if(provider.managedByEnvironment===true)return `<p>Par OAuth gestionado por el servidor. No se modifica desde este panel.</p>${probe}`;
  if(!providerPermission('adminSaveLuluCredentials'))return `<p>OAuth de Lulu: Client Key y Client Secret privados. Solo el propietario puede guardar el par.</p>${probe}`;
  return `<form data-lulu-credentials-form data-expected-revision="${escapeHtml(provider.updatedAt||'')}">
    <label class="provider-secret-field"><span>Entorno de Lulu · obligatorio</span><select name="environment" required>
      <option value="">Seleccione el entorno</option><option value="sandbox">Pruebas · sandbox</option><option value="production">Real · producción</option></select></label>
    <label class="provider-secret-field"><span>Client Key · obligatorio</span><input name="clientKey" type="password" maxlength="2048" autocomplete="off" autocapitalize="off" spellcheck="false" required></label>
    <label class="provider-secret-field"><span>Client Secret · obligatorio</span><input name="clientSecret" type="password" maxlength="2048" autocomplete="off" autocapitalize="off" spellcheck="false" required></label>
    <label class="check-row"><input name="saveConsent" type="checkbox" value="yes" required><span>Autorizo guardar este par cifrado. No prueba la conexión ni autoriza pedidos o pagos.</span></label>
    <small>Solo escritura. El panel vacía los campos al enviar y no guarda las claves en almacenamiento local. Otro par bloquea los recibos de impresión anteriores hasta revisar la configuración.</small>
    <div class="provider-actions"><button type="submit">Guardar par OAuth</button>${probe}</div>
    <p data-lulu-save-status role="status" aria-live="polite"></p>
  </form>`;
}

function renderProviders(providers) {
  const focused=document.activeElement?.closest?.('[data-lulu-credentials-form]');
  const current=(providers||[]).find(provider=>provider.provider==='lulu');
  if(focused&&!luluCredentialSavePending&&providerPermission('adminSaveLuluCredentials')&&current?.managedByEnvironment!==true&&
    focused.dataset.expectedRevision===(current?.updatedAt||''))return;
  providerGrid.innerHTML = '';
  for (const provider of providers || []) {
    const card = document.createElement('article');
    card.className = 'provider-card';
    const status = provider.configured ? 'configured' : (provider.status || 'not_configured');
    const required = provider.required ? 'Obligatorio' : 'Opcional';
    const last4 = provider.secretLast4 ? `**** ${provider.secretLast4}` : 'Sin clave visible';
    const probe = provider.testStatus || provider.testResult || (provider.testedAt ? 'tested' : 'not_tested');
    const voiceInfo = provider.provider === 'elevenlabs'
      ? ` / voice=${provider.voiceName || provider.voiceId || 'pendiente'}`
      : '';
    const modelInfo = provider.modelId ? ` / model=${provider.modelId}` : '';
    const providerId = escapeHtml(provider.provider);
    const keyLabel = providerKeyLabel(provider.provider);
    const keyPlaceholder = providerKeyPlaceholder(provider.provider);
    const credentialForm = provider.provider === 'lulu'
      ? renderLuluCredentialForm(provider)
      : `<form data-provider-form="${providerId}">
        <label class="provider-secret-field">
          <span>${escapeHtml(keyLabel)}</span>
          <input name="apiKey" type="password" autocomplete="off" spellcheck="false" placeholder="${escapeHtml(keyPlaceholder)}" aria-label="${escapeHtml(keyLabel)}">
        </label>
        <small>Write-only: se guarda cifrada o como secret server-side. El navegador no puede leerla despues.</small>
        <div class="provider-actions">
          <button type="submit">Guardar key</button>
          <button class="secondary" type="button" data-test-provider="${providerId}">Probar conexion</button>
        </div>
      </form>`;
    card.innerHTML = `
      <div class="provider-head">
        <div>
          <span>${escapeHtml(providerOperationalLabel(provider.provider))}</span>
          <h3>${escapeHtml(provider.displayName || provider.provider)}</h3>
        </div>
        ${badge(status)}
      </div>
      <p>${escapeHtml(required)} / ${escapeHtml(last4)} / ${escapeHtml(provider.source || 'missing')} / probe=${escapeHtml(probe)}${escapeHtml(modelInfo)}${escapeHtml(voiceInfo)}</p>
      ${credentialForm}
    `;
    providerGrid.append(card);
  }
}

function renderSessions(sessions) {
  sessionsBody.innerHTML = '';
  if (!sessions?.length) {
    sessionsBody.innerHTML = '<tr class="empty-row"><td colspan="6">Aun no hay sesiones registradas.</td></tr>';
    return;
  }
  for (const session of sessions || []) {
    const status = session.status || 'unknown';
    const bookStatus = session.book_status || session.bookStatus || 'n/a';
    const pdfReviewStatus = session.pdf_review_status || session.pdfReviewStatus || 'n/a';
    const row = document.createElement('tr');
    row.innerHTML = `
      <td><code>${escapeHtml(shortId(session.id))}</code></td>
      <td>${badge(status)}</td>
      <td>${escapeHtml(statusText(bookStatus))}</td>
      <td>${badge(pdfReviewStatus)}</td>
      <td>${escapeHtml(formatDate(session.updated_at || session.updatedAt || session.created_at || session.createdAt))}</td>
      <td><button type="button" class="secondary" data-session-detail="${escapeHtml(session.id)}">Abrir</button></td>
    `;
    sessionsBody.append(row);
  }
}

function renderManuscripts(manuscripts) {
  if (!manuscriptBody) return;
  manuscriptBody.innerHTML = '';
  if (!manuscripts?.length) {
    manuscriptBody.innerHTML = '<tr class="empty-row"><td colspan="6">Aun no hay manuscritos generados.</td></tr>';
    return;
  }
  for (const manuscript of manuscripts || []) {
    const row = document.createElement('tr');
    const quality = manuscript.quality_score ?? manuscript.qualityScore ?? manuscript.quality_report?.score ?? 'n/a';
    row.innerHTML = `
      <td><code>${escapeHtml(shortId(manuscript.session_id || manuscript.sessionId))}</code></td>
      <td><strong>${escapeHtml(manuscript.title || 'Sin titulo')}</strong></td>
      <td>${badge(manuscript.status || 'draft')}</td>
      <td>${escapeHtml(quality)}</td>
      <td>${escapeHtml(manuscript.prompt_version || manuscript.promptVersion || 'n/a')}</td>
      <td>${escapeHtml(formatDate(manuscript.created_at || manuscript.createdAt))}</td>
    `;
    manuscriptBody.append(row);
  }
}

function renderCaronteMaps(psychMaps) {
  if (!caronteBody) return;
  caronteBody.innerHTML = '';
  if (!psychMaps?.length) {
    caronteBody.innerHTML = '<tr class="empty-row"><td colspan="5">No hay mapas Caronte generados.</td></tr>';
    return;
  }
  for (const item of psychMaps || []) {
    const status = item.status || item.quality_report?.status || 'n/a';
    const row = document.createElement('tr');
    row.innerHTML = `
      <td><code>${escapeHtml(shortId(item.session_id || item.sessionId))}</code></td>
      <td>v${escapeHtml(item.version || '1')}</td>
      <td>${escapeHtml(item.prompt_version || item.promptVersion || 'n/a')}</td>
      <td>${badge(status)}</td>
      <td>${escapeHtml(formatDate(item.created_at || item.createdAt))}</td>
    `;
    caronteBody.append(row);
  }
}

function pdfStatus(pdf) {
  return pdf.reviewStatus || pdf.review_status || 'pending_review';
}

function printValidationAllowed(pdf) {
  const admin = latestDashboardData?.admin;
  const allowed = Array.isArray(admin?.permissions)
    ? admin.permissions.includes('*') || admin.permissions.includes('adminValidatePrint')
    : ['editor', 'ops', 'owner', 'legacy_token', 'local_admin'].includes(admin?.role);
  const validation = pdf?.printValidation || pdf?.print_validation || {};
  const metadata = pdf?.metadata || {};
  const state = validation.preflight;
  const pages = pdf?.pageCount ?? pdf?.page_count;
  const held = ['submitting', 'uncertain', 'failed', 'binding_changed', 'approval_required'];
  return allowed && ['approved', 'released_to_customer'].includes(pdfStatus(pdf)) &&
    metadata.template === 'caronte-a5-embedded-v2' && metadata.storage_verified === true &&
    !!validation.editorial_approval && Number.isSafeInteger(pages) && pages >= 180 && pages <= 200 &&
    state?.status !== 'ready' && !held.includes(state?.status) &&
    !held.includes(state?.interior?.state) && !held.includes(state?.cover?.state);
}

function renderPdfs(pdfs) {
  pdfBody.innerHTML = '';
  if (!pdfs?.length) {
    pdfBody.innerHTML = '<tr class="empty-row"><td colspan="5">No hay PDFs pendientes de revision.</td></tr>';
    return;
  }
  for (const pdf of pdfs || []) {
    const row = document.createElement('tr');
    const status = pdfStatus(pdf);
    const lulu = pdf.luluMetadata || pdf.lulu_metadata || {};
    const validation = pdf.printValidation || pdf.print_validation || {};
    const state = validation.preflight;
    const ready = lulu.ready_for_print === true && validation.ready_for_print === true &&
      !!validation.editorial_approval && state?.status === 'ready' &&
      state.interior?.state === 'normalized' && state.cover?.state === 'normalized';
    const luluStatus = ready ? 'ready_for_print' : state?.status || lulu.ready_for_print_status || 'unknown';
    const progress = state ? `<small>Interior: ${escapeHtml(statusText(state.interior?.state || 'pending'))}` +
      ` · Cubierta: ${escapeHtml(statusText(state.cover?.state || 'pending'))}</small>` : '';
    const pdfId = escapeHtml(pdf.id);
    row.innerHTML = `
      <td><strong>${escapeHtml(pdf.fileName || pdf.file_name || shortId(pdf.id))}</strong></td>
      <td>${badge(status)}</td>
      <td>${escapeHtml(pdf.pageCount || pdf.page_count || 'n/a')}</td>
      <td>${badge(luluStatus)}${progress}</td>
      <td>
        <div class="row-actions">
          <button type="button" data-preview-pdf="${pdfId}">Ver</button>
          <button type="button" data-approve-pdf="${pdfId}" ${status !== 'pending_review' ? 'disabled' : ''}>Aprobar</button>
          <button class="secondary" type="button" data-reject-pdf="${pdfId}" ${status !== 'pending_review' ? 'disabled' : ''}>Rechazar</button>
          <button class="secondary" type="button" data-regen-pdf="${pdfId}">Regenerar</button>
          <button type="button" data-release-pdf="${pdfId}" ${status !== 'approved' ? 'disabled' : ''}>Liberar</button>
          ${printValidationAllowed(pdf) ? `<button type="button" data-validate-print="${pdfId}" ${printValidationPending.has(pdf.id) ? 'disabled' : ''}>${state ? 'Consultar Lulu' : 'Validar con Lulu'}</button>` : ''}
          ${printQuotationAllowed(pdf) ? `<button type="button" data-print-quote="${pdfId}">Preparar impresión</button>` : ''}
          ${printOrderAllowed() && pdf.printOrder?.hasIntent ? `<button type="button" data-print-order="${pdfId}">Ver pedido</button>` : ''}
        </div>
      </td>
    `;
    pdfBody.append(row);
  }
}

async function validatePrint(pdfId) {
  if (printValidationPending.has(pdfId)) return;
  printValidationPending.add(pdfId);
  try {
    const current = await adminAction('adminPrintStatus', {pdfId});
    if (current.pdf?.id !== pdfId || !printValidationAllowed(current.pdf)) throw new Error('Esta validación no está permitida en el estado actual.');
    setText(printValidationStatus, 'Consultando Lulu. No se crea ningún pedido ni pago.');
    const result = await adminAction('adminValidatePrint', {pdfId}, {timeoutMs: 120000});
    const confirmed = await adminAction('adminPrintStatus', {pdfId});
    if (!result.ok || !confirmed.ok || confirmed.pdf?.id !== pdfId ||
        printReceiptJson(confirmed.pdf.printValidation) !== printReceiptJson(result.pdf?.printValidation) ||
        printReceiptJson(confirmed.pdf.luluMetadata) !== printReceiptJson(result.pdf?.luluMetadata)) {
      throw new Error('No se ha podido confirmar el estado de Lulu. Consulte de nuevo antes de continuar.');
    }
    if (latestDashboardData?.pdfs) latestDashboardData.pdfs = latestDashboardData.pdfs.map(pdf => pdf.id === pdfId ? confirmed.pdf : pdf);
    const state = confirmed.pdf.printValidation?.preflight;
    setText(printValidationStatus, `Lulu: ${statusText(state?.status || 'unknown')}. No se ha creado ni pagado un pedido.`);
  } catch (error) {
    setText(printValidationStatus, 'Estado sin confirmar. Actualice el panel; no repita un envío incierto.');
    throw error;
  } finally {
    printValidationPending.delete(pdfId);
    if (latestDashboardData?.pdfs) renderPdfs(latestDashboardData.pdfs);
  }
}

function printReceiptJson(value) {
  if (Array.isArray(value)) return `[${value.map(printReceiptJson).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${printReceiptJson(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}

function printQuotationAllowed(pdf) {
  if(pdf?.printOrder?.hasIntent&&pdf.printOrder.canRequote!==true)return false;
  const admin=latestDashboardData?.admin, p=pdf?.printValidation||pdf?.print_validation, l=pdf?.luluMetadata||pdf?.lulu_metadata;
  const allowed=Array.isArray(admin?.permissions)?admin.permissions.includes('*')||admin.permissions.includes('adminQuotePrint')
    :['ops','owner','legacy_token','local_admin'].includes(admin?.role);
  return allowed && ['approved','released_to_customer'].includes(pdfStatus(pdf)) && p?.ready_for_print===true && l?.ready_for_print===true &&
    p.preflight?.status==='ready' && p.preflight.interior?.state==='normalized' && p.preflight.cover?.state==='normalized';
}

function printQuoteArtifact(pdf) {
  return printReceiptJson({review:pdfStatus(pdf),pages:pdf?.pageCount||pdf?.page_count,
    print:pdf?.printValidation||pdf?.print_validation,lulu:pdf?.luluMetadata||pdf?.lulu_metadata});
}

function clearPrintQuote() {
  clearPrintOrder();lastPrintQuotation=null;confirmedPrintQuoteInput=null;
  if(printPrepareOrderButton)printPrepareOrderButton.disabled=true;
  selectedPrintPdfId='';selectedPrintBinding=null;printShippingFingerprint=null;
  if(printQuotePanel)printQuotePanel.hidden=true;
  for(const node of Object.values(printAddressFields))if(node)node.value='';
  if(printQuoteConsent)printQuoteConsent.checked=false;
  if(printShippingLevel){printShippingLevel.innerHTML='<option value="">Consulte las opciones primero</option>';printShippingLevel.disabled=true;}
  if(printQuoteCalculateButton)printQuoteCalculateButton.disabled=true;
  setText(printQuoteSummary,'Sin presupuesto confirmado.');
  setText(printQuoteActionStatus,'Una copia. Presupuesto informativo; sin pedido ni cobro.');
}

function printQuoteInput() {
  const pdf=latestDashboardData?.pdfs?.find(item=>item.id===selectedPrintPdfId);
  if(!printQuotationAllowed(pdf))throw new Error('El presupuesto no está permitido para este libro o este usuario.');
  if(!printQuoteConsent?.checked)throw new Error('Confirme la dirección y su envío a Lulu antes de consultar.');
  const shippingAddress=Object.fromEntries(Object.entries(printAddressFields).map(([key,node])=>[key,node?.value||'']));
  return {pdfId:selectedPrintPdfId,shippingAddress,shippingConsent:true,currency:printQuoteCurrency?.value||'EUR'};
}

async function openPrintQuote(pdfId) {
  const current=await adminAction('adminPrintStatus',{pdfId});
  if(current.pdf?.id!==pdfId||!printQuotationAllowed(current.pdf))throw new Error('El libro aún no permite preparar impresión.');
  clearPrintQuote();selectedPrintPdfId=pdfId;selectedPrintBinding=printQuoteArtifact(current.pdf);
  setText(document.querySelector('#printQuoteBook'),`${current.pdf.fileName||pdfId} · ${current.pdf.pageCount} páginas · una copia`);
  if(printQuotePanel)printQuotePanel.hidden=false;
  const result=await adminAction('adminPrintQuote',{pdfId});
  if(!result.ok)throw new Error('No se pudo consultar el presupuesto.');
  renderPrintQuotation(result.quotation);
}

function renderPrintQuotation(quote) {
  lastPrintQuotation=quote;
  if(printPrepareOrderButton)printPrepareOrderButton.disabled=quote?.status!=='quoted'||quote.pdfId!==selectedPrintPdfId;
  if(quote?.status==='address_review_required'){
    setText(printQuoteSummary,`Lulu propone revisar la dirección. No hay presupuesto confirmado. Propuesta: ${JSON.stringify(quote.suggestedAddress||{})}`);return;
  }
  if(!quote?.costs){setText(printQuoteSummary,statusText(quote?.status||'not_quoted'));return;}
  const money=value=>typeof value==='string'&&/^\d+(?:\.\d+)?$/.test(value)?`${value.replace('.',',')} ${quote.costs.currency}`:'Sin comprobar';
  const items=[['Impresión, con impuestos',quote.costs.printing?.incl_tax],['Envío y manipulación, con impuestos',quote.costs.shipping_handling?.incl_tax],
    ['Gestión, con impuestos',quote.costs.fulfillment?.incl_tax],['Impuestos incluidos',quote.costs.tax],['Descuento ya aplicado',quote.costs.discount],['Total',quote.costs.total_incl_tax]];
  printQuoteSummary.innerHTML=`<p>${escapeHtml(statusText(quote.status))} · ${escapeHtml(quote.environment||'')} · ${escapeHtml(quote.shippingLevel||'')} · caduca ${escapeHtml(formatDate(quote.expiresAt))}</p>`+
    `<div class="detail-grid">${items.map(([label,value])=>`<div class="detail-card"><span>${escapeHtml(label)}</span><strong>${escapeHtml(money(value))}</strong></div>`).join('')}</div>`+
    '<p>Estimación del proveedor. El pedido requiere nueva comprobación y aprobación expresa. No se ha creado ni pagado ningún pedido.</p>';
}

async function loadPrintShippingOptions() {
  if(printQuoteBusy||printOrderBusy)return;
  const input=printQuoteInput();printQuoteBusy=true;printShippingFingerprint=null;
  if(printQuoteCalculateButton)printQuoteCalculateButton.disabled=true;
  if(printShippingOptionsButton)printShippingOptionsButton.disabled=true;
  try{
    const result=await adminAction('adminShippingOptions',input,{timeoutMs:120000});
    if(!result.ok||!Array.isArray(result.options))throw new Error('Opciones de envío sin confirmar.');
    if(printReceiptJson(input)!==printReceiptJson(printQuoteInput()))throw new Error('La dirección ha cambiado; consulte las opciones de nuevo.');
    printShippingLevel.innerHTML='<option value="">Seleccione un envío</option>'+result.options.map(option=>`<option value="${escapeHtml(option.level)}">${escapeHtml(option.level)} · ${escapeHtml(option.cost_excl_tax==null?'Coste sin comprobar':option.cost_excl_tax.replace('.',',')+' '+option.currency)} sin impuestos · ${option.traceable===true?'con seguimiento':option.traceable===false?'sin seguimiento':'seguimiento sin comprobar'}</option>`).join('');
    printShippingLevel.disabled=!result.options.length;printShippingFingerprint=printReceiptJson(input);
    if(printQuoteCalculateButton)printQuoteCalculateButton.disabled=!result.options.length;
    setText(printQuoteActionStatus,result.options.length?'Elija envío y calcule el total. Sin pedido ni pago.':'Lulu no ofrece envíos para estos datos.');
  }finally{printQuoteBusy=false;if(printShippingOptionsButton)printShippingOptionsButton.disabled=false;}
}

async function calculatePrintQuote() {
  if(printQuoteBusy||printOrderBusy)return;
  const input=printQuoteInput();
  if(printShippingFingerprint!==printReceiptJson(input))throw new Error('Consulte las opciones de envío para esta dirección primero.');
  if(!printShippingLevel?.value)throw new Error('Seleccione una opción de envío.');
  clearPrintOrder();lastPrintQuotation=null;confirmedPrintQuoteInput=null;
  if(printPrepareOrderButton)printPrepareOrderButton.disabled=true;
  printQuoteBusy=true;setText(printQuoteSummary,'Calculando presupuesto; todavía sin confirmar.');
  try{
    const result=await adminAction('adminQuotePrint',{...input,shippingLevel:printShippingLevel.value},{timeoutMs:120000});
    if(result.quotation?.status==='address_review_required'){renderPrintQuotation(result.quotation);return;}
    const confirmed=await adminAction('adminPrintQuote',{pdfId:input.pdfId});
    if(!result.ok||!confirmed.ok||confirmed.quotation?.pdfId!==input.pdfId||printReceiptJson(result.quotation)!==printReceiptJson(confirmed.quotation)||
        printReceiptJson(input)!==printReceiptJson(printQuoteInput()))throw new Error('No se ha podido confirmar el presupuesto.');
    renderPrintQuotation(confirmed.quotation);
    confirmedPrintQuoteInput=printReceiptJson({...input,shippingLevel:printShippingLevel.value});
    setText(printQuoteActionStatus,'Presupuesto guardado y releído. Ningún pedido ni cobro.');
  }catch(error){setText(printQuoteSummary,'Presupuesto sin confirmar. Consulte de nuevo antes de continuar.');throw error;}
  finally{printQuoteBusy=false;}
}

function printOrderAllowed() {
  const admin=latestDashboardData?.admin;
  return Array.isArray(admin?.permissions)?admin.permissions.includes('*')||admin.permissions.includes('adminPrintOrder')
    :['ops','owner','legacy_token','local_admin'].includes(admin?.role);
}

function clearPrintOrder() {
  selectedPrintOrderPdfId='';selectedPrintOrder=null;
  if(printOrderPanel)printOrderPanel.hidden=true;
  if(printOrderApprovalForm)printOrderApprovalForm.hidden=true;
  if(printOrderAmount)printOrderAmount.value='';
  for(const node of [printOrderConsent,printManualPaymentConsent])if(node)node.checked=false;
  for(const node of Object.values(printOrderButtons))if(node)node.disabled=true;
  if(printPaymentPortal){printPaymentPortal.hidden=true;printPaymentPortal.removeAttribute('href');}
  setText(printOrderSummary,'Sin pedido seleccionado.');
  setText(printOrderActionStatus,'Abrir el portal no confirma el pago. La entrega se comprueba por separado.');
}

function renderPrintOrder(order) {
  selectedPrintOrder=order;
  const quote=lastPrintQuotation?.pdfId===selectedPrintOrderPdfId&&lastPrintQuotation.status==='quoted'?lastPrintQuotation:null;
  const approval=!!quote&&['not_approved','approved','approval_invalidated'].includes(order?.state);
  if(printOrderApprovalForm)printOrderApprovalForm.hidden=!approval;
  const permissions={approve:approval,submit:order?.canSubmit===true&&order.submissionEnabled===true,status:true,
    sync:order?.canSync===true,reconcile:order?.canReconcile===true};
  for(const [action,node] of Object.entries(printOrderButtons))if(node)node.disabled=printOrderBusy||!permissions[action];
  const costs=order?.costs||quote?.costs,total=costs?.total_incl_tax,validTotal=typeof total==='string'&&/^\d+(?:\.\d+)?$/.test(total);
  const payment={paid_confirmed:'Pago confirmado',unpaid:'Sin pagar',payment_in_progress:'Pago en curso; todavía sin confirmar',unknown:'Pago sin confirmar'};
  const labels={not_approved:'Sin aprobación del pedido',approved:'Aprobación guardada; pedido sin enviar',approval_invalidated:'Aprobación invalidada',
    submitted:'Pedido creado; recibo pendiente de comprobación',verified:'Recibo del proveedor comprobado',status_unverified:'Estado del proveedor sin confirmar',uncertain:'Envío incierto; no repetir',submitting:'Envío en curso; no repetir'};
  printOrderSummary.innerHTML=`<p>${escapeHtml(labels[order?.state]||statusText(order?.state))} · ${escapeHtml(order?.environment||quote?.environment||'')}</p>`+
    `<p>Una copia · ${escapeHtml(order?.shippingLevel||quote?.shippingLevel||'sin envío')} · total ${escapeHtml(validTotal?total.replace('.',',')+' '+costs.currency:'sin confirmar')}</p>`+
    `<p>Lulu: ${escapeHtml(order?.providerId||'sin identificador')} · ${escapeHtml(order?.providerStatus||'sin estado')} · ${escapeHtml(payment[order?.paymentStatus]||payment.unknown)} · ${order?.delivered===true?'Entrega confirmada':'Entrega sin confirmar'}</p>`+
    `<p>Última comprobación: ${escapeHtml(order?.checkedAt?formatDate(order.checkedAt):'sin lectura confirmada')}</p>`+
    '<p>Abrir el portal no confirma el pago. Compruebe el estado en Lulu después de pagar.</p>'+
    (order?.submissionEnabled===false?'<p>El envío de pedidos está desactivado en el servidor.</p>':'');
  const tracking=order?.tracking;
  if(order?.paymentStatus==='paid_confirmed'&&Array.isArray(tracking?.urls)){
    const links=tracking.urls.filter(value=>{try{const url=new URL(value);return typeof value==='string'&&value.length<=8192&&url.protocol==='https:'&&!url.username&&!url.password&&!url.hash&&!/^(localhost|127\.|0\.|\[::1\])/.test(url.hostname);}catch{return false;}});
    printOrderSummary.innerHTML+=`<p>Seguimiento: ${escapeHtml(tracking.carrier||'transportista sin confirmar')} · ${escapeHtml(tracking.id||'sin referencia')} `+
      links.map((url,index)=>`<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">Consultar envío ${index+1}</a>`).join(' · ')+'</p>';
  }
  if(printPaymentPortal){
    const portal=order?.environment==='production'?'https://developers.lulu.com/':'https://developers.sandbox.lulu.com/';
    const age=Date.now()-Date.parse(order?.checkedAt);
    const allowed=order?.canPay===true&&order.providerStatus==='UNPAID'&&order.paymentStatus==='unpaid'&&age>=0&&age<120000&&order.paymentPortalUrl===portal;
    printPaymentPortal.hidden=!allowed;
    if(allowed)printPaymentPortal.setAttribute('href',portal);else printPaymentPortal.removeAttribute('href');
  }
}

async function openPrintOrder(pdfId) {
  if(!printOrderAllowed())throw new Error('Este usuario no puede gestionar pedidos.');
  const result=await adminAction('adminPrintOrder',{pdfId});
  if(!result.ok||result.order?.pdfId!==pdfId)throw new Error('No se pudo confirmar el pedido.');
  clearPrintOrder();selectedPrintOrderPdfId=pdfId;
  if(printOrderPanel)printOrderPanel.hidden=false;
  renderPrintOrder(result.order);
}

async function printOrderAction(action) {
  if(printOrderBusy)return;
  if(printQuoteBusy)throw new Error('Espere a la confirmación del presupuesto.');
  if(!printOrderAllowed()||!selectedPrintOrderPdfId)throw new Error('Este usuario no puede gestionar este pedido.');
  const pdfId=selectedPrintOrderPdfId;
  const actions={approve:'adminApprovePrintOrder',submit:'adminSubmitPrintOrder',sync:'adminSyncPrintOrder',reconcile:'adminReconcilePrintOrder',status:'adminPrintOrder'};
  if(!actions[action])throw new Error('Acción de pedido no permitida.');
  let approval;
  if(action==='approve'){
    if(!printOrderConsent?.checked||!printManualPaymentConsent?.checked)throw new Error('Confirme el pedido y el modo de pago manual de Lulu.');
    const input={...printQuoteInput(),shippingLevel:printShippingLevel?.value};
    if(pdfId!==selectedPrintPdfId||lastPrintQuotation?.status!=='quoted'||lastPrintQuotation.pdfId!==pdfId||
      confirmedPrintQuoteInput!==printReceiptJson(input))throw new Error('Confirme de nuevo el presupuesto para esta dirección y envío.');
    const amount=printOrderAmount?.value;
    if(!/^\d+(?:\.\d+)?$/.test(amount||''))throw new Error('Escriba el importe exacto con punto decimal.');
    approval={...input,quoteId:lastPrintQuotation.id,quantity:1,currency:lastPrintQuotation.costs.currency,amount,orderConsent:true,manualPaymentConfirmed:true};
  }
  const previous=selectedPrintOrder;
  printOrderBusy=true;if(selectedPrintOrder)renderPrintOrder(selectedPrintOrder);
  try{
    const fresh=await adminAction('adminPrintOrder',{pdfId});
    if(!fresh.ok||fresh.order?.pdfId!==pdfId||selectedPrintOrderPdfId!==pdfId)throw new Error('No se pudo confirmar el pedido seleccionado.');
    if(action==='status'){renderPrintOrder(fresh.order);setText(printOrderActionStatus,'Registro releído. No se ha enviado ni pagado nada desde esta consulta.');return;}
    if(action==='submit'&&(!fresh.order.canSubmit||fresh.order.submissionEnabled!==true||previous?.id!==fresh.order.id||previous.quoteId!==fresh.order.quoteId||
      printReceiptJson(previous.costs)!==printReceiptJson(fresh.order.costs)))throw new Error('El envío del pedido no está permitido. Consulte y revise su aprobación.');
    if(action==='sync'&&!fresh.order.canSync)throw new Error('Falta el identificador de Lulu.');
    if(action==='reconcile'&&!fresh.order.canReconcile)throw new Error('Este pedido no requiere conciliación.');
    const result=await adminAction(actions[action],{pdfId,...(approval||{}),...(action==='submit'?{orderId:fresh.order.id}:{})},{timeoutMs:120000});
    const confirmed=await adminAction('adminPrintOrder',{pdfId});
    if(!result.ok||!confirmed.ok||confirmed.order?.pdfId!==pdfId||selectedPrintOrderPdfId!==pdfId||
      printReceiptJson(result.order)!==printReceiptJson(confirmed.order))throw new Error('No se ha podido confirmar el recibo. Consulte el registro; no repita el envío.');
    renderPrintOrder(confirmed.order);
    if(action==='approve')for(const node of [printOrderConsent,printManualPaymentConsent])if(node)node.checked=false;
    setText(printOrderActionStatus,action==='approve'?'Aprobación guardada y releída. Todavía sin enviar ni pagar.':'Estado guardado y releído. Consulte el recibo; esta acción no efectúa pagos.');
  }catch(error){
    renderPrintOrder({pdfId,state:'unknown',canSubmit:false,canSync:false,canPay:false,canReconcile:false});
    setText(printOrderActionStatus,'Estado sin confirmar. Consulte el registro; no repita un envío incierto.');throw error;
  }finally{printOrderBusy=false;if(selectedPrintOrder)renderPrintOrder(selectedPrintOrder);}
}

function renderAudit(events) {
  if (!adminAuditBody) return;
  adminAuditBody.innerHTML = '';
  if (!events?.length) {
    adminAuditBody.innerHTML = '<tr class="empty-row"><td colspan="5">Sin acciones auditadas todavia.</td></tr>';
    return;
  }
  for (const item of events || []) {
    const row = document.createElement('tr');
    const resource = [item.resource_type, item.resource_id ? shortId(item.resource_id) : ''].filter(Boolean).join(' / ');
    row.innerHTML = `
      <td>${escapeHtml(formatDate(item.created_at || item.createdAt))}</td>
      <td>${escapeHtml(item.admin_email || item.adminEmail || item.metadata?.mode || 'legacy')}</td>
      <td>${badge(item.admin_role || item.adminRole || 'n/a')}</td>
      <td>${escapeHtml(item.action || 'n/a')}</td>
      <td><code>${escapeHtml(resource || 'n/a')}</code></td>
    `;
    adminAuditBody.append(row);
  }
}

function answerPreview(answer) {
  const transcript = String(answer.transcript || '').replace(/\s+/g, ' ').trim();
  return transcript.length > 220 ? `${transcript.slice(0, 220)}...` : transcript || '[sin transcripcion]';
}

function renderSessionDetail(data) {
  if (!sessionDetail) return;
  const session = data?.session || {};
  const events = data?.events || [];
  const answers = data?.answers || [];
  const artifacts = data?.artifacts || [];
  const manuscripts = data?.manuscripts || [];
  const pdfs = data?.pdfs || [];
  selectedSessionId = session.id || selectedSessionId;
  if (sessionDetailInput) sessionDetailInput.value = selectedSessionId;
  if (repairSessionIdInput) repairSessionIdInput.value = selectedSessionId;
  sessionDetail.innerHTML = `
    <div class="detail-grid">
      <div class="detail-card"><span>Sesion</span><strong>${escapeHtml(shortId(session.id))}</strong></div>
      <div class="detail-card"><span>Estado</span><strong>${escapeHtml(statusText(session.status))}</strong></div>
      <div class="detail-card"><span>Libro</span><strong>${escapeHtml(statusText(session.book_status || session.bookStatus))}</strong></div>
      <div class="detail-card"><span>PDF</span><strong>${escapeHtml(statusText(session.pdf_review_status || session.pdfReviewStatus))}</strong></div>
      <div class="detail-card"><span>Respuestas</span><strong>${escapeHtml(answers.length)}</strong></div>
      <div class="detail-card"><span>Eventos</span><strong>${escapeHtml(events.length)}</strong></div>
      <div class="detail-card"><span>Artefactos</span><strong>${escapeHtml(artifacts.length)}</strong></div>
      <div class="detail-card"><span>Entregables</span><strong>${escapeHtml(manuscripts.length + pdfs.length)}</strong></div>
    </div>
    <div class="timeline-list">
      ${(events.slice(-8).reverse()).map((item) => `
        <div class="timeline-item">
          <strong>${escapeHtml(item.event_type || item.eventType || 'evento')}</strong>
          <small>${escapeHtml(formatDate(item.created_at || item.createdAt))}</small>
        </div>
      `).join('') || '<div class="timeline-item"><strong>Sin eventos</strong></div>'}
    </div>
    <div class="answer-list">
      ${answers.slice(0, 8).map((answer) => `
        <div class="answer-item">
          <strong>q_${escapeHtml(String(answer.question_index || answer.questionIndex || '').padStart(2, '0'))} / ${escapeHtml(answer.transcript_source || answer.transcriptSource || 'n/a')} / ${escapeHtml(answer.quality_score || answer.qualityScore || 'n/a')}</strong>
          <small>${escapeHtml(answerPreview(answer))}</small>
        </div>
      `).join('') || '<div class="answer-item"><strong>Sin respuestas</strong></div>'}
    </div>
  `;
}


async function refresh() {
  setText(adminStatus, 'Actualizando...');
  let data;
  try {
    data = await adminAction('adminDashboard');
    if (data?.ok !== true) throw new Error('admin_dashboard_unavailable');
  } catch (error) {
    latestDashboardData = null;
    if(providerGrid)providerGrid.innerHTML='';
    clearPrintQuote();
    selectedBookJobDetail = null;
    selectedPrintJobDetail = null;
    if (workspace) workspace.hidden = true;
    if (adminGate) adminGate.hidden = false;
    if (pdfPreview) pdfPreview.removeAttribute('src');
    if (coverPdfLink) { coverPdfLink.hidden = true; coverPdfLink.removeAttribute('href'); }
    setText(adminMode, error instanceof Error ? error.message : 'No se pudo sincronizar');
    throw error;
  }
  latestDashboardData = data;
  if(selectedPrintOrderPdfId&&(!printOrderAllowed()||!data.pdfs?.some(pdf=>pdf.id===selectedPrintOrderPdfId)))clearPrintOrder();
  if(selectedPrintPdfId){
    const selected=data.pdfs?.find(pdf=>pdf.id===selectedPrintPdfId);
    if(!printQuotationAllowed(selected)||printQuoteArtifact(selected)!==selectedPrintBinding)clearPrintQuote();
  }
  if (data.admin) {
    const who = data.admin.email || data.admin.label || data.admin.mode || 'operador';
    setText(adminIdentity, `${who} / ${data.admin.role || 'admin'}`);
  } else {
    const user = getStoredUser();
    setText(adminIdentity, user?.email || (adminToken ? 'token legacy' : 'local'));
  }
  renderOperationOverview(data);
  renderAuditChecklist(data);
  renderMetrics(data.metrics);
  renderMonitor(data.monitor);
  renderCosts(data.costs);
  renderSecurity(data.security);
  renderObservability(data.observability);
  renderViralAccess(data.viralAccess);
  renderProviders(data.providers);
  renderSessions(data.sessions);
  renderBookJobs(data.bookJobs);
  renderPrintJobs(data.printJobs);
  const runtime = data.bookRuntime;
  setText(bookRuntimeStatus, runtime
    ? `Escritor: ${runtime.writerModel || 'sin modelo'} / ${runtime.openaiConfigured ? 'clave configurada' : 'sin clave'}. Revisor: ${runtime.reviewerModel || 'sin modelo'} / ${runtime.anthropicConfigured ? 'clave configurada' : 'sin clave'}.`
    : 'Configuración del motor no disponible.');
  renderCaronteMaps(data.psychMaps);
  renderManuscripts(data.manuscripts);
  renderPdfs(data.pdfs);
  renderAudit(data.auditEvents);
  setText(adminStatus, `Actualizado ${formatDate(data.refreshedAt || new Date().toISOString())}`);
}

async function openPanel() {
  if (adminGate) adminGate.hidden = false;
  if (workspace) workspace.hidden = true;
  if (!hasBackendConfig()) throw new Error('backend_not_configured');
  const email = adminEmailInput?.value?.trim() || '';
  const password = adminPasswordInput?.value || '';
  const storedUser = getStoredUser();
  if (email && password && hasBackendConfig()) {
    adminToken = '';
    sessionStorage.removeItem(ADMIN_TOKEN_KEY);
    await signIn({ email, password });
  } else if (storedUser && !adminToken && !(tokenInput?.value || '').trim()) {
    adminToken = '';
  } else {
    adminToken = (tokenInput?.value || adminToken || '').trim();
    if (!adminToken) throw new Error('admin_credentials_required');
    sessionStorage.setItem(ADMIN_TOKEN_KEY, adminToken);
    clearSession();
  }
  await refresh();
  if (adminGate) adminGate.hidden = true;
  if (workspace) workspace.hidden = false;
  setText(adminMode, 'Conectado al servidor');
}

function renderBookJobs(jobs) {
  if (!bookJobsBody) return;
  bookJobsBody.innerHTML = '';
  if (!Array.isArray(jobs)) {
    bookJobsBody.innerHTML = '<tr class="empty-row"><td colspan="6">Cola de libros no disponible. Actualice el servidor para consultar este proceso.</td></tr>';
    return;
  }
  if (!jobs.length) {
    bookJobsBody.innerHTML = '<tr class="empty-row"><td colspan="6">Aún no hay trabajos de escritura.</td></tr>';
    return;
  }
  for (const job of jobs) {
    const row = document.createElement('tr');
    row.innerHTML = `<td><code>${escapeHtml(shortId(job.session_id))}</code></td>
      <td>${badge(job.status)}</td><td>${escapeHtml(job.stage || '—')}</td>
      <td>${escapeHtml(job.error_code || '—')}</td>
      <td>${escapeHtml(formatDate(job.updated_at))}</td>
      <td><button type="button" class="secondary" data-book-job="${escapeHtml(job.id)}">Ver proceso</button></td>`;
    bookJobsBody.append(row);
  }
}

function bookJobPermissions(detail, admin = {}) {
  const operator = ['ops', 'owner', 'legacy_token'].includes(admin.role);
  const blocked = operator && detail?.job?.status === 'blocked';
  const failed = (detail?.steps || []).filter(step => step.status === 'failed').at(-1);
  const safeErrors = ['provider_key_missing', 'provider_model_missing', 'provider_config_invalid', 'provider_poll_unavailable', 'provider_http_error'];
  return {
    cancel: blocked,
    resume: Boolean(blocked && failed && failed.stage !== 'gate'
      && safeErrors.includes(detail.job.error_code)
      && (!failed.error_code || failed.error_code === detail.job.error_code)
      && !(detail.steps || []).some(step => step.diagnostic?.uncertain === true))
  };
}

function renderBookJobDetail(detail) {
  selectedBookJobDetail = detail;
  const job = detail?.job;
  const permissions = bookJobPermissions(detail, latestDashboardData?.admin);
  if (resumeBookButton) resumeBookButton.disabled = bookJobActionPending || !permissions.resume;
  if (cancelBookButton) cancelBookButton.disabled = bookJobActionPending || !permissions.cancel;
  if (!job) {
    setText(bookJobSummary, 'Sin trabajo seleccionado.');
    if (bookJobStepsBody) bookJobStepsBody.innerHTML = '';
    return;
  }
  setText(bookJobSummary, `${job.id} / ${statusText(job.status)} / ${job.stage || '—'} / ${job.error_code || 'sin error'}`);
  const uncertain = (detail.steps || []).some(step => step.diagnostic?.uncertain === true);
  setText(bookJobActionStatus, uncertain
    ? 'Resultado del proveedor incierto. Requiere reconciliación antes de cualquier nueva petición.'
    : permissions.resume ? 'Corrija la causa y registre el motivo antes de reanudar.'
      : job.status === 'blocked' ? 'Este bloqueo requiere revisión; la reanudación automática no está disponible.' : 'Estado consultado en el servidor.');
  if (!bookJobStepsBody) return;
  bookJobStepsBody.innerHTML = '';
  for (const step of detail.steps || []) {
    const row = document.createElement('tr');
    row.innerHTML = `<td>${escapeHtml(step.step_key)}</td><td>${badge(step.status)}</td>
      <td>${escapeHtml(step.model || '—')}</td><td>${escapeHtml(step.attempt ?? '—')}</td>
      <td><code>${escapeHtml(step.provider_request_id || '—')}</code></td>
      <td>${escapeHtml(JSON.stringify(step.usage || {}))}</td>
      <td>${escapeHtml(step.error_code || '—')} ${escapeHtml(JSON.stringify(step.diagnostic || {}))}</td>`;
    bookJobStepsBody.append(row);
  }
  if (!(detail.steps || []).length) bookJobStepsBody.innerHTML = '<tr class="empty-row"><td colspan="7">Sin peticiones registradas.</td></tr>';
}

async function loadBookJob(jobId) {
  selectedBookJobId = jobId;
  const detail = await adminAction('adminBookJob', { jobId });
  if (selectedBookJobId === jobId) renderBookJobDetail(detail);
  return detail;
}

async function changeBookJob(action) {
  if (!['adminResumeBook', 'adminCancelBook'].includes(action)) throw new Error('book_job_action_invalid');
  if (bookJobActionPending) throw new Error('Acción de libro en curso');
  const jobId = selectedBookJobId;
  if (!jobId) throw new Error('Seleccione un trabajo');
  const reason = bookJobReasonInput?.value?.trim() || '';
  if (reason.length < 8 || reason.length > 1000) throw new Error('Indique un motivo de 8 a 1000 caracteres');
  bookJobActionPending = true;
  if (resumeBookButton) resumeBookButton.disabled = true;
  if (cancelBookButton) cancelBookButton.disabled = true;
  try {
    const current = await adminAction('adminBookJob', { jobId });
    if (selectedBookJobId !== jobId) throw new Error('El trabajo seleccionado ha cambiado');
    if (current?.ok !== true || current.job?.id !== jobId) throw new Error('El proceso recibido no coincide con el trabajo seleccionado');
    renderBookJobDetail(current);
    const permission = action === 'adminResumeBook' ? 'resume' : 'cancel';
    if (!bookJobPermissions(current, latestDashboardData?.admin)[permission]) throw new Error('La acción no está permitida en el estado actual');
    await adminAction(action, { jobId, reason });
    const confirmed = await adminAction('adminBookJob', { jobId });
    if (confirmed.job?.id !== jobId || (action === 'adminCancelBook' && confirmed.job.status !== 'cancelled')
      || (action === 'adminResumeBook' && !['queued', 'running', 'ready'].includes(confirmed.job.status))) {
      if (selectedBookJobId === jobId) renderBookJobDetail(confirmed);
      throw new Error('No se ha confirmado el cambio de estado. Actualice el proceso antes de repetir.');
    }
    if (selectedBookJobId === jobId) {
      renderBookJobDetail(confirmed);
      bookJobReasonInput.value = '';
    }
    await refresh();
  } finally {
    bookJobActionPending = false;
    if (selectedBookJobDetail) renderBookJobDetail(selectedBookJobDetail);
  }
}

function renderPrintJobs(page, append = false) {
  if (!printJobsBody) return;
  if (!append) printJobsBody.innerHTML = '';
  printJobsPageState = page;
  if (morePrintJobsButton) morePrintJobsButton.hidden = !(page?.available === true && page.hasMore && Number.isSafeInteger(page.nextOffset));
  if (page?.available !== true || !Array.isArray(page.items)) {
    printJobsBody.innerHTML = '<tr class="empty-row"><td colspan="6">Cola PDF no disponible. Compruebe la activación y el servidor.</td></tr>'; return;
  }
  if (!page.items.length && !append) printJobsBody.innerHTML = '<tr class="empty-row"><td colspan="6">Aún no hay trabajos PDF.</td></tr>';
  for (const job of page.items) {
    const row = document.createElement('tr');
    row.innerHTML = `<td><code>${escapeHtml(shortId(job.session_id))}</code></td><td>${escapeHtml(job.version)}</td>
      <td>${badge(job.status)}</td><td>${escapeHtml(job.stage || '—')}</td><td>${escapeHtml(job.error_code || '—')}</td>
      <td><button type="button" class="secondary" data-print-job="${escapeHtml(job.id)}">Ver proceso PDF</button></td>`;
    printJobsBody.append(row);
  }
}
async function morePrintJobs() {
  if (printJobsPageBusy || !printJobsPageState?.hasMore) return;
  printJobsPageBusy = true;
  if (morePrintJobsButton) morePrintJobsButton.disabled = true;
  try { renderPrintJobs(await adminAction('adminPrintJobs',{offset:printJobsPageState.nextOffset,limit:100}),true); }
  finally { printJobsPageBusy = false; if (morePrintJobsButton) morePrintJobsButton.disabled = false; }
}
function printJobPermissions(detail) {
  const operator = ['ops','owner','legacy_token'].includes(latestDashboardData?.admin?.role);
  const available = operator && detail?.ok === true && detail.job?.status === 'blocked' && !printJobBusy && !printJobUnconfirmed;
  return {resume:Boolean(available && detail.canResume === true),cancel:Boolean(available && detail.canCancel === true)};
}
function renderPrintJobDetail(detail) {
  selectedPrintJobDetail = detail;
  const job = detail?.job, permissions = printJobPermissions(detail);
  if (resumePrintButton) resumePrintButton.disabled = !permissions.resume;
  if (cancelPrintButton) cancelPrintButton.disabled = !permissions.cancel;
  setText(printJobSummary,job ? `${job.id} / v${job.version} / ${statusText(job.status)} / ${job.stage || '—'} / ${job.error_code || 'sin error'}` : 'Sin proceso seleccionado.');
  setText(printJobActionStatus,printJobUnconfirmed ? 'Intervención sin confirmar. Consulte de nuevo el proceso antes de cualquier decisión.'
    : job?.status === 'blocked' ? 'Corrija la causa y registre el motivo. Las etapas terminadas se conservan.' : 'Estado consultado en el servidor. Sin pedido ni pago.');
  if (!printJobStepsBody) return;
  printJobStepsBody.innerHTML = '';
  for (const step of detail?.steps || []) {
    const row = document.createElement('tr');
    row.innerHTML = `<td>${escapeHtml(step.step_key)}</td><td>${badge(step.status)}</td><td>${escapeHtml(step.attempt ?? '—')}</td>
      <td><code>${escapeHtml(step.output_hash || '—')}</code></td><td>${escapeHtml(step.error_code || '—')}</td>`;
    printJobStepsBody.append(row);
  }
  if (!detail?.steps?.length) printJobStepsBody.innerHTML = '<tr class="empty-row"><td colspan="5">Sin etapas registradas.</td></tr>';
}
async function loadPrintJob(jobId) {
  if (printJobBusy) throw new Error('Intervención PDF en curso');
  selectedPrintJobId = jobId;
  const detail = await adminAction('adminPrintJob',{jobId});
  if (detail?.ok !== true || detail.job?.id !== jobId) throw new Error('El proceso PDF recibido no coincide');
  if (selectedPrintJobId === jobId) { printJobUnconfirmed = false; renderPrintJobDetail(detail); }
  return detail;
}
async function changePrintJob(action) {
  if (!['adminResumePrint','adminCancelPrint'].includes(action)) throw new Error('print_control_not_allowed');
  if (printJobBusy) throw new Error('Intervención PDF en curso');
  if (printJobUnconfirmed) throw new Error('Intervención sin confirmar; consulte el proceso');
  const jobId = selectedPrintJobId, reason = printJobReasonInput?.value?.trim() || '';
  if (!jobId) throw new Error('Seleccione un proceso PDF');
  if (reason.length < 8 || reason.length > 1000) throw new Error('Indique un motivo de 8 a 1000 caracteres');
  if (!printJobPermissions(selectedPrintJobDetail)[action === 'adminResumePrint' ? 'resume' : 'cancel']) throw new Error('La acción PDF no está permitida');
  printJobBusy = true;renderPrintJobDetail(selectedPrintJobDetail);
  let confirmedChange = false;
  try {
    const current = await adminAction('adminPrintJob',{jobId});
    if (selectedPrintJobId !== jobId || current?.ok !== true || current.job?.id !== jobId) throw new Error('El proceso PDF recibido no coincide');
    selectedPrintJobDetail = current;
    const allowed = action === 'adminResumePrint' ? current.canResume : current.canCancel;
    if (current.job.status !== 'blocked' || allowed !== true || typeof current.job.updated_at !== 'string') throw new Error('La acción PDF no está permitida en el estado actual');
    const revision = current.job.updated_at, decision = action === 'adminResumePrint' ? 'resume' : 'cancel';
    printJobUnconfirmed = true;
    try { await adminAction(action,{jobId,reason,expectedRevision:revision}); } catch { /* Resolve by governing GET only. */ }
    const confirmed = await adminAction('adminPrintJob',{jobId});
    if (confirmed?.ok !== true || confirmed.job?.id !== jobId || confirmed.lastControl?.action !== decision
      || confirmed.lastControl?.previousRevision !== revision || (decision === 'cancel' && confirmed.job.status !== 'cancelled')
      || (decision === 'resume' && !['queued','running','ready','blocked'].includes(confirmed.job.status))) throw new Error('No se ha confirmado la intervención. Consulte el proceso; no repita la petición.');
    selectedPrintJobDetail = confirmed;printJobUnconfirmed = false;confirmedChange = true;printJobReasonInput.value = '';
    await refresh();
  } finally {
    printJobBusy = false;
    renderPrintJobDetail(selectedPrintJobDetail);
    if (confirmedChange) setText(printJobActionStatus,'Cambio confirmado en el servidor. Sin pedido ni pago.');
  }
}

function previewPdf(pdf) {
  if (coverPdfLink) { coverPdfLink.hidden = true; coverPdfLink.removeAttribute('href'); }
  if (!pdf?.pdfBase64 && !pdf?.signedUrl) {
    if (pdfPreview) pdfPreview.removeAttribute('src');
    setText(previewMeta, 'PDF sin binario disponible');
    return;
  }
  const url = pdf.pdfBase64
    ? `data:${pdf.mimeType || 'application/pdf'};base64,${pdf.pdfBase64}`
    : pdf.signedUrl;
  if (pdfPreview) pdfPreview.src = url;
  if (coverPdfLink && typeof pdf.coverSignedUrl === 'string' && pdf.coverSignedUrl.startsWith('https://')) {
    coverPdfLink.href = pdf.coverSignedUrl;
    coverPdfLink.hidden = false;
  }
  setText(previewMeta, `${pdf.fileName || 'pdf'} / ${statusText(pdfStatus(pdf))} / ${pdf.storagePath ? 'storage privado' : 'inline'}`);
}

function showSecurityReport(value) {
  if (!securityReport) return;
  securityReport.textContent = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
}

function showObservabilityReport(value) {
  if (!observabilityReport) return;
  observabilityReport.textContent = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
}

async function handleWorkspaceClick(event) {
  const target = event.target;
  if (!(target instanceof HTMLElement) || target.disabled) return;
  const { previewPdf: previewId, approvePdf: approveId, rejectPdf: rejectId,
    regenPdf: regenId, releasePdf: releaseId, validatePrint: validatePrintId, printQuote: printQuoteId, printOrder: printOrderId, testProvider,
    sessionDetail: detailSessionId, retryDeadLetter: retryDeadLetterId,
    resolveDeadLetter: resolveDeadLetterId, campaignInvites: campaignInvitesId,
    pauseCampaign: pauseCampaignId, closeCampaign: closeCampaignId,
    revokeInvite: revokeInviteId, bookJob: bookJobId, printJob: printJobId } = target.dataset;

  if (bookJobId) { await loadBookJob(bookJobId); return; }
  if (printJobId) { await loadPrintJob(printJobId); return; }
  if (validatePrintId) { await validatePrint(validatePrintId); return; }
  if (printQuoteId) { await openPrintQuote(printQuoteId); return; }
  if (printOrderId) { await openPrintOrder(printOrderId); return; }
  if (campaignInvitesId) {
    if (inviteCampaignIdInput) inviteCampaignIdInput.value = campaignInvitesId;
    inviteCampaignIdInput?.focus();
    return;
  }
  if (pauseCampaignId || closeCampaignId) {
    await adminAction('adminUpdateAccessCampaign', {
      campaignId: pauseCampaignId || closeCampaignId,
      status: pauseCampaignId ? 'paused' : 'closed'
    });
    await refresh();
    return;
  }
  if (revokeInviteId) {
    const result = await adminAction('adminRevokeAccessInvite', { inviteId: revokeInviteId, reason: 'revocado desde back office' });
    if (viralInviteOutput) viralInviteOutput.textContent = JSON.stringify(result, null, 2);
    await refresh();
    return;
  }
  if (retryDeadLetterId) {
    const current = (latestDashboardData?.observability?.deadLetters || []).find(item => item.id === retryDeadLetterId);
    if (!current || String(current.failed_action || current.failedAction || '').includes('book')
      || current.error_code === 'provider_submission_uncertain' || current.diagnostic?.uncertain === true) {
      throw new Error('Revise el proceso del libro antes de reintentar');
    }
    const result = await adminAction('adminRetryDeadLetter', { deadLetterId: retryDeadLetterId });
    showObservabilityReport(result);
    await refresh();
    return;
  }
  if (resolveDeadLetterId) {
    const result = await adminAction('adminResolveDeadLetter', { deadLetterId: resolveDeadLetterId, reason: 'resuelto desde back office' });
    showObservabilityReport(result);
    await refresh();
    return;
  }
  if (detailSessionId) {
    renderSessionDetail(await adminAction('adminSessionDetail', { sessionId: detailSessionId }));
    return;
  }
  if (previewId) {
    const result = await adminAction('adminPdf', { pdfId: previewId });
    previewPdf(result.pdf);
    return;
  }
  if (approveId) await adminAction('adminApprovePdf', { pdfId: approveId });
  if (rejectId) await adminAction('adminRejectPdf', { pdfId: rejectId, reason: 'rechazado desde back office' });
  if (regenId) await adminAction('adminRegeneratePdf', { pdfId: regenId, reason: 'regeneracion solicitada' });
  if (releaseId) await adminAction('adminReleasePdf', { pdfId: releaseId });
  if (testProvider) await adminAction('adminTestProvider', { provider: testProvider });
  if (approveId || rejectId || regenId || releaseId || testProvider) await refresh();
}

async function handleSessionDetailSubmit(event) {
  event.preventDefault();
  const sessionId = sessionDetailInput?.value?.trim() || selectedSessionId;
  if (!sessionId) return;
  const result = await adminAction('adminSessionDetail', { sessionId });
  renderSessionDetail(result);
}

async function handleSessionRepairSubmit(event) {
  event.preventDefault();
  const sessionId = repairSessionIdInput?.value?.trim() || selectedSessionId;
  if (!sessionId) throw new Error('Falta ID de sesion');
  const payload = {
    sessionId,
    status: repairStatusInput?.value || '',
    bookStatus: repairBookStatusInput?.value || '',
    pdfReviewStatus: repairPdfStatusInput?.value || '',
    reason: repairReasonInput?.value || 'reparacion desde back office',
    clearError: repairClearErrorInput?.checked === true
  };
  await adminAction('adminPatchSessionStatus', payload);
  const detail = await adminAction('adminSessionDetail', { sessionId });
  renderSessionDetail(detail);
  await refresh();
}

async function runRetention(dryRun) {
  const result = await adminAction('adminRunRetention', { dryRun });
  showSecurityReport(result);
  await refresh();
}

async function runPrivacyAction(action) {
  const sessionId = privacySessionInput?.value?.trim() || selectedSessionId;
  if (!sessionId) throw new Error('Falta ID de sesion');
  const result = await adminAction(action, {
    sessionId,
    reason: action === 'adminPrivacyErase' ? 'borrado RGPD desde back office' : 'export RGPD desde back office'
  });
  showSecurityReport(result);
  if (action === 'adminPrivacyErase') {
    selectedSessionId = '';
    if (sessionDetail) sessionDetail.textContent = 'Sesion borrada por solicitud RGPD.';
  }
  await refresh();
}

async function runSyntheticMonitor() {
  const result = await adminAction('adminRunSyntheticMonitor', { probeType: 'manual_light_flow' });
  showObservabilityReport(result);
  await refresh();
}

async function runAutonomousMonitor() {
  const result = await adminAction('adminRunAutonomousMonitor');
  showObservabilityReport(result);
  await refresh();
}

async function handleAccessPolicySubmit(event) {
  event.preventDefault();
  const result = await adminAction('adminUpdateAccessPolicy', {
    mode: accessModeInput?.value || 'fixed_beta',
    campaignCode: accessCampaignCodeInput?.value?.trim() || '',
    fixedBetaEnabled: fixedBetaEnabledInput?.checked === true,
    waitlistEnabled: waitlistEnabledInput?.checked !== false
  });
  if (viralInviteOutput) viralInviteOutput.textContent = JSON.stringify(result, null, 2);
  await refresh();
}

async function handleAccessCampaignSubmit(event) {
  event.preventDefault();
  const result = await adminAction('adminCreateAccessCampaign', {
    name: campaignNameInput?.value?.trim() || 'Campana privada',
    code: campaignCodeInput?.value?.trim() || '',
    accessMode: 'invite_required',
    maxSessions: Number(campaignMaxSessionsInput?.value || 100),
    maxInvites: Number(campaignMaxSessionsInput?.value || 100),
    defaultTtlMinutes: Number(campaignTtlInput?.value || 60),
    inviteMaxUses: 1,
    waitlistEnabled: true
  });
  if (viralInviteOutput) viralInviteOutput.textContent = JSON.stringify(result, null, 2);
  if (inviteCampaignIdInput && result.campaign?.id) inviteCampaignIdInput.value = result.campaign.id;
  accessCampaignForm?.reset();
  await refresh();
}

async function handleAccessInviteSubmit(event) {
  event.preventDefault();
  const baseUrl = new URL('./tiresias.html', window.location.href).toString();
  const result = await adminAction('adminCreateAccessInvites', {
    campaignId: inviteCampaignIdInput?.value?.trim() || '',
    count: Number(inviteCountInput?.value || 1),
    ttlMinutes: Number(inviteTtlInput?.value || 60),
    maxUses: 1,
    childInviteLimit: Number(inviteChildLimitInput?.value || 0),
    baseUrl
  });
  if (viralInviteOutput) {
    viralInviteOutput.textContent = (result.invites || [])
      .map((item) => item.link)
      .join('\n') || JSON.stringify(result, null, 2);
  }
  await refresh();
}

async function handleProviderSubmit(event) {
  const luluForm=event.target.closest('[data-lulu-credentials-form]');
  if(luluForm)return handleLuluCredentialsSubmit(event,luluForm);
  const form = event.target.closest('[data-provider-form]');
  if (!form) return;
  event.preventDefault();
  const provider = form.dataset.providerForm;
  const apiKey = new FormData(form).get('apiKey');
  await adminAction('adminSaveProviderKey', { provider, apiKey });
  form.reset();
  await refresh();
}

async function handleLuluCredentialsSubmit(event,form) {
  event.preventDefault();
  if(luluCredentialSavePending)return;
  if(!providerPermission('adminSaveLuluCredentials'))throw new Error('No tiene permiso para guardar credenciales.');
  const existing=latestDashboardData?.providers?.find(provider=>provider.provider==='lulu');
  if(existing?.managedByEnvironment===true)throw new Error('Este par se gestiona en el servidor.');
  const data=new FormData(form),input={environment:data.get('environment'),clientKey:data.get('clientKey'),clientSecret:data.get('clientSecret'),
    saveConsent:data.get('saveConsent')==='yes',expectedRevision:form.dataset.expectedRevision||null,configurationId:crypto.randomUUID()};
  if(!input.saveConsent||!['sandbox','production'].includes(input.environment)||
    [input.clientKey,input.clientSecret].some(value=>typeof value!=='string'||!/^[\x21-\x7e]{1,2048}$/.test(value)))throw new Error('Complete el entorno, las dos claves y la autorización.');
  const button=form.querySelector('button[type="submit"]');
  const status=message=>{
    setText(form.querySelector('[data-lulu-save-status]'),message);
    setText(providerGrid?.querySelector?.('[data-lulu-save-status]'),message);setText(adminStatus,message);
  };
  luluCredentialSavePending=true;form.reset();form.setAttribute('aria-busy','true');if(button)button.disabled=true;
  status('Guardando par OAuth. Aún sin confirmar.');
  try{
    const result=await adminAction('adminSaveLuluCredentials',input);
    if(result?.ok!==true||result.provider?.configurationId!==input.configurationId||result.provider.configured!==true||
      result.provider.environment!==input.environment)throw new Error();
    await refresh();const saved=latestDashboardData?.providers?.find(provider=>provider.provider==='lulu');
    if(saved?.configurationId!==input.configurationId||saved.configured!==true||saved.source!=='encrypted_oauth_pair'||
      saved.environment!==input.environment)throw new Error();
    status('Par OAuth guardado y releído. Conexión sin comprobar. No se han creado pedidos ni pagos.');
  }catch{
    status('Guardado de Lulu sin confirmar. Actualice el panel antes de decidir si debe volver a guardar.');
    throw new Error('Guardado de Lulu sin confirmar. No se ha reintentado automáticamente.');
  }finally{
    luluCredentialSavePending=false;form.removeAttribute('aria-busy');if(button)button.disabled=false;
  }
}

tokenForm?.addEventListener('submit', (event) => {
  event.preventDefault();
  openPanel().catch((error) => setText(adminMode, error instanceof Error ? error.message : 'No se pudo entrar'));
});

refreshButton?.addEventListener('click', () => {
  refresh().catch((error) => setText(adminStatus, error instanceof Error ? error.message : 'No se pudo actualizar'));
});

resumeBookButton?.addEventListener('click', () => {
  changeBookJob('adminResumeBook').catch(error => setText(bookJobActionStatus, error instanceof Error ? error.message : 'No se pudo reanudar'));
});

cancelBookButton?.addEventListener('click', () => {
  changeBookJob('adminCancelBook').catch(error => setText(bookJobActionStatus, error instanceof Error ? error.message : 'No se pudo cancelar'));
});
resumePrintButton?.addEventListener('click', () => changePrintJob('adminResumePrint').catch(error => setText(printJobActionStatus,error.message)));
cancelPrintButton?.addEventListener('click', () => changePrintJob('adminCancelPrint').catch(error => setText(printJobActionStatus,error.message)));
morePrintJobsButton?.addEventListener('click', () => morePrintJobs().catch(() => setText(printJobActionStatus,'No se pudo consultar la siguiente página de procesos.')));

workspace?.addEventListener('click', (event) => {
  handleWorkspaceClick(event).catch((error) => setText(adminStatus, error instanceof Error ? error.message : 'La accion ha fallado'));
});

workspace?.addEventListener('submit', (event) => {
  handleProviderSubmit(event).catch((error) => setText(adminStatus, error instanceof Error ? error.message : 'No se pudo guardar el proveedor'));
});

accessToggleButton?.addEventListener('click', () => {
  if (typeof latestDashboardData?.monitor?.access?.disabled !== 'boolean') return;
  const disabledNow = accessToggleButton.dataset.disabledNow === 'true';
  adminAction('adminToggleAccess', {
    disabled: !disabledNow,
    reason: disabledNow ? 'reactivado desde back office' : 'incidente operativo'
  })
    .then(refresh)
    .catch((error) => setText(adminStatus, error instanceof Error ? error.message : 'No se pudo cambiar el acceso'));
});

deleteSessionForm?.addEventListener('submit', (event) => {
  event.preventDefault();
  const sessionId = deleteSessionInput?.value || '';
  adminAction('adminDeleteSessionData', {
    sessionId,
    reason: 'borrado solicitado desde back office'
  })
    .then(() => {
      if (deleteSessionInput) deleteSessionInput.value = '';
      return refresh();
    })
    .catch((error) => setText(adminStatus, error instanceof Error ? error.message : 'No se pudo borrar la sesion'));
});

sessionDetailForm?.addEventListener('submit', (event) => {
  handleSessionDetailSubmit(event).catch((error) => setText(adminStatus, error instanceof Error ? error.message : 'No se pudo abrir la sesion'));
});

sessionRepairForm?.addEventListener('submit', (event) => {
  handleSessionRepairSubmit(event).catch((error) => setText(adminStatus, error instanceof Error ? error.message : 'No se pudo reparar la sesion'));
});

retentionDryRunButton?.addEventListener('click', () => {
  runRetention(true).catch((error) => setText(adminStatus, error instanceof Error ? error.message : 'No se pudo simular retencion'));
});

retentionRunButton?.addEventListener('click', () => {
  runRetention(false).catch((error) => setText(adminStatus, error instanceof Error ? error.message : 'No se pudo ejecutar retencion'));
});

syntheticRunButton?.addEventListener('click', () => {
  runSyntheticMonitor().catch((error) => setText(adminStatus, error instanceof Error ? error.message : 'No se pudo ejecutar synthetic'));
});

autonomousMonitorButton?.addEventListener('click', () => {
  runAutonomousMonitor().catch((error) => setText(adminStatus, error instanceof Error ? error.message : 'No se pudo ejecutar monitor autonomo'));
});

accessPolicyForm?.addEventListener('submit', (event) => {
  handleAccessPolicySubmit(event).catch((error) => setText(adminStatus, error instanceof Error ? error.message : 'No se pudo guardar modo de acceso'));
});

accessCampaignForm?.addEventListener('submit', (event) => {
  handleAccessCampaignSubmit(event).catch((error) => setText(adminStatus, error instanceof Error ? error.message : 'No se pudo crear campana'));
});

accessInviteForm?.addEventListener('submit', (event) => {
  handleAccessInviteSubmit(event).catch((error) => setText(adminStatus, error instanceof Error ? error.message : 'No se pudieron generar enlaces'));
});

privacyOpsForm?.addEventListener('click', (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;
  if (target.dataset.privacyExport !== undefined) {
    runPrivacyAction('adminPrivacyExport').catch((error) => setText(adminStatus, error instanceof Error ? error.message : 'No se pudo exportar'));
  }
  if (target.dataset.privacyErase !== undefined) {
    runPrivacyAction('adminPrivacyErase').catch((error) => setText(adminStatus, error instanceof Error ? error.message : 'No se pudo borrar'));
  }
});

privacyOpsForm?.addEventListener('submit', (event) => {
  event.preventDefault();
});

adminLogoutButton?.addEventListener('click', () => {
  clearPrintQuote();
  signOut().catch(() => null);
  adminToken = '';
  sessionStorage.removeItem(ADMIN_TOKEN_KEY);
  if (tokenInput) tokenInput.value = '';
  if (adminPasswordInput) adminPasswordInput.value = '';
  if (adminGate) adminGate.hidden = false;
  if (workspace) workspace.hidden = true;
  latestDashboardData = null;
  if(providerGrid)providerGrid.innerHTML='';
  selectedBookJobId = '';
  selectedBookJobDetail = null;
  selectedPrintJobId = '';selectedPrintJobDetail = null;printJobUnconfirmed = false;printJobsPageState = null;
  renderPrintJobDetail(null);
  if (pdfPreview) pdfPreview.removeAttribute('src');
  if (coverPdfLink) { coverPdfLink.hidden = true; coverPdfLink.removeAttribute('href'); }
  setText(adminMode, 'Sesion cerrada');
});

printShippingOptionsButton?.addEventListener('click',()=>{
  loadPrintShippingOptions().catch(error=>setText(printQuoteActionStatus,error instanceof Error?error.message:'No se pudo consultar Lulu.'));
});
printQuoteForm?.addEventListener('submit',event=>{
  event.preventDefault();calculatePrintQuote().catch(error=>setText(printQuoteActionStatus,error instanceof Error?error.message:'No se pudo confirmar el presupuesto.'));
});
printQuoteForm?.addEventListener('input',event=>{
  lastPrintQuotation=null;confirmedPrintQuoteInput=null;clearPrintOrder();
  if(printPrepareOrderButton)printPrepareOrderButton.disabled=true;
  if(event.target===printShippingLevel){setText(printQuoteSummary,'Envío modificado. Calcule el presupuesto de nuevo.');return;}
  printShippingFingerprint=null;
  if(printQuoteCalculateButton)printQuoteCalculateButton.disabled=true;
  if(printShippingLevel)printShippingLevel.disabled=true;
  setText(printQuoteSummary,'Datos modificados. Consulte las opciones y el presupuesto de nuevo.');
});
printPrepareOrderButton?.addEventListener('click',()=>openPrintOrder(selectedPrintPdfId).catch(error=>setText(printQuoteActionStatus,error.message)));
printOrderApprovalForm?.addEventListener('submit',event=>{
  event.preventDefault();printOrderAction('approve').catch(error=>setText(printOrderActionStatus,error.message));
});
for(const [action,node] of Object.entries(printOrderButtons))if(action!=='approve')node?.addEventListener('click',()=>{
  printOrderAction(action).catch(error=>setText(printOrderActionStatus,error.message));
});
printPaymentPortal?.addEventListener('click',event=>{
  if(selectedPrintOrder)renderPrintOrder(selectedPrintOrder);
  if(printOrderBusy||printPaymentPortal.hidden)event.preventDefault();
});

if (getStoredUser() || adminToken) {
  tokenInput.value = adminToken;
  openPanel().catch((error) => setText(adminMode, error instanceof Error ? error.message : 'No se pudo restaurar la sesion'));
} else {
  setText(adminMode, hasBackendConfig() ? 'Backend: entra con usuario admin o token legacy' : 'Servidor sin configurar');
}

setInterval(() => {
  if(selectedPrintOrder&&!printOrderBusy)renderPrintOrder(selectedPrintOrder);
  if (!workspace?.hidden && !bookJobActionPending && !printQuoteBusy && !printOrderBusy && !printJobBusy && !printJobUnconfirmed && !printJobsPageBusy) {
    refresh().then(async () => {
      if (selectedBookJobId) await loadBookJob(selectedBookJobId);
      if (selectedPrintJobId) await loadPrintJob(selectedPrintJobId);
    })
      .catch(error => setText(adminStatus, error instanceof Error ? error.message : 'No se pudo actualizar'));
  }
}, 15000);
