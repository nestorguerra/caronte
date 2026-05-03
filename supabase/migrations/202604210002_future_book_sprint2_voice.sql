create table if not exists public.future_book_answers (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.future_book_sessions(id) on delete cascade,
  question_index integer not null check (question_index between 1 and 99),
  question_text text not null,
  transcript text,
  transcript_source text not null default 'browser' check (transcript_source in ('browser', 'backend', 'pending', 'manual_admin')),
  audio_storage_path text,
  audio_mime_type text,
  duration_seconds integer,
  quality_score numeric(4, 3),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (session_id, question_index)
);

create table if not exists public.future_book_artifacts (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.future_book_sessions(id) on delete cascade,
  artifact_type text not null check (artifact_type in ('voice_prompt', 'audio_answer', 'transcript', 'manuscript', 'pdf')),
  storage_path text,
  provider text,
  mime_type text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_future_book_answers_session_question
  on public.future_book_answers(session_id, question_index);

create index if not exists idx_future_book_artifacts_session_type
  on public.future_book_artifacts(session_id, artifact_type, created_at desc);

alter table public.future_book_answers enable row level security;
alter table public.future_book_artifacts enable row level security;

comment on table public.future_book_answers is 'Voice interview answers for Futuro Anterior. Direct client access is blocked by RLS; public flows use Edge Functions.';
comment on table public.future_book_artifacts is 'Private artifact metadata for voice prompts, audio answers, transcripts, manuscripts and PDFs.';
