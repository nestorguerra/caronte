-- Prepared locally. Do not apply to the shared project without deployment approval.
create table public.future_book_print_jobs (
  id uuid primary key default gen_random_uuid(),
  pdf_id uuid not null unique default gen_random_uuid(),
  session_id uuid not null references public.future_book_sessions(id) on delete cascade,
  manuscript_id uuid not null references public.future_book_manuscripts(id) on delete cascade,
  manuscript_revision timestamptz not null,
  version integer not null check (version>=1),
  source_snapshot jsonb not null check (jsonb_typeof(source_snapshot)='object'),
  source_sha256 text not null check (source_sha256 ~ '^[a-f0-9]{64}$'),
  input_hash text not null check (input_hash ~ '^[a-f0-9]{64}$'),
  stages_version text not null check (stages_version='caronte-a5-chunks-v1'),
  lulu_environment text not null check (lulu_environment in ('sandbox','production')),
  lulu_configuration_tag text not null check (lulu_configuration_tag ~ '^[a-f0-9]{64}$'),
  pod_package_id text not null,
  status text not null default 'queued' check (status in ('queued','running','blocked','ready','cancelled')),
  stage text not null default 'plan',error_code text,
  lease_token uuid,lease_until timestamptz,
  next_run_at timestamptz not null default now(),
  control_history jsonb not null default '[]'::jsonb check (jsonb_typeof(control_history)='array'),
  created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
  unique(session_id,input_hash),unique(session_id,version)
);
create unique index future_book_print_one_active on public.future_book_print_jobs(session_id)
  where status in ('queued','running','blocked');
create index future_book_print_queue on public.future_book_print_jobs(next_run_at,created_at)
  where status in ('queued','running');
create table public.future_book_print_steps (
  job_id uuid not null references public.future_book_print_jobs(id) on delete cascade,
  step_key text not null,stage text not null,
  status text not null check (status in ('started','completed','failed')),
  attempt integer not null check (attempt between 0 and 3),
  input_hash text check (input_hash is null or input_hash ~ '^[a-f0-9]{64}$'),
  output jsonb,output_hash text check (output_hash is null or output_hash ~ '^[a-f0-9]{64}$'),
  error_code text,history jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
  primary key(job_id,step_key)
);
alter table public.future_book_pdfs add column print_job_id uuid
  references public.future_book_print_jobs(id) on delete set null;
create unique index future_book_pdf_print_job on public.future_book_pdfs(print_job_id) where print_job_id is not null;
alter table public.future_book_print_jobs enable row level security;
alter table public.future_book_print_steps enable row level security;
revoke all on public.future_book_print_jobs,public.future_book_print_steps from anon,authenticated;
grant all on public.future_book_print_jobs,public.future_book_print_steps to service_role;

create function public.caronte_enqueue_print(p_session_id uuid,p_manuscript_id uuid,
  p_manuscript_revision timestamptz,p_source jsonb,p_source_sha256 text,p_input_hash text,
  p_stages_version text,p_environment text,p_configuration_tag text,p_pod_package_id text)
returns public.future_book_print_jobs
language plpgsql security definer set search_path=public,pg_temp as $$
declare m public.future_book_manuscripts;j public.future_book_print_jobs;reserved_version integer;
begin
  perform 1 from public.future_book_sessions where id=p_session_id
    and status in ('book_ready','pdf_generating','pending_review','approved','released_to_customer','blocked') for update;
  if not found then raise exception 'print_manuscript_not_approved';end if;
  select * into m from public.future_book_manuscripts where id=p_manuscript_id and session_id=p_session_id for share;
  if m.id is null or m.status<>'ready' or m.quality_report->>'editorial_gate' is distinct from 'pass'
    or m.provider_chain->>'degraded'='true' or m.provider_chain->>'drafting' in ('deterministic','openai_failed')
    or m.quality_report->>'status' in ('degraded_provider_fallback','blocked_safety','needs_caronte_rewrite')
    or m.manuscript->>'prompt_version' is distinct from 'caronte-literary-v2'
    or jsonb_typeof(m.manuscript->'sections') is distinct from 'array' or jsonb_array_length(m.manuscript->'sections')<>5
    then raise exception 'print_manuscript_not_approved';end if;
  if m.updated_at is distinct from p_manuscript_revision or m.manuscript is distinct from p_source
    then raise exception 'print_source_changed';end if;
  select * into j from public.future_book_print_jobs where session_id=p_session_id and input_hash=p_input_hash;
  if j.id is not null then return j;end if;
  if exists(select 1 from public.future_book_print_jobs where session_id=p_session_id and status in ('queued','running','blocked'))
    then raise exception 'active_print_source_changed';end if;
  select greatest(coalesce((select max(version) from public.future_book_pdfs where session_id=p_session_id),0),
    coalesce((select max(version) from public.future_book_print_jobs where session_id=p_session_id),0))+1 into reserved_version;
  insert into public.future_book_print_jobs(session_id,manuscript_id,manuscript_revision,version,
    source_snapshot,source_sha256,input_hash,stages_version,lulu_environment,lulu_configuration_tag,pod_package_id)
    values(p_session_id,p_manuscript_id,p_manuscript_revision,reserved_version,m.manuscript,p_source_sha256,p_input_hash,
      p_stages_version,p_environment,p_configuration_tag,p_pod_package_id) returning * into j;
  update public.future_book_sessions set status='pdf_generating',pdf_review_status='not_generated',
    error_code=null,updated_at=now() where id=p_session_id;
  return j;
end;$$;

create function public.caronte_claim_print_job(p_job_id uuid default null)
returns public.future_book_print_jobs
language plpgsql security definer set search_path=public,pg_temp as $$
declare j public.future_book_print_jobs;m public.future_book_manuscripts;
begin
  select * into j from public.future_book_print_jobs where status in ('queued','running')
    and next_run_at<=clock_timestamp() and (lease_until is null or lease_until<clock_timestamp())
    and (p_job_id is null or id=p_job_id) order by next_run_at,created_at for update skip locked limit 1;
  if j.id is null then return null;end if;
  select * into m from public.future_book_manuscripts where id=j.manuscript_id;
  if m.id is null or m.status<>'ready' or m.updated_at<>j.manuscript_revision or m.manuscript<>j.source_snapshot
    or m.quality_report->>'editorial_gate' is distinct from 'pass' or m.provider_chain->>'degraded'='true' then
    update public.future_book_print_jobs set status='blocked',error_code='print_source_changed',
      lease_token=null,lease_until=null,updated_at=now() where id=j.id;return null;
  end if;
  update public.future_book_print_jobs set status='running',lease_token=gen_random_uuid(),
    lease_until=clock_timestamp()+interval '140 seconds',updated_at=now() where id=j.id returning * into j;
  return j;
end;$$;

create function public.caronte_checkpoint_print_job(p_job_id uuid,p_lease_token uuid,p_step jsonb,
  p_state text,p_delay_seconds integer default 0) returns boolean
language plpgsql security definer set search_path=public,pg_temp as $$
declare j public.future_book_print_jobs;previous public.future_book_print_steps;
begin
  select * into j from public.future_book_print_jobs where id=p_job_id and status='running'
    and lease_token=p_lease_token and lease_until>clock_timestamp() for update;
  if j.id is null then raise exception 'lease_lost';end if;
  if not exists(select 1 from public.future_book_manuscripts where id=j.manuscript_id and status='ready'
    and updated_at=j.manuscript_revision and manuscript=j.source_snapshot and quality_report->>'editorial_gate'='pass')
    then raise exception 'print_source_changed';end if;
  if p_state is null or p_state not in ('running','queued','blocked')
    or p_step->>'status' is null or p_step->>'status' not in ('started','completed','failed')
    or coalesce(p_step->>'step_key','') !~ '^(plan:[0-4]:(12(\.5)?|13(\.5)?|14)|compose|part:[0-9]+:[0-9]+|interior|cover|finish|gate)$'
    or p_step->>'stage' is null or p_step->>'stage' not in ('plan','compose','part','interior','cover','finish','gate')
    then raise exception 'print_step_contract';end if;
  if p_step->>'stage'<>'gate' and coalesce(p_step->>'input_hash','') !~ '^[a-f0-9]{64}$'
    then raise exception 'print_step_contract';end if;
  if p_step->'output' is not null and p_step->'output'<>'null'::jsonb and
    (jsonb_typeof(p_step->'output')<>'object' or coalesce(p_step->>'output_hash','') !~ '^[a-f0-9]{64}$'
      or (p_step->'output') ? 'bytes') then raise exception 'print_step_contract';end if;
  if p_step->>'status'='completed' and (p_step->'output' is null or p_step->'output'='null'::jsonb)
    then raise exception 'print_step_contract';end if;
  select * into previous from public.future_book_print_steps where job_id=p_job_id and step_key=p_step->>'step_key' for update;
  if previous.status='completed' then raise exception 'completed_step_is_immutable';end if;
  if previous.input_hash is not null and previous.input_hash is distinct from p_step->>'input_hash'
    then raise exception 'print_step_input_changed';end if;
  if previous.output is not null and previous.output<>'null'::jsonb
    and (previous.output-'storage_verified') is distinct from ((p_step->'output')-'storage_verified')
    then raise exception 'print_step_output_changed';end if;
  if previous.attempt is not null and (p_step->>'attempt')::integer<previous.attempt
    then raise exception 'print_step_contract';end if;
  if p_step->>'status'='completed' and p_step->>'stage' in ('part','interior','cover')
    and p_step->'output'->>'storage_verified' is distinct from 'true' then raise exception 'print_step_contract';end if;
  insert into public.future_book_print_steps(job_id,step_key,stage,status,attempt,input_hash,output,output_hash,error_code)
    values(p_job_id,p_step->>'step_key',p_step->>'stage',p_step->>'status',(p_step->>'attempt')::integer,
      p_step->>'input_hash',p_step->'output',p_step->>'output_hash',p_step->>'error_code')
    on conflict(job_id,step_key) do update set status=excluded.status,attempt=excluded.attempt,
      input_hash=excluded.input_hash,output=excluded.output,output_hash=excluded.output_hash,error_code=excluded.error_code,
      history=future_book_print_steps.history||jsonb_build_array(jsonb_build_object('at',now(),
        'status',future_book_print_steps.status,'attempt',future_book_print_steps.attempt,
        'output_hash',future_book_print_steps.output_hash,'error_code',future_book_print_steps.error_code)),updated_at=now();
  update public.future_book_print_jobs set status=p_state,stage=p_step->>'stage',error_code=p_step->>'error_code',
    lease_token=case when p_state='running' then lease_token else null end,
    lease_until=case when p_state='running' then lease_until else null end,
    next_run_at=now()+make_interval(secs=>greatest(0,least(p_delay_seconds,3600))),updated_at=now() where id=p_job_id;
  return true;
end;$$;

-- Operator-only control. Audit, retry budget and state change share one transaction.
-- Only blocked/unleased work may be changed; completed receipts and object intents
-- are retained. Cancellation does not delete data, cancel a Lulu order or refund.
create function public.caronte_control_print_job(p_job_id uuid,p_expected_revision text,
  p_action text,p_reason text,p_actor jsonb) returns public.future_book_print_jobs
language plpgsql security definer set search_path=public,pg_temp as $$
declare j public.future_book_print_jobs;m public.future_book_manuscripts;decision jsonb;changed_at timestamptz;
begin
  if p_action is null or p_action not in ('resume','cancel') or p_reason is null
    or length(trim(p_reason)) not between 8 and 1000 or p_expected_revision is null
    or length(p_expected_revision)>80 or jsonb_typeof(p_actor) is distinct from 'object'
    or p_actor->>'role' is null or p_actor->>'role' not in ('ops','owner','legacy_token','local_admin')
    then raise exception 'print_control_not_allowed';end if;
  perform 1 from public.future_book_sessions where id=(select session_id from public.future_book_print_jobs where id=p_job_id) for update;
  select * into j from public.future_book_print_jobs where id=p_job_id for update;
  if j.id is null then raise exception 'print_job_not_found';end if;
  if j.updated_at is distinct from p_expected_revision::timestamptz then raise exception 'print_control_conflict';end if;
  if j.status<>'blocked' or j.lease_token is not null or j.lease_until is not null then raise exception 'print_control_not_allowed';end if;
  changed_at:=greatest(clock_timestamp(),j.updated_at+interval '1 microsecond');
  decision:=jsonb_build_object('action',p_action,'previousRevision',p_expected_revision,'at',changed_at,'reason',trim(p_reason),'actor',p_actor);
  if p_action='resume' then
    if j.error_code is null or j.error_code not in ('print_archive_unverified','print_archive_timeout')
      or (select count(*) from public.future_book_print_steps where job_id=j.id and status='failed')<>1
      or not exists(select 1 from public.future_book_print_steps where job_id=j.id and status='failed'
        and stage<>'gate' and error_code=j.error_code) then raise exception 'print_control_not_allowed';end if;
    select * into m from public.future_book_manuscripts where id=j.manuscript_id for share;
    if m.id is null or m.status<>'ready' or m.updated_at is distinct from j.manuscript_revision
      or m.manuscript is distinct from j.source_snapshot or m.quality_report->>'editorial_gate' is distinct from 'pass'
      or m.provider_chain->>'degraded'='true' or m.provider_chain->>'drafting' in ('deterministic','openai_failed')
      or m.quality_report->>'status' in ('degraded_provider_fallback','blocked_safety','needs_caronte_rewrite')
      then raise exception 'print_source_changed';end if;
    update public.future_book_print_steps set history=history||jsonb_build_array(jsonb_build_object(
      'at',changed_at,'status',status,'attempt',attempt,'error_code',error_code,'output_hash',output_hash,'control','resume')),
      status='started',attempt=0,error_code=null,updated_at=changed_at where job_id=j.id and status='failed';
  end if;
  update public.future_book_print_jobs set status=case when p_action='resume' then 'queued' else 'cancelled' end,
    error_code=null,next_run_at=changed_at,control_history=control_history||jsonb_build_array(decision),updated_at=changed_at
    where id=j.id returning * into j;
  update public.future_book_sessions set status=case when p_action='resume' then 'pdf_generating' else 'book_ready' end,
    pdf_review_status='not_generated',error_code=null,updated_at=changed_at where id=j.session_id and status='pdf_generating';
  return j;
end;$$;

-- This also fences legacy writers: they cannot consume a reserved version.
create function public.caronte_pdf_reservation_guard() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if new.print_job_id is null then
    if tg_op='UPDATE' and old.print_job_id is not null
      and not exists(select 1 from public.future_book_print_jobs where id=old.print_job_id) then return new;end if;
    if exists(select 1 from public.future_book_print_jobs where session_id=new.session_id and version=new.version)
      then raise exception 'print_reserved_version';end if;
  elsif not exists(select 1 from public.future_book_print_jobs where id=new.print_job_id and pdf_id=new.id
    and session_id=new.session_id and manuscript_id=new.manuscript_id and version=new.version) then
    raise exception 'print_pdf_reservation_mismatch';
  end if;
  return new;
end;$$;
create trigger caronte_pdf_reservation_guard before insert or update of id,session_id,manuscript_id,version,print_job_id
  on public.future_book_pdfs for each row execute function public.caronte_pdf_reservation_guard();

create function public.caronte_finish_print_job(p_job_id uuid,p_lease_token uuid,p_pdf jsonb) returns uuid
language plpgsql security definer set search_path=public,pg_temp as $$
declare j public.future_book_print_jobs;inside jsonb;cover jsonb;layout jsonb;prefix text;pages integer;
  chapter integer;font_size text;page_start integer;
begin
  -- Use the same session-first lock order as enqueue before taking the job lock.
  perform 1 from public.future_book_sessions where id=(select session_id from public.future_book_print_jobs where id=p_job_id) for update;
  select * into j from public.future_book_print_jobs where id=p_job_id and status='running'
    and lease_token=p_lease_token and lease_until>clock_timestamp() for update;
  if j.id is null then raise exception 'lease_lost';end if;
  perform 1 from public.future_book_manuscripts where id=j.manuscript_id and status='ready'
    and updated_at=j.manuscript_revision and manuscript=j.source_snapshot and quality_report->>'editorial_gate'='pass' for share;
  if not found then raise exception 'print_source_changed';end if;
  select output into inside from public.future_book_print_steps where job_id=j.id and step_key='interior' and status='completed';
  select output into cover from public.future_book_print_steps where job_id=j.id and step_key='cover' and status='completed';
  select output into layout from public.future_book_print_steps where job_id=j.id and step_key='compose' and status='completed';
  pages:=(inside->>'pageCount')::integer;
  if pages is null or pages not between 180 and 200 or pages%2<>0 or (cover->>'pageCount')::integer is distinct from 1
    or inside->>'storage_verified' is distinct from 'true' or cover->>'storage_verified' is distinct from 'true'
    or layout->>'proof' is distinct from 'false' or jsonb_array_length(layout->'layout'->'pages') is distinct from pages
    then raise exception 'print_parts_incomplete';end if;
  for chapter in 0..4 loop foreach font_size in array array['12','12.5','13','13.5','14'] loop
    if not exists(select 1 from public.future_book_print_steps where job_id=j.id
      and step_key='plan:'||chapter||':'||font_size and status='completed') then raise exception 'print_parts_incomplete';end if;
  end loop;end loop;
  for page_start in select generate_series(1,pages,10) loop
    if not exists(select 1 from public.future_book_print_steps where job_id=j.id
      and step_key='part:'||page_start||':'||least(page_start+9,pages) and status='completed'
      and output->>'storage_verified'='true') then raise exception 'print_parts_incomplete';end if;
  end loop;
  prefix:=j.session_id||'/v'||lpad(j.version::text,greatest(2,length(j.version::text)),'0')||'/'||j.id||'/';
  if p_pdf->>'id' is distinct from j.pdf_id::text or p_pdf->>'session_id' is distinct from j.session_id::text
    or p_pdf->>'manuscript_id' is distinct from j.manuscript_id::text or p_pdf->>'print_job_id' is distinct from j.id::text
    or (p_pdf->>'version')::integer is distinct from j.version or (p_pdf->>'page_count')::integer is distinct from pages
    or p_pdf->>'storage_path' is distinct from prefix||'interior.pdf'
    or inside->>'path' is distinct from prefix||'interior.pdf' or cover->>'path' is distinct from prefix||'cover.pdf'
    or p_pdf->'print_validation'->>'source_sha256' is distinct from j.source_sha256
    or inside->>'sourceFingerprint' is distinct from j.source_sha256 or cover->>'sourceFingerprint' is distinct from j.source_sha256
    or p_pdf->'print_validation'->>'interior_sha256' is distinct from inside->>'sha256'
    or p_pdf->'print_validation'->>'cover_sha256' is distinct from cover->>'sha256'
    or p_pdf->'print_validation'->>'ready_for_print' is distinct from 'false'
    or p_pdf->'lulu_metadata'->>'ready_for_print' is distinct from 'false'
    or p_pdf->'lulu_metadata'->>'send_to_lulu' is distinct from 'false'
    or p_pdf->'lulu_metadata'->>'environment' is distinct from j.lulu_environment
    or p_pdf->'lulu_metadata'->>'pod_package_id' is distinct from j.pod_package_id
    or p_pdf->'lulu_metadata'->>'cover_pdf_storage_path' is distinct from cover->>'path'
    or p_pdf->'metadata'->>'print_job_id' is distinct from j.id::text
    or p_pdf->'metadata'->>'lulu_credential_tag' is distinct from j.lulu_configuration_tag
    or p_pdf->>'status' is distinct from 'generated' or p_pdf->>'review_status' is distinct from 'pending_review'
    then raise exception 'print_pdf_reservation_mismatch';end if;
  insert into public.future_book_pdfs(id,print_job_id,session_id,manuscript_id,version,status,review_status,
    file_name,mime_type,pdf_base64,page_count,page_size,storage_path,print_validation,lulu_metadata,quality_report,metadata)
    values(j.pdf_id,j.id,j.session_id,j.manuscript_id,j.version,'generated','pending_review',p_pdf->>'file_name',
      'application/pdf',null,pages,'A5',prefix||'interior.pdf',p_pdf->'print_validation',p_pdf->'lulu_metadata',
      p_pdf->'quality_report',p_pdf->'metadata');
  update public.future_book_print_jobs set status='ready',stage='finish',lease_token=null,lease_until=null,
    error_code=null,updated_at=now() where id=j.id;
  update public.future_book_sessions set status='pending_review',pdf_review_status='pending_review',pdf_ready_at=now(),
    error_code=null,updated_at=now() where id=j.session_id;
  return j.pdf_id;
end;$$;

revoke all on function public.caronte_enqueue_print(uuid,uuid,timestamptz,jsonb,text,text,text,text,text,text) from public,anon,authenticated;
revoke all on function public.caronte_claim_print_job(uuid) from public,anon,authenticated;
revoke all on function public.caronte_checkpoint_print_job(uuid,uuid,jsonb,text,integer) from public,anon,authenticated;
revoke all on function public.caronte_finish_print_job(uuid,uuid,jsonb) from public,anon,authenticated;
revoke all on function public.caronte_pdf_reservation_guard() from public,anon,authenticated;
revoke all on function public.caronte_control_print_job(uuid,text,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.caronte_enqueue_print(uuid,uuid,timestamptz,jsonb,text,text,text,text,text,text) to service_role;
grant execute on function public.caronte_claim_print_job(uuid) to service_role;
grant execute on function public.caronte_checkpoint_print_job(uuid,uuid,jsonb,text,integer) to service_role;
grant execute on function public.caronte_finish_print_job(uuid,uuid,jsonb) to service_role;
grant execute on function public.caronte_control_print_job(uuid,text,text,text,jsonb) to service_role;
comment on table public.future_book_print_jobs is 'Private source snapshots, reserved versions and recoverable print stages. No direct client access.';
comment on table public.future_book_print_steps is 'Expected object intents before write; exact receipts before completion. Hashes are integrity, not authentication.';
