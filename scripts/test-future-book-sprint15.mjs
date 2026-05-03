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
const migration = await file('supabase/migrations/202604220009_future_book_sprint15_ephemeral_access.sql');
const bookHtml = await file('src/futuro.html');
const bookJs = await file('src/scripts/future-book.js');
const adminHtml = await file('src/futuro-admin.html');
const adminJs = await file('src/scripts/future-admin.js');
const headers = await file('src/_headers');
const env = await file('.env.example');
const sprint = await file('docs/SPRINT_15_LIBRO_FUTURO_IMPLEMENTATION.md');
const readme = await file('README.md');
const pkg = await file('package.json');

includes(fn, [
  'future_book_access_campaigns',
  'future_book_access_invites',
  'future_book_waitlist_entries',
  'accessStatus',
  'joinWaitlist',
  'requestViralInvite',
  'evaluateAccessGate',
  'consumeAccessInvite',
  'adminCreateAccessCampaign',
  'adminUpdateAccessPolicy',
  'adminCreateAccessInvites',
  'adminRevokeAccessInvite',
  'FUTURE_BOOK_ACCESS_MODE',
  'FUTURE_BOOK_REQUIRE_INVITE'
], 'Future book Sprint 15 backend');

includes(migration, [
  'create table if not exists public.future_book_access_campaigns',
  'create table if not exists public.future_book_access_invites',
  'create table if not exists public.future_book_waitlist_entries',
  'token_hash text not null unique',
  'access_campaign_id',
  'access_invite_id',
  'enable row level security'
], 'Future book Sprint 15 migration');

includes(bookHtml + headers, [
  'noindex',
  'nofollow',
  'X-Robots-Tag'
], 'Future book Sprint 15 noindex');

includes(bookJs, [
  'ACCESS_TOKEN_KEY',
  'accessTokenFromUrl',
  'syncAccessToken',
  'accessStatus',
  'inviteToken',
  'showAccessDenied',
  'registerOpaqueWaitlist',
  'ephemeral_url'
], 'Future book Sprint 15 frontend');

includes(adminHtml, [
  'viralAccessGrid',
  'accessPolicyForm',
  'accessCampaignForm',
  'accessInviteForm',
  'viralInviteOutput',
  'accessCampaignBody',
  'accessInviteBody'
], 'Future book Sprint 15 admin HTML');

includes(adminJs, [
  'renderViralAccess',
  'renderAccessCampaigns',
  'renderAccessInvites',
  'adminCreateAccessCampaign',
  'adminUpdateAccessPolicy',
  'adminCreateAccessInvites',
  'adminRevokeAccessInvite'
], 'Future book Sprint 15 admin JS');

includes(env, [
  'FUTURE_BOOK_ACCESS_MODE',
  'FUTURE_BOOK_REQUIRE_INVITE'
], 'Future book Sprint 15 env');

includes(sprint, [
  'PB-I01',
  'PB-I02',
  'PB-I03',
  'PB-I04',
  'PB-I05',
  'PB-I06',
  'PB-I07',
  'PB-I08',
  'future_book_access_invites'
], 'Future book Sprint 15 doc');

includes(readme, [
  'Modulo Futuro Anterior Sprint 15',
  'future_book_access_campaigns',
  'FUTURE_BOOK_ACCESS_MODE',
  'FUTURE_BOOK_REQUIRE_INVITE'
], 'Future book Sprint 15 README');

includes(pkg, [
  'test-future-book-sprint15.mjs'
], 'Package test script');

console.log('Future book Sprint 15 checks OK');
