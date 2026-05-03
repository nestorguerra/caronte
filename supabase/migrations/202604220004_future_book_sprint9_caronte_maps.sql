create table if not exists public.future_book_psych_maps (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.future_book_sessions(id) on delete cascade,
  version integer not null default 1 check (version >= 1),
  status text not null default 'draft' check (status in ('draft', 'ready', 'degraded', 'failed')),
  prompt_version text not null default 'caronte-literary-v1',
  map_payload jsonb not null default '{}'::jsonb,
  outline_payload jsonb not null default '{}'::jsonb,
  quality_report jsonb not null default '{}'::jsonb,
  provider_chain jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (session_id, version)
);

alter table public.future_book_manuscripts
  add column if not exists psych_map_id uuid references public.future_book_psych_maps(id) on delete set null;

create index if not exists idx_future_book_psych_maps_session_version
  on public.future_book_psych_maps(session_id, version desc);

create index if not exists idx_future_book_psych_maps_status_created
  on public.future_book_psych_maps(status, created_at desc);

drop trigger if exists touch_future_book_psych_maps_updated_at on public.future_book_psych_maps;
create trigger touch_future_book_psych_maps_updated_at
before update on public.future_book_psych_maps
for each row execute function public.touch_updated_at();

alter table public.future_book_psych_maps enable row level security;

comment on table public.future_book_psych_maps is 'Versioned Caronte psychological maps and narrative outlines generated from Futuro Anterior interviews.';
comment on column public.future_book_manuscripts.psych_map_id is 'Psychological map used as literary source for this manuscript.';
