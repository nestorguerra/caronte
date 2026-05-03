create extension if not exists pgcrypto;

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  tax_id text,
  country text not null default 'ES',
  sector text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  invited_email text,
  role text not null default 'viewer' check (role in ('owner', 'admin', 'bid_manager', 'legal', 'finance', 'viewer')),
  status text not null default 'active' check (status in ('invited', 'active', 'disabled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, user_id),
  unique (organization_id, invited_email)
);

create table if not exists public.plans (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  price_cents integer not null default 0,
  currency text not null default 'EUR',
  trial_days integer not null default 30,
  payments_enabled boolean not null default false,
  features jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  plan_id uuid not null references public.plans(id),
  status text not null default 'trialing_free' check (status in ('trialing_free', 'active_free', 'expired', 'payment_required_future')),
  started_at timestamptz not null default now(),
  current_period_ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.company_profiles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  legal_name text,
  trade_name text,
  tax_id text,
  services_description text,
  target_cpvs text[] not null default '{}',
  certifications text[] not null default '{}',
  business_classification text,
  annual_revenue_range text,
  employee_range text,
  years_experience integer,
  operating_regions text[] not null default '{}',
  preferences jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id)
);

create table if not exists public.procurement_sources (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  base_url text,
  source_type text not null default 'official',
  enabled boolean not null default true,
  last_ingested_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tenders (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  source_id uuid references public.procurement_sources(id),
  external_id text not null,
  canonical_key text,
  title text not null,
  contracting_body text,
  status text,
  contract_type text,
  procedure_type text,
  cpv_codes text[] not null default '{}',
  country text not null default 'ES',
  region text,
  publication_date date,
  submission_deadline timestamptz,
  estimated_value_cents bigint,
  base_budget_cents bigint,
  currency text not null default 'EUR',
  official_url text,
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source_id, external_id)
);

create table if not exists public.tender_lots (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  tender_id uuid not null references public.tenders(id) on delete cascade,
  external_id text,
  title text not null,
  cpv_codes text[] not null default '{}',
  estimated_value_cents bigint,
  base_budget_cents bigint,
  status text,
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tender_documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  tender_id uuid not null references public.tenders(id) on delete cascade,
  tender_lot_id uuid references public.tender_lots(id) on delete cascade,
  source_id uuid references public.procurement_sources(id),
  document_type text,
  title text not null,
  official_url text,
  storage_path text,
  content_hash text,
  mime_type text,
  published_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.tender_versions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  tender_id uuid not null references public.tenders(id) on delete cascade,
  version_label text not null,
  change_type text,
  source_payload jsonb not null default '{}'::jsonb,
  diff_summary jsonb not null default '{}'::jsonb,
  ingested_at timestamptz not null default now()
);

create table if not exists public.saved_searches (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  name text not null,
  query text,
  filters jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tracked_tenders (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  tender_id uuid not null references public.tenders(id) on delete cascade,
  owner_user_id uuid references auth.users(id) on delete set null,
  internal_status text not null default 'new' check (internal_status in ('new', 'analysis', 'go', 'no_go', 'preparing', 'submitted', 'discarded', 'awarded', 'lost')),
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, tender_id)
);

create table if not exists public.alert_rules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  name text not null,
  query text,
  filters jsonb not null default '{}'::jsonb,
  cadence text not null default 'daily' check (cadence in ('daily', 'weekly')),
  channels jsonb not null default '{"email": true}'::jsonb,
  active boolean not null default true,
  last_run_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.alert_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  alert_rule_id uuid references public.alert_rules(id) on delete set null,
  tender_id uuid references public.tenders(id) on delete cascade,
  event_type text not null default 'match',
  dedupe_key text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (organization_id, dedupe_key)
);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  tracked_tender_id uuid references public.tracked_tenders(id) on delete cascade,
  assigned_to uuid references auth.users(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  title text not null,
  description text,
  status text not null default 'open' check (status in ('open', 'in_progress', 'done', 'cancelled')),
  due_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.milestones (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  tracked_tender_id uuid references public.tracked_tenders(id) on delete cascade,
  title text not null,
  milestone_type text not null default 'internal',
  due_at timestamptz not null,
  source text not null default 'manual',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.document_checklists (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  tracked_tender_id uuid references public.tracked_tenders(id) on delete cascade,
  title text not null,
  items jsonb not null default '[]'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.proposal_projects (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  tracked_tender_id uuid references public.tracked_tenders(id) on delete cascade,
  title text not null,
  status text not null default 'draft' check (status in ('draft', 'review', 'approved', 'archived')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.proposal_versions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  proposal_project_id uuid not null references public.proposal_projects(id) on delete cascade,
  version_number integer not null,
  content_markdown text not null,
  ai_run_id uuid,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (proposal_project_id, version_number)
);

create table if not exists public.ai_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  use_case text not null,
  model text,
  prompt_version text,
  input_refs jsonb not null default '{}'::jsonb,
  output jsonb not null default '{}'::jsonb,
  citations jsonb not null default '[]'::jsonb,
  token_usage jsonb not null default '{}'::jsonb,
  status text not null default 'succeeded' check (status in ('succeeded', 'failed')),
  created_at timestamptz not null default now()
);

create table if not exists public.audit_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  resource_type text,
  resource_id uuid,
  ip_address inet,
  user_agent text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  alert_event_id uuid references public.alert_events(id) on delete set null,
  user_id uuid references auth.users(id) on delete set null,
  channel text not null default 'email',
  destination text,
  status text not null default 'queued' check (status in ('queued', 'sent', 'failed', 'skipped')),
  provider_message_id text,
  error_message text,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_organization_members_user on public.organization_members(user_id);
create index if not exists idx_tenders_search on public.tenders using gin (to_tsvector('spanish', coalesce(title, '') || ' ' || coalesce(contracting_body, '')));
create index if not exists idx_tenders_cpv on public.tenders using gin (cpv_codes);
create index if not exists idx_tenders_deadline on public.tenders(submission_deadline);
create index if not exists idx_tracked_tenders_org_status on public.tracked_tenders(organization_id, internal_status);
create index if not exists idx_audit_events_org_created on public.audit_events(organization_id, created_at desc);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.is_org_member(target_org_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.organization_members om
    where om.organization_id = target_org_id
      and om.user_id = auth.uid()
      and om.status = 'active'
  );
$$;

create or replace function public.has_org_role(target_org_id uuid, allowed_roles text[])
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.organization_members om
    where om.organization_id = target_org_id
      and om.user_id = auth.uid()
      and om.status = 'active'
      and om.role = any(allowed_roles)
  );
$$;

insert into public.plans (code, name, price_cents, currency, trial_days, payments_enabled, features)
values (
  'free_beta_month',
  'Beta gratuita - primer mes',
  0,
  'EUR',
  30,
  false,
  '{"payments_required": false, "message": "Durante el primer mes LicitIA es gratuita. No tienes que introducir tarjeta ni metodo de pago. Te avisaremos antes de activar cualquier plan de pago."}'::jsonb
)
on conflict (code) do update
set name = excluded.name,
    price_cents = excluded.price_cents,
    trial_days = excluded.trial_days,
    payments_enabled = excluded.payments_enabled,
    features = excluded.features;

insert into public.procurement_sources (code, name, base_url, source_type)
values
  ('boe_opendata', 'BOE OpenData', 'https://www.boe.es/datosabiertos/api/', 'official'),
  ('placsp_open_data', 'PLACSP Datos Abiertos', 'https://contrataciondelestado.es/', 'official')
on conflict (code) do nothing;

alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.plans enable row level security;
alter table public.subscriptions enable row level security;
alter table public.company_profiles enable row level security;
alter table public.procurement_sources enable row level security;
alter table public.tenders enable row level security;
alter table public.tender_lots enable row level security;
alter table public.tender_documents enable row level security;
alter table public.tender_versions enable row level security;
alter table public.saved_searches enable row level security;
alter table public.tracked_tenders enable row level security;
alter table public.alert_rules enable row level security;
alter table public.alert_events enable row level security;
alter table public.tasks enable row level security;
alter table public.milestones enable row level security;
alter table public.document_checklists enable row level security;
alter table public.proposal_projects enable row level security;
alter table public.proposal_versions enable row level security;
alter table public.ai_runs enable row level security;
alter table public.audit_events enable row level security;
alter table public.notification_deliveries enable row level security;

drop policy if exists organizations_select_member on public.organizations;
create policy organizations_select_member on public.organizations
for select to authenticated
using (public.is_org_member(id));

drop policy if exists organizations_insert_owner on public.organizations;
create policy organizations_insert_owner on public.organizations
for insert to authenticated
with check (created_by = auth.uid());

drop policy if exists organizations_update_admin on public.organizations;
create policy organizations_update_admin on public.organizations
for update to authenticated
using (public.has_org_role(id, array['owner', 'admin']))
with check (public.has_org_role(id, array['owner', 'admin']));

drop policy if exists organization_members_select_member on public.organization_members;
create policy organization_members_select_member on public.organization_members
for select to authenticated
using (public.is_org_member(organization_id));

drop policy if exists organization_members_update_admin on public.organization_members;
create policy organization_members_update_admin on public.organization_members
for update to authenticated
using (public.has_org_role(organization_id, array['owner', 'admin']))
with check (public.has_org_role(organization_id, array['owner', 'admin']));

drop policy if exists plans_select_authenticated on public.plans;
create policy plans_select_authenticated on public.plans
for select to authenticated
using (true);

drop policy if exists procurement_sources_select_authenticated on public.procurement_sources;
create policy procurement_sources_select_authenticated on public.procurement_sources
for select to authenticated
using (true);

drop policy if exists tenant_select_member on public.tenders;
create policy tenant_select_member on public.tenders
for select to authenticated
using (organization_id is null or public.is_org_member(organization_id));

drop policy if exists tenant_insert_member on public.tenders;
create policy tenant_insert_member on public.tenders
for insert to authenticated
with check (organization_id is not null and public.is_org_member(organization_id));

drop policy if exists tenant_update_member on public.tenders;
create policy tenant_update_member on public.tenders
for update to authenticated
using (organization_id is not null and public.has_org_role(organization_id, array['owner', 'admin', 'bid_manager']))
with check (organization_id is not null and public.has_org_role(organization_id, array['owner', 'admin', 'bid_manager']));

drop policy if exists tenant_select_member on public.tender_lots;
create policy tenant_select_member on public.tender_lots
for select to authenticated
using (organization_id is null or public.is_org_member(organization_id));

drop policy if exists tenant_select_member on public.tender_documents;
create policy tenant_select_member on public.tender_documents
for select to authenticated
using (organization_id is null or public.is_org_member(organization_id));

drop policy if exists tenant_select_member on public.tender_versions;
create policy tenant_select_member on public.tender_versions
for select to authenticated
using (organization_id is null or public.is_org_member(organization_id));

drop policy if exists tenant_select_member on public.subscriptions;
create policy tenant_select_member on public.subscriptions
for select to authenticated
using (public.is_org_member(organization_id));

drop policy if exists tenant_select_member on public.company_profiles;
create policy tenant_select_member on public.company_profiles
for select to authenticated
using (public.is_org_member(organization_id));

drop policy if exists tenant_write_admin on public.company_profiles;
create policy tenant_write_admin on public.company_profiles
for all to authenticated
using (public.has_org_role(organization_id, array['owner', 'admin', 'bid_manager']))
with check (public.has_org_role(organization_id, array['owner', 'admin', 'bid_manager']));

drop policy if exists tenant_select_member on public.saved_searches;
create policy tenant_select_member on public.saved_searches
for select to authenticated
using (public.is_org_member(organization_id));

drop policy if exists tenant_write_member on public.saved_searches;
create policy tenant_write_member on public.saved_searches
for all to authenticated
using (public.is_org_member(organization_id))
with check (public.is_org_member(organization_id));

drop policy if exists tenant_select_member on public.tracked_tenders;
create policy tenant_select_member on public.tracked_tenders
for select to authenticated
using (public.is_org_member(organization_id));

drop policy if exists tenant_write_member on public.tracked_tenders;
create policy tenant_write_member on public.tracked_tenders
for all to authenticated
using (public.is_org_member(organization_id))
with check (public.is_org_member(organization_id));

drop policy if exists tenant_select_member on public.alert_rules;
create policy tenant_select_member on public.alert_rules
for select to authenticated
using (public.is_org_member(organization_id));

drop policy if exists tenant_write_member on public.alert_rules;
create policy tenant_write_member on public.alert_rules
for all to authenticated
using (public.is_org_member(organization_id))
with check (public.is_org_member(organization_id));

drop policy if exists tenant_select_member on public.alert_events;
create policy tenant_select_member on public.alert_events
for select to authenticated
using (public.is_org_member(organization_id));

drop policy if exists tenant_select_member on public.tasks;
create policy tenant_select_member on public.tasks
for select to authenticated
using (public.is_org_member(organization_id));

drop policy if exists tenant_write_member on public.tasks;
create policy tenant_write_member on public.tasks
for all to authenticated
using (public.is_org_member(organization_id))
with check (public.is_org_member(organization_id));

drop policy if exists tenant_select_member on public.milestones;
create policy tenant_select_member on public.milestones
for select to authenticated
using (public.is_org_member(organization_id));

drop policy if exists tenant_write_member on public.milestones;
create policy tenant_write_member on public.milestones
for all to authenticated
using (public.is_org_member(organization_id))
with check (public.is_org_member(organization_id));

drop policy if exists tenant_select_member on public.document_checklists;
create policy tenant_select_member on public.document_checklists
for select to authenticated
using (public.is_org_member(organization_id));

drop policy if exists tenant_write_member on public.document_checklists;
create policy tenant_write_member on public.document_checklists
for all to authenticated
using (public.is_org_member(organization_id))
with check (public.is_org_member(organization_id));

drop policy if exists tenant_select_member on public.proposal_projects;
create policy tenant_select_member on public.proposal_projects
for select to authenticated
using (public.is_org_member(organization_id));

drop policy if exists tenant_write_member on public.proposal_projects;
create policy tenant_write_member on public.proposal_projects
for all to authenticated
using (public.is_org_member(organization_id))
with check (public.is_org_member(organization_id));

drop policy if exists tenant_select_member on public.proposal_versions;
create policy tenant_select_member on public.proposal_versions
for select to authenticated
using (public.is_org_member(organization_id));

drop policy if exists tenant_write_member on public.proposal_versions;
create policy tenant_write_member on public.proposal_versions
for all to authenticated
using (public.is_org_member(organization_id))
with check (public.is_org_member(organization_id));

drop policy if exists tenant_select_member on public.ai_runs;
create policy tenant_select_member on public.ai_runs
for select to authenticated
using (public.is_org_member(organization_id));

drop policy if exists tenant_insert_member on public.ai_runs;
create policy tenant_insert_member on public.ai_runs
for insert to authenticated
with check (public.is_org_member(organization_id));

drop policy if exists tenant_select_member on public.audit_events;
create policy tenant_select_member on public.audit_events
for select to authenticated
using (organization_id is null or public.has_org_role(organization_id, array['owner', 'admin']));

drop policy if exists tenant_select_member on public.notification_deliveries;
create policy tenant_select_member on public.notification_deliveries
for select to authenticated
using (public.is_org_member(organization_id));
