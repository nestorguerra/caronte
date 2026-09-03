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

const page = await file('src/tiresias.html');
const adminPage = await file('src/futuro-admin.html');
const clientJs = await file('src/scripts/future-book.js');
const adminJs = await file('src/scripts/future-admin.js');
const adminCss = await file('src/styles/future-admin.css');
const fn = await file('supabase/functions/future-book-session/index.ts');
const migration = await file('supabase/migrations/202604220001_future_book_sprint5_pdf_admin.sql');
const sprint = await file('docs/SPRINT_5_LIBRO_FUTURO_IMPLEMENTATION.md');
const pkg = await file('package.json');

includes(page, [
  'generatePdfButton',
  'downloadPdfButton',
  'pdfStatus',
  'futuro-admin.html'
], 'Future book Sprint 5 page');

includes(adminPage, [
  'adminTokenForm',
  'metricsGrid',
  'providerGrid',
  'pdf_review_queue',
  'pdfPreview'
], 'Future book Sprint 5 admin page');

includes(clientJs, [
  'future_book_sprint5_pdf',
  'makeLocalPdf',
  'generatePdf',
  'downloadReleasedPdf',
  "DEMO_MODE ? 'released_to_customer'",
  'pdf_status='
], 'Future book Sprint 5 frontend');

includes(adminJs, [
  'adminDashboard',
  'adminSaveProviderKey',
  'adminApprovePdf',
  'adminRegeneratePdf',
  'adminReleasePdf',
  'localAdminAction',
  'providerDefaults'
], 'Future book Sprint 5 admin JS');

includes(adminCss, [
  '.metrics-grid',
  '.provider-card',
  '.preview-panel'
], 'Future book Sprint 5 admin CSS');

includes(fn, [
  'buildPdfDocument',
  'future_book_pdfs',
  'generatePdf',
  'downloadReleasedPdf',
  'requireFutureBookAdmin',
  'adminDashboard',
  'adminApprovePdf',
  'adminRegeneratePdf',
  'adminSaveProviderKey',
  'ready_for_print'
], 'Future book Sprint 5 backend');

includes(migration, [
  'create table if not exists public.future_book_pdfs',
  'review_status',
  'pdf_base64 text not null',
  'future_book_provider_settings',
  'secret_ciphertext',
  'enable row level security'
], 'Future book Sprint 5 migration');

includes(sprint, [
  'PB-E01',
  'PB-E02',
  'PB-E03',
  'PB-F01',
  'PB-F06',
  'pending_review',
  'ready_for_print'
], 'Future book Sprint 5 doc');

includes(pkg, [
  'test-future-book-sprint5.mjs'
], 'Package test script');

console.log('Future book Sprint 5 checks OK');
