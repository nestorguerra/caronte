import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const requiredFiles = [
  'package.json',
  'index.html',
  'src/index.html',
  'src/app.html',
  'src/auth/confirm.html',
  'src/scripts/api-client.js',
  'src/scripts/future-book.js',
  'src/scripts/future-admin.js',
  'src/scripts/auth-confirm.js',
  'src/scripts/auth-flow.js',
  'src/config/env.template.js',
  'src/futuro.html',
  'src/futuro-admin.html',
  'src/styles/future-book.css',
  'src/styles/future-admin.css',
  'src/legal/terms.html',
  'src/legal/privacy.html',
  'src/legal/ai-notice.html',
  'src/legal/futuro-terms.html',
  'src/legal/futuro-privacy.html',
  'src/_headers',
  'vercel.json',
  '.github/workflows/future-book-monitor.yml',
  'supabase/functions/health/index.ts',
  'supabase/functions/create-organization/index.ts',
  'supabase/functions/complete-onboarding/index.ts',
  'supabase/functions/onboarding-state/index.ts',
  'supabase/functions/update-company-profile/index.ts',
  'supabase/functions/audit-event/index.ts',
  'supabase/functions/ingest-boe/index.ts',
  'supabase/functions/ingest-placsp/index.ts',
  'supabase/functions/search-tenders/index.ts',
  'supabase/functions/tender-detail/index.ts',
  'supabase/functions/track-tender/index.ts',
  'supabase/functions/decision-score/index.ts',
  'supabase/functions/analyze-tender/index.ts',
  'supabase/functions/workflow-tender/index.ts',
  'supabase/functions/system-health/index.ts',
  'supabase/functions/proposal-copilot/index.ts',
  'supabase/functions/proposal-review/index.ts',
  'supabase/functions/competitive-intel/index.ts',
  'supabase/functions/document-dossier/index.ts',
  'supabase/functions/ops-admin/index.ts',
  'supabase/functions/observability-event/index.ts',
  'supabase/functions/future-book-session/index.ts',
  'supabase/functions/run-alerts/index.ts',
  'supabase/functions/_shared/scoring.ts',
  'supabase/functions/_shared/ai.ts',
  'supabase/functions/_shared/workflow.ts',
  'supabase/functions/_shared/exports.ts',
  'supabase/functions/_shared/tenders.ts',
  'supabase/functions/_shared/xml.ts',
  'supabase/templates/confirmation.html',
  'supabase/templates/recovery.html',
  'supabase/migrations/202604190001_sprint1_core.sql',
  'supabase/migrations/202604200001_sprint2_onboarding_legal_audit.sql',
  'supabase/migrations/202604200002_sprint3_official_data_search_alerts.sql',
  'supabase/migrations/202604200003_sprint4_ai_workflow_health.sql',
  'supabase/migrations/202604200004_sprint5_proposals_competitive_dossier.sql',
  'supabase/migrations/202604200005_sprint6_ops_quality_release.sql',
  'supabase/migrations/202604210001_future_book_sprint0.sql',
  'supabase/migrations/202604210002_future_book_sprint2_voice.sql',
  'supabase/migrations/202604210003_future_book_sprint4_manuscript.sql',
  'supabase/migrations/202604220001_future_book_sprint5_pdf_admin.sql',
  'supabase/migrations/202604220002_future_book_sprint6_monitoring.sql',
  'supabase/migrations/202604220003_future_book_sprint8_audio_storage.sql',
  'supabase/migrations/202604220004_future_book_sprint9_caronte_maps.sql',
  'supabase/migrations/202604220005_future_book_sprint10_pdf_storage.sql',
  'supabase/migrations/202604220006_future_book_sprint12_backoffice_ops.sql',
  'supabase/migrations/202604220007_future_book_sprint13_security_privacy.sql',
  'supabase/migrations/202604220008_future_book_sprint14_autonomous_observability.sql',
  'supabase/migrations/202604220009_future_book_sprint15_ephemeral_access.sql',
  'scripts/test-production-flows.mjs',
  'scripts/test-future-book-sprint0.mjs',
  'scripts/test-future-book-sprint1.mjs',
  'scripts/test-future-book-sprint2.mjs',
  'scripts/test-future-book-sprint3.mjs',
  'scripts/test-future-book-sprint4.mjs',
  'scripts/test-future-book-sprint5.mjs',
  'scripts/test-future-book-sprint6.mjs',
  'scripts/test-future-book-sprint8.mjs',
  'scripts/test-future-book-sprint9.mjs',
  'scripts/test-future-book-sprint10.mjs',
  'scripts/test-future-book-sprint12.mjs',
  'scripts/test-future-book-sprint13.mjs',
  'scripts/test-future-book-sprint14.mjs',
  'scripts/test-future-book-sprint15.mjs',
  'docs/PRODUCT_BACKLOG_LIBRO_FUTURO_MVP.md',
  'docs/SPRINT_0_LIBRO_FUTURO_IMPLEMENTATION.md',
  'docs/SPRINT_1_LIBRO_FUTURO_IMPLEMENTATION.md',
  'docs/SPRINT_2_LIBRO_FUTURO_IMPLEMENTATION.md',
  'docs/SPRINT_3_LIBRO_FUTURO_IMPLEMENTATION.md',
  'docs/SPRINT_4_LIBRO_FUTURO_IMPLEMENTATION.md',
  'docs/SPRINT_5_LIBRO_FUTURO_IMPLEMENTATION.md',
  'docs/SPRINT_6_LIBRO_FUTURO_IMPLEMENTATION.md',
  'docs/SPRINT_8_LIBRO_FUTURO_IMPLEMENTATION.md',
  'docs/SPRINT_9_LIBRO_FUTURO_IMPLEMENTATION.md',
  'docs/SPRINT_10_LIBRO_FUTURO_IMPLEMENTATION.md',
  'docs/SPRINT_12_LIBRO_FUTURO_IMPLEMENTATION.md',
  'docs/SPRINT_13_LIBRO_FUTURO_IMPLEMENTATION.md',
  'docs/SPRINT_14_LIBRO_FUTURO_IMPLEMENTATION.md',
  'docs/SPRINT_15_LIBRO_FUTURO_IMPLEMENTATION.md',
  'docs/RUNBOOK_FUTURO_ANTERIOR.md',
  'docs/BETA_CHECKLIST_FUTURO_ANTERIOR.md',
  'docs/SPRINT_6_IMPLEMENTATION.md',
  'docs/PRODUCT_BACKLOG_DISENO_UX_2026.md',
  'docs/SPRINT_UX_1_IMPLEMENTATION.md',
  'docs/SPRINT_UX_2_IMPLEMENTATION.md',
  'docs/SPRINT_UX_3_IMPLEMENTATION.md',
  'docs/SPRINT_UX_4_IMPLEMENTATION.md',
  'docs/RUNBOOK_OPERATIVO.md',
  'docs/MATRIZ_CUMPLIMIENTO.md'
];

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (['.git', 'dist', 'node_modules'].includes(entry.name)) continue;
      files.push(...await walk(full));
    } else {
      files.push(full);
    }
  }
  return files;
}

for (const file of requiredFiles) {
  const full = path.join(root, file);
  const info = await stat(full).catch(() => null);
  if (!info?.isFile()) throw new Error(`Missing required file: ${file}`);
}

const scanRoots = ['src', 'scripts', 'supabase', '.github', 'docs'];
const files = [];
for (const dir of scanRoots) {
  files.push(...await walk(path.join(root, dir)).catch(() => []));
}

const secretPatterns = [
  /sk-[A-Za-z0-9_-]{20,}/,
  /xox[baprs]-[A-Za-z0-9-]{20,}/,
  /ghp_[A-Za-z0-9]{20,}/,
  /-----BEGIN PRIVATE KEY-----/
];

for (const file of files) {
  if (path.basename(file) === 'validate.mjs') continue;
  const text = await readFile(file, 'utf8').catch(() => '');
  for (const pattern of secretPatterns) {
    if (pattern.test(text)) {
      throw new Error(`Potential secret found in ${path.relative(root, file)}`);
    }
  }
}

const index = await readFile(path.join(root, 'src/index.html'), 'utf8');
if (!index.includes('Beta gratuita') || !index.includes('Crear cuenta') || !index.includes('terminos beta')) {
  throw new Error('Onboarding/auth copy missing from src/index.html');
}
if (!index.includes('quickOnboardingForm') || !index.includes('7 preguntas') || index.includes('profileForm') || index.includes('searchPrefsForm')) {
  throw new Error('Onboarding must stay short: one quick form and no legacy multi-step forms');
}

const corporateIndex = await readFile(path.join(root, 'index.html'), 'utf8');
for (const snippet of ['Caronte', './futuro.html', './futuro-admin.html', 'backend=supabase_edge_functions']) {
  if (!corporateIndex.includes(snippet)) throw new Error(`Caronte landing missing ${snippet}`);
}
if (!corporateIndex.includes('modelo autonomo para entrevista, mapa psicologico, manuscrito privado y PDF final')) {
  throw new Error('Caronte landing missing accurate product positioning');
}
for (const forbidden of ['Cuenta demo', 'dashboard.html', 'LicitIA']) {
  if (corporateIndex.includes(forbidden)) throw new Error(`Caronte landing must not expose legacy access or brand: ${forbidden}`);
}

const buildScript = await readFile(path.join(root, 'scripts/build.mjs'), 'utf8');
for (const snippet of ['acceso.html', "root, 'index.html'"]) {
  if (!buildScript.includes(snippet)) throw new Error(`Build must publish landing/access split: ${snippet}`);
}

const apiClient = await readFile(path.join(root, 'src/scripts/api-client.js'), 'utf8');
for (const snippet of ['redirect_to=', 'consumeAuthRedirect', 'verifyTokenHash', 'auth/v1/verify']) {
  if (!apiClient.includes(snippet)) throw new Error(`Auth client missing ${snippet}`);
}
if (!apiClient.includes('acceso.html')) {
  throw new Error('Auth redirects must return to production access page');
}

const confirmationTemplate = await readFile(path.join(root, 'supabase/templates/confirmation.html'), 'utf8');
for (const snippet of ['LicitIA', 'Activa tu cuenta', '{{ .ConfirmationURL }}']) {
  if (!confirmationTemplate.includes(snippet)) throw new Error(`Confirmation email template missing ${snippet}`);
}

const envTemplate = await readFile(path.join(root, 'src/config/env.template.js'), 'utf8');
if (!envTemplate.includes('paymentsEnabled: false')) {
  throw new Error('paymentsEnabled must default to false for Sprint 1');
}

const appShell = await readFile(path.join(root, 'src/scripts/app-shell.js'), 'utf8');
for (const snippet of ['updateCompanyProfile', 'getOnboardingState', 'searchTenders', 'decisionScore', 'analyzeTender', 'workflowTender', 'systemHealth']) {
  if (!appShell.includes(snippet)) throw new Error(`App shell missing ${snippet}`);
}

const cockpit = await readFile(path.join(root, 'src/app.html'), 'utf8');
for (const snippet of ['decisionPanel', 'analysisPanel', 'workflowPanel', 'systemHealthPanel']) {
  if (!cockpit.includes(snippet)) throw new Error(`Sprint 4 cockpit missing ${snippet}`);
}
for (const snippet of ['proposalPanel', 'competitivePanel', 'dossierPanel', 'sprint5State']) {
  if (!cockpit.includes(snippet)) throw new Error(`Sprint 5 cockpit missing ${snippet}`);
}
for (const snippet of ['data-nav-link="hoy"', 'href="#expedientes"', 'href="#propuestas"', 'href="#inteligencia"', 'href="#operaciones"', 'id="ajustes"']) {
  if (!cockpit.includes(snippet)) throw new Error(`Sidebar navigation missing ${snippet}`);
}
for (const snippet of ['setupSidebarNavigation', 'showView', 'data-view-panel', 'setActiveNav', 'setupGlobalSearch', 'viewAliases', 'aria-current']) {
  if (!appShell.includes(snippet)) throw new Error(`Sidebar navigation JS missing ${snippet}`);
}
for (const snippet of ['proposalCopilot', 'proposalReview', 'competitiveIntel', 'documentDossier', 'downloadBase64']) {
  if (!appShell.includes(snippet)) throw new Error(`Sprint 5 app shell missing ${snippet}`);
}
for (const snippet of ['opsAdmin', 'observabilityEvent', 'loadOpsDashboard', 'setupErrorTracking']) {
  if (!appShell.includes(snippet)) throw new Error(`Sprint 6 app shell missing ${snippet}`);
}
for (const snippet of ['opsPanel', 'observabilityPanel', 'releasePanel', 'data-view-panel="ajustes"']) {
  if (!cockpit.includes(snippet)) throw new Error(`Sprint 6 cockpit missing ${snippet}`);
}
for (const snippet of ['skip-link', 'globalSearchForm', 'activeOrgName', 'data-view-panel="hoy"', 'data-view-panel="operaciones"']) {
  if (!cockpit.includes(snippet)) throw new Error(`Sprint UX 1 shell missing ${snippet}`);
}
for (const snippet of ['opportunity-search-main', 'activeFilterChips', 'opportunity-table', 'Ficha 360']) {
  if (!cockpit.includes(snippet)) throw new Error(`Sprint UX 2 opportunities UI missing ${snippet}`);
}
for (const snippet of ['proposal-studio', 'proposalEvidencePanel', 'proposalReviewPanel', 'dossier-board', 'intel-workspace', 'pricingScenarioPanel', 'marketRiskPanel']) {
  if (!cockpit.includes(snippet)) throw new Error(`Sprint UX 3 proposal/intel UI missing ${snippet}`);
}
for (const snippet of ['renderProposalEvidence', 'renderPricingScenarioPanel', 'renderMarketRiskPanel', 'proposalReviewPanel']) {
  if (!appShell.includes(snippet)) throw new Error(`Sprint UX 3 app shell missing ${snippet}`);
}
for (const snippet of ['data-admin-only', 'ops-tabbar', 'opsOverviewPanel', 'opsUsersPanel', 'uxMetricsPanel', 'toastRegion']) {
  if (!cockpit.includes(snippet)) throw new Error(`Sprint UX 4 operations UI missing ${snippet}`);
}
for (const snippet of ['userMenuButton', 'userMenuPanel', 'accountSettingsForm', 'systemSettingsPanel', 'sidebarOrgName']) {
  if (!cockpit.includes(snippet)) throw new Error(`User settings shell missing ${snippet}`);
}
for (const snippet of ['setupOpsTabs', 'showToast', 'renderSkeleton', 'renderErrorState', 'trackProductEvent', 'renderUxMetricsPanel']) {
  if (!appShell.includes(snippet)) throw new Error(`Sprint UX 4 app shell missing ${snippet}`);
}
for (const snippet of ['setupUserMenu', 'handleAccountSettings', 'applyUserSettings', 'renderUserIdentity']) {
  if (!appShell.includes(snippet)) throw new Error(`User settings JS missing ${snippet}`);
}
if (!apiClient.includes('updateCurrentUser')) {
  throw new Error('API client missing updateCurrentUser for account settings');
}
for (const snippet of ['signup_started', 'onboarding_completed']) {
  const authFlow = await readFile(path.join(root, 'src/scripts/auth-flow.js'), 'utf8');
  if (!authFlow.includes(snippet)) throw new Error(`Sprint UX 4 auth metric missing ${snippet}`);
}
const auditEvent = await readFile(path.join(root, 'supabase/functions/audit-event/index.ts'), 'utf8');
for (const snippet of ['search_executed', 'tender_tracked', 'decision_recorded', 'proposal_exported', 'dossier_exported']) {
  if (!auditEvent.includes(snippet)) throw new Error(`Sprint UX 4 audit event missing ${snippet}`);
}

const appCss = await readFile(path.join(root, 'src/styles/app.css'), 'utf8');
for (const snippet of ['opportunity-row', 'detail-tabs', 'score-drivers', 'detail-meta-grid']) {
  if (!appCss.includes(snippet)) throw new Error(`Sprint UX 2 CSS missing ${snippet}`);
}
for (const snippet of ['proposal-studio', 'dossier-board', 'intel-workspace']) {
  if (!appCss.includes(snippet)) throw new Error(`Sprint UX 3 CSS missing ${snippet}`);
}
for (const snippet of ['ops-tabbar', 'ops-overview-strip', 'toast-region', 'skeleton-row', 'toast-in']) {
  if (!appCss.includes(snippet)) throw new Error(`Sprint UX 4 CSS missing ${snippet}`);
}
for (const snippet of ['position: fixed', 'user-menu-panel', 'settings-layout', 'data-density']) {
  if (!appCss.includes(snippet)) throw new Error(`Fixed sidebar/user settings CSS missing ${snippet}`);
}
for (const snippet of [
  '@media (min-width: 641px) and (max-width: 940px)',
  '@media (min-width: 941px) and (max-width: 1280px)',
  '100dvh',
  '-webkit-overflow-scrolling: touch',
  '@media (max-width: 860px)'
]) {
  if (!appCss.includes(snippet)) throw new Error(`iPad responsive CSS missing ${snippet}`);
}
if (appCss.includes('transition: all')) {
  throw new Error('Sprint UX 4 motion rule violated: transition: all is not allowed');
}

console.log('Validation OK');
