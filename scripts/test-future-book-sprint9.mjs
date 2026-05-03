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
const migration = await file('supabase/migrations/202604220004_future_book_sprint9_caronte_maps.sql');
const adminHtml = await file('src/futuro-admin.html');
const adminJs = await file('src/scripts/future-admin.js');
const sprint = await file('docs/SPRINT_9_LIBRO_FUTURO_IMPLEMENTATION.md');
const readme = await file('README.md');
const env = await file('.env.example');
const pkg = await file('package.json');

includes(fn, [
  'CARONTE_PROMPT_VERSION',
  'caronte-literary-v1',
  'psychMapSchema',
  'buildPsychologicalMap',
  'buildNarrativeOutline',
  'evaluateCaronteManuscript',
  'prohibitedPromiseViolations',
  'caronte_rewrite_requested',
  'future_book_psych_maps',
  'psych_map_id',
  'needs_caronte_rewrite',
  'blocked_safety',
  'ready_for_print',
  'reviewWithAnthropic(ai.manuscript, psychological.map, caronteEvaluation)'
], 'Future book Sprint 9 backend');

includes(migration, [
  'create table if not exists public.future_book_psych_maps',
  'map_payload jsonb',
  'outline_payload jsonb',
  'provider_chain jsonb',
  'add column if not exists psych_map_id',
  'alter table public.future_book_psych_maps enable row level security'
], 'Future book Sprint 9 migration');

includes(adminHtml, [
  'Caronte',
  'caronteBody',
  'Mapas psicologicos'
], 'Future book Sprint 9 admin HTML');

includes(adminJs, [
  'caronteBody',
  'renderCaronteMaps',
  'psychMaps',
  'caronteMaps'
], 'Future book Sprint 9 admin JS');

includes(sprint, [
  'PB-C01',
  'PB-C02',
  'PB-C03',
  'PB-C07',
  'PB-C08',
  'PB-C09',
  'PB-C10',
  'future_book_psych_maps',
  'caronte-rewrite-v1'
], 'Future book Sprint 9 doc');

includes(readme, [
  'Modulo Futuro Anterior Sprint 9',
  'future_book_psych_maps',
  'caronte-literary-v1',
  'FUTURE_BOOK_MAP_MODEL'
], 'Future book Sprint 9 README');

includes(env, [
  'FUTURE_BOOK_MAP_MODEL=gpt-5.4-pro'
], 'Future book Sprint 9 env');

includes(pkg, [
  'test-future-book-sprint9.mjs'
], 'Package test script');

console.log('Future book Sprint 9 checks OK');
