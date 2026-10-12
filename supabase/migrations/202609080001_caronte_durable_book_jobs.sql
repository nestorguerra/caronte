create table public.future_book_jobs (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.future_book_sessions(id) on delete cascade,
  interview_hash text not null check (interview_hash ~ '^[a-f0-9]{64}$'),
  interview jsonb not null check (jsonb_typeof(interview) = 'object'),
  prompt_version text not null,
  model_config jsonb not null default '{}'::jsonb,
  status text not null default 'queued' check (status in ('queued','running','blocked','ready','cancelled')),
  stage text not null default 'biography',
  error_code text,
  lease_token uuid,
  lease_until timestamptz,
  next_run_at timestamptz not null default now(),
  manuscript_id uuid references public.future_book_manuscripts(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (session_id, interview_hash, prompt_version)
);

create table public.future_book_job_steps (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.future_book_jobs(id) on delete cascade,
  step_key text not null,
  stage text not null,
  unit_id text,
  status text not null check (status in ('started','waiting','completed','failed','retry')),
  attempt integer not null default 0 check (attempt between 0 and 20),
  provider text,
  model text,
  provider_request_id text,
  input_hash text check (input_hash is null or input_hash ~ '^[a-f0-9]{64}$'),
  output jsonb,
  usage jsonb not null default '{}'::jsonb,
  diagnostic jsonb,
  error_code text,
  history jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (job_id, step_key)
);

create index future_book_jobs_queue on public.future_book_jobs(next_run_at, created_at)
  where status in ('queued','running');
create unique index future_book_jobs_one_active on public.future_book_jobs(session_id)
  where status in ('queued','running','blocked');
create index future_book_job_steps_order on public.future_book_job_steps(job_id, created_at);
alter table public.future_book_manuscripts add column book_job_id uuid
  references public.future_book_jobs(id) on delete set null;
create unique index future_book_manuscript_job on public.future_book_manuscripts(book_job_id)
  where book_job_id is not null;
alter table public.future_book_jobs enable row level security;
alter table public.future_book_job_steps enable row level security;
revoke all on public.future_book_jobs, public.future_book_job_steps from anon, authenticated;
grant all on public.future_book_jobs, public.future_book_job_steps to service_role;

create function public.caronte_enqueue_book(
  p_session_id uuid, p_interview_hash text, p_interview jsonb,
  p_prompt_version text, p_model_config jsonb
) returns public.future_book_jobs
language plpgsql security definer set search_path = public, pg_temp as $$
declare result public.future_book_jobs; active_job public.future_book_jobs;
begin
  perform 1 from public.future_book_sessions where id = p_session_id
    and status in ('interview_completed','book_generating','book_ready','blocked') for update;
  if not found then raise exception 'interview_not_completed'; end if;
  if jsonb_typeof(p_interview->'sources') is distinct from 'array'
    or jsonb_array_length(p_interview->'sources') = 0 then raise exception 'interview_sources_required'; end if;
  if nullif(p_model_config->>'writerModel','') is null
    or nullif(p_model_config->>'reviewerModel','') is null then raise exception 'model_configuration_required'; end if;
  select * into active_job from public.future_book_jobs where session_id=p_session_id
    and status in ('queued','running','blocked');
  if active_job.id is not null and (active_job.interview_hash<>p_interview_hash or active_job.prompt_version<>p_prompt_version)
    then raise exception 'active_book_interview_changed'; end if;
  if active_job.id is not null then return active_job; end if;
  insert into public.future_book_jobs(session_id, interview_hash, interview, prompt_version, model_config)
    values (p_session_id, p_interview_hash, p_interview, p_prompt_version, p_model_config)
    on conflict (session_id, interview_hash, prompt_version) do nothing;
  select * into result from public.future_book_jobs where session_id = p_session_id
    and interview_hash = p_interview_hash and prompt_version = p_prompt_version;
  if result.status in ('queued','running') then
    update public.future_book_sessions set status='book_generating', book_status='queued',
      book_generation_started_at=coalesce(book_generation_started_at,now()), updated_at=now()
      where id=p_session_id;
  end if;
  return result;
end;
$$;

create function public.caronte_claim_book_job(p_job_id uuid default null)
returns public.future_book_jobs
language plpgsql security definer set search_path = public, pg_temp as $$
declare result public.future_book_jobs;
begin
  select * into result from public.future_book_jobs
    where status in ('queued','running') and next_run_at<=now()
      and (lease_until is null or lease_until<now())
      and (p_job_id is null or id=p_job_id)
    order by next_run_at,created_at for update skip locked limit 1;
  if result.id is null then return null; end if;
  update public.future_book_jobs set status='running', lease_token=gen_random_uuid(),
    lease_until=now()+interval '140 seconds', updated_at=now() where id=result.id returning * into result;
  return result;
end;
$$;

create function public.caronte_checkpoint_book_job(
  p_job_id uuid, p_lease_token uuid, p_step jsonb, p_state text,
  p_delay_seconds integer default 0
) returns boolean
language plpgsql security definer set search_path = public, pg_temp as $$
declare current_job public.future_book_jobs; previous public.future_book_job_steps;
begin
  select * into current_job from public.future_book_jobs where id=p_job_id
    and lease_token=p_lease_token and lease_until>now() and status='running' for update;
  if current_job.id is null then raise exception 'lease_lost'; end if;
  if p_state is null or p_state not in ('queued','running','blocked') then raise exception 'invalid_job_state'; end if;
  if coalesce(length(p_step->>'step_key'),0) not between 1 and 120 then raise exception 'invalid_step_key'; end if;
  if p_step->>'status'='completed' and (p_step->'output' is null or p_step->'output'='null'::jsonb
    or p_step->>'input_hash' is null) then raise exception 'completed_step_receipt_required'; end if;
  select * into previous from public.future_book_job_steps
    where job_id=p_job_id and step_key=p_step->>'step_key' for update;
  if previous.status='completed' then raise exception 'completed_step_is_immutable'; end if;
  insert into public.future_book_job_steps(job_id,step_key,stage,unit_id,status,attempt,
    provider,model,provider_request_id,input_hash,output,usage,diagnostic,error_code)
    values (p_job_id,p_step->>'step_key',p_step->>'stage',p_step->>'unit_id',p_step->>'status',
      coalesce((p_step->>'attempt')::integer,0),p_step->>'provider',p_step->>'model',
      p_step->>'provider_request_id',p_step->>'input_hash',p_step->'output',
      coalesce(p_step->'usage','{}'::jsonb),p_step->'diagnostic',p_step->>'error_code')
    on conflict (job_id,step_key) do update set
      status=excluded.status,attempt=excluded.attempt,provider=excluded.provider,
      model=excluded.model,provider_request_id=excluded.provider_request_id,
      input_hash=coalesce(excluded.input_hash,future_book_job_steps.input_hash),
      output=excluded.output,usage=excluded.usage,diagnostic=excluded.diagnostic,error_code=excluded.error_code,
      history=future_book_job_steps.history || jsonb_build_array(jsonb_build_object(
        'at',now(),'status',future_book_job_steps.status,'attempt',future_book_job_steps.attempt,
        'provider_request_id',future_book_job_steps.provider_request_id,'usage',future_book_job_steps.usage,
        'error_code',future_book_job_steps.error_code)), updated_at=now();
  update public.future_book_jobs set status=p_state, stage=p_step->>'stage',
    error_code=p_step->>'error_code', next_run_at=now()+make_interval(secs=>greatest(0,least(p_delay_seconds,3600))),
    lease_token=case when p_state='running' then lease_token else null end,
    lease_until=case when p_state='running' then lease_until else null end, updated_at=now() where id=p_job_id;
  update public.future_book_sessions set status=case when p_state='blocked' then 'blocked' else 'book_generating' end,
    book_status=case when p_state='blocked' then 'failed' else 'generating' end,
    error_code=p_step->>'error_code', updated_at=now() where id=current_job.session_id;
  return true;
end;
$$;

create function public.caronte_finish_book_job(
  p_job_id uuid, p_lease_token uuid, p_manuscript jsonb, p_quality_report jsonb, p_provider_chain jsonb
) returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare current_job public.future_book_jobs; created_manuscript_id uuid;
begin
  select * into current_job from public.future_book_jobs where id=p_job_id
    and lease_token=p_lease_token and lease_until>now() and status='running' for update;
  if current_job.id is null then raise exception 'lease_lost'; end if;
  if p_quality_report->>'editorial_gate' is distinct from 'pass' then raise exception 'editorial_gate_required'; end if;
  if jsonb_typeof(p_manuscript->'sections') is distinct from 'array' then raise exception 'manuscript_sections_required'; end if;
  if jsonb_array_length(p_manuscript->'sections')<>5 then raise exception 'five_chapters_required'; end if;
  if coalesce((p_manuscript->>'word_count')::integer,0) not between 45000 and 55000 then raise exception 'manuscript_word_count'; end if;
  insert into public.future_book_manuscripts(session_id,book_job_id,status,title,manuscript,
    quality_report,provider_chain,prompt_version,page_target_min,page_target_max)
    values(current_job.session_id,p_job_id,'ready',p_manuscript->>'title',p_manuscript,
      p_quality_report,p_provider_chain,current_job.prompt_version,180,200)
    returning id into created_manuscript_id;
  update public.future_book_jobs set status='ready',stage='manuscript',manuscript_id=created_manuscript_id,
    lease_until=null,lease_token=null,error_code=null,updated_at=now() where id=p_job_id;
  update public.future_book_sessions set status='book_ready',book_status='ready',
    book_generation_completed_at=now(),error_code=null,updated_at=now() where id=current_job.session_id;
  return created_manuscript_id;
end;
$$;

create function public.caronte_resume_book_job(p_job_id uuid, p_reason text)
returns public.future_book_jobs
language plpgsql security definer set search_path = public, pg_temp as $$
declare result public.future_book_jobs; failed_step public.future_book_job_steps;
begin
  if coalesce(length(trim(p_reason)),0)<8 then raise exception 'resume_reason_required'; end if;
  select * into result from public.future_book_jobs where id=p_job_id for update;
  if result.id is null then raise exception 'book_job_not_found'; end if;
  if result.status<>'blocked' then raise exception 'book_job_not_blocked'; end if;
  if result.error_code is null or result.error_code not in
    ('provider_key_missing','provider_model_missing','provider_config_invalid','provider_poll_unavailable','provider_http_error')
    then raise exception 'book_job_reconciliation_required'; end if;
  select * into failed_step from public.future_book_job_steps where job_id=p_job_id and status='failed' and stage<>'gate'
    order by updated_at desc limit 1 for update;
  if failed_step.id is null or failed_step.diagnostic->>'uncertain'='true'
    then raise exception 'book_job_reconciliation_required'; end if;
  update public.future_book_job_steps set status='retry', updated_at=now(),
    history=history || jsonb_build_array(jsonb_build_object('at',now(),'action','admin_resume',
      'reason',left(p_reason,1000),'error_code',error_code,'attempt',attempt)) where id=failed_step.id;
  update public.future_book_jobs set status='queued',error_code=null,lease_token=null,
    lease_until=null,next_run_at=now(),updated_at=now() where id=p_job_id returning * into result;
  update public.future_book_sessions set status='book_generating',book_status='queued',error_code=null,updated_at=now()
    where id=result.session_id;
  return result;
end;
$$;

create function public.caronte_cancel_blocked_book_job(p_job_id uuid, p_reason text)
returns public.future_book_jobs
language plpgsql security definer set search_path = public, pg_temp as $$
declare result public.future_book_jobs;
begin
  if coalesce(length(trim(p_reason)),0)<8 then raise exception 'cancel_reason_required'; end if;
  select * into result from public.future_book_jobs where id=p_job_id and status='blocked' for update;
  if result.id is null then raise exception 'book_job_not_blocked'; end if;
  update public.future_book_jobs set status='cancelled',updated_at=now() where id=p_job_id returning * into result;
  return result;
end;
$$;

revoke all on function public.caronte_enqueue_book(uuid,text,jsonb,text,jsonb) from public,anon,authenticated;
revoke all on function public.caronte_claim_book_job(uuid) from public,anon,authenticated;
revoke all on function public.caronte_checkpoint_book_job(uuid,uuid,jsonb,text,integer) from public,anon,authenticated;
revoke all on function public.caronte_finish_book_job(uuid,uuid,jsonb,jsonb,jsonb) from public,anon,authenticated;
revoke all on function public.caronte_resume_book_job(uuid,text) from public,anon,authenticated;
revoke all on function public.caronte_cancel_blocked_book_job(uuid,text) from public,anon,authenticated;
grant execute on function public.caronte_enqueue_book(uuid,text,jsonb,text,jsonb) to service_role;
grant execute on function public.caronte_claim_book_job(uuid) to service_role;
grant execute on function public.caronte_checkpoint_book_job(uuid,uuid,jsonb,text,integer) to service_role;
grant execute on function public.caronte_finish_book_job(uuid,uuid,jsonb,jsonb,jsonb) to service_role;
grant execute on function public.caronte_resume_book_job(uuid,text) to service_role;
grant execute on function public.caronte_cancel_blocked_book_job(uuid,text) to service_role;

comment on table public.future_book_jobs is 'Private immutable interview snapshots and resumable literary production. No direct client access.';
comment on table public.future_book_job_steps is 'Per-step provider receipts and editorial artifacts. Completed steps cannot be overwritten by workers.';
