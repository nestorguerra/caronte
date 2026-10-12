import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { planNextStep, collectArtifacts, runClaimedJob, publicBookJob } from '../supabase/functions/_shared/caronte-jobs.mjs';
import { validateArtifact, LITERARY_CONTRACT } from '../supabase/functions/_shared/caronte-literary.mjs';

function hash(value) {
  const canonical = (item) => Array.isArray(item) ? item.map(canonical) : item && typeof item === 'object'
    ? Object.fromEntries(Object.keys(item).sort().map(key => [key, canonical(item[key])])) : item;
  return createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
}

const completed = (key, stage, output, unitId = null) => ({ step_key: key, stage, unit_id: unitId, status: 'completed', output });
const outline = { chapters: Array.from({ length: 5 }, (_, c) => ({
  id: `ch_${String(c + 1).padStart(2, '0')}`,
  units: Array.from({ length: 6 }, (_, u) => ({ id: `ch_${String(c + 1).padStart(2, '0')}_u_${String(u + 1).padStart(2, '0')}` }))
})) };
const base = [completed('biography', 'biography', { age: { current: 50, future: 90 } }), completed('world', 'world', {}), completed('outline', 'outline', outline)];
assert.equal(planNextStep([]).key, 'biography');
assert.equal(planNextStep(base.slice(0, 1)).key, 'world');
assert.equal(planNextStep(base).key, 'draft:ch_01_u_01:0');
const first = [...base, completed('draft:ch_01_u_01:0', 'draft', { unitId: 'ch_01_u_01', paragraphs: ['Full draft'] }, 'ch_01_u_01')];
assert.equal(planNextStep(first).stage, 'review');
const revised = [...first, completed('review:ch_01_u_01:0', 'review', { verdict: 'revise', issues: [{ detail: 'Too generic' }] }, 'ch_01_u_01')];
assert.equal(planNextStep(revised).key, 'revision:ch_01_u_01:1');
assert.equal(planNextStep([...first, completed('review:ch_01_u_01:0', 'review', { verdict: 'block' }, 'ch_01_u_01')]).blocked, true);
const all = [...base];
for (const unit of outline.chapters.flatMap(c => c.units)) {
  all.push(completed(`draft:${unit.id}:0`, 'draft', { unitId: unit.id, paragraphs: ['text'] }, unit.id));
  all.push(completed(`review:${unit.id}:0`, 'review', { verdict: 'pass' }, unit.id));
}
assert.equal(planNextStep(all).stage, 'longitudinal');
assert.equal(planNextStep([...all, completed('longitudinal:0', 'longitudinal', { verdict: 'pass' })]).finalize, true);
assert.equal(planNextStep([...all, completed('longitudinal:0', 'longitudinal', { verdict: 'revise', issues: [{ location: 'ch_03_u_02', instruction: 'Resolve contradiction' }] })]).unit.id, 'ch_03_u_02');
assert.equal(Object.keys(collectArtifacts(all).drafts).length, 30);
assert.equal(publicBookJob({ id: 'j', status: 'queued', interview: { private: 'NEVER PUBLIC' } }, all).interview, undefined);

const job = { id: 'job', interview: { sources: [] }, lease_token: 'lease' };
const writes = [];
const io = {
  job, steps: [],
  checkpoint: async (step, state) => { writes.push({ step, state }); },
  finish: async () => { throw new Error('unexpected finalization'); },
  build: () => ({ prompt: 'private source' }),
  validate: (_stage, output) => output,
  assemble: () => ({}),
  provider: { start: async () => ({ status: 'pending', id: 'resp_1', provider: 'openai', model: 'writer' }) }
};
await runClaimedJob(io);
assert.equal(writes[0].step.status, 'started');
assert.equal(writes.at(-1).step.provider_request_id, 'resp_1');
assert.equal(writes.at(-1).state, 'queued');

let starts = 0;
const pending = { step_key: 'biography', stage: 'biography', status: 'waiting', provider: 'openai', provider_request_id: 'resp_1', attempt: 1, input_hash: hash({ prompt: 'private source' }) };
await runClaimedJob({ ...io, steps: [pending], provider: {
  start: async () => { starts++; },
  poll: async ({ id }) => ({ status: 'completed', id, parsed: { age: 50 }, usage: { output_tokens: 42 } })
} });
assert.equal(starts, 0);
assert.equal(writes.at(-1).step.status, 'completed');
assert.equal(writes.at(-1).step.usage.output_tokens, 42);

await runClaimedJob({ ...io, steps: [{ ...pending, status: 'started', provider_request_id: null }] });
assert.equal(writes.at(-1).state, 'blocked');
assert.equal(writes.at(-1).step.error_code, 'provider_submission_uncertain');
await runClaimedJob({ ...io, provider: { start: async () => { const e = new Error('secret not logged'); e.code = 'provider_missing'; e.terminal = true; throw e; } } });
assert.equal(writes.at(-1).state, 'blocked');
assert.equal(writes.at(-1).step.error_code, 'provider_missing');
assert.equal(JSON.stringify(writes).includes('secret not logged'), false);
console.log('Caronte durable job behavior checks OK');

function setup(overrides = {}) {
  const writes = [];
  const calls = { start: 0, poll: 0, finish: 0 };
  const input = {
    job: { id: 'job', interview: { sources: [] }, model_config: { writerModel: 'writer', reviewerModel: 'reviewer' } },
    steps: [],
    checkpoint: async (step, state, delay) => { writes.push({ step: structuredClone(step), state, delay }); },
    finish: async () => { calls.finish++; },
    build: () => ({ prompt: 'private source', schema: { type: 'object', properties: {} } }),
    validate: async (_stage, value) => value,
    assemble: async (artifacts) => ({ title: 'Approved', bindings: artifacts.approvalBindings }),
    provider: {
      start: async () => { calls.start++; return { status: 'pending', id: 'resp_1', model: 'writer' }; },
      poll: async ({ id }) => { calls.poll++; return { status: 'completed', id, model: 'writer', parsed: { text: 'complete' } }; }
    }, ...overrides
  };
  return { input, writes, calls };
}

test('request fingerprint is checkpointed before paid submission, not added afterwards', async () => {
  const request = { prompt: 'Complete input', schema: { type: 'object' } };
  const { input, writes } = setup({ build: async () => request });
  input.provider.start = async () => {
    assert.equal(writes.length, 1);
    assert.equal(writes[0].step.status, 'started');
    assert.equal(writes[0].step.input_hash, hash(request));
    return { status: 'pending', id: 'resp_1', model: 'writer' };
  };
  await runClaimedJob(input);
  assert.equal(writes.at(-1).step.input_hash, hash(request));
});

test('unit review binds the exact full draft, not the prompt or model-provided binding', async () => {
  const draft = { unitId: 'ch_01_u_01', paragraphs: ['Every paragraph must be bound.'], continuityNotes: ['A motif'] };
  const { input, writes } = setup({ steps: [...base, completed('draft:ch_01_u_01:0', 'draft', draft, draft.unitId)] });
  input.provider.start = async (_request, options) => {
    assert.equal(options.provider, 'anthropic');
    assert.equal(writes[0].step.input_hash, hash(draft));
    return { status: 'completed', id: 'msg_review', model: 'reviewer', parsed: { verdict: 'pass', input_hash: 'forged' } };
  };
  await runClaimedJob(input);
  assert.equal(writes.at(-1).step.input_hash, hash(draft));
  assert.equal(writes.at(-1).step.status, 'completed');
  assert.equal(collectArtifacts([...input.steps, writes.at(-1).step]).approvalBindings.units[draft.unitId], hash(draft));
});

test('longitudinal review binds all thirty complete drafts in outline order', async () => {
  const withBindings = all.map(step => step.stage === 'review'
    ? { ...step, input_hash: hash(all.find(s => s.unit_id === step.unit_id && s.stage === 'draft').output) } : step);
  const expected = hash(outline.chapters.flatMap(c => c.units).map(unit => all.find(s => s.unit_id === unit.id && s.stage === 'draft').output));
  const { input, writes } = setup({ steps: [...withBindings].reverse() });
  input.provider.start = async () => {
    assert.equal(writes[0].step.input_hash, expected);
    return { status: 'completed', id: 'msg_longitudinal', model: 'reviewer', parsed: { verdict: 'pass' } };
  };
  await runClaimedJob(input);
  const artifacts = collectArtifacts([...input.steps, writes.at(-1).step]);
  assert.equal(artifacts.approvalBindings.longitudinal, expected);
  assert.equal(Object.keys(artifacts.approvalBindings.units).length, 30);
});

test('artifact collection chooses the latest draft and review even when DB rows are unordered', () => {
  const unitId = 'ch_01_u_01';
  const latestDraft = { unitId, paragraphs: ['New text'] };
  const latestReview = { verdict: 'pass', approvalBindings: { units: { [unitId]: 'forged' } } };
  const steps = [
    { ...completed(`revision:${unitId}:2`, 'revision', latestDraft, unitId) },
    { ...completed(`review:${unitId}:2`, 'review', latestReview, unitId), input_hash: hash(latestDraft) },
    { ...completed('longitudinal:1', 'longitudinal', { verdict: 'pass' }), input_hash: 'b'.repeat(64) },
    ...first,
    { ...completed(`review:${unitId}:0`, 'review', { verdict: 'revise' }, unitId), input_hash: 'a'.repeat(64) },
    { ...completed('longitudinal:0', 'longitudinal', { verdict: 'revise' }), input_hash: 'a'.repeat(64) }
  ];
  const artifacts = collectArtifacts(steps);
  assert.deepEqual(artifacts.drafts[unitId], latestDraft);
  assert.deepEqual(artifacts.reviews[unitId], latestReview);
  assert.equal(artifacts.approvalBindings.units[unitId], hash(latestDraft));
  assert.equal(artifacts.approvalBindings.longitudinal, 'b'.repeat(64));
});

test('a newer draft requires its own review rather than inheriting an earlier pass', () => {
  const unitId = 'ch_01_u_01';
  const steps = [...first, completed(`review:${unitId}:0`, 'review', { verdict: 'pass' }, unitId), completed(`revision:${unitId}:1`, 'revision', { unitId, paragraphs: ['Changed'] }, unitId)];
  assert.equal(planNextStep(steps).key, `review:${unitId}:1`);
});

test('validation and assembly are awaited before persistence/finalization', async () => {
  const { input, writes } = setup({ validate: async () => { await Promise.resolve(); return { validated: true }; } });
  input.provider.start = async () => ({ status: 'completed', id: 'resp_1', model: 'writer', parsed: {} });
  await runClaimedJob(input);
  assert.deepEqual(writes.at(-1).step.output, { validated: true });
  const finalInput = setup({
    steps: [...all, completed('longitudinal:0', 'longitudinal', { verdict: 'pass' })],
    assemble: async () => { await Promise.resolve(); return { title: 'Awaited manuscript' }; },
    finish: async (manuscript) => { assert.deepEqual(manuscript, { title: 'Awaited manuscript' }); }
  });
  assert.equal((await runClaimedJob(finalInput.input)).status, 'ready');
});

test('a rejected asynchronous assembly never calls finish or returns ready', async () => {
  const { input, writes, calls } = setup({ steps: [...all, completed('longitudinal:0', 'longitudinal', { verdict: 'pass' })], assemble: async () => { throw Object.assign(new Error('Private text'), { code: 'stale_unit_approval' }); } });
  assert.deepEqual(await runClaimedJob(input), { status: 'blocked', errorCode: 'stale_unit_approval' });
  assert.equal(calls.finish, 0);
  assert.equal(writes.at(-1).step.error_code, 'stale_unit_approval');
});

test('in-flight handles with missing or changed fingerprints cannot restart or apply stale output', async () => {
  for (const input_hash of [null, '0'.repeat(64)]) {
    const { input, writes, calls } = setup({ steps: [{ ...pending, input_hash }] });
    await runClaimedJob(input);
    assert.equal(calls.start, 0);
    assert.equal(calls.poll, 0);
    assert.equal(writes.at(-1).state, 'blocked');
    assert.equal(writes.at(-1).step.error_code, 'stale_step_input');
  }
});

test('uncertain POST remains blocked after a later worker restart', async () => {
  for (const previous of [
    { ...pending, status: 'started', provider_request_id: null },
    { ...pending, status: 'waiting', provider_request_id: null },
    { ...pending, status: 'failed', provider_request_id: null, error_code: 'provider_submission_uncertain' }
  ]) {
    const { input, writes, calls } = setup({ steps: [previous] });
    await runClaimedJob(input);
    assert.equal(calls.start, 0);
    assert.equal(writes.at(-1).state, 'blocked');
    assert.equal(writes.at(-1).step.error_code, 'provider_submission_uncertain');
  }
});

test('unknown POST exception cannot be made retryable without proof it was rejected', async () => {
  const { input, writes, calls } = setup();
  input.provider.start = async () => { calls.start++; throw Object.assign(new Error('Private text'), { code: 'socket_closed', retryable: true }); };
  await runClaimedJob(input);
  assert.equal(calls.start, 1);
  assert.equal(writes.at(-1).state, 'blocked');
  assert.equal(writes.at(-1).step.error_code, 'provider_submission_uncertain');
});

test('a transient polling error preserves the handle and requeues polling, not submission', async () => {
  const request = { prompt: 'private source', schema: { type: 'object', properties: {} } };
  const { input, writes, calls } = setup({ steps: [{ ...pending, model: 'writer', input_hash: hash(request) }] });
  input.provider.poll = async () => { calls.poll++; throw Object.assign(new Error('Private text'), { code: 'provider_poll_unavailable', id: 'resp_1', terminal: false, uncertain: false }); };
  await runClaimedJob(input);
  assert.equal(calls.start, 0);
  assert.equal(calls.poll, 1);
  assert.equal(writes.at(-1).step.provider_request_id, 'resp_1');
  assert.equal(writes.at(-1).step.status, 'waiting');
  assert.equal(writes.at(-1).state, 'queued');
});

test('terminal errors preserve receipt, configured model, usage and safe status metadata', async () => {
  const { input, writes } = setup();
  input.provider.start = async () => { throw Object.assign(new Error('Private text'), { code: 'provider_output_incomplete', id: 'resp_failed', terminal: true, uncertain: false, providerStatus: 'incomplete', reason: 'max_output_tokens', usage: { input_tokens: 300, output_tokens: 7000 }, httpStatus: 200 }); };
  await runClaimedJob(input);
  const receipt = writes.at(-1).step;
  assert.equal(receipt.provider_request_id, 'resp_failed');
  assert.equal(receipt.model, 'writer');
  assert.deepEqual(receipt.usage, { input_tokens: 300, output_tokens: 7000 });
  assert.equal(receipt.diagnostic.providerStatus, 'incomplete');
  assert.equal(receipt.diagnostic.reason, 'max_output_tokens');
  assert.equal(receipt.diagnostic.uncertain, false);
  assert.equal(JSON.stringify(receipt).includes('Private text'), false);
});

test('lease loss before submission, after acceptance or during finish never triggers compensating writes or POST', async () => {
  for (const loseOnWrite of [1, 2]) {
    const { input, calls } = setup();
    let count = 0;
    input.checkpoint = async () => { count++; if (count === loseOnWrite) throw Object.assign(new Error('Lease expired'), { code: 'lease_lost' }); };
    await assert.rejects(runClaimedJob(input), { code: 'lease_lost' });
    assert.equal(count, loseOnWrite);
    assert.equal(calls.start, loseOnWrite === 1 ? 0 : 1);
  }
  const { input, writes } = setup({ steps: [...all, completed('longitudinal:0', 'longitudinal', { verdict: 'pass' })], finish: async () => { throw Object.assign(new Error(), { code: 'lease_lost' }); } });
  await assert.rejects(runClaimedJob(input), { code: 'lease_lost' });
  assert.equal(writes.length, 0);
});

test('poll cannot replace a persisted handle or validate output from another request', async () => {
  const { input, writes, calls } = setup({ steps: [{ ...pending, input_hash: hash({ prompt: 'private source', schema: { type: 'object', properties: {} } }) }] });
  input.provider.poll = async () => ({ status: 'completed', id: 'resp_other', parsed: { wrong: 'request' } });
  input.validate = () => { throw new Error('must not validate mismatched output'); };
  await runClaimedJob(input);
  assert.equal(calls.start, 0);
  assert.equal(writes.at(-1).state, 'blocked');
  assert.equal(writes.at(-1).step.error_code, 'provider_response_mismatch');
  assert.equal(writes.at(-1).step.provider_request_id, 'resp_1');
});

test('Anthropic synchronous review cannot become a pending message that has no polling API', async () => {
  const { input, writes } = setup({ steps: first });
  input.provider.start = async () => ({ status: 'pending', id: 'msg_review', model: 'reviewer' });
  await runClaimedJob(input);
  assert.equal(writes.at(-1).state, 'blocked');
  assert.equal(writes.at(-1).step.provider_request_id, 'msg_review');
  assert.equal(writes.at(-1).step.error_code, 'invalid_provider_status');
});

test('a completed but invalid Opus review retains its exact artifact privately and stays terminal', async () => {
  const dimensions = ['grounding','voice','depth','futureTexture','coherence','originality','recognition','causalPlausibility'];
  const rejected = {unitId:'ch_01_u_01',verdict:'pass',scores:Object.fromEntries(dimensions.map(name=>[name,5])),
    issues:[],coveredUnitIds:['ch_01_u_01'],evidence:dimensions.map(dimension=>({dimension,
      unitId:'ch_01_u_01',paragraphIndex:1,quote:'This quotation does not exist.',rationale:'PRIVATE REVIEW CORPUS'}))};
  const {input,writes,calls}=setup({steps:first,validate:validateArtifact});
  input.job.model_config.literaryContract=LITERARY_CONTRACT;
  input.provider.start=async()=>{calls.start++;return {status:'completed',id:'msg_bad_evidence',
    model:'claude-opus-5-5',usage:{input_tokens:59525,output_tokens:4939},parsed:rejected};};
  assert.deepEqual(await runClaimedJob(input),{status:'blocked',errorCode:'review_evidence_mismatch'});
  const receipt=writes.at(-1).step;
  assert.equal(receipt.status,'failed');assert.equal(receipt.output,undefined);
  assert.equal(receipt.provider_request_id,'msg_bad_evidence');
  assert.deepEqual(receipt.usage,{input_tokens:59525,output_tokens:4939});
  assert.deepEqual(receipt.diagnostic,{terminal:true,uncertain:false,providerStatus:'completed',artifact:rejected});
  assert.equal(collectArtifacts([...first,receipt]).reviews.ch_01_u_01,undefined);
  assert.equal(JSON.stringify(publicBookJob(input.job,[...first,receipt])).includes('PRIVATE REVIEW CORPUS'),false);
  const resumed=setup({steps:[...first,receipt]});
  await runClaimedJob(resumed.input);
  assert.equal(resumed.calls.start,0);assert.equal(resumed.calls.poll,0);
  assert.equal(resumed.writes.at(-1).state,'blocked');assert.equal(calls.start,1);
});

test('other completed validation failures preserve the raw artifact without swallowing lease loss',async()=>{
  for(const code of ['unit_word_count','lease_lost']){
    const {input,writes}=setup({validate:()=>{throw Object.assign(new Error('PRIVATE VALIDATION DETAIL'),{code});}});
    input.provider.start=async()=>({status:'completed',id:'resp_invalid_draft',model:'writer',parsed:{text:'PRIVATE FULL DRAFT'}});
    if(code==='lease_lost'){
      await assert.rejects(runClaimedJob(input),{code});assert.equal(writes.length,1);
    }else{
      assert.deepEqual(await runClaimedJob(input),{status:'blocked',errorCode:code});
      assert.deepEqual(writes.at(-1).step.diagnostic,{terminal:true,uncertain:false,providerStatus:'completed',artifact:{text:'PRIVATE FULL DRAFT'}});
      assert.equal(JSON.stringify(writes).includes('PRIVATE VALIDATION DETAIL'),false);
    }
  }
});

test('explicit rate-limit rejection may retry with bounded paid-attempt count', async () => {
  const { input, writes } = setup();
  input.provider.start = async () => { throw Object.assign(new Error(), { code: 'provider_http_error', httpStatus: 429, terminal: false, uncertain: false }); };
  await runClaimedJob(input);
  assert.equal(writes.at(-1).state, 'queued');
  assert.equal(writes.at(-1).step.attempt, 1);
  input.steps = [{ ...writes.at(-1).step, attempt: 3 }];
  const previousCount = writes.length;
  await runClaimedJob(input);
  assert.equal(writes.at(-1).state, 'blocked');
  assert.equal(writes.at(-1).step.attempt, 3);
  assert.equal(writes.length, previousCount + 1);
});

test('completed failed receipt cannot be repolled or resubmitted by an accidental resume', async () => {
  const { input, writes, calls } = setup({ steps: [{ ...pending, status: 'failed', diagnostic: { terminal: true, uncertain: false }, error_code: 'provider_output_incomplete' }] });
  await runClaimedJob(input);
  assert.equal(calls.start, 0);
  assert.equal(calls.poll, 0);
  assert.equal(writes.at(-1).state, 'blocked');
  assert.equal(writes.at(-1).step.error_code, 'provider_output_incomplete');
});

test('an unexpected GET observation error requeues the same handle without treating it as a new POST', async () => {
  const { input, writes, calls } = setup({ steps: [{ ...pending, input_hash: hash({ prompt: 'private source', schema: { type: 'object', properties: {} } }) }] });
  input.provider.poll = async () => { calls.poll++; throw Object.assign(new Error('Private network detail'), { code: 'socket_closed' }); };
  await runClaimedJob(input);
  assert.equal(calls.poll, 1);
  assert.equal(calls.start, 0);
  assert.equal(writes.at(-1).state, 'queued');
  assert.equal(writes.at(-1).step.status, 'waiting');
  assert.equal(writes.at(-1).step.provider_request_id, 'resp_1');
});

test('lost acknowledgement after persisting a handle resumes the authoritative row with GET', async () => {
  let saved;
  let writeCount = 0;
  const { input, calls } = setup();
  input.checkpoint = async (step) => {
    writeCount++;
    if (writeCount === 3) throw Object.assign(new Error(), { code: 'lease_lost' });
    saved = structuredClone(step);
    if (writeCount === 2) throw new Error('Lost DB acknowledgement');
  };
  await assert.rejects(runClaimedJob(input), { code: 'lease_lost' });
  assert.equal(saved.status, 'waiting');
  assert.equal(saved.provider_request_id, 'resp_1');
  const fresh = setup({ steps: [saved] });
  await runClaimedJob(fresh.input);
  assert.equal(calls.start, 1);
  assert.equal(fresh.calls.start, 0);
  assert.equal(fresh.calls.poll, 1);
  assert.equal(fresh.writes.at(-1).step.status, 'completed');
});

test('an operator-reconciled eighth review keeps its binding and advances only the ninth draft',async()=>{
  const unitId='ch_02_u_02';
  const draft={unitId,paragraphs:Array.from({length:29},(_,i)=>`Verified unique passage P${i+1}.`)};
  const dimensions=['grounding','voice','depth','futureTexture','coherence','originality','recognition','causalPlausibility'];
  const actual=[16,13,4,24,21,22,1,27,29,23,8,15,13,14,10,9];
  const original={unitId,verdict:'pass',scores:Object.fromEntries(dimensions.map(d=>[d,4])),issues:[],coveredUnitIds:[unitId],
    evidence:actual.map((paragraphIndex,i)=>({dimension:dimensions[Math.floor(i/2)],unitId,
      paragraphIndex:paragraphIndex+([3,4,5,7,8,9].includes(i)?1:0),
      quote:draft.paragraphs[paragraphIndex-1],rationale:'Synthetic independent evidence'}))};
  const context={contractVersion:LITERARY_CONTRACT.version,unit:{id:unitId},draft};
  assert.throws(()=>validateArtifact('review',original,context),{code:'review_evidence_mismatch'});
  const candidate=structuredClone(original);
  for(const i of [3,4,5,7,8,9])candidate.evidence[i].paragraphIndex--;
  const approved=validateArtifact('review',candidate,context);
  const units=outline.chapters.flatMap(c=>c.units);
  const steps=[...base];
  for(const unit of units.slice(0,7)){
    steps.push(completed(`draft:${unit.id}:0`,'draft',{unitId:unit.id,paragraphs:['Complete synthetic unit']},unit.id));
    steps.push(completed(`review:${unit.id}:0`,'review',{verdict:'pass'},unit.id));
  }
  const originalReceipt={provider_request_id:'msg_preserved_original',attempt:1,usage:{input_tokens:62423,output_tokens:5139},
    input_hash:hash(draft),diagnostic:{terminal:true,uncertain:false,providerStatus:'completed',artifact:original}};
  const reconciled={...completed(`review:${unitId}:0`,'review',approved,unitId),...originalReceipt,
    history:[{action:'approved_review_reference_reconciliation',receipt:originalReceipt}]};
  steps.push(completed(`draft:${unitId}:0`,'draft',draft,unitId),reconciled);
  assert.equal(planNextStep(steps).key,'draft:ch_02_u_03:0');
  const artifacts=collectArtifacts(steps);
  assert.equal(artifacts.approvalBindings.units[unitId],hash(draft));
  assert.deepEqual(artifacts.reviews[unitId],approved);
  const {input,writes,calls}=setup({steps});
  input.provider.start=async(_request,options)=>{
    calls.start++;assert.equal(options.provider,'openai');
    assert.equal(writes[0].step.step_key,'draft:ch_02_u_03:0');
    return {status:'pending',id:'resp_ninth_draft',model:'writer'};
  };
  input.provider.poll=async()=>{throw new Error('Must not poll the completed Opus review');};
  assert.deepEqual(await runClaimedJob(input),{status:'queued'});
  assert.equal(calls.start,1);assert.equal(calls.poll,0);
  assert.deepEqual(steps.at(-1),reconciled);
  assert.equal(JSON.stringify(publicBookJob(input.job,steps)).includes('Synthetic independent evidence'),false);
});

test('the twenty-seventh recovery is an isolated operator RPC with the approved receipt and six fixed references',()=>{
  const sql=readFileSync('supabase/migrations/20261012203353_caronte_approved_twenty_seventh_reference_reconciliation.sql','utf8');
  assert.match(sql,/create function public\.caronte_reconcile_twenty_seventh_review_references/);
  assert.match(sql,/language plpgsql security invoker set search_path=''/);
  assert.match(sql,/msg_011CfxxWtQwV9y6bUAJEeQi9/);
  assert.match(sql,/0953ab1881820113b355cf06373421748fa609276e899962844542552baa4459/);
  assert.match(sql,/review:ch_05_u_03:0/);
  assert.match(sql,/jsonb_array_length\(d.output->'paragraphs'\)<>29/);
  assert.match(sql,/s.usage->>'input_tokens' is distinct from '80303'/);
  assert.match(sql,/s.usage->>'output_tokens' is distinct from '5781'/);
  const corrections=JSON.parse(sql.match(/corrections constant jsonb := '([^']+)'/)[1]);
  assert.deepEqual(corrections,[{evidenceIndex:5,from:30,to:28},{evidenceIndex:7,from:25,to:24},
    {evidenceIndex:9,from:31,to:29},{evidenceIndex:11,from:26,to:25},
    {evidenceIndex:13,from:22,to:21},{evidenceIndex:15,from:24,to:23}]);
  assert.match(sql,/revoke all on function public\.caronte_reconcile_twenty_seventh_review_references\(uuid,text,text,uuid,jsonb,jsonb,text\) from public,anon,authenticated/);
  assert.match(sql,/grant execute on function public\.caronte_reconcile_twenty_seventh_review_references\(uuid,text,text,uuid,jsonb,jsonb,text\) to service_role/);
  assert.doesNotMatch(sql,/create or replace|https?:|caronte_reconcile_ninth_review_references|caronte_reconcile_review_references/);
});

test('the approved twenty-seventh reconciliation keeps the original evidence and advances only the twenty-eighth draft',async()=>{
  const unitId='ch_05_u_03';
  const draft={unitId,paragraphs:Array.from({length:29},(_,i)=>`Verified unique passage P${i+1}.`)};
  const dimensions=['grounding','voice','depth','futureTexture','coherence','originality','recognition','causalPlausibility'];
  const actual=[1,2,3,4,5,28,7,24,9,29,11,25,13,21,15,23];
  const changes=[{evidenceIndex:5,from:30,to:28},{evidenceIndex:7,from:25,to:24},
    {evidenceIndex:9,from:31,to:29},{evidenceIndex:11,from:26,to:25},
    {evidenceIndex:13,from:22,to:21},{evidenceIndex:15,from:24,to:23}];
  const original={unitId,verdict:'pass',scores:Object.fromEntries(dimensions.map(d=>[d,4])),
    issues:[{id:'minor_27',severity:'minor',location:'paragraph 30',detail:'Keep the original observation.',instruction:'Consider during whole-book reading.'}],coveredUnitIds:[unitId],
    evidence:actual.map((paragraphIndex,i)=>({dimension:dimensions[Math.floor(i/2)],unitId,
      paragraphIndex:changes.find(c=>c.evidenceIndex===i)?.from??paragraphIndex,
      quote:draft.paragraphs[paragraphIndex-1],rationale:'Synthetic twenty-seventh evidence, private diagnostic'}))};
  const context={contractVersion:LITERARY_CONTRACT.version,unit:{id:unitId},draft};
  assert.throws(()=>validateArtifact('review',original,context),{code:'review_evidence_mismatch'});
  const candidate=structuredClone(original);
  for(const change of changes)candidate.evidence[change.evidenceIndex].paragraphIndex=change.to;
  const approved=validateArtifact('review',candidate,context);
  assert.deepEqual(approved.issues,original.issues);
  const steps=[...base];
  for(const unit of outline.chapters.flatMap(c=>c.units).slice(0,26)){
    steps.push(completed(`draft:${unit.id}:0`,'draft',{unitId:unit.id,paragraphs:['Complete synthetic unit']},unit.id));
    steps.push(completed(`review:${unit.id}:0`,'review',{verdict:'pass'},unit.id));
  }
  const receipt={provider_request_id:'msg_preserved_twenty_seventh',attempt:1,
    usage:{input_tokens:80303,output_tokens:5781,cache_read_input_tokens:0,cache_creation_input_tokens:0},
    input_hash:hash(draft),diagnostic:{terminal:true,uncertain:false,providerStatus:'completed',artifact:original}};
  const reconciled={...completed(`review:${unitId}:0`,'review',approved,unitId),...receipt,
    history:[{action:'approved_review_reference_reconciliation',receipt,corrections:changes}]};
  steps.push(completed(`draft:${unitId}:0`,'draft',draft,unitId),reconciled);
  const before=structuredClone(steps);
  assert.equal(planNextStep(steps).key,'draft:ch_05_u_04:0');
  const artifacts=collectArtifacts(steps);
  assert.equal(artifacts.approvalBindings.units[unitId],hash(draft));
  assert.deepEqual(artifacts.reviews[unitId],approved);
  const {input,writes,calls}=setup({steps});
  input.provider.start=async(_request,options)=>{
    calls.start++;assert.equal(options.provider,'openai');
    assert.equal(writes[0].step.step_key,'draft:ch_05_u_04:0');
    return {status:'pending',id:'resp_twenty_eighth_draft',model:'writer'};
  };
  input.provider.poll=async()=>{throw new Error('Must not poll the completed twenty-seventh Opus receipt');};
  assert.deepEqual(await runClaimedJob(input),{status:'queued'});
  assert.equal(calls.start,1);assert.equal(calls.poll,0);
  assert.deepEqual(steps,before);
  assert.equal(JSON.stringify(publicBookJob(input.job,steps)).includes('Synthetic twenty-seventh evidence'),false);
});

test('the approved ninth reference reconciliation advances only the tenth draft without repeating Opus',async()=>{
  const unitId='ch_02_u_03';
  const draft={unitId,paragraphs:Array.from({length:32},(_,i)=>`Verified unique passage P${i+1}.`)};
  const dimensions=['grounding','voice','depth','futureTexture','coherence','originality','recognition','causalPlausibility'];
  const actual=[1,24,3,4,28,6,7,26,9,32,11,31,13,14,15,22];
  const changed=[1,4,7,9,11,15];
  const original={unitId,verdict:'pass',scores:Object.fromEntries(dimensions.map(d=>[d,4])),issues:[],coveredUnitIds:[unitId],
    evidence:actual.map((paragraphIndex,i)=>({dimension:dimensions[Math.floor(i/2)],unitId,
      paragraphIndex:paragraphIndex+(changed.includes(i)?1:0),
      quote:draft.paragraphs[paragraphIndex-1],rationale:'Synthetic ninth evidence, private diagnostic'}))};
  const context={contractVersion:LITERARY_CONTRACT.version,unit:{id:unitId},draft};
  assert.throws(()=>validateArtifact('review',original,context),{code:'review_evidence_mismatch'});
  const candidate=structuredClone(original);
  for(const i of changed)candidate.evidence[i].paragraphIndex--;
  const approved=validateArtifact('review',candidate,context);
  const steps=[...base];
  for(const unit of outline.chapters.flatMap(c=>c.units).slice(0,8)){
    steps.push(completed(`draft:${unit.id}:0`,'draft',{unitId:unit.id,paragraphs:['Complete synthetic unit']},unit.id));
    steps.push(completed(`review:${unit.id}:0`,'review',{verdict:'pass'},unit.id));
  }
  const receipt={provider_request_id:'msg_preserved_ninth',attempt:1,usage:{input_tokens:63703,output_tokens:4881},
    input_hash:hash(draft),diagnostic:{terminal:true,uncertain:false,providerStatus:'completed',artifact:original}};
  const reconciled={...completed(`review:${unitId}:0`,'review',approved,unitId),...receipt,
    history:[{action:'approved_review_reference_reconciliation',receipt}]};
  steps.push(completed(`draft:${unitId}:0`,'draft',draft,unitId),reconciled);
  assert.equal(planNextStep(steps).key,'draft:ch_02_u_04:0');
  const artifacts=collectArtifacts(steps);
  assert.equal(artifacts.approvalBindings.units[unitId],hash(draft));
  assert.deepEqual(artifacts.reviews[unitId],approved);
  const {input,writes,calls}=setup({steps});
  input.provider.start=async(_request,options)=>{
    calls.start++;assert.equal(options.provider,'openai');
    assert.equal(writes[0].step.step_key,'draft:ch_02_u_04:0');
    return {status:'pending',id:'resp_tenth_draft',model:'writer'};
  };
  input.provider.poll=async()=>{throw new Error('Must not poll the completed ninth Opus receipt');};
  assert.deepEqual(await runClaimedJob(input),{status:'queued'});
  assert.equal(calls.start,1);assert.equal(calls.poll,0);
  assert.deepEqual(steps.at(-1),reconciled);
  assert.equal(JSON.stringify(publicBookJob(input.job,steps)).includes('Synthetic ninth evidence'),false);
});
