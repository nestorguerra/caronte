alter table public.tracked_tenders
  add column if not exists decision text check (decision in ('go', 'no_go', 'review', 'pending')),
  add column if not exists decision_score integer,
  add column if not exists decision_breakdown jsonb not null default '{}'::jsonb,
  add column if not exists decision_reason text,
  add column if not exists decided_by uuid references auth.users(id) on delete set null,
  add column if not exists decided_at timestamptz;

alter table public.document_checklists
  add column if not exists source text not null default 'manual',
  add column if not exists history jsonb not null default '[]'::jsonb,
  add column if not exists generated_from_ai_run_id uuid references public.ai_runs(id) on delete set null;

alter table public.tasks
  add column if not exists priority text not null default 'normal' check (priority in ('low', 'normal', 'high', 'urgent')),
  add column if not exists tender_document_id uuid references public.tender_documents(id) on delete set null,
  add column if not exists metadata jsonb not null default '{}'::jsonb,
  add column if not exists completed_at timestamptz;

alter table public.milestones
  add column if not exists reminder_at timestamptz,
  add column if not exists last_notified_at timestamptz,
  add column if not exists export_uid text,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

alter table public.ai_runs
  add column if not exists endpoint text,
  add column if not exists success boolean not null default true,
  add column if not exists estimated_cost_cents bigint,
  add column if not exists error_message text;

create table if not exists public.task_comments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  task_id uuid not null references public.tasks(id) on delete cascade,
  author_user_id uuid references auth.users(id) on delete set null,
  body text not null,
  created_at timestamptz not null default now()
);

alter table public.task_comments enable row level security;

drop policy if exists tenant_select_member on public.task_comments;
create policy tenant_select_member on public.task_comments
for select to authenticated
using (public.is_org_member(organization_id));

drop policy if exists tenant_write_member on public.task_comments;
create policy tenant_write_member on public.task_comments
for all to authenticated
using (public.is_org_member(organization_id))
with check (public.is_org_member(organization_id));

create index if not exists idx_tracked_tenders_decision on public.tracked_tenders(organization_id, decision, decided_at desc);
create index if not exists idx_document_checklists_tracked on public.document_checklists(organization_id, tracked_tender_id);
create index if not exists idx_tasks_assignee_status on public.tasks(organization_id, assigned_to, status, due_at);
create index if not exists idx_tasks_tracked_status on public.tasks(tracked_tender_id, status, priority);
create index if not exists idx_task_comments_task_created on public.task_comments(task_id, created_at);
create index if not exists idx_milestones_org_due on public.milestones(organization_id, due_at);
create index if not exists idx_ai_runs_org_endpoint_created on public.ai_runs(organization_id, endpoint, created_at desc);
create index if not exists idx_ai_runs_success_created on public.ai_runs(success, created_at desc);
