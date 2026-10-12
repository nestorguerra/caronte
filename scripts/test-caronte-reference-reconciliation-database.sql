-- Operator-only reconciliation of six paragraph references, never another model call.
-- Synthetic rows only. Run with the native superuser or hosted service role.
-- Every write, including successful reconciliation, is rolled back.
begin;
do $$
declare
  sid uuid;
  j public.future_book_jobs;
  r public.future_book_jobs;
  s public.future_book_job_steps;
  d public.future_book_job_steps;
  approval uuid := gen_random_uuid();
  input_hash text := repeat('b',64);
  receipt text := 'msg_synthetic_reference_reconciliation';
  reason text := 'Approved synthetic reconciliation of six paragraph references only';
  paragraphs jsonb;
  raw_artifact jsonb;
  candidate jsonb;
  altered jsonb;
  before_step jsonb;
  before_draft jsonb;
  before_job jsonb;
  after_job jsonb;
  after_step jsonb;
  correction_map jsonb := '[{"evidenceIndex":3,"from":25,"to":24},{"evidenceIndex":4,"from":22,"to":21},{"evidenceIndex":5,"from":23,"to":22},{"evidenceIndex":7,"from":28,"to":27},{"evidenceIndex":8,"from":30,"to":29},{"evidenceIndex":9,"from":24,"to":23}]';
  dimensions text[] := array['grounding','voice','depth','futureTexture','coherence','originality','recognition','causalPlausibility'];
  exact_indices integer[] := array[1,2,3,24,21,22,4,27,29,23,5,6,7,8,9,10];
  raw_indices integer[] := array[1,2,3,25,22,23,4,28,30,24,5,6,7,8,9,10];
  evidence jsonb := '[]';
  entry jsonb;
  test_name text;
  caught boolean;
  i integer;
  changed_count integer;
  function_oid oid;
begin
  -- Deliberately fail RED when the recovery function does not yet exist.
  function_oid := to_regprocedure('public.caronte_reconcile_review_references(uuid,text,text,uuid,jsonb,jsonb,text)');
  if function_oid is null then raise exception 'test_reference_reconciliation_function_missing'; end if;
  if (select prosecdef from pg_proc where oid=function_oid) then
    raise exception 'test_reconciliation_must_be_security_invoker';
  end if;
  if has_function_privilege('anon',function_oid,'EXECUTE')
    or has_function_privilege('authenticated',function_oid,'EXECUTE')
    or not has_function_privilege('service_role',function_oid,'EXECUTE')
    or exists(select 1 from pg_proc p, lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
      where p.oid=function_oid and a.grantee=0 and a.privilege_type='EXECUTE') then
    raise exception 'test_reconciliation_operator_permissions';
  end if;

  select jsonb_agg(format('Synthetic paragraph %s contains uniquely anchored evidence. This is test text only.',n) order by n)
    into paragraphs from generate_series(1,29) n;
  for i in 1..16 loop
    evidence := evidence || jsonb_build_array(jsonb_build_object(
      'dimension',dimensions[((i-1)/2)+1],'unitId','ch_02_u_02',
      'paragraphIndex',raw_indices[i],
      'quote',format('Synthetic paragraph %s contains uniquely anchored evidence.',exact_indices[i]),
      'rationale','Synthetic exact quotation binding; not a literary quality claim.'));
  end loop;
  raw_artifact := jsonb_build_object(
    'unitId','ch_02_u_02','verdict','pass',
    'scores','{"grounding":4,"voice":4,"depth":4,"futureTexture":4,"coherence":4,"originality":4,"recognition":4,"causalPlausibility":4}'::jsonb,
    'issues','[{"id":"minor_01","severity":"minor","location":"synthetic paragraph 1","detail":"Synthetic minor issue retained.","instruction":"Retain for whole-book reading."}]'::jsonb,
    'coveredUnitIds','["ch_02_u_02"]'::jsonb,'evidence',evidence);
  candidate := raw_artifact;
  for entry in select value from jsonb_array_elements(correction_map) loop
    candidate := jsonb_set(candidate,array['evidence',entry->>'evidenceIndex','paragraphIndex'],entry->'to');
  end loop;

  insert into public.future_book_sessions(status,question_count,source,metadata)
    values('interview_completed',1,'caronte_reference_reconciliation_sql_test','{"synthetic":true}') returning id into sid;
  j := public.caronte_enqueue_book(sid,repeat('a',64),'{"sources":[{"id":"q_01","transcript":"Synthetic only"}]}',
    'caronte-longform-v2','{"writerModel":"gpt-6.1-sol","writerReasoningEffort":"xhigh","reviewerModel":"claude-opus-5-5","literaryContract":{"version":"caronte-literary-v3"}}');
  insert into public.future_book_job_steps(job_id,step_key,stage,unit_id,status,provider,model,
    provider_request_id,input_hash,attempt,output,usage)
    values(j.id,'draft:ch_02_u_02:0','draft','ch_02_u_02','completed','openai','gpt-6.1-sol',
      'resp_synthetic_draft',repeat('d',64),1,jsonb_build_object(
        'unitId','ch_02_u_02','heading','Synthetic unit','paragraphs',paragraphs,
        'factIds','[]'::jsonb,'worldChangeIds','[]'::jsonb,'motifIds','[]'::jsonb,'continuityNotes','[]'::jsonb),
      '{"input_tokens":100,"output_tokens":100}') returning * into d;
  insert into public.future_book_job_steps(job_id,step_key,stage,unit_id,status,provider,model,
    provider_request_id,input_hash,attempt,usage,diagnostic,error_code)
    values(j.id,'review:ch_02_u_02:0','review','ch_02_u_02','failed','anthropic','claude-opus-5-5',
      receipt,input_hash,1,'{"input_tokens":62423,"output_tokens":5139}',
      jsonb_build_object('terminal',true,'uncertain',false,'providerStatus','completed','artifact',raw_artifact),
      'review_evidence_mismatch') returning * into s;
  update public.future_book_jobs set status='blocked',stage='review',error_code='review_evidence_mismatch',
    lease_token=gen_random_uuid(),lease_until=now()-interval '1 minute' where id=j.id returning * into j;
  update public.future_book_sessions set status='blocked',book_status='failed',error_code='review_evidence_mismatch' where id=sid;
  before_step := to_jsonb(s)-'history';
  before_draft := to_jsonb(d);

  -- Missing approval and inadequate reasons cannot authorize any recovery.
  foreach test_name in array array['null_approval','empty_reason','short_reason'] loop
    caught := false;
    begin
      perform public.caronte_reconcile_review_references(j.id,receipt,input_hash,
        case when test_name='null_approval' then null else approval end,raw_artifact,candidate,
        case when test_name='empty_reason' then '' when test_name='short_reason' then 'short' else reason end);
    exception when others then
      if sqlerrm='review_reconciliation_approval_required' then caught:=true; else raise; end if;
    end;
    if not caught then raise exception 'test_%_accepted',test_name; end if;
  end loop;

  -- Bind to the exact saved receipt, input, and raw rejected response.
  foreach test_name in array array['wrong_receipt','wrong_hash','null_hash','wrong_raw','null_raw'] loop
    caught := false;
    begin
      perform public.caronte_reconcile_review_references(j.id,
        case when test_name='wrong_receipt' then 'msg_wrong' else receipt end,
        case when test_name='wrong_hash' then repeat('c',64) when test_name='null_hash' then null else input_hash end,
        approval,case when test_name='wrong_raw' then jsonb_set(raw_artifact,'{scores,voice}','5')
          when test_name='null_raw' then null else raw_artifact end,candidate,reason);
    exception when others then
      if sqlerrm='review_reconciliation_receipt_mismatch' then caught:=true; else raise; end if;
    end;
    if not caught then raise exception 'test_%_accepted',test_name; end if;
  end loop;

  -- The accepted copy must preserve every quotation, score, issue, and other field.
  foreach test_name in array array['raw_without_fix','wrong_index','extra_index','score_change','quote_change','issue_change','rationale_change','unit_change','coverage_change','null_candidate'] loop
    altered := case test_name
      when 'raw_without_fix' then raw_artifact
      when 'wrong_index' then jsonb_set(candidate,'{evidence,3,paragraphIndex}','23')
      when 'extra_index' then jsonb_set(candidate,'{evidence,0,paragraphIndex}','2')
      when 'score_change' then jsonb_set(candidate,'{scores,voice}','5')
      when 'quote_change' then jsonb_set(candidate,'{evidence,0,quote}','"A fabricated quotation cannot become approved."')
      when 'issue_change' then jsonb_set(candidate,'{issues}','[]')
      when 'rationale_change' then jsonb_set(candidate,'{evidence,0,rationale}','"Altered rationale"')
      when 'unit_change' then jsonb_set(candidate,'{unitId}','"ch_02_u_03"')
      when 'coverage_change' then jsonb_set(candidate,'{coveredUnitIds}','["ch_02_u_03"]')
      when 'null_candidate' then null end;
    caught := false;
    begin
      perform public.caronte_reconcile_review_references(j.id,receipt,input_hash,approval,raw_artifact,altered,reason);
    exception when others then
      if sqlerrm='review_reconciliation_evidence_mismatch' then caught:=true; else raise; end if;
    end;
    if not caught then raise exception 'test_%_accepted',test_name; end if;
  end loop;

  -- Reject any uncertain, unfinished, different, or already-approved provider state.
  foreach test_name in array array['job_not_blocked','wrong_job_error','wrong_job_stage','wrong_prompt','wrong_contract','wrong_reviewer',
    'wrong_unit','wrong_stage','wrong_status','second_attempt','nonterminal','uncertain','provider_pending',
    'wrong_provider','wrong_model','wrong_step_error','existing_output','wrong_input_usage','wrong_output_usage',
    'draft_not_completed','draft_wrong_unit','active_lease'] loop
    update public.future_book_jobs set
      status=case when test_name='job_not_blocked' then 'queued' else j.status end,
      stage=case when test_name='wrong_job_stage' then 'draft' else j.stage end,
      error_code=case when test_name='wrong_job_error' then 'another_error' else j.error_code end,
      prompt_version=case when test_name='wrong_prompt' then 'caronte-longform-v1' else j.prompt_version end,
      model_config=case when test_name='wrong_contract' then jsonb_set(j.model_config,'{literaryContract,version}','"caronte-literary-v2"')
        when test_name='wrong_reviewer' then jsonb_set(j.model_config,'{reviewerModel}','"another_model"') else j.model_config end,
      lease_token=j.lease_token,
      lease_until=case when test_name='active_lease' then now()+interval '2 minutes' else j.lease_until end
      where id=j.id;
    update public.future_book_job_steps set
      unit_id=case when test_name='wrong_unit' then 'ch_02_u_03' else s.unit_id end,
      stage=case when test_name='wrong_stage' then 'draft' else s.stage end,
      status=case when test_name='wrong_status' then 'waiting' else s.status end,
      attempt=case when test_name='second_attempt' then 2 else s.attempt end,
      provider=case when test_name='wrong_provider' then 'openai' else s.provider end,
      model=case when test_name='wrong_model' then 'another_model' else s.model end,
      error_code=case when test_name='wrong_step_error' then 'another_error' else s.error_code end,
      output=case when test_name='existing_output' then candidate else s.output end,
      usage=case when test_name='wrong_input_usage' then jsonb_set(s.usage,'{input_tokens}','62424')
        when test_name='wrong_output_usage' then jsonb_set(s.usage,'{output_tokens}','5140') else s.usage end,
      diagnostic=case when test_name='nonterminal' then jsonb_set(s.diagnostic,'{terminal}','false')
        when test_name='uncertain' then jsonb_set(s.diagnostic,'{uncertain}','true')
        when test_name='provider_pending' then jsonb_set(s.diagnostic,'{providerStatus}','"waiting"') else s.diagnostic end
      where id=s.id;
    update public.future_book_job_steps set status=case when test_name='draft_not_completed' then 'waiting' else d.status end,
      unit_id=case when test_name='draft_wrong_unit' then 'ch_02_u_03' else d.unit_id end where id=d.id;
    caught := false;
    begin
      perform public.caronte_reconcile_review_references(j.id,receipt,input_hash,approval,raw_artifact,candidate,reason);
    exception when others then
      if sqlerrm='review_reconciliation_required' then caught:=true; else raise; end if;
    end;
    if not caught then raise exception 'test_%_accepted',test_name; end if;
  end loop;
  update public.future_book_jobs set status=j.status,stage=j.stage,error_code=j.error_code,prompt_version=j.prompt_version,
    model_config=j.model_config,lease_token=j.lease_token,lease_until=j.lease_until where id=j.id;
  update public.future_book_job_steps set unit_id=s.unit_id,stage=s.stage,status=s.status,attempt=s.attempt,
    provider=s.provider,model=s.model,error_code=s.error_code,output=s.output,usage=s.usage,diagnostic=s.diagnostic where id=s.id;
  update public.future_book_job_steps set status=d.status,unit_id=d.unit_id where id=d.id;

  -- Even a raw/copy pair that agrees cannot approve an absent quotation.
  foreach test_name in array array['low_score_in_both','major_issue_in_both'] loop
    altered := case test_name when 'low_score_in_both' then jsonb_set(raw_artifact,'{scores,voice}','3')
      else jsonb_set(raw_artifact,'{issues,0,severity}','"major"') end;
    update public.future_book_job_steps set diagnostic=jsonb_set(s.diagnostic,'{artifact}',altered) where id=s.id;
    caught := false;
    begin
      perform public.caronte_reconcile_review_references(j.id,receipt,input_hash,approval,altered,
        case test_name when 'low_score_in_both' then jsonb_set(candidate,'{scores,voice}','3')
          else jsonb_set(candidate,'{issues,0,severity}','"major"') end,reason);
    exception when others then
      if sqlerrm='review_reconciliation_evidence_mismatch' then caught:=true; else raise; end if;
    end;
    if not caught then raise exception 'test_%_accepted',test_name; end if;
  end loop;
  update public.future_book_job_steps set diagnostic=s.diagnostic where id=s.id;

  altered := jsonb_set(raw_artifact,'{evidence,0,quote}','"This quote exists in no draft paragraph."');
  update public.future_book_job_steps set diagnostic=jsonb_set(s.diagnostic,'{artifact}',altered) where id=s.id;
  caught := false;
  begin
    perform public.caronte_reconcile_review_references(j.id,receipt,input_hash,approval,altered,
      jsonb_set(candidate,'{evidence,0,quote}',altered->'evidence'->0->'quote'),reason);
  exception when others then
    if sqlerrm='review_reconciliation_evidence_mismatch' then caught:=true; else raise; end if;
  end;
  if not caught then raise exception 'test_unknown_quote_accepted'; end if;
  update public.future_book_job_steps set diagnostic=s.diagnostic where id=s.id;

  -- A literal quotation in two paragraphs is ambiguous and must not be guessed.
  update public.future_book_job_steps set output=jsonb_set(d.output,'{paragraphs,1}',
    to_jsonb((d.output->'paragraphs'->>1)||' '||(raw_artifact->'evidence'->0->>'quote'))) where id=d.id;
  caught := false;
  begin
    perform public.caronte_reconcile_review_references(j.id,receipt,input_hash,approval,raw_artifact,candidate,reason);
  exception when others then
    if sqlerrm='review_reconciliation_evidence_mismatch' then caught:=true; else raise; end if;
  end;
  if not caught then raise exception 'test_ambiguous_quote_accepted'; end if;
  update public.future_book_job_steps set output=d.output where id=d.id;

  -- No failed call may have partially consumed approval or changed an artifact.
  select to_jsonb(t)-'history' into after_step from public.future_book_job_steps t where id=s.id;
  if after_step is distinct from before_step
    or exists(select 1 from public.future_book_job_steps where id=s.id and history<>s.history)
    or (select to_jsonb(t) from public.future_book_job_steps t where id=d.id) is distinct from before_draft then
    raise exception 'test_rejected_reconciliation_changed_receipts';
  end if;

  -- The single authorized recovery completes this SAME review, without a repeat.
  r := public.caronte_reconcile_review_references(j.id,receipt,input_hash,approval,raw_artifact,candidate,reason);
  if r.id<>j.id or r.status<>'queued' or r.stage<>'review' or r.error_code is not null
    or r.lease_token is not null or r.lease_until is not null then
    raise exception 'test_reconciled_job_not_queued_without_lease';
  end if;
  if not exists(select 1 from public.future_book_sessions where id=sid and status='book_generating'
    and book_status='queued' and error_code is null) then raise exception 'test_session_not_resumed'; end if;
  select * into s from public.future_book_job_steps where id=s.id;
  if s.status<>'completed' or s.error_code is not null or s.output is distinct from candidate
    or s.provider_request_id<>receipt or s.input_hash<>input_hash or s.attempt<>1
    or s.usage is distinct from before_step->'usage' or s.diagnostic is distinct from before_step->'diagnostic'
    or (to_jsonb(s)-array['history','status','output','error_code','updated_at']) is distinct from
       (before_step-array['status','output','error_code','updated_at']) then
    raise exception 'test_same_receipt_raw_response_or_cost_not_preserved';
  end if;
  if jsonb_array_length(s.history)<>1 or s.history->0->>'action'<>'approved_review_reference_reconciliation'
    or s.history->0->>'approval_id'<>approval::text or s.history->0->'receipt' is distinct from before_step
    or s.history->0->'corrections' is distinct from correction_map
    or s.history->0->'validated_output' is distinct from candidate then
    raise exception 'test_original_receipt_or_exact_map_not_preserved';
  end if;
  changed_count := 0;
  for i in 0..15 loop
    if ((s.output->'evidence'->i)-'paragraphIndex') is distinct from ((raw_artifact->'evidence'->i)-'paragraphIndex') then
      raise exception 'test_evidence_content_changed';
    end if;
    if s.output->'evidence'->i->'paragraphIndex' is distinct from raw_artifact->'evidence'->i->'paragraphIndex' then
      changed_count := changed_count+1;
    end if;
  end loop;
  if changed_count<>6 or (s.output-'evidence') is distinct from (raw_artifact-'evidence') then
    raise exception 'test_not_only_six_reference_differences';
  end if;
  if (select to_jsonb(t) from public.future_book_job_steps t where id=d.id) is distinct from before_draft then
    raise exception 'test_original_draft_changed';
  end if;

  -- Replayed approval must not reset a later live worker stage or append history.
  update public.future_book_jobs set status='running',stage='draft',lease_token=gen_random_uuid(),
    lease_until=now()+interval '2 minutes',next_run_at=now()+interval '1 minute' where id=j.id;
  insert into public.future_book_job_steps(job_id,step_key,stage,unit_id,status,provider,model,attempt,provider_request_id)
    values(j.id,'draft:ch_02_u_03:0','draft','ch_02_u_03','started','openai','gpt-6.1-sol',1,'resp_synthetic_next');
  select to_jsonb(t) into before_job from public.future_book_jobs t where id=j.id;
  after_step := to_jsonb(s);
  r := public.caronte_reconcile_review_references(j.id,receipt,input_hash,approval,raw_artifact,candidate,reason);
  select to_jsonb(t) into after_job from public.future_book_jobs t where id=j.id;
  if after_job is distinct from before_job or to_jsonb(r) is distinct from before_job
    or (select to_jsonb(t) from public.future_book_job_steps t where id=s.id) is distinct from after_step
    or not exists(select 1 from public.future_book_job_steps where job_id=j.id and step_key='draft:ch_02_u_03:0'
      and status='started' and attempt=1 and provider_request_id='resp_synthetic_next') then
    raise exception 'test_approval_replay_reset_subsequent_work';
  end if;

  foreach test_name in array array['second_approval','replay_wrong_hash','replay_wrong_raw','replay_wrong_copy'] loop
    caught := false;
    begin
      perform public.caronte_reconcile_review_references(j.id,receipt,
        case when test_name='replay_wrong_hash' then repeat('c',64) else input_hash end,
        case when test_name='second_approval' then gen_random_uuid() else approval end,
        case when test_name='replay_wrong_raw' then jsonb_set(raw_artifact,'{scores,voice}','5') else raw_artifact end,
        case when test_name='replay_wrong_copy' then jsonb_set(candidate,'{scores,voice}','5') else candidate end,reason);
    exception when others then
      if sqlerrm='review_reconciliation_already_consumed' then caught:=true; else raise; end if;
    end;
    if not caught then raise exception 'test_%_accepted',test_name; end if;
  end loop;
  if (select to_jsonb(t) from public.future_book_jobs t where id=j.id) is distinct from before_job then
    raise exception 'test_consumed_recovery_mutated_job';
  end if;
end;
$$;
rollback;
