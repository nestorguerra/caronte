alter table public.organizations
  add column if not exists status text not null default 'active' check (status in ('active', 'blocked', 'disabled')),
  add column if not exists blocked_at timestamptz,
  add column if not exists blocked_reason text;

create table if not exists public.backup_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  requested_by uuid references auth.users(id) on delete set null,
  backup_type text not null default 'organization_export' check (backup_type in ('automatic', 'organization_export', 'restore_test')),
  status text not null default 'succeeded' check (status in ('queued', 'running', 'succeeded', 'failed')),
  retention_until timestamptz,
  storage_path text,
  manifest jsonb not null default '{}'::jsonb,
  error_message text,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.error_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  severity text not null default 'error' check (severity in ('info', 'warning', 'error', 'critical')),
  source text not null default 'frontend' check (source in ('frontend', 'edge_function', 'job', 'database')),
  message text not null,
  stack text,
  url text,
  user_agent text,
  fingerprint text,
  context jsonb not null default '{}'::jsonb,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.internal_alerts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  alert_type text not null,
  severity text not null default 'warning' check (severity in ('info', 'warning', 'critical')),
  title text not null,
  detail text,
  status text not null default 'open' check (status in ('open', 'acknowledged', 'resolved')),
  source_ref jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  acknowledged_at timestamptz,
  resolved_at timestamptz
);

create table if not exists public.release_checks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  check_type text not null check (check_type in ('security', 'e2e_beta', 'frontend', 'backend_rls', 'accessibility', 'restore_test')),
  status text not null default 'pending' check (status in ('pending', 'passed', 'failed', 'warning')),
  title text not null,
  details jsonb not null default '{}'::jsonb,
  evidence_url text,
  checked_by uuid references auth.users(id) on delete set null,
  checked_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.backup_runs enable row level security;
alter table public.error_events enable row level security;
alter table public.internal_alerts enable row level security;
alter table public.release_checks enable row level security;

drop policy if exists backup_runs_select_admin on public.backup_runs;
create policy backup_runs_select_admin on public.backup_runs
for select to authenticated
using (organization_id is null or public.has_org_role(organization_id, array['owner', 'admin']));

drop policy if exists backup_runs_write_admin on public.backup_runs;
create policy backup_runs_write_admin on public.backup_runs
for all to authenticated
using (organization_id is not null and public.has_org_role(organization_id, array['owner', 'admin']))
with check (organization_id is not null and public.has_org_role(organization_id, array['owner', 'admin']));

drop policy if exists error_events_select_admin on public.error_events;
create policy error_events_select_admin on public.error_events
for select to authenticated
using (organization_id is null or public.has_org_role(organization_id, array['owner', 'admin']));

drop policy if exists error_events_insert_member on public.error_events;
create policy error_events_insert_member on public.error_events
for insert to authenticated
with check (organization_id is null or public.is_org_member(organization_id));

drop policy if exists internal_alerts_select_admin on public.internal_alerts;
create policy internal_alerts_select_admin on public.internal_alerts
for select to authenticated
using (organization_id is null or public.has_org_role(organization_id, array['owner', 'admin']));

drop policy if exists internal_alerts_write_admin on public.internal_alerts;
create policy internal_alerts_write_admin on public.internal_alerts
for all to authenticated
using (organization_id is not null and public.has_org_role(organization_id, array['owner', 'admin']))
with check (organization_id is not null and public.has_org_role(organization_id, array['owner', 'admin']));

drop policy if exists release_checks_select_admin on public.release_checks;
create policy release_checks_select_admin on public.release_checks
for select to authenticated
using (organization_id is null or public.has_org_role(organization_id, array['owner', 'admin']));

drop policy if exists release_checks_write_admin on public.release_checks;
create policy release_checks_write_admin on public.release_checks
for all to authenticated
using (organization_id is not null and public.has_org_role(organization_id, array['owner', 'admin']))
with check (organization_id is not null and public.has_org_role(organization_id, array['owner', 'admin']));

create index if not exists idx_organizations_status on public.organizations(status, created_at desc);
create index if not exists idx_backup_runs_org_created on public.backup_runs(organization_id, created_at desc);
create index if not exists idx_backup_runs_status on public.backup_runs(status, created_at desc);
create index if not exists idx_error_events_org_created on public.error_events(organization_id, created_at desc);
create index if not exists idx_error_events_fingerprint on public.error_events(fingerprint, created_at desc);
create index if not exists idx_internal_alerts_org_status on public.internal_alerts(organization_id, status, created_at desc);
create index if not exists idx_release_checks_org_type on public.release_checks(organization_id, check_type, checked_at desc);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'licitia-backups',
  'licitia-backups',
  false,
  104857600,
  array['application/json', 'application/zip', 'text/plain']
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;
