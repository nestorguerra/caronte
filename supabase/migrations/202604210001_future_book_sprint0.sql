create table if not exists public.future_book_sessions (
  id uuid primary key default gen_random_uuid(),
  public_token text not null unique default encode(extensions.gen_random_bytes(24), 'hex'),
  product_code text not null default 'futuro_anterior',
  source text not null default 'fixed_url',
  locale text not null default 'es-ES',
  timezone text not null default 'Europe/Madrid',
  status text not null default 'created' check (
    status in (
      'created',
      'payment_pending',
      'payment_simulated_approved',
      'awaiting_consent',
      'interview_ready',
      'interview_active',
      'interview_completed',
      'book_generating',
      'book_ready',
      'pdf_generating',
      'pending_review',
      'approved',
      'released_to_customer',
      'blocked',
      'failed'
    )
  ),
  payment_status text not null default 'not_started' check (
    payment_status in ('not_started', 'simulated_pending', 'simulated_approved', 'failed', 'refunded')
  ),
  price_cents integer not null default 4900 check (price_cents >= 0),
  currency text not null default 'EUR',
  question_count integer not null default 21 check (question_count between 1 and 99),
  privacy_consent_at timestamptz,
  interview_started_at timestamptz,
  interview_completed_at timestamptz,
  book_status text not null default 'not_started' check (
    book_status in ('not_started', 'queued', 'generating', 'quality_review', 'ready', 'failed')
  ),
  pdf_review_status text not null default 'not_generated' check (
    pdf_review_status in ('not_generated', 'pending_review', 'approved', 'rejected', 'regeneration_requested', 'released_to_customer')
  ),
  book_generation_started_at timestamptz,
  book_generation_completed_at timestamptz,
  pdf_ready_at timestamptz,
  pdf_reviewed_at timestamptz,
  pdf_released_at timestamptz,
  pdf_url text,
  error_code text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.future_book_events (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.future_book_sessions(id) on delete cascade,
  event_type text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_future_book_sessions_status_created
  on public.future_book_sessions(status, created_at desc);

create index if not exists idx_future_book_sessions_public_token
  on public.future_book_sessions(public_token);

create index if not exists idx_future_book_sessions_pdf_review
  on public.future_book_sessions(pdf_review_status, created_at desc);

create index if not exists idx_future_book_events_session_created
  on public.future_book_events(session_id, created_at desc);

drop trigger if exists touch_future_book_sessions_updated_at on public.future_book_sessions;
create trigger touch_future_book_sessions_updated_at
before update on public.future_book_sessions
for each row execute function public.touch_updated_at();

alter table public.future_book_sessions enable row level security;
alter table public.future_book_events enable row level security;

comment on table public.future_book_sessions is 'Futuro Anterior MVP sessions. Direct client access is blocked by RLS; public flows use Edge Functions.';
comment on table public.future_book_events is 'Operational event trail for Futuro Anterior sessions.';
