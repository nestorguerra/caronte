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

const backlog = await file('docs/PRODUCT_BACKLOG_LIBRO_FUTURO_MVP.md');
const sprint = await file('docs/SPRINT_0_LIBRO_FUTURO_IMPLEMENTATION.md');
const migration = await file('supabase/migrations/202604210001_future_book_sprint0.sql');
const fn = await file('supabase/functions/future-book-session/index.ts');
const config = await file('supabase/config.toml');
const env = await file('.env.example');
const pkg = await file('package.json');

includes(backlog, [
  'Sprint 0 - Producto, tono y base de produccion',
  'PB-A01 - Definir nombre operativo y tono del producto',
  'PB-B01 - Modelo de sesion',
  'PB-H01 - Entornos local, staging y produccion'
], 'Future book backlog');

includes(sprint, [
  'Futuro Anterior',
  'Futuros plausibles, no predicciones',
  'future_book_sessions',
  'future-book-session',
  'FUTURE_BOOK_PRICE_CENTS=4995'
], 'Sprint 0 implementation doc');

includes(migration, [
  'create table if not exists public.future_book_sessions',
  'create table if not exists public.future_book_events',
  "payment_simulated_approved",
  "pending_review",
  "released_to_customer",
  'alter table public.future_book_sessions enable row level security',
  'touch_future_book_sessions_updated_at'
], 'Sprint 0 migration');

includes(fn, [
  'future_book_sessions',
  'future_book_events',
  'createSession',
  'getSession',
  'session_created',
  'publicToken',
  'Futuro Anterior'
], 'Sprint 0 edge function');

includes(config, [
  '[functions.future-book-session]',
  'verify_jwt = false'
], 'Supabase config');

includes(env, [
  'FUTURE_BOOK_PRODUCT_CODE=futuro_anterior',
  'FUTURE_BOOK_PRICE_CENTS=4995',
  'FUTURE_BOOK_CURRENCY=EUR',
  'FUTURE_BOOK_DEFAULT_QUESTION_COUNT=21'
], 'Environment example');

includes(pkg, [
  'test-future-book-sprint0.mjs'
], 'Package test script');

console.log('Future book Sprint 0 checks OK');
