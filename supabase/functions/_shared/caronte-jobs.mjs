import { fingerprintArtifact } from './caronte-literary.mjs';

export const BOOK_JOB_VERSION = 'caronte-longform-v2';

function revisionOf(step) {
  const suffix = String(step.step_key || '').split(':').at(-1);
  return /^\d+$/.test(suffix) ? Number(suffix) : 0;
}

export function collectArtifacts(steps, interview) {
  const artifacts = { interview, drafts: {}, reviews: {}, approvalBindings: { units: {}, longitudinal: null } };
  // DB row order is not a revision contract. Select the highest completed
  // revision, including when a later read returns older rows last.
  for (const step of [...steps].sort((a, b) => revisionOf(a) - revisionOf(b))) {
    if (step.status !== 'completed') continue;
    if (['draft', 'revision'].includes(step.stage)) artifacts.drafts[step.unit_id] = step.output;
    else if (step.stage === 'review') {
      artifacts.reviews[step.unit_id] = step.output;
      artifacts.approvalBindings.units[step.unit_id] = step.input_hash || null;
    } else if (step.stage === 'longitudinal') {
      artifacts.longitudinal = step.output;
      artifacts.approvalBindings.longitudinal = step.input_hash || null;
    } else if (['biography', 'world', 'outline'].includes(step.stage)) artifacts[step.stage] = step.output;
  }
  return artifacts;
}

function unitStep(done, unit, firstRevision, lastRevision, globalReview = null) {
  let latest = firstRevision;
  for (let revision = firstRevision; revision <= lastRevision; revision++) {
    if (done.has(`${revision === 0 ? 'draft' : 'revision'}:${unit.id}:${revision}`)) latest = revision;
  }
  for (let revision = latest; revision <= lastRevision; revision++) {
    const stage = revision === 0 ? 'draft' : 'revision';
    const key = `${stage}:${unit.id}:${revision}`;
    if (!done.has(key)) return { key, stage, unit, globalReview: revision === firstRevision ? globalReview : null };
    const reviewKey = `review:${unit.id}:${revision}`;
    if (!done.has(reviewKey)) return { key: reviewKey, stage: 'review', unit };
    const review = done.get(reviewKey).output;
    if (review.verdict === 'pass') return null;
    if (review.verdict === 'block') return { blocked: true, reason: 'editorial_block', unit };
    if (review.verdict !== 'revise') return { blocked: true, reason: 'invalid_editorial_verdict', unit };
  }
  return { blocked: true, reason: 'editorial_revision_limit', unit };
}

export function planNextStep(steps) {
  const done = new Map(steps.filter(s => s.status === 'completed').map(s => [s.step_key, s]));
  for (const stage of ['biography', 'world', 'outline']) {
    if (!done.has(stage)) return { key: stage, stage };
  }
  const units = done.get('outline').output.chapters.flatMap(c => c.units);
  if (units.length !== 30 || new Set(units.map(u => u.id)).size !== 30) {
    return { blocked: true, reason: 'invalid_book_outline' };
  }
  for (const unit of units) {
    const next = unitStep(done, unit, 0, 2);
    if (next) return next;
  }
  const first = done.get('longitudinal:0')?.output;
  if (!first) return { key: 'longitudinal:0', stage: 'longitudinal' };
  if (first.verdict === 'pass') return { finalize: true };
  if (first.verdict !== 'revise') return { blocked: true, reason: 'longitudinal_editorial_block' };

  // Localize cross-book edits when the reviewer identifies units. A book-wide
  // issue is deliberately revised across all units, not ignored as unparseable.
  const locations = (first.issues || []).map(i => i.location || '').join(' ');
  const selected = units.filter(u => locations.includes(u.id));
  const targets = /\bbook\b|global|whole/i.test(locations) || !selected.length ? units : selected;
  for (const unit of targets) {
    const next = unitStep(done, unit, 3, 5, first);
    if (next) return next;
  }
  const second = done.get('longitudinal:1')?.output;
  if (!second) return { key: 'longitudinal:1', stage: 'longitudinal' };
  return second.verdict === 'pass'
    ? { finalize: true }
    : { blocked: true, reason: 'longitudinal_revision_limit' };
}

export function publicBookJob(job, steps = []) {
  if (!job) return null;
  const finished = steps.filter(s => s.status === 'completed').length;
  return {
    id: job.id,
    status: job.status,
    stage: job.stage,
    completedSteps: finished,
    totalSteps: Math.max(64, steps.length),
    progress: job.status === 'ready' ? 100 : Math.min(95, Math.floor(finished / Math.max(64, steps.length) * 95)),
    errorCode: job.error_code || null,
    createdAt: job.created_at,
    updatedAt: job.updated_at
  };
}

function safeErrorCode(error) {
  return /^[a-z][a-z0-9_:]{1,99}$/.test(error?.code || '') ? error.code : 'book_step_failed';
}

function safeModel(value) {
  return typeof value === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9._:/-]{0,199}$/.test(value) ? value : null;
}

function safeRequestId(value, provider) {
  return typeof value === 'string' && /^(resp|msg)_[a-zA-Z0-9_-]{1,200}$/.test(value)
    && value.startsWith(provider === 'openai' ? 'resp_' : 'msg_') ? value : null;
}

function safeUsage(value) {
  const usage = {};
  for (const key of ['input_tokens', 'output_tokens', 'total_tokens', 'cache_creation_input_tokens', 'cache_read_input_tokens']) {
    if (Number.isSafeInteger(value?.[key]) && value[key] >= 0) usage[key] = value[key];
  }
  for (const [group, field] of [['input_tokens_details', 'cached_tokens'], ['output_tokens_details', 'reasoning_tokens']]) {
    if (Number.isSafeInteger(value?.[group]?.[field]) && value[group][field] >= 0) usage[group] = { [field]: value[group][field] };
  }
  return usage;
}

function errorDiagnostic(error, uncertain) {
  const diagnostic = { terminal: error?.terminal === true, uncertain };
  const statuses = ['queued', 'in_progress', 'completed', 'failed', 'cancelled', 'incomplete', 'end_turn', 'refusal', 'max_tokens', 'pause_turn', 'stop_sequence', 'tool_use', 'model_context_window_exceeded', 'unknown'];
  if (statuses.includes(error?.providerStatus)) diagnostic.providerStatus = error.providerStatus;
  if (['max_output_tokens', 'content_filter', 'unknown'].includes(error?.reason)) diagnostic.reason = error.reason;
  if (Number.isInteger(error?.httpStatus) && error.httpStatus >= 100 && error.httpStatus <= 599) diagnostic.httpStatus = error.httpStatus;
  if (error?.artifact !== undefined) diagnostic.artifact = error.artifact;
  return diagnostic;
}

async function fingerprintStep(next, artifacts, request) {
  if (next.stage === 'review') return fingerprintArtifact(artifacts.drafts[next.unit.id]);
  if (next.stage === 'longitudinal') {
    const drafts = artifacts.outline.chapters.flatMap(chapter => chapter.units).map(unit => artifacts.drafts[unit.id]);
    return fingerprintArtifact(drafts);
  }
  return fingerprintArtifact(request);
}

export async function runClaimedJob({ job, steps, checkpoint, finish, build, validate, assemble, provider }) {
  // Every hash, prompt and validation in this claim sees one immutable snapshot.
  job = structuredClone(job);
  steps = structuredClone(steps);
  const next = planNextStep(steps);
  const artifacts = collectArtifacts(steps, job.interview);
  artifacts.contractVersion=job.model_config?.literaryContract?.version;
  const gate = async (code, receipt = null) => {
    await checkpoint({ ...(receipt || { step_key: 'editorial_gate', stage: 'gate' }), status: 'failed', error_code: code }, 'blocked');
    return { status: 'blocked', errorCode: code };
  };
  if (next.blocked) return gate(next.reason);
  if (next.finalize) {
    try {
      const manuscript = await assemble(artifacts);
      await finish(manuscript, artifacts);
      return { status: 'ready' };
    } catch (error) {
      if (error?.code === 'lease_lost') throw error;
      return gate(safeErrorCode(error));
    }
  }

  const previous = steps.find(s => s.step_key === next.key);
  if (previous && !previous.provider_request_id && (['started', 'waiting'].includes(previous.status)
    || previous.error_code === 'provider_submission_uncertain' || previous.diagnostic?.uncertain === true)) {
    return gate('provider_submission_uncertain');
  }
  if (previous?.status === 'failed' && previous.diagnostic?.terminal === true) return gate(safeErrorCode({ code: previous.error_code }));
  if (previous?.status === 'failed' && !previous.provider_request_id && previous.attempt >= 3) return gate('provider_retry_limit', previous);
  const review = next.globalReview || artifacts.reviews[next.unit?.id];
  let step = {
    step_key: next.key, stage: next.stage, unit_id: next.unit?.id || null,
    provider: ['review', 'longitudinal'].includes(next.stage) ? 'anthropic' : 'openai',
    status: 'started', attempt: previous?.attempt || 0,
    provider_request_id: previous?.provider_request_id || null,
    input_hash: previous?.input_hash || null,
    model: safeModel(previous?.model) || safeModel(job.model_config?.[['review', 'longitudinal'].includes(next.stage) ? 'reviewerModel' : 'writerModel']),
    usage: safeUsage(previous?.usage)
  };
  let submitted = false;
  let polled = false;
  let received = false;
  try {
    const request = await build({ stage: next.stage, interview: job.interview, artifacts,contractVersion:artifacts.contractVersion,
      unit: next.unit, draft: artifacts.drafts[next.unit?.id], review });
    const inputHash = await fingerprintStep(next, artifacts, request);
    if (previous?.input_hash && previous.input_hash !== inputHash) return gate('stale_step_input');
    if (step.provider_request_id && !previous?.input_hash) return gate('stale_step_input');
    step.input_hash = inputHash;
    let result;
    if (step.provider_request_id) {
      polled = true;
      result = await provider.poll({ provider: step.provider, id: step.provider_request_id });
    } else {
      step.attempt++;
      // Write intent before POST. A crash between POST and receipt is ambiguous,
      // so a replacement worker must not silently submit another paid request.
      await checkpoint(step, 'running');
      submitted = true;
      result = await provider.start(request, { provider: step.provider,
        requestKey: `${job.id}:${step.step_key}:${step.attempt}` });
    }
    const receiptId = safeRequestId(result?.id, step.provider) || step.provider_request_id;
    if (!receiptId) throw Object.assign(new Error(), { code: 'provider_submission_uncertain', uncertain: true });
    if (step.provider_request_id && step.provider_request_id !== receiptId) {
      throw Object.assign(new Error(), { code: 'provider_response_mismatch', terminal: true });
    }
    received = true;
    step = { ...step, provider_request_id: receiptId,
      model: safeModel(result?.model) || step.model, usage: result?.usage ? safeUsage(result.usage) : step.usage };
    if (result.status === 'pending') {
      if (step.provider !== 'openai') throw Object.assign(new Error(), { code: 'invalid_provider_status', terminal: true });
      await checkpoint({ ...step, status: 'waiting' }, 'queued', 10);
      return { status: 'queued' };
    }
    if (result.status !== 'completed') throw Object.assign(new Error(), { code: 'invalid_provider_status', terminal: true });
    const output = await validate(next.stage, result.parsed, {
      interview: job.interview, artifacts, contractVersion:artifacts.contractVersion,biography: artifacts.biography,
      world: artifacts.world, outline: artifacts.outline, plan: artifacts.outline,
      unit: next.unit, draft: artifacts.drafts[next.unit?.id], review
    });
    await checkpoint({ ...step, status: 'completed', output }, 'queued');
    return { status: 'queued' };
  } catch (error) {
    if (error?.code === 'lease_lost') throw error;
    const uncertain = error?.uncertain === true || (submitted && !received && error?.terminal === undefined && error?.uncertain !== false);
    const code = uncertain ? 'provider_submission_uncertain' : safeErrorCode(error);
    step.provider_request_id = step.provider_request_id || safeRequestId(error?.id, step.provider);
    step.model = safeModel(error?.model) || step.model;
    if (error?.usage) step.usage = safeUsage(error.usage);
    const knownRejection = code === 'provider_http_error' && error?.httpStatus === 429;
    const pollAgain = step.provider === 'openai' && step.provider_request_id && polled && !received && error?.terminal !== true && !uncertain;
    const retrySubmission = !step.provider_request_id && knownRejection && !uncertain && step.attempt < 3;
    const retry = pollAgain || retrySubmission;
    await checkpoint({ ...step, status: pollAgain ? 'waiting' : 'failed', error_code: code,
      diagnostic: errorDiagnostic(error, uncertain) }, retry ? 'queued' : 'blocked', retry ? 30 : 0);
    return { status: retry ? 'queued' : 'blocked', errorCode: code };
  }
}
