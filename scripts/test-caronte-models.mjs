import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createBookModelClient } from '../supabase/functions/_shared/caronte-models.mjs';
import { runClaimedJob } from '../supabase/functions/_shared/caronte-jobs.mjs';
import { buildStageRequest, validateArtifact } from '../supabase/functions/_shared/caronte-literary.mjs';

const request = {
  system: 'Editorial instructions',
  prompt: 'Full interview and scene text',
  schemaName: 'book_scene',
  schema: { type: 'object', properties: { prose: { type: 'string' } }, required: ['prose'], additionalProperties: false },
  maxOutputTokens: 7000
};
const options = { provider: 'openai', requestKey: 'book-123-scene-01-attempt-1' };
const openaiResponse = (overrides = {}) => ({
  id: 'resp_test123', model: 'writer-model', status: 'completed',
  output: [{ type: 'message', role: 'assistant', content: [{ type: 'output_text', text: '{"prose":"A complete scene."}' }] }],
  usage: { input_tokens: 300, output_tokens: 20, total_tokens: 320 }, ...overrides
});
const anthropicResponse = (overrides = {}) => ({
  id: 'msg_test123', model: 'reviewer-model', type: 'message', stop_reason: 'end_turn',
  content: [{ type: 'text', text: '{"prose":"An independent review."}' }],
  usage: { input_tokens: 500, output_tokens: 30 }, ...overrides
});
function client(fetchImpl, overrides = {}) {
  return createBookModelClient({ openaiKey: 'secret-openai', anthropicKey: 'secret-anthropic', writerModel: 'writer-model', reviewerModel: 'reviewer-model', fetchImpl, ...overrides });
}
function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });
}
function failure(code, fields = {}) {
  return (error) => {
    assert.equal(error.code, code);
    for (const [name, value] of Object.entries(fields)) assert.equal(error[name], value);
    assert.equal(error.message, code);
    assert.equal(error.cause, undefined);
    assert.doesNotMatch(JSON.stringify(error), /secret-|Full interview|Personal sensitive data/);
    return true;
  };
}

test('OpenAI submission stores a recoverable background handle and preserves the entire prompt', async () => {
  const longRequest = { ...request, prompt: 'Long private context. '.repeat(20000) };
  let calls = 0;
  const adapter = client(async (url, init) => {
    calls++;
    assert.equal(url, 'https://api.openai.com/v1/responses');
    assert.equal(init.method, 'POST');
    assert.equal(init.redirect, 'error');
    const body = JSON.parse(init.body);
    assert.equal(body.background, true);
    assert.equal(body.store, true);
    assert.equal(body.model, 'writer-model');
    assert.equal(body.max_output_tokens, 7000);
    assert.equal(body.input[0].content, request.system);
    assert.equal(body.input[1].content, longRequest.prompt);
    assert.deepEqual(body.text.format, { type: 'json_schema', name: request.schemaName, schema: request.schema, strict: true });
    assert.equal(body.metadata.caronte_request_key, options.requestKey);
    return jsonResponse(openaiResponse({ status: 'queued', output: [] }));
  });
  assert.deepEqual(await adapter.start(longRequest, options), { status: 'pending', id: 'resp_test123', provider: 'openai', model: 'writer-model' });
  assert.equal(calls, 1);
});

test('a new client resumes the same OpenAI handle with GET, never resubmits it', async () => {
  const adapter = client(async (url, init) => {
    assert.equal(url, 'https://api.openai.com/v1/responses/resp_test123');
    assert.equal(init.method, 'GET');
    assert.equal(init.body, undefined);
    return jsonResponse(openaiResponse());
  });
  const result = await adapter.poll({ provider: 'openai', id: 'resp_test123' });
  assert.equal(result.status, 'completed');
  assert.deepEqual(result.parsed, { prose: 'A complete scene.' });
  assert.deepEqual(result.usage, { input_tokens: 300, output_tokens: 20, total_tokens: 320 });
});

test('OpenAI in_progress remains pending and synchronous completion is accepted', async () => {
  assert.equal((await client(async () => jsonResponse(openaiResponse({ status: 'in_progress' }))).poll({ provider: 'openai', id: 'resp_test123' })).status, 'pending');
  assert.equal((await client(async () => jsonResponse(openaiResponse())).start(request, options)).parsed.prose, 'A complete scene.');
});

test('OpenAI refuses to promote incomplete, failed, cancelled or refused output', async () => {
  for (const [data, code, providerStatus] of [
    [{ status: 'incomplete', incomplete_details: { reason: 'max_output_tokens' } }, 'provider_output_incomplete', 'incomplete'],
    [{ status: 'failed', error: { message: 'Personal sensitive data' } }, 'provider_response_failed', 'failed'],
    [{ status: 'cancelled' }, 'provider_response_cancelled', 'cancelled'],
    [{ output: [{ type: 'message', content: [{ type: 'refusal', refusal: 'Personal sensitive data' }] }] }, 'provider_refusal', 'completed']
  ]) {
    await assert.rejects(client(async () => jsonResponse(openaiResponse(data))).poll({ provider: 'openai', id: 'resp_test123' }), failure(code, { id: 'resp_test123', providerStatus, terminal: true, uncertain: false }));
  }
});

test('Anthropic uses current structured-output contract and full context', async () => {
  const longRequest = { ...request, prompt: 'Long full manuscript. '.repeat(20000) };
  const adapter = client(async (url, init) => {
    assert.equal(url, 'https://api.anthropic.com/v1/messages');
    assert.equal(init.method, 'POST');
    assert.equal(init.headers['anthropic-version'], '2023-06-01');
    assert.equal(init.headers['x-api-key'], 'secret-anthropic');
    const body = JSON.parse(init.body);
    assert.equal(body.model, 'reviewer-model');
    assert.equal(body.max_tokens, 7000);
    assert.equal(body.system, request.system);
    assert.equal(body.messages[0].content, longRequest.prompt);
    assert.deepEqual(body.output_config, { format: { type: 'json_schema', schema: request.schema } });
    assert.equal(body.output_format, undefined);
    return jsonResponse(anthropicResponse());
  });
  const result = await adapter.start(longRequest, { ...options, provider: 'anthropic' });
  assert.equal(result.status, 'completed');
  assert.equal(result.provider, 'anthropic');
  assert.equal(result.id, 'msg_test123');
  assert.deepEqual(result.parsed, { prose: 'An independent review.' });
});

test('Anthropic end_turn is required; refusal and token exhaustion are terminal, not success', async () => {
  for (const [stop_reason, code] of [['refusal', 'provider_refusal'], ['max_tokens', 'provider_output_incomplete'], ['pause_turn', 'provider_output_incomplete'], ['stop_sequence', 'provider_output_incomplete']]) {
    await assert.rejects(client(async () => jsonResponse(anthropicResponse({ stop_reason }))).start(request, { ...options, provider: 'anthropic' }), failure(code, { terminal: true, uncertain: false, id: 'msg_test123', providerStatus: stop_reason }));
  }
});

test('unknown provider statuses, missing output, invalid JSON and primitives never become completed', async () => {
  for (const overrides of [
    { status: 'future_status' },
    { output: [] },
    { output: {} },
    { output: [{ type: 'message', content: [{ type: 'output_text', text: 'Not JSON: Personal sensitive data' }] }] },
    { output: [{ type: 'message', content: [{ type: 'output_text', text: 'null' }] }] }
  ]) {
    await assert.rejects(client(async () => jsonResponse(openaiResponse(overrides))).start(request, options), failure('provider_output_invalid', { terminal: true, id: 'resp_test123', uncertain: false }));
  }
});

test('a mismatched response handle never replaces the persisted handle', async () => {
  await assert.rejects(client(async () => jsonResponse(openaiResponse({ id: 'resp_other' }))).poll({ provider: 'openai', id: 'resp_test123' }), failure('provider_response_mismatch', { id: 'resp_test123', terminal: true }));
});

test('POST transport failure is uncertain and never retried or leaked', async () => {
  for (const provider of ['openai', 'anthropic']) {
    let calls = 0;
    await assert.rejects(client(async () => { calls++; throw new Error('secret-openai Personal sensitive data'); }).start(request, { ...options, provider }), failure('provider_submission_uncertain', { uncertain: true, terminal: false, provider }));
    assert.equal(calls, 1);
  }
});

test('timeouts cover fetch and response body, including transports ignoring abort', async () => {
  for (const fetchImpl of [
    async () => new Promise(() => {}),
    async () => ({ ok: true, json: () => new Promise(() => {}) })
  ]) {
    await assert.rejects(client(fetchImpl, { timeoutMs: 5 }).start(request, options), failure('provider_submission_uncertain', { uncertain: true }));
  }
});

test('poll transport failures preserve id and are safe to poll again', async () => {
  await assert.rejects(client(async () => { throw new Error('Personal sensitive data'); }).poll({ provider: 'openai', id: 'resp_test123' }), failure('provider_poll_unavailable', { id: 'resp_test123', terminal: false, uncertain: false }));
});

test('POST server and timeout errors are uncertain; rejected requests stay explicit', async () => {
  for (const status of [408, 500, 502, 503]) {
    await assert.rejects(client(async () => jsonResponse({ error: 'Personal sensitive data secret-openai' }, status)).start(request, options), failure('provider_submission_uncertain', { httpStatus: status, uncertain: true }));
  }
  for (const status of [400, 401, 403, 429]) {
    await assert.rejects(client(async () => jsonResponse({ error: 'Personal sensitive data' }, status)).start(request, options), failure('provider_http_error', { httpStatus: status, uncertain: false }));
  }
});

test('an accepted response missing a recoverable handle is uncertain', async () => {
  await assert.rejects(client(async () => jsonResponse({ status: 'queued' })).start(request, options), failure('provider_submission_uncertain', { uncertain: true }));
  await assert.rejects(client(async () => new Response('{')).start(request, options), failure('provider_submission_uncertain', { uncertain: true }));
});

test('configuration, unsupported polling and invalid input fail before any network call', async () => {
  let calls = 0;
  const fetchImpl = async () => { calls++; return jsonResponse(openaiResponse()); };
  await assert.rejects(client(fetchImpl, { writerModel: undefined }).start(request, options), failure('provider_model_missing'));
  await assert.rejects(client(fetchImpl, { reviewerModel: '' }).start(request, { ...options, provider: 'anthropic' }), failure('provider_model_missing'));
  await assert.rejects(client(fetchImpl, { openaiKey: '' }).start(request, options), failure('provider_key_missing'));
  await assert.rejects(client(fetchImpl).start({ ...request, maxOutputTokens: 0 }, options), failure('provider_request_invalid'));
  await assert.rejects(client(fetchImpl).start(request, { ...options, requestKey: '' }), failure('provider_request_invalid'));
  await assert.rejects(client(fetchImpl).poll({ provider: 'openai', id: '../secret-openai' }), failure('provider_request_invalid'));
  await assert.rejects(client(fetchImpl).poll({ provider: 'anthropic', id: 'msg_test123' }), failure('provider_poll_unsupported'));
  assert.equal(calls, 0);
});

test('usage exposes token counts only, not arbitrary provider response metadata', async () => {
  const result = await client(async () => jsonResponse(openaiResponse({ usage: { input_tokens: 2, output_tokens: 5, note: 'secret-openai', input_tokens_details: { cached_tokens: 1, private_text: 'Personal sensitive data' } } }))).start(request, options);
  assert.deepEqual(result.usage, { input_tokens: 2, output_tokens: 5, input_tokens_details: { cached_tokens: 1 } });
});

test('a completed envelope never masks an incomplete message or a provider error', async () => {
  const message = openaiResponse().output[0];
  for (const overrides of [
    { output: [{ ...message, status: 'incomplete' }] },
    { error: { message: 'Personal sensitive data' } }
  ]) {
    await assert.rejects(client(async () => jsonResponse(openaiResponse(overrides))).start(request, options), failure('provider_output_invalid', { id: 'resp_test123', terminal: true }));
  }
});

test('token-limit detail is retained without retaining provider free text', async () => {
  await assert.rejects(client(async () => jsonResponse(openaiResponse({ status: 'incomplete', incomplete_details: { reason: 'max_output_tokens', text: 'Personal sensitive data' } }))).start(request, options), failure('provider_output_incomplete', { reason: 'max_output_tokens', terminal: true }));
});

test('GPT-5.4 Pro keeps its model and full schema without requesting unsupported Structured Outputs', async () => {
  for (const model of ['gpt-5.4-pro', 'gpt-5.4-pro-2026-03-05']) {
    const submissions = [];
    const longRequest = { ...request, prompt: 'Complete private interview. '.repeat(10000) };
    const adapter = client(async (_url, init) => {
      const body = JSON.parse(init.body);
      submissions.push(body);
      if (body.text?.format?.type === 'json_schema') return jsonResponse({ error: 'Unsupported format' }, 400);
      return jsonResponse(openaiResponse({ model, status: 'queued', output: [] }));
    }, { writerModel: model });
    assert.equal((await adapter.start(longRequest, options)).status, 'pending');
    assert.equal(submissions.length, 1);
    const body = submissions[0];
    assert.equal(body.model, model);
    assert.equal(body.background, true);
    assert.equal(body.store, true);
    assert.equal(body.max_output_tokens, request.maxOutputTokens);
    assert.equal(body.text, undefined);
    assert.equal(body.input[1].content, longRequest.prompt);
    assert.ok(body.input[0].content.startsWith(request.system));
    assert.ok(body.input[0].content.includes(JSON.stringify(request.schema)));
    assert.ok(body.input[0].content.includes(request.schemaName));
    assert.match(body.input[0].content, /JSON/);
    assert.equal(body.metadata.caronte_output_contract, 'prompt_json_v1');
    const restored = client(async (_url, init) => {
      assert.equal(init.method, 'GET');
      return jsonResponse(openaiResponse({ model }));
    }, { writerModel: model });
    assert.deepEqual((await restored.poll({ provider: 'openai', id: 'resp_test123' })).parsed, { prose: 'A complete scene.' });
  }
});

test('prompt-JSON output still passes the real literary gate before the worker accepts a biography', async () => {
  const source = 'Tengo 50 años. Vivo en un pueblo. Reparo relojes. Tengo un taller. Me gusta caminar. Leo novelas. Cuido un huerto. Toco el piano.';
  const interview = { sessionId: 'fixture', interviewDate: '2026-10-11T10:00:00Z', sources: [{ id: 'q_01', transcript: source }] };
  const valid = {
    age: { current: 50, future: 90, sourceId: 'q_01', quote: 'Tengo 50 años.', needsConfirmation: false },
    facts: source.split('. ').map((quote, index) => ({ id: `fact_${index}`, claim: quote, sourceId: 'q_01', quote })),
    tensions: [], voice: { register: 'Sobrio', traits: [], phrases: [] }, openQuestions: []
  };
  for (const [output, expected] of [[valid, 'queued'], [{}, 'blocked'], [{ ...valid, extra: 'unexpected' }, 'blocked']]) {
    const receipts = [];
    let calls = 0;
    const provider = client(async (_url, init) => {
      calls++;
      if (JSON.parse(init.body).text?.format?.type === 'json_schema') return jsonResponse({ error: 'Unsupported format' }, 400);
      return jsonResponse(openaiResponse({ model: 'gpt-5.4-pro', output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify(output) }] }] }));
    }, { writerModel: 'gpt-5.4-pro' });
    const result = await runClaimedJob({
      job: { id: 'fixture', interview, model_config: { writerModel: 'gpt-5.4-pro', reviewerModel: 'reviewer-model' } },
      steps: [], provider, build: buildStageRequest, validate: validateArtifact,
      checkpoint: async (step, state) => receipts.push({ step, state }),
      assemble: async () => assert.fail('A single biography must never become a book'),
      finish: async () => assert.fail('A single biography must never become a book')
    });
    assert.equal(result.status, expected);
    assert.equal(calls, 1);
    assert.equal(receipts.at(-1).step.provider_request_id, 'resp_test123');
    if (expected === 'queued') {
      assert.equal(receipts.at(-1).step.status, 'completed');
      assert.deepEqual(receipts.at(-1).step.output, valid);
    } else {
      assert.equal(result.errorCode, 'invalid_artifact');
      assert.equal(receipts.at(-1).step.output, undefined);
    }
  }
});

test('GPT-5.4 Pro never repairs or resubmits malformed JSON implicitly', async () => {
  let calls = 0;
  const adapter = client(async () => {
    calls++;
    return jsonResponse(openaiResponse({ model: 'gpt-5.4-pro', output: [{ type: 'message', content: [{ type: 'output_text', text: '```json\n{}\n```' }] }] }));
  }, { writerModel: 'gpt-5.4-pro' });
  await assert.rejects(adapter.start(request, options), failure('provider_output_invalid', { terminal: true, uncertain: false }));
  assert.equal(calls, 1);
});
