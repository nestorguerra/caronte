create table if not exists public.future_book_monitor_alerts (
  id uuid primary key default gen_random_uuid(),
  severity text not null default 'info' check (severity in ('info', 'warning', 'p0')),
  alert_type text not null,
  status text not null default 'open' check (status in ('open', 'acknowledged', 'resolved')),
  session_id uuid references public.future_book_sessions(id) on delete set null,
  message text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create table if not exists public.future_book_runtime_flags (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_by text,
  updated_at timestamptz not null default now()
);

create index if not exists idx_future_book_monitor_alerts_status_created
  on public.future_book_monitor_alerts(status, severity, created_at desc);

drop trigger if exists touch_future_book_runtime_flags_updated_at on public.future_book_runtime_flags;
create trigger touch_future_book_runtime_flags_updated_at
before update on public.future_book_runtime_flags
for each row execute function public.touch_updated_at();

alter table public.future_book_monitor_alerts enable row level security;
alter table public.future_book_runtime_flags enable row level security;

comment on table public.future_book_monitor_alerts is 'Basic operational alerts for Futuro Anterior beta monitoring.';
comment on table public.future_book_runtime_flags is 'Runtime switches for Futuro Anterior beta operations, including emergency access shutdown.';
