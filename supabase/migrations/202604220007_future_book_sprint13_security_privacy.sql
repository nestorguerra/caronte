alter table public.future_book_sessions
  add column if not exists ip_hash text,
  add column if not exists fingerprint_hash text,
  add column if not exists expires_at timestamptz,
  add column if not exists privacy_erased_at timestamptz,
  add column if not exists abuse_score numeric(5, 2) not null default 0,
  add column if not exists risk_flags jsonb not null default '{}'::jsonb;

create table if not exists public.future_book_abuse_events (
  id uuid primary key default gen_random_uuid(),
  action text not null,
  key_hash text not null,
  ip_hash text,
  fingerprint_hash text,
  session_id uuid references public.future_book_sessions(id) on delete set null,
  outcome text not null default 'accepted' check (outcome in ('accepted', 'challenge_required', 'blocked')),
  reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.future_book_retention_policies (
  data_type text primary key,
  ttl_days integer not null check (ttl_days between 1 and 3650),
  delete_mode text not null default 'hard_delete' check (delete_mode in ('hard_delete', 'metadata_only')),
  enabled boolean not null default true,
  updated_by text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.future_book_privacy_requests (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references public.future_book_sessions(id) on delete set null,
  request_type text not null check (request_type in ('export', 'erasure')),
  status text not null default 'completed' check (status in ('requested', 'completed', 'failed')),
  requester_hash text,
  processed_by text,
  result_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

insert into public.future_book_retention_policies (data_type, ttl_days, delete_mode, enabled, updated_by, metadata)
values
  ('audio', 7, 'hard_delete', true, 'migration_sprint13', '{"bucket":"future-book-audio"}'::jsonb),
  ('answers', 30, 'hard_delete', true, 'migration_sprint13', '{}'::jsonb),
  ('manuscripts', 30, 'hard_delete', true, 'migration_sprint13', '{}'::jsonb),
  ('pdfs', 30, 'hard_delete', true, 'migration_sprint13', '{"bucket":"future-book-pdfs"}'::jsonb),
  ('psych_maps', 30, 'hard_delete', true, 'migration_sprint13', '{}'::jsonb),
  ('session_events', 90, 'hard_delete', true, 'migration_sprint13', '{}'::jsonb),
  ('abuse_events', 90, 'hard_delete', true, 'migration_sprint13', '{}'::jsonb),
  ('admin_audit', 365, 'metadata_only', true, 'migration_sprint13', '{}'::jsonb),
  ('privacy_requests', 365, 'metadata_only', true, 'migration_sprint13', '{}'::jsonb)
on conflict (data_type) do nothing;

create index if not exists idx_future_book_sessions_privacy_expiry
  on public.future_book_sessions(expires_at, privacy_erased_at);

create index if not exists idx_future_book_sessions_abuse_hashes
  on public.future_book_sessions(ip_hash, fingerprint_hash, created_at desc);

create index if not exists idx_future_book_abuse_key_action_created
  on public.future_book_abuse_events(key_hash, action, created_at desc);

create index if not exists idx_future_book_abuse_session_created
  on public.future_book_abuse_events(session_id, created_at desc);

create index if not exists idx_future_book_privacy_requests_session_created
  on public.future_book_privacy_requests(session_id, created_at desc);

drop trigger if exists touch_future_book_retention_policies_updated_at on public.future_book_retention_policies;
create trigger touch_future_book_retention_policies_updated_at
before update on public.future_book_retention_policies
for each row execute function public.touch_updated_at();

alter table public.future_book_abuse_events enable row level security;
alter table public.future_book_retention_policies enable row level security;
alter table public.future_book_privacy_requests enable row level security;

comment on table public.future_book_abuse_events
  is 'Append-only anti-abuse and rate-limit signal log for Futuro Anterior. Raw IPs are not stored.';

comment on table public.future_book_retention_policies
  is 'Data retention TTLs for sensitive Futuro Anterior artifacts and logs.';

comment on table public.future_book_privacy_requests
  is 'Export and erasure request trace for Futuro Anterior privacy operations.';
