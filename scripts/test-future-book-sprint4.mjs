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

const page = await file('src/futuro.html');
const js = await file('src/scripts/future-book.js');
const css = await file('src/styles/future-book.css');
const fn = await file('supabase/functions/future-book-session/index.ts');
const migration = await file('supabase/migrations/202604210003_future_book_sprint4_manuscript.sql');
const sprint = await file('docs/SPRINT_4_LIBRO_FUTURO_IMPLEMENTATION.md');
const pkg = await file('package.json');

includes(page, [
  'generateBookButton',
  'bookStage',
  'bookTitle',
  'bookSections',
  'manuscript_ready'
], 'Future book Sprint 4 page');

includes(js, [
  'future_book_sprint4_manuscript',
  'generateLocalManuscript',
  'generateBook',
  'showBook',
  'getBookStatus',
  'stage 05/05'
], 'Future book Sprint 4 frontend');

includes(css, [
  '.book-stage',
  '.book-sections',
  '.book-quality'
], 'Future book Sprint 4 CSS');

includes(fn, [
  'callOpenAiJson',
  'manuscriptSchema',
  'future_book_manuscripts',
  'buildDeterministicManuscript',
  'reviewWithAnthropic',
  'generateBook',
  'getBookStatus',
  'book_generation_completed'
], 'Future book Sprint 4 backend');

includes(migration, [
  'create table if not exists public.future_book_manuscripts',
  'quality_report jsonb',
  'provider_chain jsonb',
  'quality_score numeric',
  'enable row level security'
], 'Future book Sprint 4 migration');

includes(sprint, [
  'PB-D01',
  'PB-D02',
  'PB-D03',
  'PB-D04',
  'future_book_manuscripts',
  'generar_libro'
], 'Future book Sprint 4 doc');

includes(pkg, [
  'test-future-book-sprint4.mjs'
], 'Package test script');

console.log('Future book Sprint 4 checks OK');
