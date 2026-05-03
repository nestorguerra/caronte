import { readFile } from 'node:fs/promises';
import path from 'node:path';

const sprint1Sql = await readFile(path.join(process.cwd(), 'supabase/migrations/202604190001_sprint1_core.sql'), 'utf8');
const sprint2Sql = await readFile(path.join(process.cwd(), 'supabase/migrations/202604200001_sprint2_onboarding_legal_audit.sql'), 'utf8');
const sprint3Sql = await readFile(path.join(process.cwd(), 'supabase/migrations/202604200002_sprint3_official_data_search_alerts.sql'), 'utf8');
const sprint4Sql = await readFile(path.join(process.cwd(), 'supabase/migrations/202604200003_sprint4_ai_workflow_health.sql'), 'utf8');
const sprint5Sql = await readFile(path.join(process.cwd(), 'supabase/migrations/202604200004_sprint5_proposals_competitive_dossier.sql'), 'utf8');
const sprint6Sql = await readFile(path.join(process.cwd(), 'supabase/migrations/202604200005_sprint6_ops_quality_release.sql'), 'utf8');
const sql = `${sprint1Sql}\n${sprint2Sql}\n${sprint3Sql}\n${sprint4Sql}\n${sprint5Sql}\n${sprint6Sql}`;

const requiredTables = [
  'organizations',
  'organization_members',
  'plans',
  'subscriptions',
  'company_profiles',
  'procurement_sources',
  'tenders',
  'tender_lots',
  'tender_documents',
  'tender_versions',
  'saved_searches',
  'tracked_tenders',
  'alert_rules',
  'alert_events',
  'tasks',
  'milestones',
  'document_checklists',
  'proposal_projects',
  'proposal_versions',
  'ai_runs',
  'audit_events',
  'notification_deliveries',
  'task_comments',
  'companies',
  'company_aliases',
  'award_history',
  'economic_scenarios',
  'document_library',
  'dossier_packages',
  'dossier_items',
  'export_jobs',
  'backup_runs',
  'error_events',
  'internal_alerts',
  'release_checks'
];

for (const table of requiredTables) {
  if (!sql.includes(`create table if not exists public.${table}`)) {
    throw new Error(`Missing table ${table}`);
  }
  if (!sql.includes(`alter table public.${table} enable row level security`)) {
    throw new Error(`Missing RLS enable for ${table}`);
  }
}

const requiredSnippets = [
  'public.is_org_member',
  'public.has_org_role',
  'free_beta_month',
  'create policy organizations_select_member',
  'create policy organization_members_select_member',
  'create policy tenant_select_member on public.tenders',
  'create table if not exists public.organization_invitations',
  'create table if not exists public.user_legal_acceptances',
  'idx_org_invitations_pending_email',
  'legal_acceptances_select_self_or_admin',
  'current_period_ends_at = coalesce',
  '"requires_card": false',
  'create table if not exists public.procurement_ingestion_runs',
  'idx_ingestion_runs_source_created',
  'idx_tenders_public_deadline',
  'placsp_profiles',
  'placsp_aggregated',
  'boe_opendata',
  'add column if not exists decision text',
  'idx_tracked_tenders_decision',
  'create table if not exists public.task_comments',
  'idx_ai_runs_org_endpoint_created',
  'create table if not exists public.companies',
  'create table if not exists public.award_history',
  'create table if not exists public.economic_scenarios',
  'create table if not exists public.document_library',
  'create table if not exists public.dossier_packages',
  'insert into storage.buckets',
  'idx_award_history_cpv',
  'add column if not exists status text',
  'create table if not exists public.backup_runs',
  'create table if not exists public.error_events',
  'create table if not exists public.internal_alerts',
  'create table if not exists public.release_checks',
  'idx_error_events_fingerprint',
  'licitia-backups'
];

for (const snippet of requiredSnippets) {
  if (!sql.includes(snippet)) throw new Error(`Missing SQL snippet: ${snippet}`);
}

const functions = [
  'complete-onboarding',
  'onboarding-state',
  'update-company-profile',
  'audit-event',
  'search-tenders',
  'tender-detail',
  'track-tender',
  'decision-score',
  'analyze-tender',
  'workflow-tender',
  'system-health',
  'proposal-copilot',
  'proposal-review',
  'competitive-intel',
  'document-dossier',
  'ops-admin',
  'observability-event'
];

for (const fn of functions) {
  const text = await readFile(path.join(process.cwd(), 'supabase/functions', fn, 'index.ts'), 'utf8');
  if (!text.includes('getUser(req)') && !text.includes('requireActiveMembership(req)')) {
    throw new Error(`Function ${fn} must authenticate the user`);
  }
  if (!text.includes('jsonResponse')) throw new Error(`Function ${fn} must return normalized JSON responses`);
}

const onboarding = await readFile(path.join(process.cwd(), 'supabase/functions/complete-onboarding/index.ts'), 'utf8');
for (const snippet of ['user_legal_acceptances', 'saved_searches', 'alert_rules', 'organization_invitations', 'onboarding.completed']) {
  if (!onboarding.includes(snippet)) throw new Error(`complete-onboarding missing ${snippet}`);
}
if (!onboarding.includes('preferences.search_terms')) {
  throw new Error('complete-onboarding must count quick onboarding search terms in profile completion');
}

for (const fn of ['ingest-boe', 'ingest-placsp', 'run-alerts']) {
  const text = await readFile(path.join(process.cwd(), 'supabase/functions', fn, 'index.ts'), 'utf8');
  if (!text.includes('requireJobCaller')) throw new Error(`Function ${fn} must protect job execution`);
  if (!text.includes('startIngestionRun')) throw new Error(`Function ${fn} must create an ingestion/job run`);
  if (text.includes('DOMParser')) throw new Error(`Function ${fn} must not rely on DOMParser in Supabase Edge runtime`);
}

const xmlHelper = await readFile(path.join(process.cwd(), 'supabase/functions/_shared/xml.ts'), 'utf8');
for (const snippet of ['xmlElementBlocks', 'firstXmlText', 'xmlAttributeValues']) {
  if (!xmlHelper.includes(snippet)) throw new Error(`XML helper missing ${snippet}`);
}

const territoryHelper = await readFile(path.join(process.cwd(), 'supabase/functions/_shared/territory.ts'), 'utf8');
for (const snippet of ['buildTerritoryLabel', 'territorialMatches', 'ES61', 'Andalucia', 'Pais Vasco']) {
  if (!territoryHelper.includes(snippet)) throw new Error(`Territory helper missing ${snippet}`);
}

const placspIngest = await readFile(path.join(process.cwd(), 'supabase/functions/ingest-placsp/index.ts'), 'utf8');
for (const snippet of ['fetchAtomEntries', 'nextAtomUrl', 'maxPages', 'buildTerritoryLabel', 'placsp_atom_v2']) {
  if (!placspIngest.includes(snippet)) throw new Error(`PLACSP ingestion missing autonomous-community support: ${snippet}`);
}

const searchTenders = await readFile(path.join(process.cwd(), 'supabase/functions/search-tenders/index.ts'), 'utf8');
if (!searchTenders.includes('territorialMatches')) {
  throw new Error('search-tenders must match regions through autonomous-community normalization');
}

const app = await readFile(path.join(process.cwd(), 'src/app.html'), 'utf8');
for (const snippet of ['tenderSearchForm', 'tenderResults', 'tenderDetail', 'runAlertsButton']) {
  if (!app.includes(snippet)) throw new Error(`Sprint 3 cockpit missing ${snippet}`);
}

const supabaseConfig = await readFile(path.join(process.cwd(), 'supabase/config.toml'), 'utf8');
for (const fn of ['complete-onboarding', 'onboarding-state', 'update-company-profile', 'audit-event', 'search-tenders', 'tender-detail', 'track-tender', 'decision-score', 'analyze-tender', 'workflow-tender', 'system-health', 'proposal-copilot', 'proposal-review', 'competitive-intel', 'document-dossier', 'ops-admin', 'observability-event']) {
  const block = supabaseConfig.match(new RegExp(`\\[functions\\.${fn}\\][\\s\\S]*?verify_jwt = (true|false)`));
  if (!block || block[1] !== 'false') {
    throw new Error(`Function ${fn} must bypass platform JWT verification and authenticate in-code`);
  }
}

const scoring = await readFile(path.join(process.cwd(), 'supabase/functions/_shared/scoring.ts'), 'utf8');
for (const snippet of ['ExplainableScore', 'cpv_service', 'historical_competition', 'document_risk']) {
  if (!scoring.includes(snippet)) throw new Error(`Scoring helper missing ${snippet}`);
}

const ai = await readFile(path.join(process.cwd(), 'supabase/functions/_shared/ai.ts'), 'utf8');
for (const snippet of ['analysisSchema', 'validateAnalysis', 'callOpenAiJson', 'no encontrado']) {
  if (!ai.includes(snippet)) throw new Error(`AI helper missing ${snippet}`);
}

const workflow = await readFile(path.join(process.cwd(), 'supabase/functions/_shared/workflow.ts'), 'utf8');
for (const snippet of ['defaultChecklistItems', 'defaultMilestones', 'icsCalendar']) {
  if (!workflow.includes(snippet)) throw new Error(`Workflow helper missing ${snippet}`);
}

const exportsHelper = await readFile(path.join(process.cwd(), 'supabase/functions/_shared/exports.ts'), 'utf8');
for (const snippet of ['createDocxBase64', 'createZipBase64', 'rowsToCsv']) {
  if (!exportsHelper.includes(snippet)) throw new Error(`Exports helper missing ${snippet}`);
}
for (const snippet of ['ParagraphTone', 'heading1', 'Aptos Mono']) {
  if (!exportsHelper.includes(snippet)) throw new Error(`Professional DOCX export missing ${snippet}`);
}

for (const fn of ['proposal-copilot', 'proposal-review', 'competitive-intel', 'document-dossier']) {
  const text = await readFile(path.join(process.cwd(), 'supabase/functions', fn, 'index.ts'), 'utf8');
  if (!text.includes('requireActiveMembership')) throw new Error(`Sprint 5 function ${fn} must require membership`);
  if (!text.includes('insertAudit')) throw new Error(`Sprint 5 function ${fn} must audit actions`);
}

const proposalCopilotFn = await readFile(path.join(process.cwd(), 'supabase/functions/proposal-copilot/index.ts'), 'utf8');
for (const snippet of ['normalizeGptModel', 'gpt-5.5', 'gpt-5.4', 'gpt-5.4-mini', 'sprint5.proposal.v2', 'maxOutputTokens', 'Matriz inicial de cumplimiento']) {
  if (!proposalCopilotFn.includes(snippet)) throw new Error(`Proposal copilot GPT/professional draft support missing ${snippet}`);
}

for (const fn of ['ops-admin', 'observability-event']) {
  const text = await readFile(path.join(process.cwd(), 'supabase/functions', fn, 'index.ts'), 'utf8');
  if (!text.includes('jsonResponse')) throw new Error(`Sprint 6 function ${fn} must return JSON`);
  if (!text.includes('error_events') && !text.includes('backup_runs')) throw new Error(`Sprint 6 function ${fn} must touch ops tables`);
}

const sprint4App = await readFile(path.join(process.cwd(), 'src/app.html'), 'utf8');
for (const snippet of ['decisionPanel', 'analysisPanel', 'workflowPanel', 'systemHealthPanel']) {
  if (!sprint4App.includes(snippet)) throw new Error(`Sprint 4 cockpit missing ${snippet}`);
}
for (const snippet of ['proposalPanel', 'competitivePanel', 'dossierPanel']) {
  if (!sprint4App.includes(snippet)) throw new Error(`Sprint 5 cockpit missing ${snippet}`);
}
for (const snippet of ['opsPanel', 'observabilityPanel', 'releasePanel', 'data-view-panel']) {
  if (!sprint4App.includes(snippet)) throw new Error(`Sprint 6 cockpit missing ${snippet}`);
}
for (const snippet of ['aiSettingsForm', 'openaiApiKey', 'gpt-5.5', 'gpt-5.4', 'gpt-5.4-mini']) {
  if (!sprint4App.includes(snippet)) throw new Error(`GPT settings UI missing ${snippet}`);
}

const appShell = await readFile(path.join(process.cwd(), 'src/scripts/app-shell.js'), 'utf8');
for (const snippet of ['AI_SETTINGS_KEY', 'proposalAiPayload', 'handleAiSettings']) {
  if (!appShell.includes(snippet) && !sprint4App.includes(snippet)) throw new Error(`App shell GPT settings support missing ${snippet}`);
}
const appCss = await readFile(path.join(process.cwd(), 'src/styles/app.css'), 'utf8');
for (const snippet of ['overflow-wrap: anywhere', '.ai-settings-card', 'font-family: Georgia']) {
  if (!appCss.includes(snippet)) throw new Error(`App CSS polish missing ${snippet}`);
}

const index = await readFile(path.join(process.cwd(), 'src/index.html'), 'utf8');
for (const snippet of ['quickOnboardingForm', '1. Empresa', '7. Importe objetivo', 'Empezar a trabajar']) {
  if (!index.includes(snippet)) throw new Error(`Quick onboarding missing ${snippet}`);
}

const authConfirm = await readFile(path.join(process.cwd(), 'src/scripts/auth-confirm.js'), 'utf8');
if (!authConfirm.includes('verifyTokenHash') || !authConfirm.includes('confirmed=1')) {
  throw new Error('Auth confirmation page must verify token hash and return to onboarding');
}

console.log('Sprint 1+2+3+4+5+6 schema and API tests OK');
