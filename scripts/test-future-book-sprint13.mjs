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
const migration = await file('supabase/migrations/202604220007_future_book_sprint13_security_privacy.sql');
const bookJs = await file('src/scripts/future-book.js');
const adminJs = await file('src/scripts/future-admin.js');
const adminHtml = await file('src/futuro-admin.html');
const futuroHtml = await file('src/tiresias.html');
const privacy = await file('src/legal/futuro-privacy.html');
const terms = await file('src/legal/futuro-terms.html');
const headers = await file('src/_headers');
const vercel = await file('vercel.json');
const sprint = await file('docs/SPRINT_13_LIBRO_FUTURO_IMPLEMENTATION.md');
const readme = await file('README.md');
const pkg = await file('package.json');

includes(fn, [
  'future_book_abuse_events',
  'enforceAbuseLimit',
  'validAbuseProof',
  'privacyHash',
  'exportPrivacyData',
  'requestPrivacyErasure',
  'adminRunRetention',
  'adminPrivacyExport',
  'adminPrivacyErase',
  'runRetentionSweep'
], 'Future book Sprint 13 backend');

includes(migration, [
  'ip_hash',
  'fingerprint_hash',
  'future_book_abuse_events',
  'future_book_retention_policies',
  'future_book_privacy_requests',
  "'audio', 7",
  "'answers', 30",
  'enable row level security'
], 'Future book Sprint 13 migration');

includes(bookJs, [
  'clientFingerprint',
  'abuseProof',
  'clientRuntimeMs',
  'caronte-proof'
], 'Future book Sprint 13 client proof');

includes(adminHtml, [
  'securityGrid',
  'retentionDryRunButton',
  'retentionRunButton',
  'privacyOpsForm',
  'securityReport'
], 'Future book Sprint 13 admin HTML');

includes(adminJs, [
  'renderSecurity',
  'adminRunRetention',
  'adminPrivacyExport',
  'adminPrivacyErase',
  'showSecurityReport'
], 'Future book Sprint 13 admin JS');

includes(futuroHtml + privacy + terms, [
  'Content-Security-Policy',
  'no-referrer'
], 'Future book Sprint 13 meta security');

includes(headers + vercel, [
  'frame-ancestors',
  'Permissions-Policy',
  'Referrer-Policy',
  'X-Frame-Options',
  'Content-Security-Policy'
], 'Future book Sprint 13 headers');

includes(privacy, [
  'Subencargados tecnicos',
  'audio hasta 7 dias',
  'senales anti-abuso en formato hash'
], 'Future book Sprint 13 privacy');

includes(terms, [
  'anti-abuso',
  'volumen anomalo',
  'hash'
], 'Future book Sprint 13 terms');

includes(sprint, [
  'PB-G01',
  'PB-G05',
  'PB-G09',
  'future_book_abuse_events',
  'GitHub Pages no permite cabeceras HTTP custom'
], 'Future book Sprint 13 doc');

includes(readme, [
  'Modulo Futuro Anterior Sprint 13',
  'future_book_abuse_events',
  'FUTURE_BOOK_PRIVACY_SALT',
  'GitHub Pages no permite'
], 'Future book Sprint 13 README');

includes(pkg, [
  'test-future-book-sprint13.mjs'
], 'Package test script');

console.log('Future book Sprint 13 checks OK');
