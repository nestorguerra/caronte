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
const migration = await file('supabase/migrations/202604220005_future_book_sprint10_pdf_storage.sql');
const bookJs = await file('src/scripts/future-book.js');
const adminJs = await file('src/scripts/future-admin.js');
const sprint = await file('docs/SPRINT_10_LIBRO_FUTURO_IMPLEMENTATION.md');
const readme = await file('README.md');
const pkg = await file('package.json');

includes(fn, [
  'future-book-a5-editorial-v1',
  'pdfPageMargins',
  'addSectionOpener',
  'addReadingNotes',
  'futureBookPdfBucket',
  'future-book-pdfs',
  'uploadPrivatePdfArtifact',
  'signedPrivatePdfUrl',
  'loadPrivatePdfBase64',
  'validateEditorialPdf',
  'print_validation',
  'private_storage_primary',
  'storage_path',
  'ready_for_print',
  'publicPdfWithBinary'
], 'Future book Sprint 10 backend');

includes(migration, [
  'alter column pdf_base64 drop not null',
  'print_validation jsonb',
  'future-book-pdfs',
  'public = false',
  'application/pdf'
], 'Future book Sprint 10 migration');

includes(bookJs, [
  'signedUrl',
  'storage=',
  'downloadBase64Pdf'
], 'Future book Sprint 10 client download');

includes(adminJs, [
  'signedUrl',
  'storage privado',
  'pdfPreview'
], 'Future book Sprint 10 admin preview');

includes(sprint, [
  'PB-D01',
  'PB-D05',
  'PB-D06',
  'PB-D09',
  'future-book-pdfs',
  'future-book-a5-editorial-v1',
  'ready_for_print=true'
], 'Future book Sprint 10 doc');

includes(readme, [
  'Modulo Futuro Anterior Sprint 10',
  'future-book-pdfs',
  'pdf_base64',
  'ready_for_print'
], 'Future book Sprint 10 README');

includes(pkg, [
  'test-future-book-sprint10.mjs'
], 'Package test script');

console.log('Future book Sprint 10 checks OK');
