create table if not exists public.procurement_ingestion_runs (
  id uuid primary key default gen_random_uuid(),
  source_id uuid references public.procurement_sources(id) on delete set null,
  source_code text not null,
  job_type text not null check (job_type in ('boe_daily', 'placsp_profiles', 'placsp_aggregated', 'alerts')),
  status text not null default 'running' check (status in ('running', 'succeeded', 'failed', 'partial')),
  requested_url text,
  items_seen integer not null default 0,
  items_upserted integer not null default 0,
  items_failed integer not null default 0,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  error_message text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.tenders
  add column if not exists source_url text,
  add column if not exists source_updated_at timestamptz,
  add column if not exists last_seen_at timestamptz,
  add column if not exists normalized_at timestamptz,
  add column if not exists document_count integer not null default 0,
  add column if not exists data_quality_flags jsonb not null default '[]'::jsonb;

alter table public.tender_versions
  add column if not exists source_url text,
  add column if not exists source_fingerprint text;

alter table public.alert_rules
  add column if not exists paused_reason text,
  add column if not exists last_error text;

alter table public.notification_deliveries
  add column if not exists subject text,
  add column if not exists body_preview text,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

create index if not exists idx_ingestion_runs_source_created on public.procurement_ingestion_runs(source_code, created_at desc);
create index if not exists idx_ingestion_runs_status on public.procurement_ingestion_runs(status, created_at desc);
create index if not exists idx_tenders_public_deadline on public.tenders(submission_deadline) where organization_id is null;
create index if not exists idx_tenders_public_publication on public.tenders(publication_date desc) where organization_id is null;
create index if not exists idx_tenders_public_amount on public.tenders(base_budget_cents, estimated_value_cents) where organization_id is null;
create index if not exists idx_tenders_public_body on public.tenders(contracting_body) where organization_id is null;
create index if not exists idx_tenders_external on public.tenders(source_id, external_id);
create index if not exists idx_tenders_canonical_key on public.tenders(canonical_key);
create index if not exists idx_tender_documents_tender on public.tender_documents(tender_id);
create index if not exists idx_tender_versions_tender_ingested on public.tender_versions(tender_id, ingested_at desc);
create index if not exists idx_tracked_tenders_org_tender on public.tracked_tenders(organization_id, tender_id);
create index if not exists idx_alert_events_rule_created on public.alert_events(alert_rule_id, created_at desc);
create index if not exists idx_notification_deliveries_status on public.notification_deliveries(status, created_at desc);

insert into public.procurement_sources (code, name, base_url, source_type, metadata)
values
  (
    'boe_opendata',
    'BOE OpenData',
    'https://www.boe.es/datosabiertos/api/boe/sumario/',
    'official',
    '{"section": "V.A", "format": "json"}'::jsonb
  ),
  (
    'placsp_profiles',
    'PLACSP perfiles del contratante',
    'https://contrataciondelsectorpublico.gob.es/sindicacion/sindicacion_643/licitacionesPerfilesContratanteCompleto3.atom',
    'official',
    '{"format": "atom", "dataset": "licitaciones perfiles contratante"}'::jsonb
  ),
  (
    'placsp_aggregated',
    'PLACSP plataformas agregadas',
    'https://contrataciondelsectorpublico.gob.es/sindicacion/sindicacion_1044/PlataformasAgregadasSinMenores.atom',
    'official',
    '{"format": "atom", "dataset": "plataformas agregadas"}'::jsonb
  )
on conflict (code) do update
set name = excluded.name,
    base_url = excluded.base_url,
    source_type = excluded.source_type,
    metadata = public.procurement_sources.metadata || excluded.metadata,
    updated_at = now();

alter table public.procurement_ingestion_runs enable row level security;

drop policy if exists ingestion_runs_select_admin on public.procurement_ingestion_runs;
create policy ingestion_runs_select_admin on public.procurement_ingestion_runs
for select to authenticated
using (
  exists (
    select 1
    from public.organization_members om
    where om.user_id = (select auth.uid())
      and om.status = 'active'
      and om.role in ('owner', 'admin')
  )
);
