-- Known terminal truncation only: synthetic rows, no providers, transaction rollback.
begin;
do $$
declare sid uuid;j public.future_book_jobs;r public.future_book_jobs;s public.future_book_job_steps;
  approval uuid:=gen_random_uuid();before_step jsonb;after_step jsonb;caught boolean;
  models jsonb:='{"writerModel":"gpt-6.1-sol","reviewerModel":"claude-opus-5-5","literaryContract":{"version":"caronte-literary-v3"}}';
begin
  insert into public.future_book_sessions(status,question_count,source,metadata)
    values('interview_completed',1,'caronte_review_recovery_sql_test','{"synthetic":true}') returning id into sid;
  j:=public.caronte_enqueue_book(sid,repeat('a',64),'{"sources":[{"id":"q_01","transcript":"Synthetic only"}]}',
    'caronte-longform-v2',models);
  insert into public.future_book_job_steps(job_id,step_key,stage,unit_id,status,provider,model,
    provider_request_id,input_hash,attempt,usage,diagnostic,error_code)
    values(j.id,'review:ch_01_u_01:0','review','ch_01_u_01','failed','anthropic','claude-opus-5-5',
      'msg_synthetic_truncated',repeat('b',64),1,'{"input_tokens":51830,"output_tokens":6000}',
      '{"terminal":true,"uncertain":false,"providerStatus":"max_tokens"}','provider_output_incomplete');
  update public.future_book_jobs set status='blocked',stage='review',error_code='provider_output_incomplete' where id=j.id;
  select * into s from public.future_book_job_steps where job_id=j.id;
  before_step:=to_jsonb(s);
  caught:=false;
  begin perform public.caronte_retry_truncated_review(j.id,s.step_key,'msg_wrong',s.input_hash,approval,'Approved synthetic recovery');
  exception when others then if sqlerrm='review_retry_receipt_mismatch' then caught:=true;else raise;end if;end;
  if not caught then raise exception 'test_failed_wrong_receipt';end if;
  caught:=false;
  begin perform public.caronte_retry_truncated_review(j.id,s.step_key,s.provider_request_id,repeat('c',64),approval,'Approved synthetic recovery');
  exception when others then if sqlerrm='review_retry_receipt_mismatch' then caught:=true;else raise;end if;end;
  if not caught then raise exception 'test_failed_wrong_input';end if;
  update public.future_book_job_steps set diagnostic='{"terminal":true,"uncertain":true,"providerStatus":"max_tokens"}' where id=s.id;
  caught:=false;
  begin perform public.caronte_retry_truncated_review(j.id,s.step_key,s.provider_request_id,s.input_hash,approval,'Approved synthetic recovery');
  exception when others then if sqlerrm='review_retry_reconciliation_required' then caught:=true;else raise;end if;end;
  if not caught then raise exception 'test_failed_uncertain_retry';end if;
  update public.future_book_job_steps set diagnostic=s.diagnostic where id=s.id;
  update public.future_book_job_steps set diagnostic=jsonb_set(s.diagnostic,'{providerStatus}','"refusal"') where id=s.id;
  caught:=false;
  begin perform public.caronte_retry_truncated_review(j.id,s.step_key,s.provider_request_id,s.input_hash,approval,'Approved synthetic recovery');
  exception when others then if sqlerrm='review_retry_reconciliation_required' then caught:=true;else raise;end if;end;
  if not caught then raise exception 'test_failed_refusal_retry';end if;
  update public.future_book_job_steps set diagnostic=s.diagnostic where id=s.id;
  r:=public.caronte_retry_truncated_review(j.id,s.step_key,s.provider_request_id,s.input_hash,approval,'Approved synthetic recovery');
  if r.status<>'queued' then raise exception 'test_failed_review_requeued';end if;
  select to_jsonb(t) into after_step from public.future_book_job_steps t where id=s.id;
  if after_step->>'status'<>'retry' or after_step->>'provider_request_id' is not null
    or after_step->>'input_hash'<>s.input_hash or (after_step->>'attempt')::integer<>1
    or after_step->'usage'<>'{}'::jsonb or after_step->'diagnostic'<>'null'::jsonb
    then raise exception 'test_failed_retry_not_safe_for_single_new_post';end if;
  if after_step->'history'->0->'receipt' is distinct from (before_step-'history')
    or after_step->'history'->0->>'approval_id'<>approval::text
    or after_step->'history'->0->>'approved_max_output_tokens'<>'16000'
    then raise exception 'test_failed_prior_receipt_not_preserved';end if;
  -- An acknowledgement loss is idempotent, even after the worker has started.
  update public.future_book_job_steps set status='started',attempt=2 where id=s.id;
  r:=public.caronte_retry_truncated_review(j.id,s.step_key,s.provider_request_id,s.input_hash,approval,'Approved synthetic recovery');
  if not exists(select 1 from public.future_book_job_steps where id=s.id and status='started' and attempt=2)
    then raise exception 'test_failed_repeated_approval_reset_worker';end if;
  caught:=false;
  begin perform public.caronte_retry_truncated_review(j.id,s.step_key,s.provider_request_id,s.input_hash,gen_random_uuid(),'Another unapproved retry');
  exception when others then if sqlerrm='review_retry_already_consumed' then caught:=true;else raise;end if;end;
  if not caught then raise exception 'test_failed_second_retry_allowed';end if;
  if has_function_privilege('anon','public.caronte_retry_truncated_review(uuid,text,text,text,uuid,text)','EXECUTE')
    or has_function_privilege('authenticated','public.caronte_retry_truncated_review(uuid,text,text,text,uuid,text)','EXECUTE')
    or not has_function_privilege('service_role','public.caronte_retry_truncated_review(uuid,text,text,text,uuid,text)','EXECUTE')
    then raise exception 'test_failed_private_review_recovery';end if;
end;$$;
rollback;
