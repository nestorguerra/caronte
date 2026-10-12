-- One operator-approved repeat of the third review whose rejected corpus was lost.
-- No browser/worker route, automatic retry, new draft or reset of another review.
create function public.caronte_retry_rejected_review(
  p_job_id uuid,p_step_key text,p_expected_receipt text,p_input_hash text,
  p_approval_id uuid,p_reason text
) returns public.future_book_jobs
language plpgsql security definer set search_path=public,pg_temp as $$
declare j public.future_book_jobs;s public.future_book_job_steps;approval jsonb;
begin
  if p_approval_id is null or coalesce(length(trim(p_reason)),0)<8
    then raise exception 'review_retry_approval_required';end if;
  select * into j from public.future_book_jobs where id=p_job_id for update;
  select * into s from public.future_book_job_steps where job_id=p_job_id and step_key=p_step_key for update;
  if j.id is null or s.id is null then raise exception 'review_retry_receipt_mismatch';end if;
  select h into approval from jsonb_array_elements(s.history) h
    where h->>'action'='approved_rejected_review_retry' limit 1;
  if approval is not null then
    if approval->>'approval_id'=p_approval_id::text
      and approval->'receipt'->>'provider_request_id'=p_expected_receipt
      and approval->'receipt'->>'input_hash'=p_input_hash then return j;end if;
    raise exception 'review_retry_already_consumed';
  end if;
  if p_expected_receipt is null or p_input_hash is null
    or s.provider_request_id is distinct from p_expected_receipt
    or s.input_hash is distinct from p_input_hash then raise exception 'review_retry_receipt_mismatch';end if;
  if j.status<>'blocked' or j.error_code is distinct from 'review_evidence_mismatch'
    or j.prompt_version is distinct from 'caronte-longform-v2'
    or j.model_config->'literaryContract'->>'version' is distinct from 'caronte-literary-v3'
    or j.model_config->>'reviewerModel' is distinct from 'claude-opus-5-5'
    or s.stage<>'review' or s.step_key is distinct from 'review:ch_01_u_03:0'
    or s.unit_id is distinct from 'ch_01_u_03' or s.status<>'failed'
    or s.provider is distinct from 'anthropic' or s.model is distinct from 'claude-opus-5-5'
    or s.provider_request_id !~ '^msg_[a-zA-Z0-9_-]{1,200}$'
    or s.input_hash !~ '^[a-f0-9]{64}$' or s.attempt<>1
    or s.error_code is distinct from 'review_evidence_mismatch'
    or s.diagnostic is distinct from '{"terminal":false,"uncertain":false}'::jsonb
    or s.usage->>'input_tokens' is distinct from '59525'
    or s.usage->>'output_tokens' is distinct from '4939'
    or (s.output is not null and s.output<>'null'::jsonb)
    then raise exception 'review_retry_reconciliation_required';end if;
  update public.future_book_job_steps set history=history||jsonb_build_array(jsonb_build_object(
    'at',now(),'action','approved_rejected_review_retry','approval_id',p_approval_id,
    'reason',left(p_reason,1000),'approved_max_output_tokens',16000,'receipt',to_jsonb(s)-'history')),
    status='retry',provider_request_id=null,usage='{}'::jsonb,diagnostic=null,error_code=null,
    updated_at=now() where id=s.id;
  update public.future_book_jobs set status='queued',error_code=null,lease_token=null,lease_until=null,
    next_run_at=now(),updated_at=now() where id=j.id returning * into j;
  update public.future_book_sessions set status='book_generating',book_status='queued',error_code=null,
    updated_at=now() where id=j.session_id;
  return j;
end;$$;
revoke all on function public.caronte_retry_rejected_review(uuid,text,text,text,uuid,text) from public,anon,authenticated;
grant execute on function public.caronte_retry_rejected_review(uuid,text,text,text,uuid,text) to service_role;
