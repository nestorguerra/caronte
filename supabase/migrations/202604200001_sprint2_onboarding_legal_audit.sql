alter table public.company_profiles
  add column if not exists sectors text[] not null default '{}',
  add column if not exists cnae text,
  add column if not exists min_contract_value_cents bigint,
  add column if not exists max_contract_value_cents bigint,
  add column if not exists target_contract_types text[] not null default '{}',
  add column if not exists onboarding_progress integer not null default 0,
  add column if not exists profile_completed_at timestamptz;

create table if not exists public.organization_invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  email text not null,
  role text not null default 'viewer' check (role in ('owner', 'admin', 'bid_manager', 'legal', 'finance', 'viewer')),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'cancelled', 'expired')),
  invited_by uuid references auth.users(id) on delete set null,
  invited_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '14 days'),
  accepted_by uuid references auth.users(id) on delete set null,
  accepted_at timestamptz,
  cancelled_at timestamptz,
  metadata jsonb not null default '{}'::jsonb
);

create unique index if not exists idx_org_invitations_pending_email
on public.organization_invitations (organization_id, lower(email))
where status = 'pending';

create table if not exists public.user_legal_acceptances (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  terms_version text not null,
  privacy_version text not null,
  ai_notice_version text not null,
  communications_consent boolean not null default false,
  accepted_at timestamptz not null default now(),
  ip_address inet,
  user_agent text,
  metadata jsonb not null default '{}'::jsonb,
  unique (organization_id, user_id, terms_version, privacy_version, ai_notice_version)
);

create index if not exists idx_company_profiles_org on public.company_profiles(organization_id);
create index if not exists idx_saved_searches_org_created on public.saved_searches(organization_id, created_at desc);
create index if not exists idx_alert_rules_org_active on public.alert_rules(organization_id, active);
create index if not exists idx_subscriptions_org_status on public.subscriptions(organization_id, status);
create index if not exists idx_legal_acceptances_user on public.user_legal_acceptances(user_id, accepted_at desc);
create index if not exists idx_legal_acceptances_org on public.user_legal_acceptances(organization_id, accepted_at desc);
create index if not exists idx_org_invitations_org_status on public.organization_invitations(organization_id, status);

update public.subscriptions
set current_period_ends_at = coalesce(current_period_ends_at, started_at + interval '30 days')
where status in ('trialing_free', 'active_free');

update public.plans
set features = features || '{
  "payments_required": false,
  "requires_card": false,
  "legal_terms_version": "beta-2026-04",
  "privacy_version": "beta-2026-04",
  "ai_notice_version": "beta-2026-04"
}'::jsonb
where code = 'free_beta_month';

alter table public.organization_invitations enable row level security;
alter table public.user_legal_acceptances enable row level security;

drop policy if exists organization_invitations_select_member on public.organization_invitations;
create policy organization_invitations_select_member on public.organization_invitations
for select to authenticated
using (public.is_org_member(organization_id));

drop policy if exists organization_invitations_write_admin on public.organization_invitations;
create policy organization_invitations_write_admin on public.organization_invitations
for all to authenticated
using (public.has_org_role(organization_id, array['owner', 'admin']))
with check (public.has_org_role(organization_id, array['owner', 'admin']));

drop policy if exists legal_acceptances_select_self_or_admin on public.user_legal_acceptances;
create policy legal_acceptances_select_self_or_admin on public.user_legal_acceptances
for select to authenticated
using (
  user_id = (select auth.uid())
  or public.has_org_role(organization_id, array['owner', 'admin'])
);

drop policy if exists legal_acceptances_insert_self on public.user_legal_acceptances;
create policy legal_acceptances_insert_self on public.user_legal_acceptances
for insert to authenticated
with check (
  user_id = (select auth.uid())
  and public.is_org_member(organization_id)
);
