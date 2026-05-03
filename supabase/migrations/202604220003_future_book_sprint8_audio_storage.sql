alter table public.future_book_answers
  add column if not exists audio_storage_path text;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
) values (
  'future-book-audio',
  'future-book-audio',
  false,
  26214400,
  array['audio/webm', 'audio/mp4', 'audio/mpeg', 'audio/wav', 'audio/ogg']::text[]
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

comment on column public.future_book_answers.audio_storage_path
  is 'Private Supabase Storage path for raw answer audio when Sprint 8 retention policy stores it.';
