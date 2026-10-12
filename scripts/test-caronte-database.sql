-- Synthetic rows only. All rows and state transitions roll back at the end.
begin;
do $$
declare
  sid uuid; j public.future_book_jobs; same public.future_book_jobs;
  lease public.future_book_jobs; next_lease public.future_book_jobs; result_id uuid;
  source jsonb := '{"sources":[{"id":"q_01","transcript":"QA synthetic interview"}]}';
  models jsonb := '{"writerModel":"qa-writer","reviewerModel":"qa-reviewer"}';
  caught boolean;
begin
  if has_table_privilege('anon','public.future_book_jobs','SELECT')
    or has_table_privilege('authenticated','public.future_book_job_steps','INSERT')
    or has_function_privilege('anon','public.caronte_claim_book_job(uuid)','EXECUTE')
    then raise exception 'test_failed_private_access'; end if;
  insert into public.future_book_sessions(status,question_count,source,metadata)
    values('interview_completed',1,'caronte_database_test','{"synthetic":true}') returning id into sid;
  j := public.caronte_enqueue_book(sid,repeat('a',64),source,'qa-contract',models);
  same := public.caronte_enqueue_book(sid,repeat('a',64),source,'qa-contract',models);
  if j.id<>same.id then raise exception 'test_failed_idempotency'; end if;
  lease := public.caronte_claim_book_job(j.id);
  same := public.caronte_claim_book_job(j.id);
  if lease.lease_token is null or same.id is not null then raise exception 'test_failed_exclusive_claim'; end if;
  caught := false;
  begin
    perform public.caronte_checkpoint_book_job(j.id,gen_random_uuid(),'{"step_key":"biography","stage":"biography","status":"started"}','running');
  exception when others then if sqlerrm='lease_lost' then caught:=true; else raise; end if; end;
  if not caught then raise exception 'test_failed_stale_lease'; end if;
  perform public.caronte_checkpoint_book_job(j.id,lease.lease_token,
    jsonb_build_object('step_key','biography','stage','biography','status','completed','attempt',1,'input_hash',repeat('b',64),'output',jsonb_build_object('qa',true)), 'running');
  caught := false;
  begin
    perform public.caronte_checkpoint_book_job(j.id,lease.lease_token,
      jsonb_build_object('step_key','biography','stage','biography','status','completed','input_hash',repeat('c',64),'output',jsonb_build_object('changed',true)), 'queued');
  exception when others then if sqlerrm='completed_step_is_immutable' then caught:=true; else raise; end if; end;
  if not caught then raise exception 'test_failed_immutable_receipt'; end if;
  caught := false;
  begin
    perform public.caronte_finish_book_job(j.id,lease.lease_token,'{}','{}','{}');
  exception when others then if sqlerrm='editorial_gate_required' then caught:=true; else raise; end if; end;
  if not caught then raise exception 'test_failed_null_editorial_gate'; end if;
  update public.future_book_jobs set lease_until=now()-interval '1 second' where id=j.id;
  next_lease := public.caronte_claim_book_job(j.id);
  if next_lease.lease_token=lease.lease_token or next_lease.id<>j.id then raise exception 'test_failed_expired_lease'; end if;
  perform public.caronte_checkpoint_book_job(j.id,next_lease.lease_token,
    '{"step_key":"world","stage":"world","status":"failed","error_code":"provider_key_missing","diagnostic":{"terminal":true,"uncertain":false}}','blocked');
  same := public.caronte_resume_book_job(j.id,'QA credential fixed');
  if same.status<>'queued' then raise exception 'test_failed_safe_resume'; end if;
  if not exists(select 1 from public.future_book_job_steps where job_id=j.id and step_key='world' and status='retry')
    then raise exception 'test_failed_resume_keeps_terminal_guard'; end if;
  lease := public.caronte_claim_book_job(j.id);
  perform public.caronte_checkpoint_book_job(j.id,lease.lease_token,
    '{"step_key":"world","stage":"world","status":"failed","error_code":"provider_submission_uncertain","diagnostic":{"uncertain":true}}','blocked');
  caught := false;
  begin
    perform public.caronte_resume_book_job(j.id,'QA must not duplicate');
  exception when others then if sqlerrm='book_job_reconciliation_required' then caught:=true; else raise; end if; end;
  if not caught then raise exception 'test_failed_uncertain_submission_resumed'; end if;
  same := public.caronte_cancel_blocked_book_job(j.id,'QA cancel uncertain job');
  if same.status<>'cancelled' then raise exception 'test_failed_cancel'; end if;
  same := public.caronte_enqueue_book(sid,repeat('d',64),source,'qa-contract',models);
  if same.id=j.id then raise exception 'test_failed_changed_interview_isolation'; end if;
  delete from public.future_book_sessions where id=sid;
  if exists(select 1 from public.future_book_jobs where session_id=sid)
    or exists(select 1 from public.future_book_job_steps where job_id=j.id)
    then raise exception 'test_failed_privacy_cascade'; end if;
end;
$$;
select 'PASS: private access, idempotency, exclusive lease, immutable receipts, null gates, recovery, uncertainty and erasure' as result;
rollback;
