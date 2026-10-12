import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
import {test} from 'node:test';
import vm from 'node:vm';
import {createBookEngine} from '../supabase/functions/_shared/caronte-engine.mjs';
import {wakeBookQueue} from './wake-caronte-book-queue.mjs';

const jobId = '948bc512-eaf8-4f2c-8ae8-c302561ca8d4';
const serviceKey = 'synthetic-worker-service-key';
const monitorSecret = 'synthetic-worker-monitor-secret';
const projectUrl = 'https://synthetic-worker.supabase.co';
const fakeFunctionBearer = 'function serviceRoleKey() { return "synthetic-worker-service-key"; }';
const privateFailure = 'private-synthetic-provider-detail https://private.example.test/?token=private-synthetic-token';

function executableSource(path) {
  return stripTypeScriptTypes(readFileSync(new URL(path, import.meta.url), 'utf8')
    .replace(/^import .*;\n/gm, '')
    .replace(/^export /gm, ''), {mode: 'strip'});
}

// Load the actual shared constants, authentication helpers and HTTP route.
// Only environment, HTTP transport and Edge lifecycle are synthetic boundaries.
const source = [
  '../supabase/functions/_shared/service.ts',
  '../supabase/functions/_shared/cors.ts',
  '../supabase/functions/future-book-session/index.ts'
].map(executableSource).join('\n');

function fixture({edge = true, missingKey = false, wakeFailure = null, claimFailure = false} = {}) {
  const env = {
    APP_ENV: 'production',
    SUPABASE_URL: projectUrl,
    SUPABASE_SERVICE_ROLE_KEY: missingKey ? '' : serviceKey,
    SUPABASE_ANON_KEY: 'synthetic-worker-anon-key',
    FUTURE_BOOK_ADMIN_TOKEN: 'synthetic-worker-admin-token',
    FUTURE_BOOK_MONITOR_SECRET: monitorSecret
  };
  const requests = [], tasks = [], delays = [], logs = [];
  let handler, cancelledBodies = 0;
  const fetch = async (input, options = {}) => {
    const url = new URL(String(input));
    assert.equal(url.origin, projectUrl, 'The fixture must never reach another origin');
    const headers = new Headers(options.headers);
    const entry = {url: url.href, method: options.method || 'GET', headers,
      body: options.body ? JSON.parse(options.body) : null, signal: options.signal};
    requests.push(entry);
    if (url.pathname === '/auth/v1/user') {
      return Response.json({message: 'Invalid synthetic auth session'}, {status: 401});
    }
    if (url.pathname === '/rest/v1/rpc/caronte_claim_book_job') {
      if (claimFailure) throw new Error(privateFailure);
      return Response.json([]);
    }
    if (url.pathname === '/functions/v1/future-book-session') {
      if (wakeFailure === 'network') throw new Error(privateFailure);
      if (wakeFailure === 'http') return new Response(privateFailure, {status: 503});
      return new Response(new ReadableStream({cancel() { cancelledBodies += 1; }}));
    }
    assert.fail('Unexpected HTTP boundary in worker fixture');
  };
  const context = vm.createContext({
    createBookEngine: options => createBookEngine({...options, fetchImpl: fetch}),
    fetch, Request, Response, Headers, URL, AbortSignal,
    AbortController, ReadableStream, TextEncoder, TextDecoder, Uint8Array,
    crypto: globalThis.crypto, btoa, atob,
    setTimeout(resolve, milliseconds) { delays.push(milliseconds); resolve(); },
    clearTimeout() {},
    console: {error(...values) { logs.push(values.join(' ')); }},
    Deno: {env: {get(name) { return env[name]; }}, serve(value) { handler = value; }}
  });
  if (edge) context.EdgeRuntime = {waitUntil(task) { tasks.push(task); }};
  vm.runInContext(source, context, {filename: 'caronte-worker-route.fixture.js'});
  const request = (payload, authorization, extraHeaders = {}) => new Request(
    `${projectUrl}/functions/v1/future-book-session`, {
      method: 'POST',
      headers: {'content-type': 'application/json',
        ...(authorization == null ? {} : {authorization}), ...extraHeaders},
      body: JSON.stringify(payload)
    });
  return {
    context, requests, tasks, delays, logs,
    cancelledBodies: () => cancelledBodies,
    claims: () => requests.filter(entry => new URL(entry.url).pathname === '/rest/v1/rpc/caronte_claim_book_job'),
    authCalls: () => requests.filter(entry => new URL(entry.url).pathname === '/auth/v1/user'),
    wake: (id = jobId, delay = 0) => context.queueBookWake(id, delay),
    advance: (payload, authorization, headers) => context.advanceBook(request(payload, authorization, headers), payload),
    dispatch: (payload, authorization, headers) => handler(request(payload, authorization, headers)),
    settle: () => Promise.all(tasks)
  };
}

test('the worker self-wake registers one Edge task and uses the real HTTPS URL, bearer and UUID payload', async () => {
  const app = fixture();
  app.wake();
  assert.equal(app.tasks.length, 1);
  await app.settle();
  assert.equal(app.requests.length, 1);
  const [wake] = app.requests;
  assert.equal(wake.url, `${projectUrl}/functions/v1/future-book-session`);
  assert.equal(wake.method, 'POST');
  assert.equal(wake.headers.get('authorization'), `Bearer ${serviceKey}`);
  assert.equal(wake.headers.get('content-type'), 'application/json');
  assert.deepEqual(wake.body, {action: 'advanceBook', jobId});
  assert.equal(wake.signal.aborted, false);
  assert.equal(app.cancelledBodies(), 1);
  assert.deepEqual(app.logs, []);
});

test('a delayed wake is bounded and does not dispatch until its delay is scheduled', async () => {
  const app = fixture();
  app.wake(jobId, 90);
  assert.deepEqual(app.delays, [30000]);
  assert.equal(app.tasks.length, 1);
  assert.equal(app.requests.length, 0);
  await app.settle();
  assert.equal(app.requests.length, 1);
});

test('self-wake HTTP and network rejections settle with a sanitized diagnostic', async () => {
  for (const wakeFailure of ['http', 'network']) {
    const app = fixture({wakeFailure});
    app.wake();
    await app.settle();
    assert.equal(app.requests.length, 1);
    assert.deepEqual(app.logs.map(value => JSON.parse(value)), [{event: 'book_wake_failed', jobId}]);
    assert.doesNotMatch(JSON.stringify(app.logs), /private-synthetic|Bearer|serviceRoleKey/);
  }
});

test('anonymous, foreign and function-shaped bearers cannot claim work or bypass monitor authentication', async () => {
  for (const authorization of [undefined, 'Bearer synthetic-foreign-token', `Bearer ${fakeFunctionBearer}`]) {
    const app = fixture();
    const response = await app.dispatch({action: 'advanceBook', jobId}, authorization);
    assert.equal(response.status, 400);
    assert.equal((await response.json()).error, 'Invalid admin token');
    assert.equal(app.claims().length, 0);
    assert.equal(app.tasks.length, 0);
    assert.equal(app.authCalls().length, authorization == null ? 0 : 1);
    await assert.rejects(app.context.requireFutureBookMonitorCaller(new Request(projectUrl, {
      headers: authorization == null ? {} : {authorization}
    }), {}), /Invalid admin token/);
    assert.equal(app.claims().length, 0);
  }
});

test('the exact service bearer advances one UUID through the real claim RPC without admin auth', async () => {
  const app = fixture();
  const response = await app.dispatch({action: 'advanceBook', jobId}, `Bearer ${serviceKey}`);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {ok: true, accepted: true, jobId});
  assert.equal(app.tasks.length, 1);
  await app.settle();
  const [claim] = app.claims();
  assert.equal(app.claims().length, 1);
  assert.equal(claim.method, 'POST');
  assert.deepEqual(claim.body, {p_job_id: jobId});
  assert.equal(claim.headers.get('authorization'), `Bearer ${serviceKey}`);
  assert.equal(claim.headers.get('apikey'), serviceKey);
  assert.equal(app.authCalls().length, 0);
  assert.deepEqual(app.logs, []);
});

test('a configured monitor secret authorizes the worker without fabricating a service bearer', async () => {
  const app = fixture();
  const response = await app.dispatch({action: 'advanceBook', jobId}, undefined,
    {'x-future-book-monitor-secret': monitorSecret});
  assert.equal(response.status, 200);
  await app.settle();
  assert.deepEqual(app.claims().map(entry => entry.body), [{p_job_id: jobId}]);
  assert.equal(app.authCalls().length, 0);
});

test('a missing service key rejects the HTTP route and cannot become an empty or function-shaped auth bypass', async () => {
  const app = fixture({missingKey: true});
  const response = await app.dispatch({action: 'advanceBook', jobId}, `Bearer ${serviceKey}`);
  assert.equal(response.status, 503);
  assert.equal((await response.json()).error, 'Backend not configured');
  assert.equal(app.requests.length, 0);
  for (const authorization of ['Bearer ', `Bearer ${fakeFunctionBearer}`]) {
    await assert.rejects(app.advance({jobId}, authorization), /Invalid admin token/);
  }
  assert.equal(app.authCalls().length, 1);
  assert.equal(app.claims().length, 0);
  assert.equal(app.tasks.length, 0);
});

test('invalid job IDs fail at the HTTP boundary before claiming or scheduling work', async () => {
  for (const invalidId of ['not-a-uuid', `${jobId} suffix`, {}, 123]) {
    const app = fixture();
    const response = await app.dispatch({action: 'advanceBook', jobId: invalidId}, `Bearer ${serviceKey}`);
    assert.equal(response.status, 400);
    assert.equal((await response.json()).error, 'invalid_book_job_id');
    assert.equal(app.requests.length, 0);
    assert.equal(app.tasks.length, 0);
  }
});

test('worker storage failures settle their Edge task without exposing private upstream details', async () => {
  const app = fixture({claimFailure: true});
  const response = await app.dispatch({action: 'advanceBook', jobId}, `Bearer ${serviceKey}`);
  assert.equal(response.status, 200);
  const publicResponse = await response.json();
  assert.deepEqual(publicResponse, {ok: true, accepted: true, jobId});
  const [result] = await app.settle();
  assert.deepEqual(JSON.parse(JSON.stringify(result)), {status: 'failed', errorCode: 'book_storage_unavailable'});
  assert.deepEqual(app.logs.map(value => JSON.parse(value)), [
    {event: 'book_worker_failed', jobId, errorCode: 'book_storage_unavailable'}
  ]);
  assert.doesNotMatch(JSON.stringify({publicResponse, logs: app.logs}), /private-synthetic|Bearer|serviceRoleKey/);
});

test('without Edge lifecycle support wake is inert and an authorized advance returns its real idle result', async () => {
  const app = fixture({edge: false});
  app.wake();
  assert.equal(app.requests.length, 0);
  const response = await app.dispatch({action: 'advanceBook', jobId}, `Bearer ${serviceKey}`);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {ok: true, status: 'idle'});
  assert.equal(app.claims().length, 1);
  assert.equal(app.tasks.length, 0);
});

test('the recovery executable and native HTTP route agree on monitor auth and an untargeted claim',async()=>{
  const app=fixture();let dispatches=0;
  const result=await wakeBookQueue({enabled:true,projectUrl,functionsBaseUrl:`${projectUrl}/functions/v1`,monitorSecret,
    fetchImpl:async(url,options)=>{
      dispatches++;assert.equal(url,`${projectUrl}/functions/v1/future-book-session`);
      return app.dispatch(JSON.parse(options.body),undefined,Object.fromEntries(new Headers(options.headers)));
    }});
  assert.deepEqual(result,{status:'accepted',completionVerified:false});
  await app.settle();assert.equal(dispatches,1);assert.equal(app.authCalls().length,0);
  assert.deepEqual(app.claims().map(entry=>entry.body),[{p_job_id:null}]);
});
test('native auth rejection remains a safe failed recovery signal and cannot claim work',async()=>{
  const app=fixture();let dispatches=0;
  await assert.rejects(wakeBookQueue({enabled:true,projectUrl,functionsBaseUrl:`${projectUrl}/functions/v1`,
    monitorSecret:'synthetic-foreign-monitor-secret',fetchImpl:async(_url,options)=>{
      dispatches++;return app.dispatch(JSON.parse(options.body),undefined,Object.fromEntries(new Headers(options.headers)));
    }}),{message:'book_recovery_http_error'});
  assert.equal(dispatches,1);assert.equal(app.claims().length,0);assert.equal(app.tasks.length,0);
});
