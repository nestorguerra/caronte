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
const migration = await file('supabase/migrations/202604220006_future_book_sprint12_backoffice_ops.sql');
const adminHtml = await file('src/futuro-admin.html');
const adminJs = await file('src/scripts/future-admin.js');
const adminCss = await file('src/styles/future-admin.css');
const sprint = await file('docs/SPRINT_12_LIBRO_FUTURO_IMPLEMENTATION.md');
const readme = await file('README.md');
const pkg = await file('package.json');

includes(fn, [
  'futureBookAdminPermissions',
  'futureBookAdminFromAuth',
  'requireFutureBookAdmin(req',
  'future_book_admin_audit_events',
  'adminSessionDetail',
  'adminPatchSessionStatus',
  'futureBookCostSnapshot',
  'publicAdminContext',
  'adminSaveProviderKey(req'
], 'Future book Sprint 12 backend');

includes(migration, [
  'future_book_admin_users',
  'future_book_admin_audit_events',
  "role in ('owner', 'ops', 'editor', 'support', 'viewer')",
  'enable row level security'
], 'Future book Sprint 12 migration');

includes(adminHtml, [
  'adminEmailInput',
  'adminIdentity',
  'costGrid',
  'sessionDetailForm',
  'sessionRepairForm',
  'manuscriptBody',
  'adminAuditBody'
], 'Future book Sprint 12 admin HTML');

includes(adminJs, [
  'signIn',
  'signOut',
  'adminSessionDetail',
  'adminPatchSessionStatus',
  'renderSessionDetail',
  'renderAudit',
  'renderCosts',
  'data-session-detail'
], 'Future book Sprint 12 admin JS');

includes(adminCss, [
  'auth-grid',
  'session-repair-form',
  'session-detail',
  'detail-grid',
  'timeline-item'
], 'Future book Sprint 12 admin CSS');

includes(sprint, [
  'PB-F01',
  'PB-F04',
  'PB-F08',
  'PB-F09',
  'future_book_admin_users',
  'adminPatchSessionStatus'
], 'Future book Sprint 12 doc');

includes(readme, [
  'Modulo Futuro Anterior Sprint 12',
  'future_book_admin_users',
  'adminSessionDetail',
  'adminPatchSessionStatus'
], 'Future book Sprint 12 README');

includes(pkg, [
  'test-future-book-sprint12.mjs'
], 'Package test script');

console.log('Future book Sprint 12 checks OK');
