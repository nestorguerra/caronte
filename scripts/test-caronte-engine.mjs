import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createBookEngine } from '../supabase/functions/_shared/caronte-engine.mjs';

const session = { id: '11111111-1111-4111-8111-111111111111', status: 'interview_completed', question_count: 2, created_at: '2026-09-08T00:00:00Z' };
const answers = [
  { question_index: 1, question_text: 'Edad y vida', transcript: 'Tengo 50 años. ' + 'Memoria completa. '.repeat(300), transcript_source: 'backend' },
  { question_index: 2, question_text: 'Una elección', transcript: 'Elegí abrir mi taller.', transcript_source: 'backend' }
];
const settings = async () => ({ writerModel: 'writer-configured', reviewerModel: 'reviewer-configured', openaiKey: 'test-key', anthropicKey: 'test-key' });
function database() {
  let job = null;
  const steps = [];
  let claims = 0;
  return {
    get job() { return job; }, steps,
    async rest(path, options = {}) {
      const p = options.body;
      if (path === 'rpc/caronte_enqueue_book') {
        job ||= { id: '22222222-2222-4222-8222-222222222222', session_id: p.p_session_id, interview: p.p_interview,
          interview_hash: p.p_interview_hash, model_config: p.p_model_config, prompt_version: p.p_prompt_version, status: 'queued', stage: 'biography' };
        return job;
      }
      if (path === 'rpc/caronte_claim_book_job') {
        if (claims++) return null;
        return { ...job, lease_token: 'lease-test', status: 'running' };
      }
      if (path === 'rpc/caronte_checkpoint_book_job') {
        const at = steps.findIndex(s => s.step_key === p.p_step.step_key);
        if (at < 0) steps.push(p.p_step); else steps[at] = p.p_step;
        job.status = p.p_state; job.stage = p.p_step.stage; job.error_code = p.p_step.error_code || null;
        return true;
      }
      if (path.startsWith('future_book_jobs?')) return job ? [job] : [];
      if (path.startsWith('future_book_job_steps?')) return steps;
      if (path.startsWith('future_book_manuscripts?')) return [{ id: 'old-short-book', manuscript: { title: 'Legacy book' } }];
      throw new Error(`Unhandled test DB route ${path}`);
    }
  };
}

test('enqueue preserves complete interview, snapshots models without credentials, and is idempotent', async () => {
  const db = database(); const wakes = [];
  const engine = createBookEngine({ rest: db.rest, settings, wake: id => wakes.push(id) });
  const first = await engine.enqueue(session, answers);
  const again = await engine.enqueue(session, answers);
  assert.equal(first.job.id, again.job.id);
  assert.equal(first.manuscript, null);
  assert.equal(db.job.interview.sources[0].transcript, answers[0].transcript);
  assert.deepEqual(db.job.model_config, { writerModel: 'writer-configured', reviewerModel: 'reviewer-configured' });
  assert.equal(JSON.stringify(first).includes('Memoria completa'), false);
  assert.equal(JSON.stringify(db.job).includes('test-key'), false);
  assert.ok(wakes.includes(first.job.id));
});

test('incomplete, duplicated or gapped answers do not enqueue a paid job', async () => {
  for (const input of [answers.slice(0, 1), [answers[0], answers[0]], [answers[0], { ...answers[1], question_index: 3 }]]) {
    const db = database(); const engine = createBookEngine({ rest: db.rest, settings });
    await assert.rejects(engine.enqueue(session, input), /interview_incomplete/);
    assert.equal(db.job, null);
  }
  const db = database(); const engine = createBookEngine({ rest: db.rest, settings });
  await assert.rejects(engine.enqueue({ ...session, status: 'interview_active' }, answers), /interview_not_completed/);
});

test('missing model or provider credentials fail explicitly without synthetic book', async () => {
  for (const missing of ['writerModel', 'reviewerModel', 'openaiKey', 'anthropicKey']) {
    const db = database(); const engine = createBookEngine({ rest: db.rest, settings: async () => ({ ...await settings(), [missing]: '' }) });
    await assert.rejects(engine.enqueue(session, answers), /book_provider_configuration_required/);
    assert.equal(db.job, null);
  }
});

test('pending new job never returns a stale legacy manuscript', async () => {
  const db = database(); const engine = createBookEngine({ rest: db.rest, settings });
  await engine.enqueue(session, answers);
  const status = await engine.status(session.id);
  assert.equal(status.manuscript, null);
  assert.equal(status.job.status, 'queued');
  assert.equal(Object.hasOwn(status.job, 'interview'), false);
});

test('worker saves real provider receipt; another claim cannot submit the same step', async () => {
  const db = database(); let submissions = 0;
  const engine = createBookEngine({ rest: db.rest, settings, fetchImpl: async () => {
    assert.equal(db.steps[0].status, 'started');
    submissions++;
    return new Response(JSON.stringify({ id: 'resp_saved', status: 'queued', model: 'writer-configured' }), { status: 200 });
  } });
  await engine.enqueue(session, answers);
  assert.equal((await engine.advance(db.job.id)).status, 'queued');
  assert.equal(db.steps[0].provider_request_id, 'resp_saved');
  assert.equal(db.steps[0].status, 'waiting');
  assert.equal((await engine.advance(db.job.id)).status, 'idle');
  assert.equal(submissions, 1);
});

// Synthetic durable transport with explicit time/lease eligibility; the engine,
// prompts, model adapter and saved receipts remain the real implementation.
function recoveryDatabase() {
  const db=database(),claims=[];let clock=0,nextRunAt=0,leased=false;
  return {db,claims,tick:seconds=>{clock+=seconds;},
    async rest(path,options={}){
      if(path==='rpc/caronte_claim_book_job'){
        claims.push(options.body.p_job_id);
        if(!db.job||db.job.status!=='queued'||leased||clock<nextRunAt)return null;
        leased=true;return {...structuredClone(db.job),status:'running',lease_token:'synthetic-recovery-lease'};
      }
      const result=await db.rest(path,options);
      if(path==='rpc/caronte_checkpoint_book_job'){
        leased=options.body.p_state==='running';nextRunAt=clock+(options.body.p_delay_seconds||0);
      }
      return result;
    }};
}
test('an independent recovery claim resumes a saved provider ID after a lost wake without another model POST',async()=>{
  const store=recoveryDatabase(),requests=[],wakes=[];
  const fetchImpl=async(url,options)=>{
    requests.push({url,method:options.method});
    return Response.json({id:'resp_recovery_saved',status:options.method==='POST'?'queued':'in_progress',model:'writer-configured'});
  };
  const first=createBookEngine({rest:store.rest,settings,fetchImpl,wake:id=>wakes.push(id)});
  await first.enqueue(session,answers);
  assert.equal((await first.advance(store.db.job.id)).status,'queued');
  assert.equal(store.db.steps[0].provider_request_id,'resp_recovery_saved');
  const replacement=createBookEngine({rest:store.rest,settings,fetchImpl});
  assert.equal((await replacement.advance()).status,'idle');
  store.tick(11);
  assert.equal((await replacement.advance()).status,'queued');
  assert.deepEqual(requests.map(request=>request.method),['POST','GET']);
  assert.match(requests[1].url,/\/responses\/resp_recovery_saved$/);
  assert.equal(store.db.steps[0].attempt,1);assert.equal(store.db.steps[0].status,'waiting');
  assert.deepEqual(store.claims,[store.db.job.id,null,null]);assert.equal(wakes.length,2);
});
test('independent recovery cannot reactivate or repeat a provider submission whose receipt was lost',async()=>{
  const store=recoveryDatabase();let submissions=0;
  const fetchImpl=async()=>{submissions++;throw new Error('Synthetic response lost after submission');};
  const first=createBookEngine({rest:store.rest,settings,fetchImpl});
  await first.enqueue(session,answers);
  assert.equal((await first.advance(store.db.job.id)).status,'blocked');
  assert.equal(store.db.job.error_code,'provider_submission_uncertain');
  assert.equal(store.db.steps[0].error_code,'provider_submission_uncertain');
  store.tick(600);
  const replacement=createBookEngine({rest:store.rest,settings,fetchImpl});
  assert.equal((await replacement.advance()).status,'idle');
  assert.equal(submissions,1);assert.equal(store.db.job.status,'blocked');
});
