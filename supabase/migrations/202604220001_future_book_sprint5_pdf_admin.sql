create table if not exists public.future_book_pdfs (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.future_book_sessions(id) on delete cascade,
  manuscript_id uuid references public.future_book_manuscripts(id) on delete set null,
  version integer not null default 1 check (version >= 1),
  status text not null default 'generated' check (status in ('generated', 'failed')),
  review_status text not null default 'pending_review' check (
    review_status in (
      'pending_review',
      'approved',
      'rejected',
      'regeneration_requested',
      'blocked',
      'released_to_customer'
    )
  ),
  file_name text not null,
  mime_type text not null default 'application/pdf',
  pdf_base64 text not null,
  page_count integer not null default 0,
  page_size text not null default 'A5',
  storage_path text,
  quality_report jsonb not null default '{}'::jsonb,
  lulu_metadata jsonb not null default '{}'::jsonb,
  review_notes text,
  reviewed_by text,
  reviewed_at timestamptz,
  released_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (session_id, version)
);

create table if not exists public.future_book_provider_settings (
  provider text primary key,
  display_name text not null,
  configured boolean not null default false,
  required boolean not null default false,
  status text not null default 'not_configured' check (
    status in ('not_configured', 'configured', 'disabled', 'failed', 'placeholder')
  ),
  secret_ciphertext text,
  secret_nonce text,
  secret_last4 text,
  tested_at timestamptz,
  updated_by text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_future_book_pdfs_session_created
  on public.future_book_pdfs(session_id, created_at desc);

create index if not exists idx_future_book_pdfs_review_created
  on public.future_book_pdfs(review_status, created_at desc);

drop trigger if exists touch_future_book_pdfs_updated_at on public.future_book_pdfs;
create trigger touch_future_book_pdfs_updated_at
before update on public.future_book_pdfs
for each row execute function public.touch_updated_at();

drop trigger if exists touch_future_book_provider_settings_updated_at on public.future_book_provider_settings;
create trigger touch_future_book_provider_settings_updated_at
before update on public.future_book_provider_settings
for each row execute function public.touch_updated_at();

alter table public.future_book_pdfs enable row level security;
alter table public.future_book_provider_settings enable row level security;

comment on table public.future_book_pdfs is 'Generated Futuro Anterior PDF versions. PDFs are blocked until manual review and release.';
comment on table public.future_book_provider_settings is 'Encrypted or metadata-only provider configuration for Futuro Anterior admin operations. Secrets are never returned to clients.';
