create table if not exists public.future_book_admin_users (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  email text not null unique,
  display_name text,
  role text not null default 'viewer' check (role in ('owner', 'ops', 'editor', 'support', 'viewer')),
  status text not null default 'active' check (status in ('active', 'disabled')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.future_book_admin_audit_events (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid references public.future_book_admin_users(id) on delete set null,
  admin_email text,
  admin_role text,
  action text not null,
  resource_type text,
  resource_id text,
  outcome text not null default 'success' check (outcome in ('success', 'failed')),
  ip_hint text,
  user_agent text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_future_book_admin_users_email_status
  on public.future_book_admin_users(lower(email), status);

create index if not exists idx_future_book_admin_users_user_status
  on public.future_book_admin_users(user_id, status);

create index if not exists idx_future_book_admin_audit_created
  on public.future_book_admin_audit_events(created_at desc);

create index if not exists idx_future_book_admin_audit_resource
  on public.future_book_admin_audit_events(resource_type, resource_id, created_at desc);

drop trigger if exists touch_future_book_admin_users_updated_at on public.future_book_admin_users;
create trigger touch_future_book_admin_users_updated_at
before update on public.future_book_admin_users
for each row execute function public.touch_updated_at();

alter table public.future_book_admin_users enable row level security;
alter table public.future_book_admin_audit_events enable row level security;

comment on table public.future_book_admin_users
  is 'Role-based back office operators for Futuro Anterior. Direct client access is blocked; Edge Functions enforce permissions.';

comment on table public.future_book_admin_audit_events
  is 'Immutable operational audit log for Futuro Anterior back office actions and privileged reads.';
