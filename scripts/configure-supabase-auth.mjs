import { readFile } from 'node:fs/promises';
import path from 'node:path';

const projectRef = process.argv[2];
const pageOrigin = process.argv[3] || 'https://nestorguerra.github.io';
const repoPath = process.argv[4] || 'licitia-v2-production';
const token = process.env.SUPABASE_ACCESS_TOKEN;

if (!projectRef) {
  throw new Error('Usage: SUPABASE_ACCESS_TOKEN=... node scripts/configure-supabase-auth.mjs <project-ref> [page-origin] [repo-path]');
}

if (!token) {
  throw new Error('SUPABASE_ACCESS_TOKEN is required to update hosted Supabase Auth email templates.');
}

const root = process.cwd();
const appBaseUrl = `${pageOrigin.replace(/\/$/, '')}/${repoPath.replace(/^\/|\/$/g, '')}/`;
const accessUrl = `${appBaseUrl}acceso.html`;
const templatesDir = path.join(root, 'supabase', 'templates');
const confirmation = await readFile(path.join(templatesDir, 'confirmation.html'), 'utf8');
const recovery = await readFile(path.join(templatesDir, 'recovery.html'), 'utf8');

const body = {
  site_url: accessUrl,
  uri_allow_list: [
    appBaseUrl,
    accessUrl,
    `${appBaseUrl}**`,
    'http://localhost:8765/**',
    'http://127.0.0.1:8765/**'
  ].join(','),
  mailer_subjects_confirmation: 'Activa tu cuenta en LicitIA',
  mailer_templates_confirmation_content: confirmation,
  mailer_subjects_recovery: 'Recupera tu acceso a LicitIA',
  mailer_templates_recovery_content: recovery,
  mailer_subjects_magic_link: 'Tu enlace de acceso a LicitIA',
  mailer_templates_magic_link_content: confirmation,
  mailer_subjects_invite: 'Te han invitado a LicitIA',
  mailer_templates_invite_content: confirmation,
  smtp_sender_name: 'LicitIA'
};

const resp = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/config/auth`, {
  method: 'PATCH',
  headers: {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(body)
});

const text = await resp.text();
if (!resp.ok) {
  throw new Error(`Supabase Auth config failed with HTTP ${resp.status}: ${text}`);
}

console.log(JSON.stringify({
  ok: true,
  projectRef,
  siteUrl: accessUrl,
  templates: ['confirmation', 'recovery', 'magic_link', 'invite']
}, null, 2));
