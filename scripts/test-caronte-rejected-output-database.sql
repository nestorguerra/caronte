-- Service-only rejected model corpus stays diagnostic, never approved; rollback.
begin;
do $$
declare sid uuid;j public.future_book_jobs;claimed public.future_book_jobs;
  s public.future_book_job_steps;ignored public.future_book_jobs;caught boolean;
  diagnosis jsonb:='{"terminal":true,"uncertain":false,"providerStatus":"completed","artifact":{"verdict":"pass","evidence":[{"quote":"private-rejected-synthetic"}]}}';
begin
  insert into public.future_book_sessions(status,question_count,source,metadata)
    values('interview_completed',1,'caronte_rejected_output_sql_test','{"synthetic":true}') returning id into sid;
  j:=public.caronte_enqueue_book(sid,repeat('a',64),'{"sources":[{"id":"q_01","transcript":"Synthetic only"}]}',
    'caronte-longform-v2','{"writerModel":"gpt-6.1-sol","reviewerModel":"claude-opus-5-5","literaryContract":{"version":"caronte-literary-v3"}}');
  claimed:=public.caronte_claim_book_job(j.id);
  if claimed.id is null or claimed.lease_token is null then raise exception 'test_claim_missing';end if;
  perform public.caronte_checkpoint_book_job(j.id,claimed.lease_token,
    jsonb_build_object('step_key','review:ch_01_u_03:0','stage','review','unit_id','ch_01_u_03',
      'status','started','attempt',1,'provider','anthropic','model','claude-opus-5-5','input_hash',repeat('b',64)),
    'running',0);
  perform public.caronte_checkpoint_book_job(j.id,claimed.lease_token,
    jsonb_build_object('step_key','review:ch_01_u_03:0','stage','review','unit_id','ch_01_u_03',
      'status','failed','attempt',1,'provider','anthropic','model','claude-opus-5-5','input_hash',repeat('b',64),
      'provider_request_id','msg_rejected_synthetic','usage','{"output_tokens":42}'::jsonb,
      'diagnostic',diagnosis,'error_code','review_evidence_mismatch'),
    'blocked',0);
  select * into s from public.future_book_job_steps where job_id=j.id and step_key='review:ch_01_u_03:0';
  if s.diagnostic is distinct from diagnosis or s.output is not null or s.status<>'failed'
    or s.provider_request_id is distinct from 'msg_rejected_synthetic'
    or s.input_hash is distinct from repeat('b',64) or s.usage->>'output_tokens' is distinct from '42'
    then raise exception 'test_rejected_corpus_not_preserved';end if;
  ignored:=public.caronte_claim_book_job(j.id);
  if ignored.id is not null then raise exception 'test_blocked_job_claimed';end if;
  caught:=false;
  begin perform public.caronte_resume_book_job(j.id,'Synthetic accidental resume');
  exception when others then if sqlerrm='book_job_reconciliation_required' then caught:=true;else raise;end if;end;
  if not caught then raise exception 'test_invalid_review_auto_resumed';end if;
end;$$;
rollback;
