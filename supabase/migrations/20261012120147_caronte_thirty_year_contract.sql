-- Approved 30-year contract. Additive replacement; no row rewrites or shared Auth changes.
-- Historical v2 manuscripts retain their original 40-year / 180-200-page contract.

create or replace function public.caronte_finish_book_job(
  p_job_id uuid, p_lease_token uuid, p_manuscript jsonb, p_quality_report jsonb, p_provider_chain jsonb
) returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare current_job public.future_book_jobs; created_manuscript_id uuid; page_min integer;page_max integer;word_min integer;word_max integer;
begin
  select * into current_job from public.future_book_jobs where id=p_job_id
    and lease_token=p_lease_token and lease_until>now() and status='running' for update;
  if current_job.id is null then raise exception 'lease_lost'; end if;
  if p_quality_report->>'editorial_gate' is distinct from 'pass' then raise exception 'editorial_gate_required'; end if;
  if jsonb_typeof(p_manuscript->'sections') is distinct from 'array' then raise exception 'manuscript_sections_required'; end if;
  if jsonb_array_length(p_manuscript->'sections')<>5 then raise exception 'five_chapters_required'; end if;
  if current_job.prompt_version='caronte-longform-v2' then
    if current_job.model_config->'literaryContract' is distinct from '{"version":"caronte-literary-v3","horizonYears":30,"chapters":5,"unitsPerChapter":6,"unitWords":{"min":1800,"max":2200},"manuscriptWords":{"min":55000,"max":65000},"physicalPages":{"min":216,"max":224,"target":220},"reviewMinimum":4}'::jsonb
      then raise exception 'book_contract_unsupported';end if;
    page_min:=216;page_max:=224;word_min:=55000;word_max:=65000;
    if p_manuscript->>'prompt_version' is distinct from 'caronte-literary-v3'
      or coalesce((p_manuscript->>'future_age')::integer-(p_manuscript->>'current_age')::integer,-1)<>30
      or (p_manuscript->>'narrative_year')::integer is distinct from
        extract(year from (current_job.interview->>'interviewDate')::timestamptz)::integer+30
      or p_manuscript->'target_pages' is distinct from '{"min":216,"max":224,"verified":false}'::jsonb
      or p_quality_report->'page_target' is distinct from p_manuscript->'target_pages'
      or p_provider_chain->>'degraded'='true' then raise exception 'book_contract_mismatch';end if;
  elsif current_job.prompt_version='caronte-longform-v1' and p_manuscript->>'prompt_version'='caronte-literary-v2' then
    page_min:=180;page_max:=200;word_min:=45000;word_max:=55000;
  else raise exception 'book_contract_unsupported';end if;
  if coalesce((p_manuscript->>'word_count')::integer,0) not between word_min and word_max
    then raise exception 'manuscript_word_count';end if;
  insert into public.future_book_manuscripts(session_id,book_job_id,status,title,manuscript,
    quality_report,provider_chain,prompt_version,page_target_min,page_target_max)
    values(current_job.session_id,p_job_id,'ready',p_manuscript->>'title',p_manuscript,
      p_quality_report,p_provider_chain,current_job.prompt_version,page_min,page_max)
    returning id into created_manuscript_id;
  update public.future_book_jobs set status='ready',stage='manuscript',manuscript_id=created_manuscript_id,
    lease_until=null,lease_token=null,error_code=null,updated_at=now() where id=p_job_id;
  update public.future_book_sessions set status='book_ready',book_status='ready',
    book_generation_completed_at=now(),error_code=null,updated_at=now() where id=current_job.session_id;
  return created_manuscript_id;
end;
$$;

create or replace function public.caronte_enqueue_print(p_session_id uuid,p_manuscript_id uuid,
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
    or coalesce(m.manuscript->>'prompt_version','') not in ('caronte-literary-v2','caronte-literary-v3')
    or jsonb_typeof(m.manuscript->'sections') is distinct from 'array' or jsonb_array_length(m.manuscript->'sections')<>5
    then raise exception 'print_manuscript_not_approved';end if;
  if m.manuscript->>'prompt_version'='caronte-literary-v3' and (
    coalesce((m.manuscript->>'word_count')::integer,0) not between 55000 and 65000
    or coalesce((m.manuscript->>'future_age')::integer-(m.manuscript->>'current_age')::integer,-1)<>30
    or m.page_target_min is distinct from 216 or m.page_target_max is distinct from 224
    or m.manuscript->'target_pages' is distinct from '{"min":216,"max":224,"verified":false}'::jsonb)
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

create or replace function public.caronte_checkpoint_print_job(p_job_id uuid,p_lease_token uuid,p_step jsonb,
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
    or coalesce(p_step->>'step_key','') !~ '^(plan:[0-4]:(1[23](\.[1-9])?|14)|compose|part:[0-9]+:[0-9]+|interior|cover|finish|gate)$'
    or p_step->>'stage' is null or p_step->>'stage' not in ('plan','compose','part','interior','cover','finish','gate')
    then raise exception 'print_step_contract';end if;
  if p_step->>'stage'='plan' and (
    (j.source_snapshot->>'prompt_version'='caronte-literary-v2'
      and p_step->>'step_key' !~ '^plan:[0-4]:(12(\.5)?|13(\.5)?|14)$')
    or coalesce(j.source_snapshot->>'prompt_version','') not in ('caronte-literary-v2','caronte-literary-v3'))
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

create or replace function public.caronte_finish_print_job(p_job_id uuid,p_lease_token uuid,p_pdf jsonb) returns uuid
language plpgsql security definer set search_path=public,pg_temp as $$
declare j public.future_book_print_jobs;inside jsonb;cover jsonb;layout jsonb;prefix text;pages integer;
  chapter integer;font_size text;page_start integer;page_min integer;page_max integer;font_sizes text[];
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
  if j.source_snapshot->>'prompt_version'='caronte-literary-v3' then
    page_min:=216;page_max:=224;
    select array_agg(case when n%10=0 then (n/10)::text else (n/10.0)::numeric(3,1)::text end order by n)
      into font_sizes from generate_series(120,140) n;
    if p_pdf->'metadata'->>'literary_contract_version' is distinct from 'caronte-literary-v3'
      then raise exception 'print_pdf_reservation_mismatch';end if;
  elsif j.source_snapshot->>'prompt_version'='caronte-literary-v2' then
    page_min:=180;page_max:=200;font_sizes:=array['12','12.5','13','13.5','14'];
  else raise exception 'print_manuscript_not_approved';end if;
  pages:=(inside->>'pageCount')::integer;
  if pages is null or pages not between page_min and page_max or pages%2<>0 or (cover->>'pageCount')::integer is distinct from 1
    or inside->>'storage_verified' is distinct from 'true' or cover->>'storage_verified' is distinct from 'true'
    or layout->>'proof' is distinct from 'false' or jsonb_array_length(layout->'layout'->'pages') is distinct from pages
    then raise exception 'print_parts_incomplete';end if;
  for chapter in 0..4 loop foreach font_size in array font_sizes loop
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

revoke all on function public.caronte_finish_book_job(uuid,uuid,jsonb,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.caronte_finish_book_job(uuid,uuid,jsonb,jsonb,jsonb) to service_role;
revoke all on function public.caronte_enqueue_print(uuid,uuid,timestamptz,jsonb,text,text,text,text,text,text) from public,anon,authenticated;
grant execute on function public.caronte_enqueue_print(uuid,uuid,timestamptz,jsonb,text,text,text,text,text,text) to service_role;
revoke all on function public.caronte_checkpoint_print_job(uuid,uuid,jsonb,text,integer) from public,anon,authenticated;
grant execute on function public.caronte_checkpoint_print_job(uuid,uuid,jsonb,text,integer) to service_role;
revoke all on function public.caronte_finish_print_job(uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.caronte_finish_print_job(uuid,uuid,jsonb) to service_role;
