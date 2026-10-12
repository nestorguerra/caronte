-- Explicit operator approval of six metadata references; never a model retry.
-- The literary validator, immutable draft, original provider receipt and cost stay intact.
create function public.caronte_reconcile_review_references(
  p_job_id uuid,p_expected_receipt text,p_input_hash text,p_approval_id uuid,
  p_expected_artifact jsonb,p_validated_output jsonb,p_reason text
) returns public.future_book_jobs
language plpgsql security invoker set search_path='' as $$
declare
  j public.future_book_jobs;s public.future_book_job_steps;d public.future_book_job_steps;
  approval jsonb;raw_artifact jsonb;expected jsonb;entry jsonb;evidence jsonb;
  matches integer;exact_index integer;dimension text;
  corrections constant jsonb := '[{"evidenceIndex":3,"from":25,"to":24},{"evidenceIndex":4,"from":22,"to":21},{"evidenceIndex":5,"from":23,"to":22},{"evidenceIndex":7,"from":28,"to":27},{"evidenceIndex":8,"from":30,"to":29},{"evidenceIndex":9,"from":24,"to":23}]';
begin
  if p_approval_id is null or coalesce(length(trim(p_reason)),0)<8 then
    raise exception 'review_reconciliation_approval_required';end if;
  select * into j from public.future_book_jobs where id=p_job_id for update;
  select * into s from public.future_book_job_steps
    where job_id=p_job_id and step_key='review:ch_02_u_02:0' for update;
  if j.id is null or s.id is null then raise exception 'review_reconciliation_receipt_mismatch';end if;
  select h into approval from jsonb_array_elements(s.history) h
    where h->>'action'='approved_review_reference_reconciliation' limit 1;
  if approval is not null then
    if approval->>'approval_id'=p_approval_id::text
      and approval->'receipt'->>'provider_request_id'=p_expected_receipt
      and approval->'receipt'->>'input_hash'=p_input_hash
      and approval->'receipt'->'diagnostic'->'artifact'=p_expected_artifact
      and approval->'validated_output'=p_validated_output then return j;end if;
    raise exception 'review_reconciliation_already_consumed';
  end if;
  raw_artifact:=s.diagnostic->'artifact';
  if p_expected_receipt is null or p_input_hash is null or p_expected_artifact is null
    or s.provider_request_id is distinct from p_expected_receipt
    or s.input_hash is distinct from p_input_hash
    or raw_artifact is distinct from p_expected_artifact then
    raise exception 'review_reconciliation_receipt_mismatch';end if;
  select * into d from public.future_book_job_steps
    where job_id=p_job_id and step_key='draft:ch_02_u_02:0' for update;
  if j.status<>'blocked' or j.stage<>'review' or j.error_code is distinct from 'review_evidence_mismatch'
    or j.prompt_version is distinct from 'caronte-longform-v2'
    or j.model_config->'literaryContract'->>'version' is distinct from 'caronte-literary-v3'
    or j.model_config->>'reviewerModel' is distinct from 'claude-opus-5-5'
    or j.lease_until>now() or j.manuscript_id is not null
    or s.stage<>'review' or s.unit_id is distinct from 'ch_02_u_02' or s.status<>'failed'
    or s.provider is distinct from 'anthropic' or s.model is distinct from 'claude-opus-5-5'
    or s.provider_request_id !~ '^msg_[a-zA-Z0-9_-]{1,200}$'
    or s.input_hash !~ '^[a-f0-9]{64}$' or s.attempt<>1
    or s.error_code is distinct from 'review_evidence_mismatch'
    or s.diagnostic->'terminal' is distinct from 'true'::jsonb
    or s.diagnostic->'uncertain' is distinct from 'false'::jsonb
    or s.diagnostic->>'providerStatus' is distinct from 'completed'
    or s.usage->>'input_tokens' is distinct from '62423'
    or s.usage->>'output_tokens' is distinct from '5139'
    or (s.output is not null and s.output<>'null'::jsonb)
    or d.id is null or d.status<>'completed' or d.stage<>'draft'
    or d.unit_id is distinct from 'ch_02_u_02' or d.output->>'unitId' is distinct from 'ch_02_u_02'
    or jsonb_typeof(d.output->'paragraphs') is distinct from 'array' then
    raise exception 'review_reconciliation_required';end if;
  if jsonb_array_length(d.output->'paragraphs')<>29
    or exists(select 1 from jsonb_array_elements(d.output->'paragraphs') p where jsonb_typeof(p)<>'string') then
    raise exception 'review_reconciliation_required';end if;
  if jsonb_typeof(raw_artifact) is distinct from 'object'
    or raw_artifact->>'unitId' is distinct from 'ch_02_u_02'
    or raw_artifact->>'verdict' is distinct from 'pass'
    or raw_artifact->'coveredUnitIds' is distinct from '["ch_02_u_02"]'::jsonb
    or jsonb_typeof(raw_artifact->'scores') is distinct from 'object'
    or jsonb_typeof(raw_artifact->'issues') is distinct from 'array'
    or jsonb_typeof(raw_artifact->'evidence') is distinct from 'array' then
    raise exception 'review_reconciliation_evidence_mismatch';end if;
  if jsonb_array_length(raw_artifact->'evidence')<>16
    or exists(select 1 from jsonb_array_elements(raw_artifact->'issues') issue
      where issue->>'severity' is distinct from 'minor') then
    raise exception 'review_reconciliation_evidence_mismatch';end if;
  foreach dimension in array array['grounding','voice','depth','futureTexture','coherence','originality','recognition','causalPlausibility'] loop
    if coalesce(raw_artifact->'scores'->dimension not in ('4'::jsonb,'5'::jsonb),true)
      or (select count(*) from jsonb_array_elements(raw_artifact->'evidence') e where e->>'dimension'=dimension) not between 1 and 3 then
      raise exception 'review_reconciliation_evidence_mismatch';end if;
  end loop;
  expected:=raw_artifact;
  for entry in select value from jsonb_array_elements(corrections) loop
    if raw_artifact->'evidence'->(entry->>'evidenceIndex')::integer->'paragraphIndex' is distinct from entry->'from' then
      raise exception 'review_reconciliation_evidence_mismatch';end if;
    expected:=jsonb_set(expected,array['evidence',entry->>'evidenceIndex','paragraphIndex'],entry->'to');
  end loop;
  -- Equality of the entire JSON forbids changing scores, quotes, issues or prose.
  if p_validated_output is distinct from expected then raise exception 'review_reconciliation_evidence_mismatch';end if;
  for evidence in select value from jsonb_array_elements(expected->'evidence') loop
    if evidence->>'unitId' is distinct from 'ch_02_u_02'
      or jsonb_typeof(evidence->'quote') is distinct from 'string'
      or coalesce(length(evidence->>'quote'),0)=0
      or jsonb_typeof(evidence->'paragraphIndex') is distinct from 'number'
      or coalesce(evidence->>'paragraphIndex','') !~ '^[1-9][0-9]?$' then
      raise exception 'review_reconciliation_evidence_mismatch';end if;
    select count(*),min(p.ordinality)::integer into matches,exact_index
      from jsonb_array_elements_text(d.output->'paragraphs') with ordinality p(paragraph,ordinality)
      where position(evidence->>'quote' in p.paragraph)>0;
    if matches<>1 or exact_index<>(evidence->>'paragraphIndex')::integer then
      raise exception 'review_reconciliation_evidence_mismatch';end if;
  end loop;
  update public.future_book_job_steps set history=history||jsonb_build_array(jsonb_build_object(
    'at',now(),'action','approved_review_reference_reconciliation','approval_id',p_approval_id,
    'reason',left(p_reason,1000),'receipt',to_jsonb(s)-'history','corrections',corrections,
    'validated_output',p_validated_output)),status='completed',output=p_validated_output,
    error_code=null,updated_at=now() where id=s.id;
  update public.future_book_jobs set status='queued',error_code=null,lease_token=null,lease_until=null,
    next_run_at=now(),updated_at=now() where id=j.id returning * into j;
  update public.future_book_sessions set status='book_generating',book_status='queued',error_code=null,
    updated_at=now() where id=j.session_id;
  return j;
end;$$;
revoke all on function public.caronte_reconcile_review_references(uuid,text,text,uuid,jsonb,jsonb,text) from public,anon,authenticated;
grant execute on function public.caronte_reconcile_review_references(uuid,text,text,uuid,jsonb,jsonb,text) to service_role;
