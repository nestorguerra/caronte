import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createLuluPrintClient, LuluPrintError, luluPaymentPortalUrl, LULU_A5_PAPERBACK_SKU } from '../supabase/functions/_shared/lulu-print.mjs';

const json = (body, status = 200) => new Response(JSON.stringify(body), { status });
const credentials = { clientKey: 'test-client-key', clientSecret: 'test-secret' };
const token = () => json({ access_token: 'test-access-token', expires_in: 3600, token_type: 'bearer' });

function fixture(handlers, options = {}) {
  const calls = [];
  const client = createLuluPrintClient({
    ...credentials,
    ...options,
    fetch: async (url, init) => {
      calls.push({ url, ...init });
      const next = handlers.shift();
      assert.ok(next, `Unexpected request: ${url}`);
      return typeof next === 'function' ? next(url, init) : next;
    }
  });
  return { client, calls };
}

test('OAuth uses sandbox client credentials, shares concurrent refresh and honors expiry', async () => {
  let now = 1000;
  const { client, calls } = fixture([token(), json({ id: 10 }), token(), json({ id: 11 }), json({ id: 12 })], { now: () => now });
  const [auth1, auth2] = await Promise.all([client.authenticate(), client.authenticate()]);
  assert.equal(calls.length, 1);
  assert.deepEqual(auth1, auth2);
  assert.equal(auth1.environment, 'sandbox');
  assert.equal(JSON.stringify(auth1).includes('test-access-token'), false);
  assert.equal(calls[0].url, 'https://api.sandbox.lulu.com/auth/realms/glasstree/protocol/openid-connect/token');
  assert.equal(calls[0].body, 'grant_type=client_credentials');
  assert.equal(calls[0].headers.Authorization, `Basic ${btoa('test-client-key:test-secret')}`);
  await client.getPrintJob(10);
  now += 3590 * 1000;
  await client.getPrintJob(11);
  await client.getPrintJob(12);
  assert.equal(calls.filter((call) => call.url.endsWith('/token')).length, 2);
  assert.equal(calls[1].headers.Authorization, 'Bearer test-access-token');
});

test('production is explicit and portal links point only to documented portal roots', async () => {
  const { client, calls } = fixture([token()], { environment: 'production' });
  await client.authenticate();
  assert.ok(calls[0].url.startsWith('https://api.lulu.com/'));
  assert.equal(luluPaymentPortalUrl('sandbox'), 'https://developers.sandbox.lulu.com/');
  assert.equal(luluPaymentPortalUrl('production'), 'https://developers.lulu.com/');
  assert.throws(() => createLuluPrintClient({ ...credentials, environment: 'live-typo' }), LuluPrintError);
});

test('missing credentials are rejected before any network request', () => {
  assert.throws(() => createLuluPrintClient({ clientKey: 'key' }), (error) => error.code === 'invalid_input');
});

test('provider errors never include credentials, bearer tokens, request bodies or response echoes', async () => {
  const { client } = fixture([token(), json({ error: 'test-secret test-access-token', address: 'private' }, 401)]);
  await assert.rejects(client.getPrintJob(10), (error) => {
    assert.equal(error.httpStatus, 401);
    assert.equal(error.code, 'http_error');
    assert.equal(error.uncertain, false);
    assert.doesNotMatch(JSON.stringify(error) + error.message, /test-secret|test-access-token|private/);
    return true;
  });
});

const interior = { source_url: 'https://books.example.org/interior.pdf?signature=private', pod_package_id: LULU_A5_PAPERBACK_SKU };
const cover = { ...interior, source_url: 'https://books.example.org/cover.pdf', interior_page_count: 192 };
const lineItems = [{ pod_package_id: LULU_A5_PAPERBACK_SKU, page_count: 192, quantity: 1 }];
const address = { name: 'Pilot Reader', street1: 'Example street 1', city: 'Madrid', postcode: '28001', country_code: 'ES', state_code: 'M', phone_number: '+34910000000', email: 'pilot@example.org' };

test('interior and cover validation use the real asynchronous endpoints', async () => {
  let now = 0;
  const { client, calls } = fixture([
    token(), json({ id: 7, status: 'VALIDATING' }, 201), json({ id: 7, status: 'NORMALIZING' }), json({ id: 7, status: 'NORMALIZED', page_count: 192, errors: [] }),
    json({ id: 9, status: 'NORMALIZING' }, 201), json({ id: 9, status: 'NORMALIZED', errors: [] })
  ], { now: () => now, sleep: async (ms) => { now += ms; } });
  assert.equal((await client.validateInterior(interior)).id, 7);
  assert.equal((await client.waitForInteriorValidation(7, { pollIntervalMs: 1 })).status, 'NORMALIZED');
  assert.equal((await client.validateCover(cover)).id, 9);
  assert.equal((await client.waitForCoverValidation(9, { pollIntervalMs: 1 })).status, 'NORMALIZED');
  assert.equal(new URL(calls[1].url).pathname, '/validate-interior/');
  assert.deepEqual(JSON.parse(calls[1].body), interior);
  assert.equal(new URL(calls[4].url).pathname, '/validate-cover/');
  assert.deepEqual(JSON.parse(calls[4].body), cover);
});

test('validation ERROR is a real terminal result and unknown statuses cannot pass', async () => {
  const { client } = fixture([token(), json({ id: 7, status: 'ERROR', errors: ['Font not embedded'] }), json({ id: 8, status: 'INVENTED_SUCCESS' })]);
  assert.equal((await client.waitForInteriorValidation(7)).status, 'ERROR');
  await assert.rejects(client.waitForCoverValidation(8), (error) => error.code === 'invalid_response');
});
test('cover polling cannot accept an interior-only status as valid progress', async () => {
  const {client} = fixture([token(),json({id:8,status:'VALIDATING'})]);
  await assert.rejects(client.waitForCoverValidation(8,{timeoutMs:1000,pollIntervalMs:1}), error => error.code==='invalid_response');
});
test('lost validation creation receipts are uncertain, not safe automatic retries', async () => {
  for(const kind of ['Interior','Cover']) {
    const {client} = fixture([token(),()=>{throw new Error('lost response');}]);
    await assert.rejects(client[`validate${kind}`](kind==='Interior'?interior:cover),error=>error.uncertain===true&&error.retryable===false);
  }
});

test('cover dimensions use final page count and return decimal dimensions unchanged', async () => {
  const { client, calls } = fixture([token(), json({ width: '887.880', height: '613.440', unit: 'pt' }, 201)]);
  const result = await client.calculateCoverDimensions({ pod_package_id: LULU_A5_PAPERBACK_SKU, interior_page_count: 192, unit: 'pt' });
  assert.equal(result.width, '887.880');
  assert.equal(JSON.parse(calls[1].body).interior_page_count, 192);
});

test('shipping and quote preserve their distinct API field names and exact money decimals', async () => {
  const { client, calls } = fixture([token(), new Response('[{"level":"MAIL","cost_excl_tax":7.5700,"currency":"EUR"}]'), new Response('{"total_cost_incl_tax":19.1234567890123456789,"total_tax":"0.75","currency":"EUR"}')]);
  const shipping = await client.shippingOptions({ currency: 'EUR', line_items: lineItems, shipping_address: { country: 'ES', state_code: 'M', postcode: '28001' } });
  assert.equal(shipping[0].cost_excl_tax, '7.5700');
  const quote = await client.quote({ line_items: lineItems, shipping_address: address, shipping_option: 'MAIL' });
  assert.equal(quote.total_cost_incl_tax, '19.1234567890123456789');
  assert.equal(quote.total_tax, '0.75');
  assert.equal(JSON.parse(calls[1].body).shipping_address.country, 'ES');
  assert.equal(JSON.parse(calls[1].body).shipping_address.state, 'M');
  assert.equal(JSON.parse(calls[1].body).shipping_address.state_code, undefined);
  assert.equal(JSON.parse(calls[2].body).shipping_address.country_code, 'ES');
  assert.equal(JSON.parse(calls[2].body).shipping_address.state_code, 'M');
  assert.equal(JSON.parse(calls[2].body).shipping_option, 'MAIL');
});

test('invalid source URLs, dimensions, quantity and country contracts fail before authentication', async () => {
  const { client, calls } = fixture([]);
  for (const source_url of ['http://books.example.org/a.pdf', 'file:///a.pdf', 'https://user:password@example.org/a.pdf']) {
    assert.throws(() => client.validateInterior({ ...interior, source_url }), (error) => error.code === 'invalid_input');
  }
  assert.throws(() => client.calculateCoverDimensions({ pod_package_id: LULU_A5_PAPERBACK_SKU, interior_page_count: 0 }));
  assert.throws(() => client.shippingOptions({ line_items: [{ ...lineItems[0], quantity: 0 }], shipping_address: { country: 'ES' } }));
  assert.throws(() => client.shippingOptions({ line_items: lineItems, shipping_address: { country_code: 'ES' } }));
  assert.throws(() => client.quote({ line_items: lineItems, shipping_address: { ...address, country_code: undefined, country: 'ES' }, shipping_option: 'MAIL' }));
  assert.equal(calls.length, 0);
});

function printJob() {
  return {
    external_id: 'caronte-pilot-001', contact_email: 'operator@example.org',
    line_items: [{ external_id: 'approved-v1', title: 'Caronte', quantity: 1, printable_normalization: { interior: { source_url: interior.source_url }, cover: { source_url: cover.source_url }, pod_package_id: LULU_A5_PAPERBACK_SKU } }],
    shipping_address: address, shipping_level: 'MAIL', production_delay: 120
  };
}

test('create submits one exact print job and returns provider status without pretending payment', async () => {
  const job = printJob();
  const { client, calls } = fixture([token(), json({ id: 44, status: { name: 'UNPAID' } }, 201), json({ name: 'SHIPPED', print_job_id: 44, line_item_statuses: [{ messages: { tracking_urls: ['https://tracking.example.org/44'] } }] }), json({ total_cost_incl_tax: '19.75' })]);
  const result = await client.createPrintJob(job);
  assert.equal(result.id, 44);
  assert.equal(result.status.name, 'UNPAID');
  assert.deepEqual(JSON.parse(calls[1].body), job);
  assert.equal(new URL(calls[1].url).pathname, '/print-jobs/');
  assert.equal((await client.getPrintJobStatus(44)).name, 'SHIPPED');
  assert.equal((await client.getPrintJobCosts(44)).total_cost_incl_tax, '19.75');
  assert.equal(new URL(calls[2].url).pathname, '/print-jobs/44/status/');
  assert.equal(new URL(calls[3].url).pathname, '/print-jobs/44/costs/');
});

test('a real ERROR processing state retains the known print-job ID without claiming payment',async()=>{
  const {client}=fixture([token(),json({id:44,status:{name:'ERROR'}},201)]);
  const result=await client.createPrintJob(printJob());assert.equal(result.id,44);assert.equal(result.status.name,'ERROR');
});

test('order network loss, HTTP 5xx and unreadable success require reconciliation with no retry', async () => {
  for (const failure of [() => { throw new Error('test-secret network failure'); }, json({ error: 'upstream unavailable' }, 503), new Response('not json', { status: 201 }), json({ status: { name: 'UNPAID' } }, 201)]) {
    const { client, calls } = fixture([token(), failure]);
    await assert.rejects(client.createPrintJob(printJob()), (error) => {
      assert.equal(error.code, 'submission_uncertain');
      assert.equal(error.reconciliationRequired, true);
      assert.equal(error.retryable, false);
      assert.doesNotMatch(error.message, /test-secret/);
      return true;
    });
    assert.equal(calls.length, 2);
  }
});

test('definite rejection is distinct from an uncertain order', async () => {
  const { client, calls } = fixture([token(), json({ error: 'bad address' }, 400)]);
  await assert.rejects(client.createPrintJob(printJob()), (error) => error.httpStatus === 400 && !error.uncertain && !error.retryable);
  assert.equal(calls.length, 2);
});

test('timeout covers an uncooperative fetch and marks only dispatched order as uncertain', async () => {
  const never = () => new Promise(() => {});
  const { client, calls } = fixture([token(), never], { timeoutMs: 5 });
  await assert.rejects(client.createPrintJob(printJob()), (error) => error.uncertain && error.code === 'submission_uncertain');
  assert.equal(calls[1].signal.aborted, true);
  const beforeDispatch = fixture([never], { timeoutMs: 5 });
  await assert.rejects(beforeDispatch.client.createPrintJob(printJob()), (error) => !error.uncertain && error.operation === 'authenticate');
  assert.equal(beforeDispatch.calls.length, 1);
});

test('transient reads expose retry eligibility without retrying automatically', async () => {
  const { client, calls } = fixture([token(), json({}, 503)]);
  await assert.rejects(client.getPrintJob(5), (error) => error.retryable && !error.uncertain && error.httpStatus === 503);
  assert.equal(calls.length, 2);
});

test('pending validation has a bounded wait and is not a successful preflight', async () => {
  let now = 0;
  const { client, calls } = fixture([token(), json({ id: 5, status: 'NORMALIZING' }), json({ id: 5, status: 'NORMALIZING' })], { now: () => now, sleep: async (ms) => { now += ms; } });
  await assert.rejects(client.waitForCoverValidation(5, { timeoutMs: 2, pollIntervalMs: 1 }), (error) => error.code === 'validation_pending' && !error.uncertain);
  assert.equal(calls.length, 3);
});

test('orders require a reference, complete contact/address, two HTTPS PDFs and allowed production delay', () => {
  const { client, calls } = fixture([]);
  for (const overrides of [{ external_id: '' }, { shipping_address: { ...address, email: '' } }, { production_delay: 0 }, { production_delay: 2881 }, { contact_email: 'bad-email' }, { line_items: [] }]) {
    assert.throws(() => client.createPrintJob({ ...printJob(), ...overrides }), (error) => error.code === 'invalid_input');
  }
  assert.equal(calls.length, 0);
});

test('shipping estimates require the province when Lulu needs it, including Spain', () => {
  const { client, calls } = fixture([]);
  assert.throws(() => client.shippingOptions({ line_items: lineItems, shipping_address: { country: 'ES', postcode: '28001' } }), (error) => error.field === 'shipping_address.state_code');
  assert.throws(() => client.quote({ line_items: lineItems, shipping_address: { ...address, state_code: undefined }, shipping_option: 'MAIL' }), (error) => error.field === 'shipping_address.state_code');
  assert.equal(calls.length, 0);
});

test('PDF sources must be unambiguous absolute HTTPS URLs', () => {
  const { client, calls } = fixture([]);
  for (const source_url of ['https:books.example.org/interior.pdf', 'https://books.example.org/a b.pdf', 'https:\\books.example.org\\interior.pdf']) {
    assert.throws(() => client.validateInterior({ ...interior, source_url }), (error) => error.field === 'source_url');
  }
  assert.equal(calls.length, 0);
});

test('order response body cannot hang beyond request timeout', async () => {
  const { client, calls } = fixture([token(), { ok: true, status: 201, text: () => new Promise(() => {}) }], { timeoutMs: 5 });
  await assert.rejects(client.createPrintJob(printJob()), (error) => error.code === 'submission_uncertain');
  assert.equal(calls[1].signal.aborted, true);
});

test('preflight wait deadline includes an in-flight GET and cancels its transport', async () => {
  const { client, calls } = fixture([token(), (_, init) => new Promise((_, reject) => init.signal.addEventListener('abort', () => reject(new Error('aborted'))))], { timeoutMs: 100 });
  await client.authenticate();
  await assert.rejects(client.waitForCoverValidation(5, { timeoutMs: 5, pollIntervalMs: 1 }), (error) => error.code === 'validation_pending');
  assert.equal(calls[1].signal.aborted, true);
});

test('preflight deadline includes OAuth and never dispatches a GET after its expiry', async () => {
  const { client, calls } = fixture([() => new Promise((resolve) => setTimeout(() => resolve(token()), 15))], { timeoutMs: 30 });
  await assert.rejects(client.waitForInteriorValidation(5, { timeoutMs: 5, pollIntervalMs: 1 }), (error) => error.code === 'validation_pending');
  await client.authenticate();
  assert.equal(calls.length, 1);
});

test('valid Lulu-normalized addresses may contain blank optional fields', async () => {
  const { client, calls } = fixture([token(), json({ id: 44, status: { name: 'UNPAID' } }, 201)]);
  await client.createPrintJob({ ...printJob(), shipping_address: { ...address, country_code: 'DE', state_code: '', street2: '', organization: null } });
  const shippedAddress = JSON.parse(calls[1].body).shipping_address;
  assert.equal(shippedAddress.country_code, 'DE');
  assert.equal(Object.hasOwn(shippedAddress, 'street2'), false);
  assert.equal(Object.hasOwn(shippedAddress, 'state_code'), false);
});

const remoteJob = (id, external_id, status = 'UNPAID') => ({ id, external_id, status: { name: status } });
const jobPage = (results, count = results.length, next = null) => json({ count, next, previous: null, results });

test('reconciliation finds only an exact external_id after traversing all search pages', async () => {
  const reference = 'caronte/+?a&=7';
  const { client, calls } = fixture([
    token(),
    jobPage([remoteJob(1, `${reference}-copy`), { ...remoteJob(2, reference.toUpperCase()), line_items: [{ external_id: reference }] }], 3, 'https://api.sandbox.lulu.com/print-jobs/?page=2'),
    jobPage([remoteJob(3, reference)], 3)
  ]);
  const result = await client.reconcilePrintJob(reference, { pageSize: 2 });
  assert.equal(result.outcome, 'matched');
  assert.equal(result.printJob.id, 3);
  assert.equal(result.printJob.status.name, 'UNPAID');
  assert.equal(result.searchComplete, true);
  assert.equal(result.pagesScanned, 2);
  assert.equal(result.resubmitAllowed, false);
  assert.equal(result.reconciliationRequired, false);
  for (const call of calls.slice(1)) {
    const url = new URL(call.url);
    assert.equal(url.pathname, '/print-jobs/');
    assert.equal(url.searchParams.get('search'), reference);
    assert.equal(url.searchParams.get('ordering'), 'id');
    assert.equal(url.searchParams.get('page_size'), '2');
    assert.equal(call.method, 'GET');
  }
  assert.equal(new URL(calls[2].url).searchParams.get('page'), '2');
});

test('zero exact search matches never authorizes another POST', async () => {
  const { client, calls } = fixture([token(), jobPage([remoteJob(1, 'caronte-12')])]);
  const result = await client.reconcilePrintJob('caronte-1');
  assert.equal(result.outcome, 'not_found');
  assert.equal(result.printJob, null);
  assert.equal(result.searchComplete, true);
  assert.equal(result.reconciliationRequired, true);
  assert.equal(result.resubmitAllowed, false);
  assert.equal(calls.length, 2);
});

test('multiple exact orders block reconciliation even if one has been canceled', async () => {
  const { client, calls } = fixture([token(), jobPage([remoteJob(1, 'ref', 'CANCELED'), remoteJob(2, 'ref')])]);
  const result = await client.reconcilePrintJob('ref');
  assert.equal(result.outcome, 'ambiguous');
  assert.equal(result.printJob, null);
  assert.deepEqual(result.matchingJobIds, [1, 2]);
  assert.equal(result.reconciliationRequired, true);
  assert.equal(result.resubmitAllowed, false);
  assert.equal(calls.length, 2);
});

test('finding one matching order before a pagination cap cannot prove uniqueness', async () => {
  const { client, calls } = fixture([token(), jobPage([remoteJob(1, 'ref')], 2, 'https://api.sandbox.lulu.com/print-jobs/?page=2')]);
  await assert.rejects(client.reconcilePrintJob('ref', { maxPages: 1, pageSize: 1 }), (error) => error.code === 'reconciliation_incomplete' && error.reconciliationRequired);
  assert.equal(calls.length, 2);
});

test('untrusted or looping next-page URLs are never followed with a bearer token', async () => {
  for (const next of ['https://evil.example.org/print-jobs/?page=2', 'https://api.sandbox.lulu.com/print-jobs/?page=1', 'https://api.lulu.com/print-jobs/?page=2', 'https://api.sandbox.lulu.com/other/?page=2']) {
    const { client, calls } = fixture([token(), jobPage([remoteJob(1, 'ref')], 2, next)]);
    await assert.rejects(client.reconcilePrintJob('ref'), (error) => error.code === 'reconciliation_incomplete');
    assert.equal(calls.length, 2);
  }
});

test('changing counts, duplicate page records and malformed pages cannot become not-found or matched', async () => {
  const first = () => jobPage([remoteJob(1, 'ref')], 2, 'https://api.sandbox.lulu.com/print-jobs/?page=2');
  for (const pages of [
    [first(), jobPage([remoteJob(2, 'other')], 3)],
    [first(), jobPage([remoteJob(1, 'ref')], 2)],
    [json({ count: 0, next: null })],
    [jobPage([remoteJob(1, 'ref')], 2)]
  ]) {
    const { client } = fixture([token(), ...pages]);
    await assert.rejects(client.reconcilePrintJob('ref'), (error) => error.code === 'reconciliation_incomplete' && error.reconciliationRequired);
  }
});

test('reconciliation timeout and HTTP failure retain uncertainty and never submit an order', async () => {
  for (const response of [json({}, 503), (_, init) => new Promise((_, reject) => init.signal.addEventListener('abort', () => reject(new Error('aborted'))))]) {
    const { client, calls } = fixture([token(), response], { timeoutMs: 100 });
    await assert.rejects(client.reconcilePrintJob('ref', { timeoutMs: 5 }), (error) => error.code === 'reconciliation_incomplete' && error.reconciliationRequired);
    assert.equal(calls.length, 2);
    assert.equal(calls[1].method, 'GET');
  }
});

test('reconciliation reference and pagination limits are validated before network access', async () => {
  const { client, calls } = fixture([]);
  for (const [reference, options] of [[' ref ', {}], ['', {}], ['ref', { maxPages: 0 }], ['ref', { pageSize: 101 }], ['ref', { timeoutMs: 0 }]]) {
    await assert.rejects(client.reconcilePrintJob(reference, options), (error) => error.code === 'invalid_input');
  }
  assert.equal(calls.length, 0);
});
