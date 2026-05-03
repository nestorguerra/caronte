import { callFunction, clearSession, getStoredUser, signIn, signOut } from './api-client.js';
import { hasBackendConfig } from './config.js';

const ADMIN_TOKEN_KEY = 'future_book_admin_token';
const SESSION_KEY = 'future_book_sprint3_session';
const MANUSCRIPT_KEY = 'future_book_sprint4_manuscript';
const PDF_KEY = 'future_book_sprint5_pdf';
const PROVIDERS_KEY = 'future_book_sprint5_providers';
const SHOWCASE_DISABLE_PARAM = 'real';
const SHOWCASE_MAX_ROWS = 14;

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
const demoBanner = document.querySelector('#demoBanner');
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
const pdfPreview = document.querySelector('#pdfPreview');
const previewMeta = document.querySelector('#previewMeta');
const adminAuditBody = document.querySelector('#adminAuditBody');

let adminToken = sessionStorage.getItem(ADMIN_TOKEN_KEY) || '';
let selectedSessionId = '';
let latestDashboardData = null;

function setText(node, value) {
  if (node) node.textContent = value;
}

function readJson(key, fallback = null) {
  try {
    return JSON.parse(sessionStorage.getItem(key) || localStorage.getItem(key) || 'null') ?? fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key, value, storage = sessionStorage) {
  storage.setItem(key, JSON.stringify(value));
}

function shortId(value) {
  return String(value || '').slice(0, 8) || 'local';
}

function showcaseDataEnabled() {
  try {
    return new URLSearchParams(window.location.search).get(SHOWCASE_DISABLE_PARAM) !== '1';
  } catch {
    return true;
  }
}

function isShowcaseItem(item) {
  return item?.showcase === true || String(item?.id || item?.sessionId || item?.session_id || '').startsWith('show-');
}

function mergeShowcaseRows(realRows = [], showcaseRows = [], maxRows = SHOWCASE_MAX_ROWS) {
  const rows = [...(realRows || []), ...(showcaseRows || [])];
  const seen = new Set();
  const merged = [];
  for (const [index, row] of rows.entries()) {
    const key = String(row?.id || row?.sessionId || row?.session_id || row?.tokenHint || row?.token_hint || `row-${index}`);
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(row);
  }
  return merged.slice(0, maxRows);
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
    regeneration_requested: 'Regeneracion pedida',
    released_to_customer: 'Liberado',
    ready_for_print: 'Listo para imprimir',
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

function providerDefaults() {
  return [
    { provider: 'elevenlabs', displayName: 'ElevenLabs voz Javier', required: true, voiceName: 'Javier - Mature and Commanding', voiceId: 'PToUZ7lhIUiz1SP94rGo' },
    { provider: 'openai', displayName: 'GPT-5.4 / OpenAI redaccion', required: true, modelId: 'gpt-5.4-pro' },
    { provider: 'anthropic', displayName: 'Claude Opus / revision', required: true, modelId: 'claude-opus-4-7' },
    { provider: 'transcription', displayName: 'Transcripcion backend', required: false },
    { provider: 'lulu', displayName: 'Lulu print API', required: false, status: 'placeholder' }
  ];
}

function localProviders() {
  const saved = readJson(PROVIDERS_KEY, []);
  return providerDefaults().map((provider) => {
    const row = saved.find((item) => item.provider === provider.provider);
    const configured = Boolean(row?.configured);
    return {
      ...provider,
      configured,
      status: provider.status || (configured ? 'configured' : 'not_configured'),
      source: configured ? 'local_masked' : 'missing',
      secretLast4: row?.secretLast4 || null,
      updatedAt: row?.updatedAt || null,
      voiceName: row?.voiceName || provider.voiceName || null,
      voiceId: row?.voiceId || provider.voiceId || null,
      modelId: row?.modelId || provider.modelId || null
    };
  });
}

function minutesAgo(minutes) {
  return new Date(Date.now() - minutes * 60 * 1000).toISOString();
}

function demoSession(id, status, bookStatus, pdfReviewStatus, minutes, source = 'invite_required') {
  return {
    id,
    showcase: true,
    source,
    status,
    bookStatus,
    pdfReviewStatus,
    price: { amount: 49.95, cents: 4995, currency: 'EUR' },
    questionCount: 21,
    updatedAt: minutesAgo(minutes),
    createdAt: minutesAgo(minutes + 120)
  };
}

function demoDashboard() {
  const sessions = [
    demoSession('show-live-4831a2', 'interview_active', 'not_started', 'not_generated', 4),
    demoSession('show-live-63fa92', 'interview_active', 'not_started', 'not_generated', 7),
    demoSession('show-ready-09bb21', 'interview_ready', 'not_started', 'not_generated', 11),
    demoSession('show-book-21bb09', 'interview_completed', 'queued', 'not_generated', 18),
    demoSession('show-book-34de81', 'interview_completed', 'queued', 'not_generated', 23),
    demoSession('show-gen-8f4c11', 'book_generating', 'generating', 'not_generated', 29),
    demoSession('show-gen-18ba7d', 'book_generating', 'generating', 'not_generated', 31),
    demoSession('show-pdf-62ad90', 'pending_review', 'ready', 'pending_review', 42),
    demoSession('show-pdf-78dc11', 'pending_review', 'ready', 'pending_review', 49),
    demoSession('show-ship-f9a003', 'released_to_customer', 'ready', 'released_to_customer', 86),
    demoSession('show-ship-710ae2', 'released_to_customer', 'ready', 'released_to_customer', 92),
    demoSession('show-hold-77cc10', 'blocked', 'failed', 'rejected', 128)
  ];
  const psychMaps = [
    { showcase: true, sessionId: 'show-pdf-62ad90', version: 2, promptVersion: 'caronte-literary-v1', status: 'approved', createdAt: minutesAgo(41) },
    { showcase: true, sessionId: 'show-pdf-78dc11', version: 1, promptVersion: 'caronte-literary-v1', status: 'approved', createdAt: minutesAgo(47) },
    { showcase: true, sessionId: 'show-ship-f9a003', version: 3, promptVersion: 'caronte-literary-v1', status: 'approved', createdAt: minutesAgo(84) },
    { showcase: true, sessionId: 'show-ship-710ae2', version: 2, promptVersion: 'caronte-literary-v1', status: 'approved', createdAt: minutesAgo(90) },
    { showcase: true, sessionId: 'show-gen-8f4c11', version: 1, promptVersion: 'caronte-literary-v1', status: 'quality_review', createdAt: minutesAgo(28) },
    { showcase: true, sessionId: 'show-gen-18ba7d', version: 1, promptVersion: 'caronte-literary-v1', status: 'quality_review', createdAt: minutesAgo(30) }
  ];
  const manuscripts = [
    { id: 'show-manuscript-01', showcase: true, sessionId: 'show-pdf-62ad90', title: 'El mapa que no sabias que estabas siguiendo', status: 'ready', qualityScore: 0.91, promptVersion: 'caronte-literary-v1', createdAt: minutesAgo(39) },
    { id: 'show-manuscript-02', showcase: true, sessionId: 'show-ship-f9a003', title: 'Carta desde los cincuenta y ocho', status: 'ready', qualityScore: 0.94, promptVersion: 'caronte-literary-v1', createdAt: minutesAgo(82) },
    { id: 'show-manuscript-03', showcase: true, sessionId: 'show-gen-8f4c11', title: 'Version beta de un futuro posible', status: 'quality_review', qualityScore: 0.76, promptVersion: 'caronte-literary-v1', createdAt: minutesAgo(24) },
    { id: 'show-manuscript-04', showcase: true, sessionId: 'show-pdf-78dc11', title: 'Una vida no ejecutada todavia', status: 'ready', qualityScore: 0.89, promptVersion: 'caronte-literary-v1', createdAt: minutesAgo(46) },
    { id: 'show-manuscript-05', showcase: true, sessionId: 'show-gen-18ba7d', title: 'Los caminos que todavia no has elegido', status: 'quality_review', qualityScore: 0.79, promptVersion: 'caronte-literary-v1', createdAt: minutesAgo(27) }
  ];
  const pdfs = [
    { id: 'show-pdf-01', showcase: true, sessionId: 'show-pdf-62ad90', fileName: 'futuro-anterior-62ad90-v02.pdf', reviewStatus: 'pending_review', pageCount: 118, createdAt: minutesAgo(35), luluMetadata: { ready_for_print: true, send_to_lulu: false, status: 'ready_for_print' } },
    { id: 'show-pdf-02', showcase: true, sessionId: 'show-ship-f9a003', fileName: 'futuro-anterior-f9a003-v03.pdf', reviewStatus: 'released_to_customer', pageCount: 124, createdAt: minutesAgo(78), luluMetadata: { ready_for_print: true, send_to_lulu: false, status: 'in_transit' } },
    { id: 'show-pdf-03', showcase: true, sessionId: 'show-hold-77cc10', fileName: 'futuro-anterior-77cc10-v01.pdf', reviewStatus: 'rejected', pageCount: 109, createdAt: minutesAgo(121), luluMetadata: { ready_for_print: false, send_to_lulu: false, status: 'blocked' } },
    { id: 'show-pdf-04', showcase: true, sessionId: 'show-pdf-78dc11', fileName: 'futuro-anterior-78dc11-v01.pdf', reviewStatus: 'pending_review', pageCount: 132, createdAt: minutesAgo(44), luluMetadata: { ready_for_print: true, send_to_lulu: false, status: 'ready_for_print' } },
    { id: 'show-pdf-05', showcase: true, sessionId: 'show-ship-710ae2', fileName: 'futuro-anterior-710ae2-v02.pdf', reviewStatus: 'approved', pageCount: 127, createdAt: minutesAgo(88), luluMetadata: { ready_for_print: true, send_to_lulu: false, status: 'shipped' } }
  ];
  const providers = providerDefaults().map((provider) => ({
    ...provider,
    showcase: true,
    configured: true,
    status: provider.status || 'configured',
    source: 'demo_masked',
    secretLast4: provider.provider === 'elevenlabs' ? '947' : provider.provider === 'openai' ? 'g5p4' : provider.provider === 'anthropic' ? 'op47' : provider.provider === 'lulu' ? 'lulu' : 'stt9',
    testStatus: provider.provider === 'lulu' ? 'placeholder' : 'configured',
    testDetail: provider.provider === 'elevenlabs' ? 'voice_endpoint_ok:Javier - Mature and Commanding' : 'endpoint_ok',
    updatedAt: minutesAgo(9)
  }));
  return {
    demoMode: true,
    metrics: {
      activeSessions: 14,
      interviewing: 2,
      waitingBook: 7,
      booksGenerating: 12,
      caronteMaps: 267,
      pdfPendingReview: 8,
      pdfApproved: 224,
      pdfBlocked: 2,
      errors: 1,
      booksDone: 224,
      inTransit: 9,
      webVisitors: 38
    },
    monitor: {
      access: { disabled: false, source: 'demo', updated_at: minutesAgo(12) },
      averagesSeconds: { interview: 3198, bookGeneration: 146, pdfAfterBook: 41 },
      p0: { failedSessions: 2, missingRequiredProviders: 0, stalePendingPdfs: 1 },
      alerts: [{ severity: 'warning', message: 'pdf review queue above normal' }]
    },
    sessions,
    psychMaps,
    manuscripts,
    pdfs,
    costs: {
      priceEur: 49.95,
      sessionsInWindow: 238,
      paidOrApprovedSessions: 224,
      grossRevenueEur: 11188.8,
      answersCaptured: 4986,
      providerCallsApprox: 892,
      manuscriptsGenerated: 236,
      pdfsGenerated: 224,
      pendingEditorialCostDrivers: 8
    },
    security: {
      abuseBlocked: 68,
      abuseChallenges: 174,
      abuseEvents: [{ showcase: true, action: 'createSession', outcome: 'challenge_required' }],
      privacyRequests: [{ showcase: true, status: 'processed' }, { showcase: true, status: 'queued' }],
      retentionPolicies: [
        { data_type: 'audio', ttl_days: 7, enabled: true },
        { data_type: 'answers', ttl_days: 30, enabled: true },
        { data_type: 'pdfs', ttl_days: 30, enabled: true },
        { data_type: 'admin_audit', ttl_days: 365, enabled: true }
      ]
    },
    observability: {
      latestSynthetic: { status: 'succeeded', duration_ms: 1840 },
      deadLetters: [
        { id: 'show-dead-01', showcase: true, sessionId: 'show-hold-77cc10', failedAction: 'review_pdf', severity: 'warning', status: 'open', createdAt: minutesAgo(53) },
        { id: 'show-dead-02', showcase: true, sessionId: 'show-gen-18ba7d', failedAction: 'book_generation_retry', severity: 'info', status: 'retrying', createdAt: minutesAgo(16) }
      ],
      deadLetterOpen: 2,
      latestSla: { sla: { health: 'watch' }, conversion: { rates: { released: 0.68, bookReady: 0.91 } }, cost: { anomaly: { anomaly: false, reason: 'normal' } } },
      alertDeliveries: [{ showcase: true, status: 'delivered' }],
      stuckNow: [{ showcase: true, sessionId: 'show-pdf-62ad90', reason: 'human_review_pending' }]
    },
    viralAccess: {
      policy: { mode: 'invite_required', fixedBetaEnabled: false, campaignCode: 'caronte_abril', waitlistEnabled: true },
      campaigns: [
        { id: 'show-campaign-01', showcase: true, code: 'caronte_abril', name: 'Caronte abril', status: 'active', accessMode: 'invite_required', usedSessions: 142, maxSessions: 220 },
        { id: 'show-campaign-02', showcase: true, code: 'marcos_singapur', name: 'Seed novela', status: 'active', accessMode: 'invite_required', usedSessions: 82, maxSessions: 140 },
        { id: 'show-campaign-03', showcase: true, code: 'founders_49', name: 'Founders 49', status: 'paused', accessMode: 'invite_required', usedSessions: 0, maxSessions: 60 }
      ],
      invites: [
        { id: 'show-invite-01', showcase: true, campaignId: 'show-campaign-01', tokenHint: '4F9A91C0', status: 'active', useCount: 0, maxUses: 1, expiresAt: minutesAgo(-42) },
        { id: 'show-invite-02', showcase: true, campaignId: 'show-campaign-01', tokenHint: '02AD1F8B', status: 'used', useCount: 1, maxUses: 1, expiresAt: minutesAgo(12) },
        { id: 'show-invite-03', showcase: true, campaignId: 'show-campaign-02', tokenHint: '8C4D10AE', status: 'active', useCount: 0, maxUses: 1, expiresAt: minutesAgo(-118) },
        { id: 'show-invite-04', showcase: true, campaignId: 'show-campaign-02', tokenHint: 'A019DE77', status: 'expired', useCount: 0, maxUses: 1, expiresAt: minutesAgo(240) }
      ],
      waitlistEntries: [{ id: 'show-wait-01', showcase: true }, { id: 'show-wait-02', showcase: true }],
      metrics: { activeCampaigns: 2, openInvites: 41, usedInvites: 224, expiredInvites: 52, waitlistQueued: 86 }
    },
    auditEvents: [
      { showcase: true, createdAt: minutesAgo(12), adminEmail: 'future_book_admin', adminRole: 'ops', action: 'adminTestProvider', resource_type: 'provider', resource_id: 'elevenlabs' },
      { showcase: true, createdAt: minutesAgo(38), adminEmail: 'future_book_admin', adminRole: 'editor', action: 'adminApprovePdf', resource_type: 'future_book_pdf', resource_id: 'show-pdf-02' },
      { showcase: true, createdAt: minutesAgo(58), adminEmail: 'future_book_admin', adminRole: 'ops', action: 'adminRunAutonomousMonitor', resource_type: 'monitor', resource_id: 'sla' },
      { showcase: true, createdAt: minutesAgo(71), adminEmail: 'future_book_admin', adminRole: 'editor', action: 'adminReleasePdf', resource_type: 'future_book_pdf', resource_id: 'show-pdf-05' }
    ],
    providers,
    refreshedAt: new Date().toISOString()
  };
}

function dashboardIsEmpty(data) {
  return ![
    data?.sessions,
    data?.psychMaps,
    data?.manuscripts,
    data?.pdfs,
    data?.observability?.deadLetters,
    data?.viralAccess?.campaigns,
    data?.viralAccess?.invites
  ].some((items) => Array.isArray(items) && items.length);
}

function mergeMetricBlock(real = {}, showcase = {}) {
  const result = { ...showcase, ...real };
  for (const key of Object.keys(showcase || {})) {
    if (typeof showcase[key] === 'number' && typeof real?.[key] === 'number') {
      result[key] = Math.max(showcase[key], real[key]);
    }
  }
  return result;
}

function mergeShowcaseProviders(realProviders = [], showcaseProviders = []) {
  const defaults = providerDefaults();
  const providerIds = [
    ...new Set([
      ...defaults.map((item) => item.provider),
      ...(showcaseProviders || []).map((item) => item.provider),
      ...(realProviders || []).map((item) => item.provider)
    ].filter(Boolean))
  ];
  return providerIds.map((providerId) => {
    const defaultsRow = defaults.find((item) => item.provider === providerId) || {};
    const showcaseRow = (showcaseProviders || []).find((item) => item.provider === providerId) || {};
    const realRow = (realProviders || []).find((item) => item.provider === providerId) || {};
    const realConfigured = realRow.configured === true;
    return {
      ...defaultsRow,
      ...showcaseRow,
      ...realRow,
      configured: realConfigured || showcaseRow.configured === true,
      status: realConfigured ? 'configured' : (showcaseRow.status || defaultsRow.status || 'configured'),
      source: realConfigured ? (realRow.source || 'backend_secret') : (showcaseRow.source || 'demo_masked'),
      secretLast4: realRow.secretLast4 || realRow.secret_last4 || showcaseRow.secretLast4 || showcaseRow.secret_last4 || null,
      testStatus: realRow.testStatus || realRow.test_result || showcaseRow.testStatus || 'configured',
      testDetail: realRow.testDetail || realRow.test_detail || showcaseRow.testDetail || 'endpoint_ok',
      voiceName: realRow.voiceName || realRow.voice_name || showcaseRow.voiceName || defaultsRow.voiceName || null,
      voiceId: realRow.voiceId || realRow.voice_id || showcaseRow.voiceId || defaultsRow.voiceId || null,
      modelId: realRow.modelId || realRow.model_id || showcaseRow.modelId || defaultsRow.modelId || null,
      updatedAt: realRow.updatedAt || realRow.updated_at || showcaseRow.updatedAt || null,
      showcase: !realConfigured
    };
  });
}

function enrichDashboard(data) {
  data = data || {};
  if (!showcaseDataEnabled()) return { ...data, demoMode: false };
  const demo = demoDashboard();
  const providers = mergeShowcaseProviders(data.providers || [], demo.providers);
  const monitor = data.monitor || {};
  const security = data.security || {};
  const observability = data.observability || {};
  const viralAccess = data.viralAccess || {};
  return {
    ...data,
    demoMode: true,
    metrics: mergeMetricBlock(data.metrics || {}, demo.metrics),
    monitor: {
      ...demo.monitor,
      ...monitor,
      access: monitor.access || demo.monitor.access,
      averagesSeconds: { ...demo.monitor.averagesSeconds, ...(monitor.averagesSeconds || {}) },
      p0: { ...mergeMetricBlock(monitor.p0 || {}, demo.monitor.p0), missingRequiredProviders: 0 },
      alerts: mergeShowcaseRows(monitor.alerts || [], demo.monitor.alerts || [], 6)
    },
    sessions: mergeShowcaseRows(data.sessions || [], demo.sessions),
    psychMaps: mergeShowcaseRows(data.psychMaps || [], demo.psychMaps),
    manuscripts: mergeShowcaseRows(data.manuscripts || [], demo.manuscripts),
    pdfs: mergeShowcaseRows(data.pdfs || [], demo.pdfs),
    costs: mergeMetricBlock(data.costs || {}, demo.costs),
    security: {
      ...demo.security,
      ...security,
      abuseBlocked: Math.max(Number(security.abuseBlocked || 0), demo.security.abuseBlocked),
      abuseChallenges: Math.max(Number(security.abuseChallenges || 0), demo.security.abuseChallenges),
      abuseEvents: mergeShowcaseRows(security.abuseEvents || [], demo.security.abuseEvents || [], 8),
      privacyRequests: mergeShowcaseRows(security.privacyRequests || [], demo.security.privacyRequests || [], 8),
      retentionPolicies: mergeShowcaseRows(security.retentionPolicies || [], demo.security.retentionPolicies || [], 8)
    },
    observability: {
      ...demo.observability,
      ...observability,
      latestSynthetic: observability.latestSynthetic || demo.observability.latestSynthetic,
      deadLetters: mergeShowcaseRows(observability.deadLetters || [], demo.observability.deadLetters || [], 8),
      deadLetterOpen: Math.max(Number(observability.deadLetterOpen || 0), demo.observability.deadLetterOpen),
      latestSla: observability.latestSla || demo.observability.latestSla,
      alertDeliveries: mergeShowcaseRows(observability.alertDeliveries || [], demo.observability.alertDeliveries || [], 8),
      stuckNow: mergeShowcaseRows(observability.stuckNow || [], demo.observability.stuckNow || [], 8)
    },
    viralAccess: {
      ...demo.viralAccess,
      ...viralAccess,
      policy: { ...demo.viralAccess.policy, ...(viralAccess.policy || {}) },
      campaigns: mergeShowcaseRows(viralAccess.campaigns || [], demo.viralAccess.campaigns, 8),
      invites: mergeShowcaseRows(viralAccess.invites || [], demo.viralAccess.invites, 10),
      waitlistEntries: mergeShowcaseRows(viralAccess.waitlistEntries || [], demo.viralAccess.waitlistEntries, 6),
      metrics: mergeMetricBlock(viralAccess.metrics || {}, demo.viralAccess.metrics)
    },
    auditEvents: mergeShowcaseRows(data.auditEvents || [], demo.auditEvents, 10),
    providers,
    refreshedAt: data.refreshedAt || demo.refreshedAt
  };
}

function localDashboard() {
  const session = readJson(SESSION_KEY, null);
  const pdf = readJson(PDF_KEY, null);
  const access = readJson('future_book_sprint6_access', { disabled: false, source: 'local' });
  const sessions = session ? [session] : [];
  const pdfs = pdf ? [pdf] : [];
  return {
    ok: true,
    admin: {
      mode: 'local',
      role: 'local_admin',
      email: null,
      label: 'local_admin',
      permissions: ['*']
    },
    metrics: {
      activeSessions: sessions.filter((item) => ['created', 'payment_pending', 'interview_ready', 'interview_active'].includes(item.status)).length,
      interviewing: sessions.filter((item) => item.status === 'interview_active').length,
      waitingBook: sessions.filter((item) => item.status === 'interview_completed').length,
      booksGenerating: sessions.filter((item) => item.status === 'book_generating').length,
      caronteMaps: 0,
      pdfPendingReview: pdfs.filter((item) => item.reviewStatus === 'pending_review').length,
      pdfApproved: pdfs.filter((item) => item.reviewStatus === 'approved').length,
      pdfBlocked: pdfs.filter((item) => ['blocked', 'rejected'].includes(item.reviewStatus)).length,
      errors: 0
    },
    monitor: {
      access,
      averagesSeconds: {
        interview: 3600,
        bookGeneration: 45,
        pdfAfterBook: 10
      },
      p0: {
        failedSessions: 0,
        missingRequiredProviders: localProviders().filter((item) => item.required && !item.configured).length,
        stalePendingPdfs: 0
      },
      alerts: []
    },
    sessions,
    psychMaps: [],
    manuscripts: readJson(MANUSCRIPT_KEY, null) ? [readJson(MANUSCRIPT_KEY, null)] : [],
    pdfs,
    costs: {
      priceEur: 49.95,
      sessionsInWindow: sessions.length,
      paidOrApprovedSessions: sessions.length,
      grossRevenueEur: sessions.length * 49,
      answersCaptured: 0,
      providerCallsApprox: 0,
      manuscriptsGenerated: readJson(MANUSCRIPT_KEY, null) ? 1 : 0,
      pdfsGenerated: pdfs.length,
      pendingEditorialCostDrivers: pdfs.filter((item) => item.reviewStatus === 'pending_review').length
    },
    security: {
      abuseBlocked: 0,
      abuseChallenges: 0,
      abuseEvents: [],
      privacyRequests: [],
      retentionPolicies: [
        { data_type: 'audio', ttl_days: 7, enabled: true },
        { data_type: 'answers', ttl_days: 30, enabled: true },
        { data_type: 'pdfs', ttl_days: 30, enabled: true }
      ]
    },
    observability: {
      syntheticRuns: [],
      latestSynthetic: null,
      deadLetters: [],
      deadLetterOpen: 0,
      slaSnapshots: [],
      latestSla: null,
      alertDeliveries: [],
      stuckNow: []
    },
    viralAccess: {
      policy: {
        mode: 'fixed_beta',
        fixedBetaEnabled: true,
        campaignCode: null,
        waitlistEnabled: true
      },
      campaigns: [],
      invites: [],
      waitlistEntries: [],
      metrics: {
        activeCampaigns: 0,
        openInvites: 0,
        usedInvites: 0,
        expiredInvites: 0,
        waitlistQueued: 0
      }
    },
    auditEvents: [],
    providers: localProviders(),
    refreshedAt: new Date().toISOString()
  };
}

async function adminAction(action, payload = {}) {
  if (!hasBackendConfig()) return localAdminAction(action, payload);
  return callFunction('future-book-session', { action, adminToken, ...payload });
}

async function localAdminAction(action, payload = {}) {
  if (action === 'adminDashboard') return localDashboard();
  if (action === 'adminPdf') {
    const pdf = readJson(PDF_KEY, null);
    if (!pdf) throw new Error('local_pdf_missing');
    return { ok: true, pdf };
  }
  if (action === 'adminSaveProviderKey') {
    const providers = readJson(PROVIDERS_KEY, []);
    const next = providers.filter((item) => item.provider !== payload.provider);
    next.push({
      provider: payload.provider,
      configured: true,
      secretLast4: String(payload.apiKey || '').slice(-4),
      updatedAt: new Date().toISOString()
    });
    writeJson(PROVIDERS_KEY, next, localStorage);
    return { ok: true };
  }
  if (action === 'adminTestProvider') {
    return { ok: true, provider: { provider: payload.provider, testResult: 'local_only' } };
  }
  if (action === 'adminMonitor') return { ok: true, monitor: localDashboard().monitor };
  if (action === 'adminToggleAccess') {
    const access = {
      disabled: payload.disabled === true,
      source: 'local',
      reason: payload.reason || '',
      updated_at: new Date().toISOString()
    };
    writeJson('future_book_sprint6_access', access, localStorage);
    return { ok: true, access };
  }
  if (action === 'adminDeleteSessionData') {
    sessionStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem(MANUSCRIPT_KEY);
    sessionStorage.removeItem(PDF_KEY);
    return { ok: true, deletedSessionId: payload.sessionId };
  }
  if (action === 'adminSessionDetail') {
    const session = readJson(SESSION_KEY, null);
    const manuscript = readJson(MANUSCRIPT_KEY, null);
    const pdf = readJson(PDF_KEY, null);
    return {
      ok: true,
      session: session || { id: payload.sessionId, status: 'local_only' },
      events: [],
      answers: [],
      artifacts: [],
      psychMaps: [],
      manuscripts: manuscript ? [manuscript] : [],
      pdfs: pdf ? [pdf] : [],
      auditEvents: []
    };
  }
  if (action === 'adminPatchSessionStatus') {
    const session = readJson(SESSION_KEY, null);
    const next = {
      ...(session || { id: payload.sessionId }),
      status: payload.status || session?.status || 'local_only',
      bookStatus: payload.bookStatus || session?.bookStatus || 'not_started',
      pdfReviewStatus: payload.pdfReviewStatus || session?.pdfReviewStatus || 'not_generated',
      errorCode: payload.clearError ? null : session?.errorCode || null,
      updatedAt: new Date().toISOString()
    };
    writeJson(SESSION_KEY, next);
    return { ok: true, session: next };
  }
  if (action === 'adminRunRetention') {
    return {
      ok: true,
      dryRun: payload.dryRun !== false,
      summary: {
        local: {
          candidates: 0,
          dry_run: payload.dryRun !== false
        }
      }
    };
  }
  if (action === 'adminPrivacyExport') {
    return { ok: true, export: { session: readJson(SESSION_KEY, null), answers: readJson('future_book_sprint3_answers', []) } };
  }
  if (action === 'adminPrivacyErase') {
    sessionStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem(MANUSCRIPT_KEY);
    sessionStorage.removeItem(PDF_KEY);
    return { ok: true, erasedSessionId: payload.sessionId };
  }
  if (action === 'adminRunSyntheticMonitor') {
    return { ok: true, run: { status: 'succeeded', probe_type: 'local_light_flow', duration_ms: 0, checks: { local: 'pass' } } };
  }
  if (action === 'adminRunAutonomousMonitor') {
    return { ok: true, stuck: [], costAnomaly: { anomaly: false }, snapshot: { sla: { health: 'local' } } };
  }
  if (action === 'adminRetryDeadLetter' || action === 'adminResolveDeadLetter') {
    return { ok: true, deadLetter: { id: payload.deadLetterId, status: action === 'adminRetryDeadLetter' ? 'resolved' : 'ignored' } };
  }
  if (action === 'adminUpdateAccessPolicy') {
    return { ok: true, policy: payload };
  }
  if (action === 'adminCreateAccessCampaign') {
    return { ok: true, campaign: { id: crypto.randomUUID(), code: payload.code || 'local', name: payload.name || 'local', status: 'active', accessMode: 'invite_required', maxSessions: payload.maxSessions || 100, usedSessions: 0 } };
  }
  if (action === 'adminCreateAccessInvites') {
    const link = new URL('./futuro.html', window.location.href);
    link.searchParams.set('k', `local_${crypto.randomUUID().replaceAll('-', '')}`);
    return { ok: true, invites: [{ token: link.searchParams.get('k'), link: link.toString(), invite: { status: 'active', tokenHint: 'local' } }] };
  }
  if (action === 'adminUpdateAccessCampaign' || action === 'adminRevokeAccessInvite') {
    return { ok: true };
  }
  if (['adminApprovePdf', 'adminRejectPdf', 'adminRequestRegeneration', 'adminRegeneratePdf', 'adminReleasePdf'].includes(action)) {
    const statusByAction = {
      adminApprovePdf: 'approved',
      adminRejectPdf: 'rejected',
      adminRequestRegeneration: 'regeneration_requested',
      adminRegeneratePdf: 'pending_review',
      adminReleasePdf: 'released_to_customer'
    };
    const pdf = readJson(PDF_KEY, null);
    if (!pdf) throw new Error('local_pdf_missing');
    const nextPdf = {
      ...pdf,
      id: action === 'adminRegeneratePdf' ? crypto.randomUUID() : pdf.id,
      version: action === 'adminRegeneratePdf' ? Number(pdf.version || 1) + 1 : pdf.version,
      fileName: action === 'adminRegeneratePdf'
        ? `futuro-anterior-${shortId(pdf.sessionId || pdf.session_id || 'local')}-v${String(Number(pdf.version || 1) + 1).padStart(2, '0')}.pdf`
        : pdf.fileName,
      reviewStatus: statusByAction[action],
      reviewNotes: payload.reason || '',
      reviewedBy: 'local_admin',
      reviewedAt: new Date().toISOString(),
      releasedAt: action === 'adminReleasePdf' ? new Date().toISOString() : pdf.releasedAt
    };
    writeJson(PDF_KEY, nextPdf);
    const session = readJson(SESSION_KEY, null);
    if (session) {
      writeJson(SESSION_KEY, {
        ...session,
        status: action === 'adminReleasePdf' ? 'released_to_customer' : action === 'adminApprovePdf' ? 'approved' : 'pending_review',
        pdfReviewStatus: nextPdf.reviewStatus
      });
    }
    return { ok: true, pdf: nextPdf };
  }
  return { ok: true };
}

function renderMetrics(metrics) {
  const items = [
    ['booksDone', 'Libros enviados', 'Liberados a cliente'],
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
      <strong>${escapeHtml(metrics?.[key] ?? 0)}</strong>
      <small>${escapeHtml(helper)}</small>
    `;
    metricsGrid.append(card);
  }
}

function operationNumbers(data) {
  const sessions = data?.sessions || [];
  const pdfs = data?.pdfs || [];
  const metrics = data?.metrics || {};
  const doneFromPdfs = pdfs.filter((pdf) => ['approved', 'released_to_customer'].includes(pdfStatus(pdf))).length;
  const transitFromPdfs = pdfs.filter((pdf) => {
    const lulu = pdf.luluMetadata || pdf.lulu_metadata || {};
    return ['in_transit', 'shipped', 'ready_for_print'].includes(String(lulu.status || ''));
  }).length;
  const webNow = sessions.filter((item) => ['created', 'payment_pending', 'interview_ready', 'interview_active'].includes(item.status)).length;
  return {
    webNow: metrics.webVisitors ?? webNow,
    activeInterviews: metrics.interviewing ?? sessions.filter((item) => item.status === 'interview_active').length,
    inProcess: metrics.booksGenerating ?? sessions.filter((item) => ['interview_completed', 'book_generating', 'pending_review'].includes(item.status)).length,
    booksDone: metrics.booksDone ?? Math.max(doneFromPdfs, metrics.pdfApproved || 0),
    inTransit: metrics.inTransit ?? transitFromPdfs,
    pendingReview: metrics.pdfPendingReview ?? pdfs.filter((pdf) => pdfStatus(pdf) === 'pending_review').length,
    revenue: data?.costs?.grossRevenueEur ?? 0,
    apiOk: (data?.providers || []).filter((provider) => provider.required && provider.configured).length,
    apiTotal: (data?.providers || []).filter((provider) => provider.required).length
  };
}

function renderOperationOverview(data) {
  const ops = operationNumbers(data);
  if (demoBanner) demoBanner.hidden = data?.demoMode !== true;
  setText(opsHeadline, `${ops.activeInterviews} entrevistas en curso / ${ops.booksDone} libros enviados / ${ops.inProcess} en proceso`);
  setText(opsSubline, data?.demoMode
    ? 'Vista de produccion simulada: datos fake de volumen, mezclados solo en navegador. Para operar real usa ?real=1.'
    : `Backend sincronizado. Revision pendiente: ${ops.pendingReview}. Ingresos del corte: ${ops.revenue} EUR.`);
  if (!opsSnapshot) return;
  const items = [
    ['En web', ops.webNow, 'Usuarios y enlaces activos'],
    ['Entrevistas', ops.activeInterviews, 'Voz en curso'],
    ['Libros enviados', ops.booksDone, 'Liberados a cliente'],
    ['En proceso', ops.inProcess, 'Libro/PDF en curso'],
    ['En transito', ops.inTransit, 'Listos para fulfillment'],
    ['Revision', ops.pendingReview, 'PDF esperando humano'],
    ['APIs', `${ops.apiOk}/${ops.apiTotal}`, 'GPT, Claude, ElevenLabs']
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
    ['PDF manual', Number(data?.metrics?.pdfPendingReview || 0) >= 0, `${data?.metrics?.pdfPendingReview ?? 0} pendientes`],
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
  const p0Total = Number(monitor?.p0?.failedSessions || 0)
    + Number(monitor?.p0?.missingRequiredProviders || 0)
    + Number(monitor?.p0?.stalePendingPdfs || 0);
  const items = [
    ['Acceso', monitor?.access?.disabled ? 'disabled' : 'open', monitor?.access?.disabled ? 'Cerrado para nuevos usuarios' : 'Disponible'],
    ['Alertas P0', p0Total, 'Bloqueos criticos'],
    ['Entrevista media', `${monitor?.averagesSeconds?.interview ?? 'n/a'} s`, 'Tiempo estimado'],
    ['Libro medio', `${monitor?.averagesSeconds?.bookGeneration ?? 'n/a'} s`, 'Generacion IA'],
    ['PDF medio', `${monitor?.averagesSeconds?.pdfAfterBook ?? 'n/a'} s`, 'Postproceso'],
    ['Alertas abiertas', monitor?.alerts?.length || 0, 'Revisar si sube']
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
    accessToggleButton.textContent = monitor?.access?.disabled ? 'Reabrir acceso' : 'Cerrar acceso';
    accessToggleButton.dataset.disabledNow = monitor?.access?.disabled ? 'true' : 'false';
  }
}

function renderCosts(costs) {
  if (!costGrid) return;
  const items = [
    ['Ingresos', `${costs?.grossRevenueEur ?? 0} EUR`, 'Sesiones del corte'],
    ['Sesiones', costs?.sessionsInWindow ?? 0, 'Ventana operativa'],
    ['Pagadas', costs?.paidOrApprovedSessions ?? 0, 'Pago/beta aprobado'],
    ['Respuestas', costs?.answersCaptured ?? 0, 'Transcripciones'],
    ['Llamadas IA', costs?.providerCallsApprox ?? 0, 'Estimacion interna'],
    ['Manuscritos', costs?.manuscriptsGenerated ?? 0, 'Caronte literario'],
    ['PDFs', costs?.pdfsGenerated ?? 0, 'Artefactos generados'],
    ['Revision', costs?.pendingEditorialCostDrivers ?? 0, 'Pendientes']
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
  const policies = security?.retentionPolicies || [];
  const items = [
    ['Bloqueos', security?.abuseBlocked ?? 0, 'Rate limit'],
    ['Challenges', security?.abuseChallenges ?? 0, 'Anti-abuso'],
    ['Eventos abuso', security?.abuseEvents?.length ?? 0, 'Ultimos 120'],
    ['RGPD', security?.privacyRequests?.length ?? 0, 'Solicitudes'],
    ['Politicas', policies.length, 'Retencion'],
    ['Audio TTL', `${policies.find((item) => item.data_type === 'audio')?.ttl_days ?? 7} d`, 'Storage privado'],
    ['Respuestas TTL', `${policies.find((item) => item.data_type === 'answers')?.ttl_days ?? 30} d`, 'Datos sensibles'],
    ['Auditoria TTL', `${policies.find((item) => item.data_type === 'admin_audit')?.ttl_days ?? 365} d`, 'Minimizada']
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
  if (!deadLetters?.length) {
    deadLetterBody.innerHTML = '<tr class="empty-row"><td colspan="6">Sin dead letters abiertas.</td></tr>';
    return;
  }
  for (const item of deadLetters || []) {
    const row = document.createElement('tr');
    const id = escapeHtml(item.id);
    const status = String(item.status || 'open');
    row.innerHTML = `
      <td>${escapeHtml(formatDate(item.created_at || item.createdAt))}</td>
      <td><code>${escapeHtml(shortId(item.session_id || item.sessionId || item.target_id))}</code></td>
      <td>${escapeHtml(item.failed_action || item.failedAction || 'n/a')}</td>
      <td>${badge(item.severity || 'warning')}</td>
      <td>${badge(status)}</td>
      <td>
        <div class="row-actions">
          <button type="button" data-retry-dead-letter="${id}" ${!['open', 'retrying'].includes(status) ? 'disabled' : ''}>Retry</button>
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
    ['Dead letters', observability?.deadLetterOpen ?? 0, 'Abiertas'],
    ['SLA', sla.health || 'n/a', 'Estado interno'],
    ['Stuck now', observability?.stuckNow?.length ?? 0, 'Detectadas'],
    ['Release rate', conversion.released ?? 0, 'Conversion'],
    ['Book ready', conversion.bookReady ?? 0, 'Conversion'],
    ['Cost anomaly', costAnomaly.anomaly ? 'yes' : 'no', costAnomaly.reason || 'normal'],
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
  renderDeadLetters(observability?.deadLetters || []);
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
    ['Modo', policy.mode || 'fixed_beta', policy.fixedBetaEnabled ? 'fixed beta abierto' : 'cerrado'],
    ['Campanas', metrics.activeCampaigns ?? 0, 'Activas'],
    ['Links abiertos', metrics.openInvites ?? 0, 'No consumidos'],
    ['Links usados', metrics.usedInvites ?? 0, 'Consumidos'],
    ['Caducados', metrics.expiredInvites ?? 0, 'TTL vencido'],
    ['Waitlist', metrics.waitlistQueued ?? 0, 'Cola opaca']
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

function renderProviders(providers) {
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
    card.innerHTML = `
      <div class="provider-head">
        <div>
          <span>${escapeHtml(providerOperationalLabel(provider.provider))}</span>
          <h3>${escapeHtml(provider.displayName || provider.provider)}</h3>
        </div>
        ${badge(status)}
      </div>
      <p>${escapeHtml(required)} / ${escapeHtml(last4)} / ${escapeHtml(provider.source || 'missing')} / probe=${escapeHtml(probe)}${escapeHtml(modelInfo)}${escapeHtml(voiceInfo)}</p>
      <form data-provider-form="${providerId}">
        <label class="provider-secret-field">
          <span>${escapeHtml(keyLabel)}</span>
          <input name="apiKey" type="password" autocomplete="off" spellcheck="false" placeholder="${escapeHtml(keyPlaceholder)}" aria-label="${escapeHtml(keyLabel)}">
        </label>
        <small>Write-only: se guarda cifrada o como secret server-side. El navegador no puede leerla despues.</small>
        <div class="provider-actions">
          <button type="submit">Guardar key</button>
          <button class="secondary" type="button" data-test-provider="${providerId}">Probar conexion</button>
        </div>
      </form>
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
    const luluStatus = lulu.ready_for_print ? 'ready_for_print' : 'not_ready';
    const pdfId = escapeHtml(pdf.id);
    row.innerHTML = `
      <td><strong>${escapeHtml(pdf.fileName || pdf.file_name || shortId(pdf.id))}</strong></td>
      <td>${badge(status)}</td>
      <td>${escapeHtml(pdf.pageCount || pdf.page_count || 'n/a')}</td>
      <td>${badge(luluStatus)}</td>
      <td>
        <div class="row-actions">
          <button type="button" data-preview-pdf="${pdfId}">Ver</button>
          <button type="button" data-approve-pdf="${pdfId}" ${status !== 'pending_review' ? 'disabled' : ''}>Aprobar</button>
          <button class="secondary" type="button" data-reject-pdf="${pdfId}" ${status !== 'pending_review' ? 'disabled' : ''}>Rechazar</button>
          <button class="secondary" type="button" data-regen-pdf="${pdfId}">Regenerar</button>
          <button type="button" data-release-pdf="${pdfId}" ${status !== 'approved' ? 'disabled' : ''}>Liberar</button>
        </div>
      </td>
    `;
    pdfBody.append(row);
  }
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

function dashboardItem(collection, id) {
  const itemId = String(id || '');
  return (latestDashboardData?.[collection] || []).find((item) => {
    const candidates = [item.id, item.sessionId, item.session_id, item.campaignId, item.campaign_id, item.tokenHint, item.token_hint];
    return candidates.some((candidate) => String(candidate || '') === itemId);
  });
}

function showcaseSessionDetail(sessionId) {
  const session = dashboardItem('sessions', sessionId);
  if (!session || !isShowcaseItem(session)) return null;
  return {
    ok: true,
    session,
    events: [
      { eventType: 'voice_intro_started', createdAt: minutesAgo(54) },
      { eventType: 'answer_transcribed', createdAt: minutesAgo(48) },
      { eventType: 'psych_map_generated', createdAt: minutesAgo(40) },
      { eventType: 'manuscript_generated', createdAt: minutesAgo(34) },
      { eventType: 'pdf_rendered', createdAt: minutesAgo(29) }
    ],
    answers: [
      { questionIndex: 1, transcriptSource: 'elevenlabs_voice_session', qualityScore: 0.94, transcript: 'Recuerdo un momento concreto en el que senti que mi vida no estaba todavia decidida.' },
      { questionIndex: 3, transcriptSource: 'backend_transcription', qualityScore: 0.91, transcript: 'Mi biografia profesional mezcla ambicion, cansancio y una necesidad fuerte de control.' },
      { questionIndex: 5, transcriptSource: 'backend_transcription', qualityScore: 0.89, transcript: 'Mi biografia personal esta atravesada por decisiones que he pospuesto durante demasiado tiempo.' }
    ],
    artifacts: [{ type: 'pdf', status: session.pdfReviewStatus || 'pending_review' }],
    psychMaps: (latestDashboardData?.psychMaps || []).filter((item) => item.sessionId === sessionId || item.session_id === sessionId),
    manuscripts: (latestDashboardData?.manuscripts || []).filter((item) => item.sessionId === sessionId || item.session_id === sessionId),
    pdfs: (latestDashboardData?.pdfs || []).filter((item) => item.sessionId === sessionId || item.session_id === sessionId),
    auditEvents: []
  };
}

function isShowcaseActionTarget(id) {
  return ['sessions', 'pdfs', 'deadLetters', 'campaigns', 'invites'].some((collection) => {
    if (collection === 'deadLetters') return (latestDashboardData?.observability?.deadLetters || []).some((item) => String(item.id) === String(id) && isShowcaseItem(item));
    if (collection === 'campaigns') return (latestDashboardData?.viralAccess?.campaigns || []).some((item) => String(item.id) === String(id) && isShowcaseItem(item));
    if (collection === 'invites') return (latestDashboardData?.viralAccess?.invites || []).some((item) => String(item.id) === String(id) && isShowcaseItem(item));
    return isShowcaseItem(dashboardItem(collection, id));
  });
}

function showShowcaseActionMessage() {
  setText(adminStatus, 'Dato simulado: no se ejecuta ninguna accion real. Anade ?real=1 a la URL para operar solo con datos reales.');
}

async function refresh() {
  setText(adminStatus, 'Actualizando...');
  const rawData = await adminAction('adminDashboard');
  const data = enrichDashboard(rawData);
  latestDashboardData = data;
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
  renderCaronteMaps(data.psychMaps);
  renderManuscripts(data.manuscripts);
  renderPdfs(data.pdfs);
  renderAudit(data.auditEvents);
  setText(adminStatus, `Actualizado ${formatDate(data.refreshedAt || new Date().toISOString())}`);
}

async function openPanel() {
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
    adminToken = tokenInput.value || adminToken || 'local_admin';
    sessionStorage.setItem(ADMIN_TOKEN_KEY, adminToken);
    clearSession();
  }
  if (adminGate) adminGate.hidden = true;
  if (workspace) workspace.hidden = false;
  setText(adminMode, hasBackendConfig() ? 'Modo backend' : 'Modo local');
  await refresh();
}

function previewPdf(pdf) {
  if (!pdf?.pdfBase64 && !pdf?.signedUrl) {
    setText(previewMeta, 'PDF sin binario disponible');
    return;
  }
  const url = pdf.pdfBase64
    ? `data:${pdf.mimeType || 'application/pdf'};base64,${pdf.pdfBase64}`
    : pdf.signedUrl;
  if (pdfPreview) pdfPreview.src = url;
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
  if (!(target instanceof HTMLElement)) return;
  const previewId = target.dataset.previewPdf;
  const approveId = target.dataset.approvePdf;
  const rejectId = target.dataset.rejectPdf;
  const regenId = target.dataset.regenPdf;
  const releaseId = target.dataset.releasePdf;
  const testProvider = target.dataset.testProvider;
  const detailSessionId = target.dataset.sessionDetail;
  const retryDeadLetterId = target.dataset.retryDeadLetter;
  const resolveDeadLetterId = target.dataset.resolveDeadLetter;
  const campaignInvitesId = target.dataset.campaignInvites;
  const pauseCampaignId = target.dataset.pauseCampaign;
  const closeCampaignId = target.dataset.closeCampaign;
  const revokeInviteId = target.dataset.revokeInvite;

  if (campaignInvitesId) {
    if (inviteCampaignIdInput) inviteCampaignIdInput.value = campaignInvitesId;
    inviteCampaignIdInput?.focus();
    return;
  }
  if (pauseCampaignId || closeCampaignId) {
    if (isShowcaseActionTarget(pauseCampaignId || closeCampaignId)) {
      showShowcaseActionMessage();
      return;
    }
    await adminAction('adminUpdateAccessCampaign', {
      campaignId: pauseCampaignId || closeCampaignId,
      status: pauseCampaignId ? 'paused' : 'closed'
    });
    await refresh();
    return;
  }
  if (revokeInviteId) {
    if (isShowcaseActionTarget(revokeInviteId)) {
      showShowcaseActionMessage();
      return;
    }
    const result = await adminAction('adminRevokeAccessInvite', { inviteId: revokeInviteId, reason: 'revocado desde back office' });
    if (viralInviteOutput) viralInviteOutput.textContent = JSON.stringify(result, null, 2);
    await refresh();
    return;
  }
  if (retryDeadLetterId) {
    if (isShowcaseActionTarget(retryDeadLetterId)) {
      showShowcaseActionMessage();
      return;
    }
    const result = await adminAction('adminRetryDeadLetter', { deadLetterId: retryDeadLetterId });
    showObservabilityReport(result);
    await refresh();
    return;
  }
  if (resolveDeadLetterId) {
    if (isShowcaseActionTarget(resolveDeadLetterId)) {
      showShowcaseActionMessage();
      return;
    }
    const result = await adminAction('adminResolveDeadLetter', { deadLetterId: resolveDeadLetterId, reason: 'resuelto desde back office' });
    showObservabilityReport(result);
    await refresh();
    return;
  }
  if (detailSessionId) {
    const showcaseDetail = showcaseSessionDetail(detailSessionId);
    if (showcaseDetail) {
      renderSessionDetail(showcaseDetail);
      setText(adminStatus, 'Detalle simulado cargado sin llamar al backend.');
      return;
    }
    const result = await adminAction('adminSessionDetail', { sessionId: detailSessionId });
    renderSessionDetail(result);
    return;
  }
  if (previewId) {
    const showcasePdf = dashboardItem('pdfs', previewId);
    if (showcasePdf && isShowcaseItem(showcasePdf)) {
      previewPdf(showcasePdf);
      setText(adminStatus, 'PDF simulado seleccionado. No hay binario real asociado.');
      return;
    }
    const result = await adminAction('adminPdf', { pdfId: previewId });
    previewPdf(result.pdf);
    return;
  }
  if ([approveId, rejectId, regenId, releaseId].some((id) => id && isShowcaseActionTarget(id))) {
    showShowcaseActionMessage();
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
  const baseUrl = new URL('./futuro.html', window.location.href).toString();
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
  const form = event.target.closest('[data-provider-form]');
  if (!form) return;
  event.preventDefault();
  const provider = form.dataset.providerForm;
  const apiKey = new FormData(form).get('apiKey');
  await adminAction('adminSaveProviderKey', { provider, apiKey });
  form.reset();
  await refresh();
}

tokenForm?.addEventListener('submit', (event) => {
  event.preventDefault();
  openPanel().catch((error) => setText(adminMode, error instanceof Error ? error.message : 'No se pudo entrar'));
});

refreshButton?.addEventListener('click', () => {
  refresh().catch((error) => setText(adminStatus, error instanceof Error ? error.message : 'No se pudo actualizar'));
});

workspace?.addEventListener('click', (event) => {
  handleWorkspaceClick(event).catch((error) => setText(adminStatus, error instanceof Error ? error.message : 'La accion ha fallado'));
});

workspace?.addEventListener('submit', (event) => {
  handleProviderSubmit(event).catch((error) => setText(adminStatus, error instanceof Error ? error.message : 'No se pudo guardar el proveedor'));
});

accessToggleButton?.addEventListener('click', () => {
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
  signOut().catch(() => null);
  adminToken = '';
  sessionStorage.removeItem(ADMIN_TOKEN_KEY);
  if (tokenInput) tokenInput.value = '';
  if (adminPasswordInput) adminPasswordInput.value = '';
  if (adminGate) adminGate.hidden = false;
  if (workspace) workspace.hidden = true;
  setText(adminMode, 'Sesion cerrada');
});

if (getStoredUser() || adminToken) {
  tokenInput.value = adminToken;
  openPanel().catch((error) => setText(adminMode, error instanceof Error ? error.message : 'No se pudo restaurar la sesion'));
} else {
  setText(adminMode, hasBackendConfig() ? 'Backend: entra con usuario admin o token legacy' : 'Modo local: cualquier clave abre el panel');
}

setInterval(() => {
  if (!workspace?.hidden) refresh().catch(() => null);
}, 15000);
