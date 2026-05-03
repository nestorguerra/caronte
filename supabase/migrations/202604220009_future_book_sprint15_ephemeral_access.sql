create table if not exists public.future_book_access_campaigns (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  status text not null default 'active' check (status in ('active', 'paused', 'closed')),
  access_mode text not null default 'invite_required' check (access_mode in ('fixed_beta', 'invite_required')),
  fixed_beta_enabled boolean not null default false,
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  default_ttl_minutes integer not null default 60 check (default_ttl_minutes between 1 and 43200),
  invite_max_uses integer not null default 1 check (invite_max_uses between 1 and 50),
  max_invites integer not null default 100 check (max_invites between 1 and 100000),
  max_sessions integer not null default 100 check (max_sessions between 1 and 100000),
  issued_invites integer not null default 0 check (issued_invites >= 0),
  used_sessions integer not null default 0 check (used_sessions >= 0),
  waitlist_enabled boolean not null default true,
  created_by text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.future_book_access_invites (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.future_book_access_campaigns(id) on delete cascade,
  token_hash text not null unique,
  token_hint text not null,
  status text not null default 'active' check (status in ('active', 'used', 'expired', 'revoked')),
  max_uses integer not null default 1 check (max_uses between 1 and 50),
  use_count integer not null default 0 check (use_count >= 0),
  child_invite_limit integer not null default 0 check (child_invite_limit between 0 and 100),
  child_invite_count integer not null default 0 check (child_invite_count >= 0),
  depth integer not null default 0 check (depth between 0 and 10),
  parent_invite_id uuid references public.future_book_access_invites(id) on delete set null,
  issued_to_hash text,
  issued_by text,
  expires_at timestamptz not null,
  first_used_at timestamptz,
  last_used_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.future_book_waitlist_entries (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid references public.future_book_access_campaigns(id) on delete set null,
  invite_token_hash text,
  contact_hash text,
  ip_hash text,
  fingerprint_hash text,
  status text not null default 'queued' check (status in ('queued', 'invited', 'rejected', 'blocked')),
  reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.future_book_sessions
  add column if not exists access_campaign_id uuid references public.future_book_access_campaigns(id) on delete set null,
  add column if not exists access_invite_id uuid references public.future_book_access_invites(id) on delete set null;

create index if not exists idx_future_book_access_campaigns_status
  on public.future_book_access_campaigns(status, starts_at desc);

create index if not exists idx_future_book_access_invites_campaign_status
  on public.future_book_access_invites(campaign_id, status, expires_at desc);

create index if not exists idx_future_book_access_invites_token
  on public.future_book_access_invites(token_hash);

create index if not exists idx_future_book_waitlist_entries_status
  on public.future_book_waitlist_entries(status, created_at desc);

create index if not exists idx_future_book_sessions_access
  on public.future_book_sessions(access_campaign_id, access_invite_id, created_at desc);

drop trigger if exists touch_future_book_access_campaigns_updated_at on public.future_book_access_campaigns;
create trigger touch_future_book_access_campaigns_updated_at
before update on public.future_book_access_campaigns
for each row execute function public.touch_updated_at();

drop trigger if exists touch_future_book_access_invites_updated_at on public.future_book_access_invites;
create trigger touch_future_book_access_invites_updated_at
before update on public.future_book_access_invites
for each row execute function public.touch_updated_at();

drop trigger if exists touch_future_book_waitlist_entries_updated_at on public.future_book_waitlist_entries;
create trigger touch_future_book_waitlist_entries_updated_at
before update on public.future_book_waitlist_entries
for each row execute function public.touch_updated_at();

alter table public.future_book_access_campaigns enable row level security;
alter table public.future_book_access_invites enable row level security;
alter table public.future_book_waitlist_entries enable row level security;

comment on table public.future_book_access_campaigns
  is 'Controlled ephemeral access campaigns for Futuro Anterior.';

comment on table public.future_book_access_invites
  is 'One-time or limited-use ephemeral access links. Raw tokens are never stored.';

comment on table public.future_book_waitlist_entries
  is 'Opaque waitlist entries for rejected, expired or closed access attempts.';
