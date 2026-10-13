import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
import vm from 'node:vm';
import {createPrintEngine as coordinator} from '../supabase/functions/_shared/caronte-print-engine.mjs';
import {printManuscriptThirty} from './fixtures/print-manuscript.mjs';

// Execute the real endpoint adapter, not a copy of its stage-name list.
// The coordinator is real; persistence, the font runtime and Lulu are synthetic.
// This focused boundary test makes no HTTP, provider, PDF or database calls.
const route = readFileSync(new URL('../supabase/functions/future-book-session/index.ts', import.meta.url), 'utf8');
const start = route.indexOf('\nfunction printEngine() {');
const end = route.indexOf('\nasync function advancePrint(', start);
assert.ok(start >= 0 && end > start, 'The actual printEngine adapter must be located');
const executable = stripTypeScriptTypes(route.slice(start, end), {mode: 'strip'});

const legacy = ['planChapter', 'composeLayout', 'renderInteriorPart', 'mergeInterior', 'renderCover'];
const bounded = ['planChapterSlice', 'finishChapterSlices', 'selectLayoutSize'];
const required = [...legacy, ...bounded];
const sid = '11111111-1111-4111-8111-111111111111';
const mid = '33333333-3333-4333-8333-333333333333';
const jid = '22222222-2222-4222-8222-222222222222';
const pid = '44444444-4444-4444-8444-444444444444';
const sku = '0583X0827.BW.STD.PB.060UC444.MXX';

function fixture({missing, loadError} = {}) {
  let loads = 0, constructions = 0, captured, job = null;
  const calls = [], requests = [];
  const runtime = Object.fromEntries(required.map(name => [name, async (...args) => {
    const receipt = {synthetic: true, stage: name};
    calls.push({name, args, receiver: runtime, receipt});
    return receipt;
  }]));
  if (missing) delete runtime[missing];
  const rest = async (path, options = {}) => {
    requests.push({path, options});
    if (path === 'rpc/caronte_enqueue_print') {
      const body = options.body;
      job = {id: jid, pdf_id: pid, session_id: sid, manuscript_id: mid, version: 1,
        source_snapshot: structuredClone(body.p_source), source_sha256: body.p_source_sha256,
        input_hash: body.p_input_hash, stages_version: body.p_stages_version,
        lulu_environment: body.p_environment, lulu_configuration_tag: body.p_configuration_tag,
        pod_package_id: body.p_pod_package_id, status: 'queued', stage: 'plan',
        created_at: '2026-10-12T00:00:00.000Z', updated_at: '2026-10-12T00:00:00.000Z'};
      return structuredClone(job);
    }
    if (path.startsWith('future_book_print_jobs?')) return job ? [structuredClone(job)] : [];
    if (path.startsWith('future_book_print_steps?')) return [];
    assert.fail(`Unexpected synthetic persistence operation: ${path}`);
  };
  const forbidden = () => assert.fail('The lazy adapter must not contact a remote service');
  const context = vm.createContext({
    createPrintEngine: options => {
      constructions++;
      captured = options;
      return coordinator(options);
    },
    printDatabaseRest: rest,
    loadPrintStages: async () => {
      loads++;
      if (loadError) throw loadError;
      return runtime;
    },
    createPrintStageArchive: () => ({path: forbidden, read: forbidden, write: forbidden}),
    luluCredentials: async () => ({configured: true, environment: 'sandbox',
      configurationTag: 'a'.repeat(64)}),
    createLuluPrintClient: forbidden,
    LULU_A5_PAPERBACK_SKU: sku,
    supabaseUrl: 'https://synthetic-print.supabase.co', serviceRoleKey: 'synthetic-service-key',
    fetch: forbidden
  });
  vm.runInContext(executable, context);
  const engine = vm.runInContext('printEngine()', context);
  return {engine, calls, requests, stages: captured.stages,
    loads: () => loads, constructions: () => constructions};
}

test('the actual lazy print adapter exposes the complete bounded and legacy stage API', () => {
  const app = fixture();
  assert.deepEqual(Object.keys(app.stages).sort(), [...required].sort(),
    'The endpoint must expose all eight stages; otherwise the coordinator silently uses whole chapters');
  for (const name of required) assert.equal(typeof app.stages[name], 'function', name);
});

test('adapter creation and real coordinator status/enqueue do not load the font runtime', async () => {
  const app = fixture();
  assert.equal(app.constructions(), 1);
  assert.equal(app.loads(), 0);
  assert.deepEqual(await app.engine.status(sid), {job: null, pdf: null});
  assert.equal(app.loads(), 0);
  const source = printManuscriptThirty();
  const result = await app.engine.enqueue(sid, {id: mid, session_id: sid, status: 'ready',
    updated_at: '2026-10-12T00:00:00.000Z', manuscript: source,
    provider_chain: {degraded: false}, quality_report: {editorial_gate: 'pass'}});
  assert.equal(result.job.id, jid);
  assert.equal(result.job.status, 'queued');
  assert.equal(result.pdf, null);
  assert.equal(app.loads(), 0);
  assert.equal(app.calls.length, 0);
  assert.equal(app.requests.filter(({path}) => path === 'rpc/caronte_enqueue_print').length, 1);
  await app.engine.status(sid);
  assert.equal(app.loads(), 0);
});

const inputs = {
  planChapterSlice: () => [{syntheticSource: true}, 3,
    {size: 12.9, mode: 'counts', previous: {syntheticReceipt: true}, maxParagraphs: 24, maxCharacters: 16000}],
  finishChapterSlices: () => [{syntheticSource: true}, 2, [{syntheticReceipt: true}],
    {size: 12.9, compact: false}],
  selectLayoutSize: () => [{syntheticSource: true}, [{syntheticCount: true}]]
};

for (const name of bounded) {
  test(`the actual ${name} adapter loads lazily and preserves every input and result`, async () => {
    const app = fixture(), args = inputs[name]();
    assert.equal(app.loads(), 0);
    assert.equal(typeof app.stages[name], 'function', `${name} must reach the bounded coordinator`);
    const result = await app.stages[name](...args);
    assert.equal(app.loads(), 1, 'One runtime lookup per invoked stage');
    assert.equal(app.calls.length, 1, 'A stage must not be invoked twice');
    assert.equal(app.calls[0].name, name);
    assert.equal(app.calls[0].args.length, args.length);
    for (let index = 0; index < args.length; index++) assert.strictEqual(app.calls[0].args[index], args[index]);
    assert.strictEqual(result, app.calls[0].receipt, 'No substituted or reconstructed receipt');
  });
}

test('all five existing lazy stage methods keep their exact forwarding behavior', async () => {
  const app = fixture();
  for (const [index, name] of legacy.entries()) {
    const args = [{syntheticSource: true}, {syntheticManifest: true}, {syntheticOptions: true}];
    const result = await app.stages[name](...args);
    assert.equal(app.loads(), index + 1);
    assert.equal(app.calls.length, index + 1);
    assert.equal(app.calls[index].name, name);
    for (let at = 0; at < args.length; at++) assert.strictEqual(app.calls[index].args[at], args[at]);
    assert.strictEqual(result, app.calls[index].receipt);
  }
});

test('a loaded runtime missing a bounded method rejects without a substitute or another stage', async () => {
  for (const name of bounded) {
    const app = fixture({missing: name});
    assert.equal(typeof app.stages[name], 'function', `${name} must be present at the endpoint boundary`);
    await assert.rejects(app.stages[name](...inputs[name]()));
    assert.equal(app.loads(), 1);
    assert.equal(app.calls.length, 0);
    assert.equal(app.requests.length, 0);
  }
});

test('a rejected lazy font-runtime load propagates without a fallback stage or receipt', async () => {
  const failure = new Error('synthetic-font-runtime-unavailable');
  const app = fixture({loadError: failure});
  await assert.rejects(app.stages.planChapter({syntheticSource: true}, 0, {size: 12}), error => error === failure);
  assert.equal(app.loads(), 1);
  assert.equal(app.calls.length, 0);
  assert.equal(app.requests.length, 0);
});
