create table if not exists public.future_book_manuscripts (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.future_book_sessions(id) on delete cascade,
  status text not null default 'draft' check (status in ('draft', 'quality_review', 'ready', 'failed')),
  title text not null,
  manuscript jsonb not null default '{}'::jsonb,
  quality_report jsonb not null default '{}'::jsonb,
  provider_chain jsonb not null default '{}'::jsonb,
  prompt_version text not null default 'future-book-sprint4-v1',
  page_target_min integer not null default 35,
  page_target_max integer not null default 60,
  quality_score numeric(4, 3),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_future_book_manuscripts_session_created
  on public.future_book_manuscripts(session_id, created_at desc);

create index if not exists idx_future_book_manuscripts_status_created
  on public.future_book_manuscripts(status, created_at desc);

drop trigger if exists touch_future_book_manuscripts_updated_at on public.future_book_manuscripts;
create trigger touch_future_book_manuscripts_updated_at
before update on public.future_book_manuscripts
for each row execute function public.touch_updated_at();

alter table public.future_book_manuscripts enable row level security;

comment on table public.future_book_manuscripts is 'Generated Futuro Anterior manuscripts before PDF layout and human review. Direct client access is blocked by RLS; public flows use Edge Functions.';
