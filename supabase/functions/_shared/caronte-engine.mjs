import { normalizeInterview, fingerprintArtifact, buildStageRequest, validateArtifact, assembleManuscript } from './caronte-literary.mjs';
import { BOOK_JOB_VERSION, publicBookJob, runClaimedJob } from './caronte-jobs.mjs';
import { createBookModelClient } from './caronte-models.mjs';

const first = value => Array.isArray(value) ? value[0] || null : value || null;
const fail = code => { throw Object.assign(new Error(code), { code }); };
const encode = value => encodeURIComponent(String(value));

// The HTTP boundary authenticates the participant/admin before invoking this
// service. Its database connection is service-only; snapshots never go to clients.
export function createBookEngine({ rest, settings, wake = () => {}, fetchImpl = globalThis.fetch }) {
  async function rpc(name, body) {
    try { return await rest(`rpc/${name}`, { method: 'POST', body }); }
    catch (error) {
      if (/lease_lost/.test(error?.message || '')) fail('lease_lost');
      if (/active_book_interview_changed/.test(error?.message || '')) fail('active_book_interview_changed');
      fail('book_storage_unavailable');
    }
  }
  async function latestJob(sessionId) {
    return first(await rest(`future_book_jobs?session_id=eq.${encode(sessionId)}&select=*&order=created_at.desc&limit=1`));
  }
  async function jobSteps(jobId) {
    const rows = await rest(`future_book_job_steps?job_id=eq.${encode(jobId)}&select=*&order=created_at.asc,id.asc`);
    return Array.isArray(rows) ? rows : [];
  }
  async function status(sessionId) {
    const job = await latestJob(sessionId);
    if (!job) return { job: null, manuscript: null };
    const steps = await jobSteps(job.id);
    const manuscript = job.status === 'ready' && job.manuscript_id
      ? first(await rest(`future_book_manuscripts?id=eq.${encode(job.manuscript_id)}&session_id=eq.${encode(sessionId)}&select=*&limit=1`)) : null;
    return { job: publicBookJob(job, steps), manuscript };
  }
  async function enqueue(session, answers) {
    if (!['interview_completed', 'book_generating', 'book_ready', 'blocked'].includes(session.status)) fail('interview_not_completed');
    const expected = Number(session.question_count);
    const indices = new Set(answers.map(answer => Number(answer.question_index)));
    if (!Number.isInteger(expected) || expected < 1 || answers.length !== expected || indices.size !== expected
      || Array.from({ length: expected }, (_, i) => i + 1).some(index => !indices.has(index))) fail('interview_incomplete');
    const interview = normalizeInterview(answers, session);
    const interviewHash = await fingerprintArtifact(interview);
    const previous = await latestJob(session.id);
    if (previous?.interview_hash === interviewHash && previous.prompt_version === BOOK_JOB_VERSION) {
      if (['queued', 'running'].includes(previous.status)) wake(previous.id);
      return status(session.id);
    }
    const config = await settings();
    if (['writerModel', 'reviewerModel', 'openaiKey', 'anthropicKey'].some(key => typeof config[key] !== 'string' || !config[key].trim())) {
      fail('book_provider_configuration_required');
    }
    const job = first(await rpc('caronte_enqueue_book', {
      p_session_id: session.id, p_interview_hash: interviewHash, p_interview: interview,
      p_prompt_version: BOOK_JOB_VERSION,
      p_model_config: { writerModel: config.writerModel, reviewerModel: config.reviewerModel }
    }));
    if (!job?.id) fail('book_enqueue_failed');
    if (['queued', 'running'].includes(job.status)) wake(job.id);
    return { job: publicBookJob(job), manuscript: null };
  }
  async function advance(jobId = null) {
    const job = first(await rpc('caronte_claim_book_job', { p_job_id: jobId }));
    if (!job?.id) return { status: 'idle' };
    const steps = await jobSteps(job.id);
    const keys = await settings();
    const provider = createBookModelClient({
      ...keys, ...job.model_config, fetchImpl, timeoutMs: 110000
    });
    const result = await runClaimedJob({ job, steps, provider,
      build: buildStageRequest, validate: validateArtifact, assemble: assembleManuscript,
      checkpoint: (step, state, delay = 0) => rpc('caronte_checkpoint_book_job', {
        p_job_id: job.id, p_lease_token: job.lease_token, p_step: step, p_state: state, p_delay_seconds: delay
      }),
      finish: (manuscript, artifacts) => rpc('caronte_finish_book_job', {
        p_job_id: job.id, p_lease_token: job.lease_token, p_manuscript: manuscript,
        p_quality_report: {
          editorial_gate: 'pass', human_review: 'pending', print_pages_verified: false,
          word_count: manuscript.word_count, page_target: manuscript.target_pages,
          scores: artifacts.longitudinal.scores, approval_bindings: artifacts.approvalBindings
        },
        p_provider_chain: {
          drafting: job.model_config.writerModel, reviewer: job.model_config.reviewerModel,
          book_job_id: job.id, degraded: false,
          receipts: steps.filter(step => step.provider_request_id).map(step => ({
            step: step.step_key, provider: step.provider, model: step.model,
            id: step.provider_request_id, input_hash: step.input_hash, usage: step.usage
          }))
        }
      })
    });
    if (result.status === 'queued') wake(job.id, 10);
    return { ...result, jobId: job.id };
  }
  return { enqueue, status, advance };
}
