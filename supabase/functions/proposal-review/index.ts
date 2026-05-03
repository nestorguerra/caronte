import { jsonResponse } from '../_shared/cors.ts';
import { encodeParam, hasServiceConfig, insertAudit, requireActiveMembership, rest } from '../_shared/service.ts';

function first<T>(value: T[] | T | null): T | null {
  return Array.isArray(value) ? (value[0] || null) : value;
}

function sectionScore(markdown: string, needles: string[]) {
  const lower = markdown.toLowerCase();
  const hits = needles.filter((needle) => lower.includes(needle)).length;
  return Math.min(100, Math.round((hits / needles.length) * 100));
}

function evaluate(markdown: string) {
  const sections = [
    {
      code: 'understanding',
      label: 'Comprension del contrato',
      score: sectionScore(markdown, ['objeto', 'contrato', 'cpv', 'procedimiento']),
      suggestion: 'Conectar el enfoque con el objeto, CPV, organo y procedimiento.'
    },
    {
      code: 'technical_plan',
      label: 'Plan tecnico',
      score: sectionScore(markdown, ['metodologia', 'plan', 'ejecucion', 'kpi', 'calidad']),
      suggestion: 'Detallar metodologia, fases, entregables y control de calidad.'
    },
    {
      code: 'team_solvency',
      label: 'Equipo y solvencia',
      score: sectionScore(markdown, ['equipo', 'experiencia', 'solvencia', 'certificaciones']),
      suggestion: 'Anadir referencias, equipo asignado, solvencia y certificados reales.'
    },
    {
      code: 'risk_evidence',
      label: 'Riesgos y evidencias',
      score: sectionScore(markdown, ['riesgo', 'control', 'fuente', 'pliego']),
      suggestion: 'Trazar cada afirmacion importante a pliego o documento oficial.'
    }
  ];
  const missing = sections.filter((section) => section.score < 50).map((section) => section.label);
  const total = Math.round(sections.reduce((acc, section) => acc + section.score, 0) / sections.length);
  return {
    total,
    sections,
    risks: missing.map((label) => `Seccion debil o incompleta: ${label}`),
    suggestions: sections.filter((section) => section.score < 75).map((section) => section.suggestion),
    overwrite_required: false,
    reviewed_at: new Date().toISOString()
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return jsonResponse(req, { ok: true });
  if (req.method !== 'POST') return jsonResponse(req, { error: 'Method not allowed' }, 405);
  if (!hasServiceConfig()) return jsonResponse(req, { error: 'Backend not configured' }, 503);

  try {
    const { user, organizationId } = await requireActiveMembership(req);
    const payload = await req.json().catch(() => ({}));
    const proposalVersionId = String(payload.proposalVersionId || '').trim();
    if (!proposalVersionId) throw new Error('proposalVersionId is required');
    const version = first(await rest(`proposal_versions?id=eq.${encodeParam(proposalVersionId)}&organization_id=eq.${organizationId}&select=*&limit=1`));
    if (!version) throw new Error('Proposal version not found');
    const review = evaluate(String(version.content_markdown || ''));
    const aiRun = first(await rest('ai_runs', {
      method: 'POST',
      body: {
        organization_id: organizationId,
        actor_user_id: user.id,
        use_case: 'proposal_review',
        endpoint: 'proposal-review',
        model: 'deterministic-sprint5',
        prompt_version: 'sprint5.review.v1',
        input_refs: { proposal_version_id: proposalVersionId },
        output: review,
        citations: [],
        token_usage: {},
        status: 'succeeded',
        success: true
      }
    }));
    await rest(`proposal_versions?id=eq.${proposalVersionId}`, {
      method: 'PATCH',
      body: {
        review,
        metadata: {
          ...(version.metadata || {}),
          latest_review_ai_run_id: aiRun?.id || null
        }
      },
      prefer: 'return=minimal'
    });
    await insertAudit(req, {
      organization_id: organizationId,
      actor_user_id: user.id,
      action: 'proposal.review.created',
      resource_type: 'proposal_version',
      resource_id: proposalVersionId,
      metadata: { total: review.total, ai_run_id: aiRun?.id || null }
    });
    return jsonResponse(req, { ok: true, review, aiRunId: aiRun?.id || null });
  } catch (error) {
    return jsonResponse(req, { error: error instanceof Error ? error.message : 'Unexpected error' }, 400);
  }
});
