import { readFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();

async function file(relativePath) {
  return readFile(path.join(root, relativePath), 'utf8');
}

function includes(text, snippets, label) {
  for (const snippet of snippets) {
    if (!text.includes(snippet)) {
      throw new Error(`${label} missing ${snippet}`);
    }
  }
}

const fn = await file('supabase/functions/future-book-session/index.ts');
const migration = await file('supabase/migrations/202604220008_future_book_sprint14_autonomous_observability.sql');
const adminHtml = await file('src/futuro-admin.html');
const adminJs = await file('src/scripts/future-admin.js');
const adminCss = await file('src/styles/future-admin.css');
const sprint = await file('docs/SPRINT_14_LIBRO_FUTURO_IMPLEMENTATION.md');
const runbook = await file('docs/RUNBOOK_FUTURO_ANTERIOR.md');
const env = await file('.env.example');
const workflow = await file('.github/workflows/future-book-monitor.yml');
const readme = await file('README.md');
const pkg = await file('package.json');

includes(fn, [
  'future_book_synthetic_runs',
  'future_book_dead_letters',
  'future_book_sla_snapshots',
  'future_book_alert_deliveries',
  'deliverP0Alert',
  'detectStuckSessions',
  'runSyntheticMonitor',
  'runAutonomousMonitor',
  'adminRunSyntheticMonitor',
  'adminRunAutonomousMonitor',
  'adminRetryDeadLetter',
  'adminResolveDeadLetter',
  'FUTURE_BOOK_MONITOR_SECRET',
  'FUTURE_BOOK_ALERT_WEBHOOK_URL',
  'FUTURE_BOOK_DAILY_PROVIDER_CALL_LIMIT'
], 'Future book Sprint 14 backend');

includes(migration, [
  'create table if not exists public.future_book_synthetic_runs',
  'create table if not exists public.future_book_dead_letters',
  'create table if not exists public.future_book_sla_snapshots',
  'create table if not exists public.future_book_alert_deliveries',
  'enable row level security',
  'touch_future_book_dead_letters_updated_at'
], 'Future book Sprint 14 migration');

includes(adminHtml, [
  'observabilityGrid',
  'syntheticRunButton',
  'autonomousMonitorButton',
  'deadLetterBody',
  'observabilityReport'
], 'Future book Sprint 14 admin HTML');

includes(adminJs, [
  'renderObservability',
  'renderDeadLetters',
  'showObservabilityReport',
  'adminRunSyntheticMonitor',
  'adminRunAutonomousMonitor',
  'adminRetryDeadLetter',
  'adminResolveDeadLetter'
], 'Future book Sprint 14 admin JS');

includes(adminCss, [
  'panel-actions'
], 'Future book Sprint 14 admin CSS');

includes(sprint, [
  'PB-H02',
  'PB-H03',
  'PB-H04',
  'PB-H10',
  'future_book_dead_letters',
  'FUTURE_BOOK_MONITOR_SECRET'
], 'Future book Sprint 14 doc');

includes(runbook, [
  'Observabilidad autonoma',
  'Synthetic monitor',
  'Dead-letter queue',
  'FUTURE_BOOK_ALERT_WEBHOOK_URL',
  'OpenAI',
  'Anthropic',
  'ElevenLabs',
  'PDF'
], 'Future book Sprint 14 runbook');

includes(env, [
  'FUTURE_BOOK_MONITOR_SECRET',
  'FUTURE_BOOK_ALERT_WEBHOOK_URL',
  'FUTURE_BOOK_DAILY_PROVIDER_CALL_LIMIT'
], 'Future book Sprint 14 env');

includes(workflow, [
  'Futuro Anterior Autonomous Monitor',
  '*/30 * * * *',
  'runAutonomousMonitor',
  'runSyntheticMonitor',
  'x-licitia-job-secret',
  'INGESTION_SECRET'
], 'Future book Sprint 14 workflow');

includes(readme, [
  'Modulo Futuro Anterior Sprint 14',
  'future_book_synthetic_runs',
  'future-book-monitor.yml',
  'FUTURE_BOOK_MONITOR_SECRET',
  'FUTURE_BOOK_ALERT_WEBHOOK_URL'
], 'Future book Sprint 14 README');

includes(pkg, [
  'test-future-book-sprint14.mjs'
], 'Package test script');

console.log('Future book Sprint 14 checks OK');
