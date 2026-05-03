alter table public.proposal_projects
  add column if not exists tender_id uuid references public.tenders(id) on delete cascade,
  add column if not exists tender_lot_id uuid references public.tender_lots(id) on delete set null,
  add column if not exists source_ai_run_id uuid references public.ai_runs(id) on delete set null,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

alter table public.proposal_versions
  add column if not exists format text not null default 'markdown' check (format in ('markdown', 'docx', 'pdf')),
  add column if not exists review jsonb not null default '{}'::jsonb,
  add column if not exists export_metadata jsonb not null default '{}'::jsonb,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  name text not null,
  normalized_name text not null,
  tax_id text,
  country text not null default 'ES',
  is_ute boolean not null default false,
  confidence numeric(5,2) not null default 1,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.company_aliases (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  alias text not null,
  normalized_alias text not null,
  confidence numeric(5,2) not null default 1,
  source text not null default 'manual',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.award_history (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  source_id uuid references public.procurement_sources(id) on delete set null,
  tender_id uuid references public.tenders(id) on delete set null,
  tender_lot_id uuid references public.tender_lots(id) on delete set null,
  company_id uuid references public.companies(id) on delete set null,
  awardee_name text not null,
  normalized_awardee_name text not null,
  contracting_body text,
  cpv_codes text[] not null default '{}',
  region text,
  base_budget_cents bigint,
  award_amount_cents bigint,
  discount_pct numeric(8,4),
  award_date date,
  source_url text,
  source_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.economic_scenarios (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  tracked_tender_id uuid references public.tracked_tenders(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  name text not null,
  base_amount_cents bigint,
  bid_amount_cents bigint,
  estimated_cost_cents bigint,
  discount_pct numeric(8,4),
  margin_pct numeric(8,4),
  win_probability_pct numeric(8,4),
  expected_value_cents bigint,
  assumptions jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.document_library (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  uploaded_by uuid references auth.users(id) on delete set null,
  document_type text not null default 'other' check (document_type in ('certificate', 'solvency', 'technical_memory', 'power_of_attorney', 'cv', 'insurance', 'other')),
  title text not null,
  storage_bucket text not null default 'licitia-documents',
  storage_path text,
  version_number integer not null default 1,
  content_hash text,
  mime_type text,
  size_bytes bigint,
  expires_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.dossier_packages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  tracked_tender_id uuid references public.tracked_tenders(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  title text not null,
  status text not null default 'draft' check (status in ('draft', 'ready', 'exported', 'archived')),
  completeness_score integer not null default 0,
  export_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.dossier_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  dossier_package_id uuid not null references public.dossier_packages(id) on delete cascade,
  document_library_id uuid references public.document_library(id) on delete set null,
  tender_document_id uuid references public.tender_documents(id) on delete set null,
  proposal_version_id uuid references public.proposal_versions(id) on delete set null,
  item_type text not null default 'document' check (item_type in ('document', 'official_document', 'proposal', 'checklist_note')),
  title text not null,
  required boolean not null default true,
  status text not null default 'pending' check (status in ('pending', 'attached', 'missing', 'not_applicable')),
  sort_order integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.export_jobs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  dossier_package_id uuid references public.dossier_packages(id) on delete set null,
  proposal_version_id uuid references public.proposal_versions(id) on delete set null,
  export_type text not null check (export_type in ('docx', 'pdf', 'zip', 'csv')),
  status text not null default 'succeeded' check (status in ('queued', 'running', 'succeeded', 'failed')),
  filename text not null,
  storage_path text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.companies enable row level security;
alter table public.company_aliases enable row level security;
alter table public.award_history enable row level security;
alter table public.economic_scenarios enable row level security;
alter table public.document_library enable row level security;
alter table public.dossier_packages enable row level security;
alter table public.dossier_items enable row level security;
alter table public.export_jobs enable row level security;

drop policy if exists tenant_select_member on public.companies;
create policy tenant_select_member on public.companies
for select to authenticated
using (organization_id is null or public.is_org_member(organization_id));

drop policy if exists tenant_write_member on public.companies;
create policy tenant_write_member on public.companies
for all to authenticated
using (organization_id is not null and public.is_org_member(organization_id))
with check (organization_id is not null and public.is_org_member(organization_id));

drop policy if exists tenant_select_member on public.company_aliases;
create policy tenant_select_member on public.company_aliases
for select to authenticated
using (organization_id is null or public.is_org_member(organization_id));

drop policy if exists tenant_write_member on public.company_aliases;
create policy tenant_write_member on public.company_aliases
for all to authenticated
using (organization_id is not null and public.is_org_member(organization_id))
with check (organization_id is not null and public.is_org_member(organization_id));

drop policy if exists tenant_select_member on public.award_history;
create policy tenant_select_member on public.award_history
for select to authenticated
using (organization_id is null or public.is_org_member(organization_id));

drop policy if exists tenant_write_member on public.award_history;
create policy tenant_write_member on public.award_history
for all to authenticated
using (organization_id is not null and public.is_org_member(organization_id))
with check (organization_id is not null and public.is_org_member(organization_id));

drop policy if exists tenant_select_member on public.economic_scenarios;
create policy tenant_select_member on public.economic_scenarios
for select to authenticated
using (public.is_org_member(organization_id));

drop policy if exists tenant_write_member on public.economic_scenarios;
create policy tenant_write_member on public.economic_scenarios
for all to authenticated
using (public.is_org_member(organization_id))
with check (public.is_org_member(organization_id));

drop policy if exists tenant_select_member on public.document_library;
create policy tenant_select_member on public.document_library
for select to authenticated
using (public.is_org_member(organization_id));

drop policy if exists tenant_write_member on public.document_library;
create policy tenant_write_member on public.document_library
for all to authenticated
using (public.is_org_member(organization_id))
with check (public.is_org_member(organization_id));

drop policy if exists tenant_select_member on public.dossier_packages;
create policy tenant_select_member on public.dossier_packages
for select to authenticated
using (public.is_org_member(organization_id));

drop policy if exists tenant_write_member on public.dossier_packages;
create policy tenant_write_member on public.dossier_packages
for all to authenticated
using (public.is_org_member(organization_id))
with check (public.is_org_member(organization_id));

drop policy if exists tenant_select_member on public.dossier_items;
create policy tenant_select_member on public.dossier_items
for select to authenticated
using (public.is_org_member(organization_id));

drop policy if exists tenant_write_member on public.dossier_items;
create policy tenant_write_member on public.dossier_items
for all to authenticated
using (public.is_org_member(organization_id))
with check (public.is_org_member(organization_id));

drop policy if exists tenant_select_member on public.export_jobs;
create policy tenant_select_member on public.export_jobs
for select to authenticated
using (public.is_org_member(organization_id));

drop policy if exists tenant_write_member on public.export_jobs;
create policy tenant_write_member on public.export_jobs
for all to authenticated
using (public.is_org_member(organization_id))
with check (public.is_org_member(organization_id));

create index if not exists idx_companies_org_normalized on public.companies(organization_id, normalized_name);
create index if not exists idx_company_aliases_company on public.company_aliases(company_id, normalized_alias);
create index if not exists idx_award_history_org_date on public.award_history(organization_id, award_date desc);
create index if not exists idx_award_history_cpv on public.award_history using gin (cpv_codes);
create index if not exists idx_award_history_body on public.award_history(contracting_body);
create index if not exists idx_economic_scenarios_tracked on public.economic_scenarios(tracked_tender_id, created_at desc);
create index if not exists idx_document_library_org_type on public.document_library(organization_id, document_type, updated_at desc);
create index if not exists idx_dossier_packages_tracked on public.dossier_packages(tracked_tender_id, created_at desc);
create index if not exists idx_dossier_items_package on public.dossier_items(dossier_package_id, sort_order);
create index if not exists idx_export_jobs_org_created on public.export_jobs(organization_id, created_at desc);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'licitia-documents',
  'licitia-documents',
  false,
  52428800,
  array[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/zip',
    'text/plain',
    'text/markdown'
  ]
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;
