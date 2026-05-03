import { readFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const corporate = await readFile(path.join(root, 'index.html'), 'utf8');
const app = await readFile(path.join(root, 'src/app.html'), 'utf8');
const index = await readFile(path.join(root, 'src/index.html'), 'utf8');
const appShell = await readFile(path.join(root, 'src/scripts/app-shell.js'), 'utf8');
const apiClient = await readFile(path.join(root, 'src/scripts/api-client.js'), 'utf8');
const config = await readFile(path.join(root, 'src/config/env.template.js'), 'utf8');
const buildScript = await readFile(path.join(root, 'scripts/build.mjs'), 'utf8');
const runbook = await readFile(path.join(root, 'docs/RUNBOOK_OPERATIVO.md'), 'utf8');
const compliance = await readFile(path.join(root, 'docs/MATRIZ_CUMPLIMIENTO.md'), 'utf8');

for (const snippet of ['Caronte', './tiresias.html', './futuro-admin.html']) {
  if (!corporate.includes(snippet)) throw new Error(`Caronte landing missing ${snippet}`);
}
if (!corporate.includes('modelo autonomo para entrevista, mapa psicologico, manuscrito privado y PDF final')) {
  throw new Error('Caronte landing missing accurate product positioning');
}

for (const forbidden of ['Cuenta demo', 'dashboard.html', 'LicitIA']) {
  if (corporate.includes(forbidden)) throw new Error(`Caronte landing must route to production access, not legacy demo or brand: ${forbidden}`);
}

for (const snippet of ['acceso.html', "root, 'index.html'"]) {
  if (!buildScript.includes(snippet)) throw new Error(`Build must publish corporate landing plus production access: ${snippet}`);
}

const frontendFlowSnippets = [
  'quickOnboardingForm',
  'loginForm',
  'recoverForm',
  'Plan Beta gratuita',
  'No tienes que introducir tarjeta'
];

for (const snippet of frontendFlowSnippets) {
  if (!index.includes(snippet)) throw new Error(`Beta/free onboarding flow missing ${snippet}`);
}

for (const forbidden of ['card_number', 'stripe', 'checkout.session', 'PaymentElement']) {
  if (`${index}\n${app}\n${apiClient}`.toLowerCase().includes(forbidden.toLowerCase())) {
    throw new Error(`Free beta flow must not include payment UI/API: ${forbidden}`);
  }
}

const cockpitFlows = [
  'tenderSearchForm',
  'trackTender',
  'workflowTender',
  'proposalCopilot',
  'proposalReview',
  'opsAdmin',
  'observabilityEvent',
  'showView',
  'setupGlobalSearch',
  'globalSearchForm',
  'data-nav-link="hoy"',
  'data-nav-link="operaciones"',
  'opportunity-search-main',
  'activeFilterChips',
  'detail-tabs',
  'score-drivers',
  'proposal-studio',
  'proposalReviewPanel',
  'dossier-board',
  'intel-workspace',
  'pricingScenarioPanel',
  'ops-tabbar',
  'uxMetricsPanel',
  'toastRegion',
  'userMenuButton',
  'accountSettingsForm',
  'systemSettingsPanel',
  'setupUserMenu',
  'updateCurrentUser',
  'trackProductEvent',
  'search_executed',
  'proposal_exported',
  'data-view-panel'
];

for (const snippet of cockpitFlows) {
  if (!`${app}\n${appShell}\n${apiClient}`.includes(snippet)) throw new Error(`Production cockpit flow missing ${snippet}`);
}

for (const snippet of ['paymentsEnabled: false', 'functionsBaseUrl']) {
  if (!config.includes(snippet)) throw new Error(`Frontend env template missing ${snippet}`);
}

for (const snippet of ['Ingestion falla', 'IA falla', 'Restaurar backup', 'Revocar usuario']) {
  if (!runbook.includes(snippet)) throw new Error(`Runbook missing ${snippet}`);
}

for (const snippet of ['RGPD', 'ENS', 'AI Act', 'Retencion', 'Subencargados']) {
  if (!compliance.includes(snippet)) throw new Error(`Compliance matrix missing ${snippet}`);
}

console.log('Production frontend/E2E/static checks OK');
