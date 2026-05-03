create table if not exists public.future_book_synthetic_runs (
  id uuid primary key default gen_random_uuid(),
  probe_type text not null default 'light_flow',
  status text not null default 'running' check (status in ('running', 'succeeded', 'failed')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  duration_ms integer,
  checks jsonb not null default '{}'::jsonb,
  error_message text,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.future_book_dead_letters (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references public.future_book_sessions(id) on delete set null,
  target_type text not null default 'session',
  target_id text,
  failed_action text not null,
  severity text not null default 'warning' check (severity in ('info', 'warning', 'p0')),
  status text not null default 'open' check (status in ('open', 'retrying', 'resolved', 'ignored')),
  attempts integer not null default 0,
  last_error text,
  payload jsonb not null default '{}'::jsonb,
  next_retry_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz
);

create table if not exists public.future_book_sla_snapshots (
  id uuid primary key default gen_random_uuid(),
  window_started_at timestamptz not null,
  window_ended_at timestamptz not null default now(),
  sessions_total integer not null default 0,
  conversion jsonb not null default '{}'::jsonb,
  sla jsonb not null default '{}'::jsonb,
  cost jsonb not null default '{}'::jsonb,
  alerts jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.future_book_alert_deliveries (
  id uuid primary key default gen_random_uuid(),
  alert_id uuid references public.future_book_monitor_alerts(id) on delete set null,
  channel text not null default 'webhook',
  status text not null default 'skipped' check (status in ('skipped', 'sent', 'failed')),
  destination_hint text,
  response_status integer,
  error_message text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_future_book_synthetic_runs_created
  on public.future_book_synthetic_runs(started_at desc);

create index if not exists idx_future_book_dead_letters_status_created
  on public.future_book_dead_letters(status, severity, created_at desc);

create index if not exists idx_future_book_dead_letters_session_action
  on public.future_book_dead_letters(session_id, failed_action, status);

create index if not exists idx_future_book_sla_snapshots_created
  on public.future_book_sla_snapshots(created_at desc);

create index if not exists idx_future_book_alert_deliveries_alert_created
  on public.future_book_alert_deliveries(alert_id, created_at desc);

drop trigger if exists touch_future_book_dead_letters_updated_at on public.future_book_dead_letters;
create trigger touch_future_book_dead_letters_updated_at
before update on public.future_book_dead_letters
for each row execute function public.touch_updated_at();

alter table public.future_book_synthetic_runs enable row level security;
alter table public.future_book_dead_letters enable row level security;
alter table public.future_book_sla_snapshots enable row level security;
alter table public.future_book_alert_deliveries enable row level security;

comment on table public.future_book_synthetic_runs
  is 'Autonomous synthetic monitor runs for Futuro Anterior.';

comment on table public.future_book_dead_letters
  is 'Dead-letter queue for stuck or failed Futuro Anterior sessions and actions.';

comment on table public.future_book_sla_snapshots
  is 'SLA, conversion and cost snapshots produced by autonomous monitoring.';

comment on table public.future_book_alert_deliveries
  is 'External P0 alert delivery attempts for Futuro Anterior.';
