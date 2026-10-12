-- Exact lost rejected review: no models, synthetic rows, rollback.
begin;
do $$
declare sid uuid;j public.future_book_jobs;r public.future_book_jobs;s public.future_book_job_steps;
  approval uuid:=gen_random_uuid();before_step jsonb;caught boolean;
begin
  insert into public.future_book_sessions(status,question_count,source,metadata)
    values('interview_completed',1,'caronte_rejected_review_recovery_sql_test','{"synthetic":true}') returning id into sid;
  j:=public.caronte_enqueue_book(sid,repeat('a',64),'{"sources":[{"id":"q_01","transcript":"Synthetic only"}]}',
    'caronte-longform-v2','{"writerModel":"gpt-6.1-sol","reviewerModel":"claude-opus-5-5","literaryContract":{"version":"caronte-literary-v3"}}');
  insert into public.future_book_job_steps(job_id,step_key,stage,unit_id,status,provider,model,
    provider_request_id,input_hash,attempt,usage,diagnostic,error_code)
    values(j.id,'review:ch_01_u_03:0','review','ch_01_u_03','failed','anthropic','claude-opus-5-5',
      'msg_synthetic_rejected',repeat('b',64),1,'{"input_tokens":59525,"output_tokens":4939}',
      '{"terminal":false,"uncertain":false}','review_evidence_mismatch');
  update public.future_book_jobs set status='blocked',stage='review',error_code='review_evidence_mismatch' where id=j.id;
  select * into s from public.future_book_job_steps where job_id=j.id;before_step:=to_jsonb(s)-'history';
  caught:=false;
  begin perform public.caronte_retry_rejected_review(j.id,s.step_key,'msg_wrong',s.input_hash,approval,'Approved synthetic recovery');
  exception when others then if sqlerrm='review_retry_receipt_mismatch' then caught:=true;else raise;end if;end;
  if not caught then raise exception 'test_wrong_receipt';end if;
  caught:=false;
  begin perform public.caronte_retry_rejected_review(j.id,s.step_key,s.provider_request_id,repeat('c',64),approval,'Approved synthetic recovery');
  exception when others then if sqlerrm='review_retry_receipt_mismatch' then caught:=true;else raise;end if;end;
  if not caught then raise exception 'test_wrong_input';end if;
  update public.future_book_job_steps set diagnostic='{"terminal":false,"uncertain":true}' where id=s.id;
  caught:=false;
  begin perform public.caronte_retry_rejected_review(j.id,s.step_key,s.provider_request_id,s.input_hash,approval,'Approved synthetic recovery');
  exception when others then if sqlerrm='review_retry_reconciliation_required' then caught:=true;else raise;end if;end;
  if not caught then raise exception 'test_uncertain_retried';end if;
  update public.future_book_job_steps set diagnostic=s.diagnostic,attempt=2 where id=s.id;
  caught:=false;
  begin perform public.caronte_retry_rejected_review(j.id,s.step_key,s.provider_request_id,s.input_hash,approval,'Approved synthetic recovery');
  exception when others then if sqlerrm='review_retry_reconciliation_required' then caught:=true;else raise;end if;end;
  if not caught then raise exception 'test_second_attempt_retried';end if;
  update public.future_book_job_steps set attempt=s.attempt where id=s.id;
  r:=public.caronte_retry_rejected_review(j.id,s.step_key,s.provider_request_id,s.input_hash,approval,'Approved synthetic recovery');
  if r.status<>'queued' then raise exception 'test_not_queued';end if;
  if not exists(select 1 from public.future_book_job_steps where id=s.id and status='retry'
    and provider_request_id is null and attempt=1 and input_hash=s.input_hash
    and history->-1->'receipt'=before_step and history->-1->>'approval_id'=approval::text)
    then raise exception 'test_old_receipt_not_preserved';end if;
  update public.future_book_job_steps set status='started',attempt=2 where id=s.id;
  r:=public.caronte_retry_rejected_review(j.id,s.step_key,s.provider_request_id,s.input_hash,approval,'Same approval after lost response');
  if not exists(select 1 from public.future_book_job_steps where id=s.id and status='started' and attempt=2)
    then raise exception 'test_replay_reset_started';end if;
  caught:=false;
  begin perform public.caronte_retry_rejected_review(j.id,s.step_key,s.provider_request_id,s.input_hash,gen_random_uuid(),'Another synthetic approval');
  exception when others then if sqlerrm='review_retry_already_consumed' then caught:=true;else raise;end if;end;
  if not caught then raise exception 'test_second_approval';end if;
  if has_function_privilege('anon','public.caronte_retry_rejected_review(uuid,text,text,text,uuid,text)','EXECUTE')
    or has_function_privilege('authenticated','public.caronte_retry_rejected_review(uuid,text,text,text,uuid,text)','EXECUTE')
    or not has_function_privilege('service_role','public.caronte_retry_rejected_review(uuid,text,text,text,uuid,text)','EXECUTE')
    then raise exception 'test_operator_permissions';end if;
end;$$;
rollback;
