-- Independent regression for the operator-approved twenty_seventh review only.
-- Synthetic prose and rows; no provider/API calls. Run on the disposable local DB.
-- Fixed receipt/hash are authorization identifiers, not manuscript content.
-- All writes, including successful reconciliation and replay, are rolled back.
begin;
do $$
declare
  sid uuid;
  j public.future_book_jobs;
  r public.future_book_jobs;
  s public.future_book_job_steps;
  d public.future_book_job_steps;
  approval uuid := gen_random_uuid();
  authorized_hash constant text := '0953ab1881820113b355cf06373421748fa609276e899962844542552baa4459';
  receipt constant text := 'msg_011CfxxWtQwV9y6bUAJEeQi9';
  reason text := 'Approved synthetic twenty_seventh-review reconciliation of six paragraph references only';
  correction_map constant jsonb := '[{"evidenceIndex":5,"from":30,"to":28},{"evidenceIndex":7,"from":25,"to":24},{"evidenceIndex":9,"from":31,"to":29},{"evidenceIndex":11,"from":26,"to":25},{"evidenceIndex":13,"from":22,"to":21},{"evidenceIndex":15,"from":24,"to":23}]';
  dimensions text[] := array['grounding','voice','depth','futureTexture','coherence','originality','recognition','causalPlausibility'];
  exact_indices integer[] := array[1,2,3,4,5,28,7,24,9,29,11,25,13,21,15,23];
  raw_indices integer[] := array[1,2,3,4,5,30,7,25,9,31,11,26,13,22,15,24];
  paragraphs jsonb;
  evidence jsonb := '[]';
  raw_artifact jsonb;
  candidate jsonb;
  altered jsonb;
  altered_copy jsonb;
  entry jsonb;
  before_step jsonb;
  before_draft jsonb;
  original_job jsonb;
  original_session jsonb;
  original_other_steps jsonb;
  before_job jsonb;
  before_session jsonb;
  before_steps jsonb;
  after_step jsonb;
  before_next_step jsonb;
  test_name text;
  expected_error text;
  caught boolean;
  i integer;
  changed_count integer;
  function_oid oid;
begin
  -- RED must fail here until the independently named twenty_seventh-only RPC exists.
  function_oid := to_regprocedure('public.caronte_reconcile_twenty_seventh_review_references(uuid,text,text,uuid,jsonb,jsonb,text)');
  if function_oid is null then raise exception 'test_twenty_seventh_reference_reconciliation_function_missing'; end if;
  if (select prosecdef from pg_proc where oid=function_oid)
    or (select proconfig from pg_proc where oid=function_oid) is distinct from array['search_path=""']::text[] then
    raise exception 'test_twenty_seventh_reconciliation_must_be_security_invoker';
  end if;
  if has_function_privilege('anon',function_oid,'EXECUTE')
    or has_function_privilege('authenticated',function_oid,'EXECUTE')
    or not has_function_privilege('service_role',function_oid,'EXECUTE')
    or exists(select 1 from pg_proc p, lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
      where p.oid=function_oid and a.grantee=0 and a.privilege_type='EXECUTE') then
    raise exception 'test_twenty_seventh_reconciliation_operator_permissions';
  end if;

  select jsonb_agg(format('Twenty-seventh synthetic paragraph %s contains uniquely anchored evidence. This is test prose only.',n) order by n)
    into paragraphs from generate_series(1,29) n;
  for i in 1..16 loop
    evidence := evidence || jsonb_build_array(jsonb_build_object(
      'dimension',dimensions[((i-1)/2)+1],'unitId','ch_05_u_03',
      'paragraphIndex',raw_indices[i],
      'quote',format('Twenty-seventh synthetic paragraph %s contains uniquely anchored evidence.',exact_indices[i]),
      'rationale','Synthetic exact quotation binding; retain this rationale unchanged.'));
  end loop;
  raw_artifact := jsonb_build_object(
    'unitId','ch_05_u_03','verdict','pass',
    'scores','{"grounding":4,"voice":5,"depth":4,"futureTexture":5,"coherence":4,"originality":5,"recognition":4,"causalPlausibility":5}'::jsonb,
    'issues','[{"id":"minor_09","severity":"minor","location":"synthetic paragraph 1","detail":"Synthetic minor issue retained.","instruction":"Retain for whole-book reading."}]'::jsonb,
    'coveredUnitIds','["ch_05_u_03"]'::jsonb,'evidence',evidence);
  candidate := raw_artifact;
  for entry in select value from jsonb_array_elements(correction_map) loop
    candidate := jsonb_set(candidate,array['evidence',entry->>'evidenceIndex','paragraphIndex'],entry->'to');
  end loop;

  insert into public.future_book_sessions(status,question_count,source,metadata)
    values('interview_completed',1,'caronte_twenty_seventh_reference_reconciliation_sql_test','{"synthetic":true}') returning id into sid;
  j := public.caronte_enqueue_book(sid,repeat('a',64),'{"sources":[{"id":"q_01","transcript":"Synthetic only"}]}',
    'caronte-longform-v2','{"writerModel":"gpt-6.1-sol","writerReasoningEffort":"xhigh","reviewerModel":"claude-opus-5-5","literaryContract":{"version":"caronte-literary-v3"}}');
  insert into public.future_book_job_steps(job_id,step_key,stage,unit_id,status,provider,model,
    provider_request_id,input_hash,attempt,output,usage,history)
    values(j.id,'draft:ch_05_u_03:0','draft','ch_05_u_03','completed','openai','gpt-6.1-sol',
      'resp_synthetic_twenty_seventh_draft',repeat('d',64),1,jsonb_build_object(
        'unitId','ch_05_u_03','heading','Synthetic twenty_seventh unit','paragraphs',paragraphs,
        'factIds','[]'::jsonb,'worldChangeIds','[]'::jsonb,'motifIds','[]'::jsonb,'continuityNotes','[]'::jsonb),
      '{"input_tokens":100,"output_tokens":100}',
      '[{"action":"synthetic_immutable_draft_checkpoint","attempt":1}]') returning * into d;
  insert into public.future_book_job_steps(job_id,step_key,stage,unit_id,status,provider,model,
    provider_request_id,input_hash,attempt,usage,diagnostic,error_code,history)
    values(j.id,'review:ch_05_u_03:0','review','ch_05_u_03','failed','anthropic','claude-opus-5-5',
      receipt,authorized_hash,1,'{"input_tokens":80303,"output_tokens":5781}',
      jsonb_build_object('terminal',true,'uncertain',false,'providerStatus','completed','artifact',raw_artifact),
      'review_evidence_mismatch','[{"action":"synthetic_original_receipt_checkpoint","attempt":1,"note":"Preserve prior history"}]') returning * into s;
  -- Previous eighth artifacts are sentinels. Twenty-seventh recovery must not touch them.
  insert into public.future_book_job_steps(job_id,step_key,stage,unit_id,status,provider,model,attempt,output,history)
    values(j.id,'draft:ch_02_u_02:0','draft','ch_02_u_02','completed','openai','gpt-6.1-sol',1,
      '{"unitId":"ch_02_u_02","syntheticSentinel":"previous immutable draft"}',
      '[{"action":"synthetic_previous_draft"}]'),
    (j.id,'review:ch_02_u_02:0','review','ch_02_u_02','completed','anthropic','claude-opus-5-5',1,
      '{"unitId":"ch_02_u_02","syntheticSentinel":"previous approved review"}',
      '[{"action":"synthetic_previous_review"}]');
  update public.future_book_jobs set status='blocked',stage='review',error_code='review_evidence_mismatch',
    lease_token=gen_random_uuid(),lease_until=now()-interval '1 minute' where id=j.id returning * into j;
  update public.future_book_sessions set status='blocked',book_status='failed',error_code='review_evidence_mismatch' where id=sid;
  before_step := to_jsonb(s)-'history';
  before_draft := to_jsonb(d);
  original_job := to_jsonb(j);
  select to_jsonb(t) into original_session from public.future_book_sessions t where id=sid;
  select jsonb_agg(to_jsonb(t) order by t.id) into original_other_steps
    from public.future_book_job_steps t where job_id=j.id and id<>s.id;

  foreach test_name in array array['null_approval','empty_reason','short_reason','blank_reason',
    'wrong_job','wrong_receipt','null_receipt','wrong_hash','null_hash','wrong_raw','null_raw'] loop
    expected_error := case
      when test_name in ('null_approval','empty_reason','short_reason','blank_reason') then 'review_reconciliation_approval_required'
      else 'review_reconciliation_receipt_mismatch' end;
    caught := false;
    begin
      perform public.caronte_reconcile_twenty_seventh_review_references(
        case when test_name='wrong_job' then gen_random_uuid() else j.id end,
        case when test_name='wrong_receipt' then 'msg_wrong_twenty_seventh' when test_name='null_receipt' then null else receipt end,
        case when test_name='wrong_hash' then repeat('c',64) when test_name='null_hash' then null else authorized_hash end,
        case when test_name='null_approval' then null else approval end,
        case when test_name='wrong_raw' then jsonb_set(raw_artifact,'{scores,voice}','4')
          when test_name='null_raw' then null else raw_artifact end,candidate,
        case when test_name='empty_reason' then '' when test_name='short_reason' then 'short'
          when test_name='blank_reason' then '          ' else reason end);
    exception when others then
      if sqlerrm=expected_error then caught:=true; else raise; end if;
    end;
    if not caught then raise exception 'test_twenty_seventh_%_accepted',test_name; end if;
  end loop;

  -- Self-consistency is insufficient: stored and supplied identifiers can both
  -- match each other while failing the FIXED authorized twenty_seventh receipt/hash.
  foreach test_name in array array['stored_and_expected_other_receipt','stored_and_expected_other_hash','stored_and_expected_both_other'] loop
    begin
      update public.future_book_job_steps set
        provider_request_id=case when test_name<>'stored_and_expected_other_hash' then 'msg_other_self_consistent_twenty_seventh' else receipt end,
        input_hash=case when test_name<>'stored_and_expected_other_receipt' then repeat('e',64) else authorized_hash end
        where id=s.id;
      caught := false;
      begin
        perform public.caronte_reconcile_twenty_seventh_review_references(j.id,
          case when test_name<>'stored_and_expected_other_hash' then 'msg_other_self_consistent_twenty_seventh' else receipt end,
          case when test_name<>'stored_and_expected_other_receipt' then repeat('e',64) else authorized_hash end,
          approval,raw_artifact,candidate,reason);
      exception when others then
        if sqlerrm='review_reconciliation_receipt_mismatch' then caught:=true; else raise; end if;
      end;
      if not caught then raise exception 'test_twenty_seventh_%_accepted',test_name; end if;
      raise exception using errcode='ZT001',message='rollback_synthetic_twenty_seventh_case';
    exception when sqlstate 'ZT001' then null;
    end;
  end loop;

  -- Every evidence position is protected, including the ten unchanged indices.
  for i in 0..15 loop
    altered := jsonb_set(candidate,array['evidence',i::text,'paragraphIndex'],
      to_jsonb((candidate->'evidence'->i->>'paragraphIndex')::integer+1));
    caught := false;
    begin
      perform public.caronte_reconcile_twenty_seventh_review_references(j.id,receipt,authorized_hash,approval,raw_artifact,altered,reason);
    exception when others then
      if sqlerrm='review_reconciliation_evidence_mismatch' then caught:=true; else raise; end if;
    end;
    if not caught then raise exception 'test_twenty_seventh_changed_evidence_index_%_accepted',i; end if;
  end loop;
  foreach test_name in array array['raw_without_fix','score_change','quote_change','issue_change','rationale_change',
    'unit_change','coverage_change','verdict_change','evidence_unit_change','evidence_dimension_change',
    'new_root_field','new_evidence_field','evidence_removed','evidence_added','null_candidate'] loop
    altered := case test_name
      when 'raw_without_fix' then raw_artifact
      when 'score_change' then jsonb_set(candidate,'{scores,voice}','4')
      when 'quote_change' then jsonb_set(candidate,'{evidence,0,quote}','"A fabricated quotation cannot become approved."')
      when 'issue_change' then jsonb_set(candidate,'{issues}','[]')
      when 'rationale_change' then jsonb_set(candidate,'{evidence,0,rationale}','"Altered rationale"')
      when 'unit_change' then jsonb_set(candidate,'{unitId}','"ch_02_u_02"')
      when 'coverage_change' then jsonb_set(candidate,'{coveredUnitIds}','["ch_05_u_03","ch_05_u_04"]')
      when 'verdict_change' then jsonb_set(candidate,'{verdict}','"fail"')
      when 'evidence_unit_change' then jsonb_set(candidate,'{evidence,0,unitId}','"ch_05_u_04"')
      when 'evidence_dimension_change' then jsonb_set(candidate,'{evidence,0,dimension}','"voice"')
      when 'new_root_field' then candidate||'{"unapproved":"new root content"}'::jsonb
      when 'new_evidence_field' then jsonb_set(candidate,'{evidence,0,unapproved}','"new evidence content"')
      when 'evidence_removed' then jsonb_set(candidate,'{evidence}',(candidate->'evidence')-0)
      when 'evidence_added' then jsonb_set(candidate,'{evidence}',(candidate->'evidence')||jsonb_build_array(candidate->'evidence'->0))
      when 'null_candidate' then null end;
    caught := false;
    begin
      perform public.caronte_reconcile_twenty_seventh_review_references(j.id,receipt,authorized_hash,approval,raw_artifact,altered,reason);
    exception when others then
      if sqlerrm='review_reconciliation_evidence_mismatch' then caught:=true; else raise; end if;
    end;
    if not caught then raise exception 'test_twenty_seventh_%_accepted',test_name; end if;
  end loop;

  -- Each case is a subtransaction, so invalid fixture mutations are restored.
  foreach test_name in array array['job_queued','job_running','job_ready','job_cancelled','wrong_job_error','wrong_job_stage',
    'wrong_prompt','wrong_contract','wrong_reviewer','wrong_unit','wrong_stage','step_started','step_waiting',
    'step_completed','step_retry','second_attempt','zero_attempt','nonterminal','missing_terminal','uncertain',
    'missing_uncertain','provider_pending','wrong_provider','wrong_model','wrong_step_error','existing_output',
    'wrong_input_usage','wrong_output_usage','missing_input_usage','missing_output_usage','draft_not_completed',
    'draft_wrong_unit','draft_wrong_stage','draft_output_wrong_unit','draft_missing','review_missing',
    'draft_28_paragraphs','draft_30_paragraphs','draft_non_string','draft_non_array','active_lease'] loop
    begin
      update public.future_book_jobs set
        status=case test_name when 'job_queued' then 'queued' when 'job_running' then 'running'
          when 'job_ready' then 'ready' when 'job_cancelled' then 'cancelled' else j.status end,
        stage=case when test_name='wrong_job_stage' then 'draft' else j.stage end,
        error_code=case when test_name='wrong_job_error' then 'another_error' else j.error_code end,
        prompt_version=case when test_name='wrong_prompt' then 'caronte-longform-v1' else j.prompt_version end,
        model_config=case when test_name='wrong_contract' then jsonb_set(j.model_config,'{literaryContract,version}','"caronte-literary-v2"')
          when test_name='wrong_reviewer' then jsonb_set(j.model_config,'{reviewerModel}','"another_model"') else j.model_config end,
        lease_until=case when test_name='active_lease' then now()+interval '2 minutes' else j.lease_until end
        where id=j.id;
      update public.future_book_job_steps set
        step_key=case when test_name='review_missing' then 'review:ch_05_u_04:0' else s.step_key end,
        unit_id=case when test_name='wrong_unit' then 'ch_02_u_02' else s.unit_id end,
        stage=case when test_name='wrong_stage' then 'draft' else s.stage end,
        status=case test_name when 'step_started' then 'started' when 'step_waiting' then 'waiting'
          when 'step_completed' then 'completed' when 'step_retry' then 'retry' else s.status end,
        attempt=case when test_name='second_attempt' then 2 when test_name='zero_attempt' then 0 else s.attempt end,
        provider=case when test_name='wrong_provider' then 'openai' else s.provider end,
        model=case when test_name='wrong_model' then 'another_model' else s.model end,
        error_code=case when test_name='wrong_step_error' then 'another_error' else s.error_code end,
        output=case when test_name='existing_output' then candidate else s.output end,
        usage=case when test_name='wrong_input_usage' then jsonb_set(s.usage,'{input_tokens}','80304')
          when test_name='wrong_output_usage' then jsonb_set(s.usage,'{output_tokens}','5782')
          when test_name='missing_input_usage' then s.usage-'input_tokens'
          when test_name='missing_output_usage' then s.usage-'output_tokens' else s.usage end,
        diagnostic=case when test_name='nonterminal' then jsonb_set(s.diagnostic,'{terminal}','false')
          when test_name='missing_terminal' then s.diagnostic-'terminal'
          when test_name='uncertain' then jsonb_set(s.diagnostic,'{uncertain}','true')
          when test_name='missing_uncertain' then s.diagnostic-'uncertain'
          when test_name='provider_pending' then jsonb_set(s.diagnostic,'{providerStatus}','"waiting"') else s.diagnostic end
        where id=s.id;
      update public.future_book_job_steps set
        step_key=case when test_name='draft_missing' then 'draft:ch_05_u_04:0' else d.step_key end,
        status=case when test_name='draft_not_completed' then 'waiting' else d.status end,
        unit_id=case when test_name='draft_wrong_unit' then 'ch_05_u_04' else d.unit_id end,
        stage=case when test_name='draft_wrong_stage' then 'review' else d.stage end,
        output=case when test_name='draft_output_wrong_unit' then jsonb_set(d.output,'{unitId}','"ch_05_u_04"')
          when test_name='draft_28_paragraphs' then jsonb_set(d.output,'{paragraphs}',paragraphs-28)
          when test_name='draft_30_paragraphs' then jsonb_set(d.output,'{paragraphs}',paragraphs||'["An extra unapproved paragraph"]'::jsonb)
          when test_name='draft_non_string' then jsonb_set(d.output,'{paragraphs,0}','17')
          when test_name='draft_non_array' then jsonb_set(d.output,'{paragraphs}','{}') else d.output end
        where id=d.id;
      select to_jsonb(t) into before_job from public.future_book_jobs t where id=j.id;
      select to_jsonb(t) into before_session from public.future_book_sessions t where id=sid;
      select jsonb_agg(to_jsonb(t) order by t.id) into before_steps from public.future_book_job_steps t where job_id=j.id;
      expected_error := case when test_name='review_missing' then 'review_reconciliation_receipt_mismatch'
        else 'review_reconciliation_required' end;
      caught := false;
      begin
        perform public.caronte_reconcile_twenty_seventh_review_references(j.id,receipt,authorized_hash,approval,raw_artifact,candidate,reason);
      exception when others then
        if sqlerrm=expected_error then caught:=true; else raise; end if;
      end;
      if not caught then raise exception 'test_twenty_seventh_%_accepted',test_name; end if;
      if (select to_jsonb(t) from public.future_book_jobs t where id=j.id) is distinct from before_job
        or (select to_jsonb(t) from public.future_book_sessions t where id=sid) is distinct from before_session
        or (select jsonb_agg(to_jsonb(t) order by t.id) from public.future_book_job_steps t where job_id=j.id) is distinct from before_steps then
        raise exception 'test_twenty_seventh_%_rejection_mutated_state',test_name;
      end if;
      raise exception using errcode='ZT001',message='rollback_synthetic_twenty_seventh_case';
    exception when sqlstate 'ZT001' then null;
    end;
  end loop;

  -- Agreement between stored/raw/copy never waives literary evidence constraints.
  foreach test_name in array array['low_score','high_score','string_score','missing_score','major_issue','missing_issue_severity',
    'wrong_artifact_unit','wrong_verdict','wrong_coverage','issues_not_array','evidence_not_array',
    'fewer_evidence','extra_evidence','missing_dimension','four_quotes_dimension','unknown_dimension',
    'evidence_wrong_unit','unknown_quote','empty_quote','quote_not_string','duplicate_quote','index_string'] loop
    begin
      altered := case test_name
        when 'low_score' then jsonb_set(raw_artifact,'{scores,voice}','3')
        when 'high_score' then jsonb_set(raw_artifact,'{scores,voice}','6')
        when 'string_score' then jsonb_set(raw_artifact,'{scores,voice}','"5"')
        when 'missing_score' then jsonb_set(raw_artifact,'{scores}',(raw_artifact->'scores')-'voice')
        when 'major_issue' then jsonb_set(raw_artifact,'{issues,0,severity}','"major"')
        when 'missing_issue_severity' then jsonb_set(raw_artifact,'{issues,0}',(raw_artifact->'issues'->0)-'severity')
        when 'wrong_artifact_unit' then jsonb_set(raw_artifact,'{unitId}','"ch_02_u_02"')
        when 'wrong_verdict' then jsonb_set(raw_artifact,'{verdict}','"revise"')
        when 'wrong_coverage' then jsonb_set(raw_artifact,'{coveredUnitIds}','["ch_05_u_03","ch_05_u_04"]')
        when 'issues_not_array' then jsonb_set(raw_artifact,'{issues}','{}')
        when 'evidence_not_array' then jsonb_set(raw_artifact,'{evidence}','{}')
        when 'fewer_evidence' then jsonb_set(raw_artifact,'{evidence}',(raw_artifact->'evidence')-15)
        when 'extra_evidence' then jsonb_set(raw_artifact,'{evidence}',(raw_artifact->'evidence')||jsonb_build_array(raw_artifact->'evidence'->0))
        when 'missing_dimension' then jsonb_set(jsonb_set(raw_artifact,'{evidence,0,dimension}','"voice"'),'{evidence,1,dimension}','"voice"')
        when 'four_quotes_dimension' then jsonb_set(jsonb_set(raw_artifact,'{evidence,0,dimension}','"voice"'),'{evidence,4,dimension}','"voice"')
        when 'unknown_dimension' then jsonb_set(raw_artifact,'{evidence,0,dimension}','"not_a_dimension"')
        when 'evidence_wrong_unit' then jsonb_set(raw_artifact,'{evidence,0,unitId}','"ch_05_u_04"')
        when 'unknown_quote' then jsonb_set(raw_artifact,'{evidence,0,quote}','"This literal quote exists in no draft paragraph."')
        when 'empty_quote' then jsonb_set(raw_artifact,'{evidence,0,quote}','""')
        when 'quote_not_string' then jsonb_set(raw_artifact,'{evidence,0,quote}','17')
        when 'duplicate_quote' then jsonb_set(jsonb_set(raw_artifact,'{evidence,2,quote}',raw_artifact->'evidence'->0->'quote'),'{evidence,2,paragraphIndex}','1')
        when 'index_string' then jsonb_set(raw_artifact,'{evidence,0,paragraphIndex}','"1"') end;
      altered_copy := altered;
      for entry in select value from jsonb_array_elements(correction_map) loop
        altered_copy := jsonb_set(altered_copy,array['evidence',entry->>'evidenceIndex','paragraphIndex'],entry->'to');
      end loop;
      update public.future_book_job_steps set diagnostic=jsonb_set(s.diagnostic,'{artifact}',altered) where id=s.id;
      caught := false;
      begin
        perform public.caronte_reconcile_twenty_seventh_review_references(j.id,receipt,authorized_hash,approval,altered,altered_copy,reason);
      exception when others then
        if sqlerrm='review_reconciliation_evidence_mismatch' then caught:=true; else raise; end if;
      end;
      if not caught then raise exception 'test_twenty_seventh_%_accepted',test_name; end if;
      raise exception using errcode='ZT001',message='rollback_synthetic_twenty_seventh_case';
    exception when sqlstate 'ZT001' then null;
    end;
  end loop;

  -- Every corrected source index is fixed too, not merely the final index.
  for entry in select value from jsonb_array_elements(correction_map) loop
    begin
      altered := jsonb_set(raw_artifact,array['evidence',entry->>'evidenceIndex','paragraphIndex'],entry->'to');
      update public.future_book_job_steps set diagnostic=jsonb_set(s.diagnostic,'{artifact}',altered) where id=s.id;
      caught := false;
      begin
        perform public.caronte_reconcile_twenty_seventh_review_references(j.id,receipt,authorized_hash,approval,altered,candidate,reason);
      exception when others then
        if sqlerrm='review_reconciliation_evidence_mismatch' then caught:=true; else raise; end if;
      end;
      if not caught then raise exception 'test_twenty_seventh_wrong_from_index_%_accepted',entry->>'evidenceIndex'; end if;
      raise exception using errcode='ZT001',message='rollback_synthetic_twenty_seventh_case';
    exception when sqlstate 'ZT001' then null;
    end;
  end loop;
  begin
    update public.future_book_job_steps set output=jsonb_set(d.output,'{paragraphs,1}',
      to_jsonb((d.output->'paragraphs'->>1)||' '||(raw_artifact->'evidence'->0->>'quote'))) where id=d.id;
    caught := false;
    begin
      perform public.caronte_reconcile_twenty_seventh_review_references(j.id,receipt,authorized_hash,approval,raw_artifact,candidate,reason);
    exception when others then
      if sqlerrm='review_reconciliation_evidence_mismatch' then caught:=true; else raise; end if;
    end;
    if not caught then raise exception 'test_twenty_seventh_ambiguous_quote_accepted'; end if;
    raise exception using errcode='ZT001',message='rollback_synthetic_twenty_seventh_case';
  exception when sqlstate 'ZT001' then null;
  end;

  -- All failed attempts preserve the complete original state and approval.
  if (select to_jsonb(t) from public.future_book_job_steps t where id=s.id) is distinct from to_jsonb(s)
    or (select to_jsonb(t) from public.future_book_jobs t where id=j.id) is distinct from original_job
    or (select to_jsonb(t) from public.future_book_sessions t where id=sid) is distinct from original_session
    or (select jsonb_agg(to_jsonb(t) order by t.id) from public.future_book_job_steps t where job_id=j.id and id<>s.id) is distinct from original_other_steps then
    raise exception 'test_twenty_seventh_rejected_reconciliation_changed_original_state';
  end if;

  r := public.caronte_reconcile_twenty_seventh_review_references(j.id,receipt,authorized_hash,approval,raw_artifact,candidate,reason);
  if r.id<>j.id or r.status<>'queued' or r.stage<>'review' or r.error_code is not null
    or r.lease_token is not null or r.lease_until is not null
    or (to_jsonb(r)-array['status','error_code','lease_token','lease_until','next_run_at','updated_at']) is distinct from
       (original_job-array['status','error_code','lease_token','lease_until','next_run_at','updated_at']) then
    raise exception 'test_twenty_seventh_same_job_not_queued_without_lease';
  end if;
  if not exists(select 1 from public.future_book_sessions where id=sid and status='book_generating'
    and book_status='queued' and error_code is null)
    or ((select to_jsonb(t) from public.future_book_sessions t where id=sid)-array['status','book_status','error_code','updated_at']) is distinct from
       (original_session-array['status','book_status','error_code','updated_at']) then
    raise exception 'test_twenty_seventh_session_not_resumed_without_other_changes';
  end if;
  select * into s from public.future_book_job_steps where id=s.id;
  if s.status<>'completed' or s.error_code is not null or s.output is distinct from candidate
    or s.provider_request_id<>receipt or s.input_hash<>authorized_hash or s.attempt<>1
    or s.usage is distinct from before_step->'usage' or s.diagnostic is distinct from before_step->'diagnostic'
    or (to_jsonb(s)-array['history','status','output','error_code','updated_at']) is distinct from
       (before_step-array['status','output','error_code','updated_at']) then
    raise exception 'test_twenty_seventh_original_receipt_raw_response_or_cost_not_preserved';
  end if;
  if jsonb_array_length(s.history)<>2
    or s.history->0 is distinct from '{"action":"synthetic_original_receipt_checkpoint","attempt":1,"note":"Preserve prior history"}'::jsonb
    or s.history->1->>'action'<>'approved_review_reference_reconciliation'
    or s.history->1->>'approval_id'<>approval::text or s.history->1->'receipt' is distinct from before_step
    or s.history->1->'corrections' is distinct from correction_map
    or s.history->1->'validated_output' is distinct from candidate
    or s.history->1->>'reason'<>reason then
    raise exception 'test_twenty_seventh_original_history_receipt_or_exact_map_not_preserved';
  end if;
  changed_count := 0;
  for i in 0..15 loop
    if ((s.output->'evidence'->i)-'paragraphIndex') is distinct from ((raw_artifact->'evidence'->i)-'paragraphIndex') then
      raise exception 'test_twenty_seventh_evidence_content_changed';
    end if;
    if s.output->'evidence'->i->'paragraphIndex' is distinct from raw_artifact->'evidence'->i->'paragraphIndex' then
      changed_count := changed_count+1;
    end if;
  end loop;
  if changed_count<>6 or (s.output-'evidence') is distinct from (raw_artifact-'evidence') then
    raise exception 'test_twenty_seventh_not_only_six_reference_differences';
  end if;
  if (select to_jsonb(t) from public.future_book_job_steps t where id=d.id) is distinct from before_draft
    or (select jsonb_agg(to_jsonb(t) order by t.id) from public.future_book_job_steps t where job_id=j.id and id<>s.id) is distinct from original_other_steps
    or (select count(*) from public.future_book_jobs where session_id=sid)<>1 then
    raise exception 'test_twenty_seventh_original_rows_changed_or_new_job_created';
  end if;

  -- The same approval is a no-op once the worker has begun the twenty_eighth draft.
  update public.future_book_jobs set status='running',stage='draft',lease_token=gen_random_uuid(),
    lease_until=now()+interval '2 minutes',next_run_at=now()+interval '1 minute' where id=j.id;
  update public.future_book_sessions set book_status='generating' where id=sid;
  insert into public.future_book_job_steps(job_id,step_key,stage,unit_id,status,provider,model,attempt,provider_request_id,input_hash,usage,history)
    values(j.id,'draft:ch_05_u_04:0','draft','ch_05_u_04','started','openai','gpt-6.1-sol',1,
      'resp_synthetic_twenty_eighth_draft',repeat('f',64),'{"input_tokens":123,"output_tokens":0}',
      '[{"action":"synthetic_twenty_eighth_started"}]');
  select to_jsonb(t) into before_job from public.future_book_jobs t where id=j.id;
  select to_jsonb(t) into before_session from public.future_book_sessions t where id=sid;
  select jsonb_agg(to_jsonb(t) order by t.id) into before_steps from public.future_book_job_steps t where job_id=j.id;
  select to_jsonb(t) into before_next_step from public.future_book_job_steps t where job_id=j.id and step_key='draft:ch_05_u_04:0';
  after_step := to_jsonb(s);
  r := public.caronte_reconcile_twenty_seventh_review_references(j.id,receipt,authorized_hash,approval,raw_artifact,candidate,reason);
  if (select to_jsonb(t) from public.future_book_jobs t where id=j.id) is distinct from before_job
    or to_jsonb(r) is distinct from before_job
    or (select to_jsonb(t) from public.future_book_sessions t where id=sid) is distinct from before_session
    or (select jsonb_agg(to_jsonb(t) order by t.id) from public.future_book_job_steps t where job_id=j.id) is distinct from before_steps
    or (select to_jsonb(t) from public.future_book_job_steps t where job_id=j.id and step_key='draft:ch_05_u_04:0') is distinct from before_next_step
    or (select to_jsonb(t) from public.future_book_job_steps t where id=s.id) is distinct from after_step then
    raise exception 'test_twenty_seventh_approval_replay_reset_twenty_eighth_work';
  end if;
  foreach test_name in array array['second_approval','replay_wrong_receipt','replay_wrong_hash','replay_wrong_raw','replay_wrong_copy'] loop
    caught := false;
    begin
      perform public.caronte_reconcile_twenty_seventh_review_references(j.id,
        case when test_name='replay_wrong_receipt' then 'msg_other_replay_twenty_seventh' else receipt end,
        case when test_name='replay_wrong_hash' then repeat('c',64) else authorized_hash end,
        case when test_name='second_approval' then gen_random_uuid() else approval end,
        case when test_name='replay_wrong_raw' then jsonb_set(raw_artifact,'{scores,voice}','4') else raw_artifact end,
        case when test_name='replay_wrong_copy' then jsonb_set(candidate,'{scores,voice}','4') else candidate end,reason);
    exception when others then
      if sqlerrm='review_reconciliation_already_consumed' then caught:=true; else raise; end if;
    end;
    if not caught then raise exception 'test_twenty_seventh_%_accepted',test_name; end if;
  end loop;
  if (select to_jsonb(t) from public.future_book_jobs t where id=j.id) is distinct from before_job
    or (select to_jsonb(t) from public.future_book_sessions t where id=sid) is distinct from before_session
    or (select jsonb_agg(to_jsonb(t) order by t.id) from public.future_book_job_steps t where job_id=j.id) is distinct from before_steps then
    raise exception 'test_twenty_seventh_consumed_recovery_mutated_state';
  end if;
end;
$$;
rollback;
