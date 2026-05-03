alter table public.future_book_pdfs
  alter column pdf_base64 drop not null;

alter table public.future_book_pdfs
  add column if not exists print_validation jsonb not null default '{}'::jsonb;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
) values (
  'future-book-pdfs',
  'future-book-pdfs',
  false,
  20971520,
  array['application/pdf']::text[]
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

comment on column public.future_book_pdfs.pdf_base64
  is 'Legacy inline PDF payload. Sprint 10 stores generated PDFs in private storage and only returns base64 on authorized preview/download.';

comment on column public.future_book_pdfs.print_validation
  is 'Automated editorial and print-readiness validation for Futuro Anterior PDF generation.';
