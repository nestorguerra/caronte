import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const projectRef = process.argv[2];
const repo = process.argv[3] || 'nestorguerra/licitia-v2-production';
const pageOrigin = process.argv[4] || 'https://nestorguerra.github.io';

if (!projectRef) {
  throw new Error('Usage: node scripts/configure-supabase-production.mjs <project-ref> [owner/repo] [page-origin]');
}

function run(command, args, options = {}) {
  return execFileSync(command, args, {
    encoding: 'utf8',
    input: options.input,
    stdio: options.stdio || ['ignore', 'pipe', 'pipe']
  });
}

const supabaseUrl = `https://${projectRef}.supabase.co`;
const functionsBaseUrl = `${supabaseUrl}/functions/v1`;
const apiKeys = JSON.parse(run('supabase', ['projects', 'api-keys', '--project-ref', projectRef, '--output', 'json']));
const anonKey = apiKeys.find((key) => key.name === 'anon')?.api_key
  || apiKeys.find((key) => key.type === 'publishable')?.api_key;

if (!anonKey) throw new Error('Could not find anon/publishable Supabase key');

const dir = mkdtempSync(path.join(tmpdir(), 'licitia-supabase-'));
const envFile = path.join(dir, 'functions.env');
const ingestionSecret = process.env.INGESTION_SECRET || randomUUID();
const optionalSecrets = [
  'APP_ADMIN_EMAILS',
  'RESEND_API_KEY',
  'NOTIFICATION_FROM',
  'OPENAI_API_KEY',
  'OPENAI_MODEL',
  'FUTURE_BOOK_OPENAI_MODEL',
  'FUTURE_BOOK_ADMIN_TOKEN',
  'FUTURE_BOOK_SECRET_KEY',
  'FUTURE_BOOK_TRANSCRIPTION_API_KEY',
  'FUTURE_BOOK_ACCESS_DISABLED',
  'ANTHROPIC_API_KEY',
  'ANTHROPIC_MODEL',
  'ELEVENLABS_API_KEY',
  'ELEVENLABS_VOICE_ID',
  'ELEVENLABS_MODEL_ID',
  'ELEVENLABS_INTRO_MODEL_ID',
  'LULU_API_KEY'
].filter((name) => process.env[name]).map((name) => `${name}=${process.env[name]}`);

const functions = [
  'health',
  'create-organization',
  'complete-onboarding',
  'onboarding-state',
  'update-company-profile',
  'audit-event',
  'ingest-boe',
  'ingest-placsp',
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
  'observability-event',
  'run-alerts',
  'future-book-session'
];

try {
  writeFileSync(envFile, [
    `ALLOWED_ORIGINS=${pageOrigin},http://127.0.0.1:8765,http://localhost:8765`,
    'APP_ENV=production',
    `INGESTION_SECRET=${ingestionSecret}`,
    `FUTURE_BOOK_PRODUCT_CODE=${process.env.FUTURE_BOOK_PRODUCT_CODE || 'futuro_anterior'}`,
    `FUTURE_BOOK_PRICE_CENTS=${process.env.FUTURE_BOOK_PRICE_CENTS || '4995'}`,
    `FUTURE_BOOK_CURRENCY=${process.env.FUTURE_BOOK_CURRENCY || 'EUR'}`,
    `FUTURE_BOOK_DEFAULT_QUESTION_COUNT=${process.env.FUTURE_BOOK_DEFAULT_QUESTION_COUNT || '21'}`,
    ...optionalSecrets
  ].join('\n'));

  run('supabase', ['secrets', 'set', '--project-ref', projectRef, '--env-file', envFile], { stdio: 'inherit' });
  for (const fn of functions) {
    run('supabase', ['functions', 'deploy', fn, '--project-ref', projectRef, '--no-verify-jwt'], { stdio: 'inherit' });
  }

  run('gh', ['variable', 'set', 'SUPABASE_URL', '--repo', repo, '--body', supabaseUrl], { stdio: 'inherit' });
  run('gh', ['variable', 'set', 'SUPABASE_ANON_KEY', '--repo', repo, '--body', anonKey], { stdio: 'inherit' });
  run('gh', ['variable', 'set', 'FUNCTIONS_BASE_URL', '--repo', repo, '--body', functionsBaseUrl], { stdio: 'inherit' });
  run('gh', ['secret', 'set', 'INGESTION_SECRET', '--repo', repo], {
    input: ingestionSecret,
    stdio: ['pipe', 'inherit', 'inherit']
  });

  if (process.env.SUPABASE_ACCESS_TOKEN) {
    run(process.execPath, [
      'scripts/configure-supabase-auth.mjs',
      projectRef,
      pageOrigin,
      repo.split('/')[1] || 'licitia-v2-production'
    ], { stdio: 'inherit' });
  } else {
    console.warn('SUPABASE_ACCESS_TOKEN not set; skipping hosted Auth email template configuration.');
  }

  console.log(JSON.stringify({
    projectRef,
    supabaseUrl,
    functionsBaseUrl,
    repo,
    pageOrigin,
    ingestionSecretConfigured: true
  }, null, 2));
} finally {
  rmSync(dir, { recursive: true, force: true });
}
