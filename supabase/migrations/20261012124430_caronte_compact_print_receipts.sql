create or replace function public.caronte_checkpoint_print_job(p_job_id uuid,p_lease_token uuid,p_step jsonb,
  p_state text,p_delay_seconds integer default 0) returns boolean
language plpgsql security definer set search_path=public,pg_temp as $$
declare j public.future_book_print_jobs;previous public.future_book_print_steps;original public.future_book_print_steps;
begin
  select * into j from public.future_book_print_jobs where id=p_job_id and status='running'
    and lease_token=p_lease_token and lease_until>clock_timestamp() for update;
  if j.id is null then raise exception 'lease_lost';end if;
  if not exists(select 1 from public.future_book_manuscripts where id=j.manuscript_id and status='ready'
    and updated_at=j.manuscript_revision and manuscript=j.source_snapshot and quality_report->>'editorial_gate'='pass')
    then raise exception 'print_source_changed';end if;
  if p_state is null or p_state not in ('running','queued','blocked')
    or p_step->>'status' is null or p_step->>'status' not in ('started','completed','failed')
    or coalesce(p_step->>'step_key','') !~ '^((plan|geometry):[0-4]:(1[23](\.[1-9])?|14)|compose|part:[0-9]+:[0-9]+|interior|cover|finish|gate)$'
    or p_step->>'stage' is null or p_step->>'stage' not in ('plan','compose','part','interior','cover','finish','gate')
    then raise exception 'print_step_contract';end if;
  if p_step->>'stage'='plan' and (
    (j.source_snapshot->>'prompt_version'='caronte-literary-v2'
      and p_step->>'step_key' !~ '^(plan|geometry):[0-4]:(12(\.5)?|13(\.5)?|14)$')
    or coalesce(j.source_snapshot->>'prompt_version','') not in ('caronte-literary-v2','caronte-literary-v3'))
    then raise exception 'print_step_contract';end if;
  if p_step->>'stage'<>'gate' and coalesce(p_step->>'input_hash','') !~ '^[a-f0-9]{64}$'
    then raise exception 'print_step_contract';end if;
  if p_step->'output' is not null and p_step->'output'<>'null'::jsonb and
    (jsonb_typeof(p_step->'output')<>'object' or coalesce(p_step->>'output_hash','') !~ '^[a-f0-9]{64}$'
      or (p_step->'output') ? 'bytes') then raise exception 'print_step_contract';end if;
  if p_step->>'status'='completed' and (p_step->'output' is null or p_step->'output'='null'::jsonb)
    then raise exception 'print_step_contract';end if;
  if p_step->>'step_key' like 'geometry:%' then
    if p_step->>'stage' is distinct from 'plan' then raise exception 'print_step_contract';end if;
    if p_step->>'status'='completed' then
      select * into original from public.future_book_print_steps where job_id=j.id
        and step_key=replace(p_step->>'step_key','geometry:','plan:') and status='completed' for share;
      if original.job_id is null or jsonb_typeof(original.output->'candidates'->0->'pages') is distinct from 'array'
        or p_step->'output'->>'format' is distinct from 'chapter-counts-v1'
        or p_step->'output'->>'originalPlanKey' is distinct from original.step_key
        or p_step->'output'->>'originalPlanHash' is distinct from original.output_hash
        or p_step->'output'->>'sourceFingerprint' is distinct from j.source_sha256
        or p_step->'output'->>'fontFingerprint' is distinct from original.output->>'fontFingerprint'
        or (p_step->'output'->'candidates'->0->>'pageCount')::integer is distinct from jsonb_array_length(original.output->'candidates'->0->'pages')
        or p_step->'output'->'candidates'->0->'size' is distinct from original.output->'candidates'->0->'size'
        or p_step->'output'->'candidates'->0->'leading' is distinct from original.output->'candidates'->0->'leading'
        or p_step->'output'->'candidates'->0->'paragraphCount' is distinct from original.output->'candidates'->0->'paragraphCount'
        then raise exception 'print_geometry_receipt_mismatch';end if;
    end if;
  end if;
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

revoke all on function public.caronte_checkpoint_print_job(uuid,uuid,jsonb,text,integer) from public,anon,authenticated;
grant execute on function public.caronte_checkpoint_print_job(uuid,uuid,jsonb,text,integer) to service_role;

