import { analysisSchema, buildDeterministicAnalysis, callOpenAiJson, validateAnalysis } from '../_shared/ai.ts';
import { jsonResponse } from '../_shared/cors.ts';
import { explainTenderScore } from '../_shared/scoring.ts';
import { encodeParam, hasServiceConfig, insertAudit, requireActiveMembership, rest } from '../_shared/service.ts';

function first<T>(value: T[] | T | null): T | null {
  return Array.isArray(value) ? (value[0] || null) : value;
}

function todayMinus(hours: number) {
  return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
}

function collectCitations(analysis: ReturnType<typeof validateAnalysis>) {
  const citations = [
    ...analysis.official_facts.flatMap((item) => item.citations || []),
    ...analysis.inferred_risks.flatMap((item) => item.citations || []),
    ...analysis.requirements.flatMap((item) => item.citations || [])
  ];
  const seen = new Set<string>();
  return citations.filter((item) => {
    const key = `${item.source}:${item.title}:${item.url || ''}:${item.fragment}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function assertAiQuota(organizationId: string, userId: string) {
  const since = todayMinus(24);
  const [orgRuns, userRuns] = await Promise.all([
    rest(`ai_runs?organization_id=eq.${organizationId}&created_at=gte.${encodeParam(since)}&select=id`),
    rest(`ai_runs?organization_id=eq.${organizationId}&actor_user_id=eq.${userId}&created_at=gte.${encodeParam(since)}&select=id`)
  ]);
  const orgCount = Array.isArray(orgRuns) ? orgRuns.length : 0;
  const userCount = Array.isArray(userRuns) ? userRuns.length : 0;
  if (orgCount >= 80) throw new Error('Limite diario de analisis IA alcanzado para la organizacion');
  if (userCount >= 25) throw new Error('Limite diario de analisis IA alcanzado para este usuario');
}

async function insertAiRun(input: {
  organizationId: string;
  userId: string;
  tenderId: string;
  endpoint: string;
  model: string;
  output: unknown;
  citations: unknown[];
  usage: Record<string, unknown>;
  success: boolean;
  errorMessage?: string | null;
}) {
  const created = await rest('ai_runs', {
    method: 'POST',
    body: {
      organization_id: input.organizationId,
      actor_user_id: input.userId,
      use_case: 'tender_analysis',
      endpoint: input.endpoint,
      model: input.model,
      prompt_version: 'sprint4.analysis.v1',
      input_refs: { tender_id: input.tenderId },
      output: input.output,
      citations: input.citations,
      token_usage: input.usage,
      status: input.success ? 'succeeded' : 'failed',
      success: input.success,
      estimated_cost_cents: null,
      error_message: input.errorMessage || null
    }
  });
  return first(created);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return jsonResponse(req, { ok: true });
  if (req.method !== 'POST') return jsonResponse(req, { error: 'Method not allowed' }, 405);
  if (!hasServiceConfig()) return jsonResponse(req, { error: 'Backend not configured' }, 503);

  try {
    const { user, organizationId } = await requireActiveMembership(req);
    const payload = await req.json().catch(() => ({}));
    const tenderId = String(payload.tenderId || '').trim();
    if (!tenderId) throw new Error('tenderId is required');
    await assertAiQuota(organizationId, user.id);

    const [tenderRows, profileRows, documentRows] = await Promise.all([
      rest(`tenders?id=eq.${encodeParam(tenderId)}&select=*&limit=1`),
      rest(`company_profiles?organization_id=eq.${organizationId}&select=*&limit=1`),
      rest(`tender_documents?tender_id=eq.${encodeParam(tenderId)}&select=*&order=created_at.desc&limit=20`)
    ]);
    const tender = first(tenderRows);
    if (!tender) throw new Error('Tender not found');
    if (tender.organization_id && tender.organization_id !== organizationId) {
      throw new Error('Tender is not visible for this organization');
    }
    const profile = first(profileRows);
    const documents = Array.isArray(documentRows) ? documentRows : [];
    const score = explainTenderScore({ tender, profile, documents });
    const deterministic = buildDeterministicAnalysis({ tender, documents, score });

    let analysis = deterministic;
    let model = Deno.env.get('OPENAI_MODEL') || 'deterministic-sprint4';
    let usage: Record<string, unknown> = {};
    let aiRunSuccess = true;
    let warning: string | null = null;
    const aiPrompt = JSON.stringify({
      tender,
      documents: documents.map((doc) => ({
        id: doc.id,
        title: doc.title,
        document_type: doc.document_type,
        official_url: doc.official_url,
        metadata: doc.metadata
      })),
      score
    });

    try {
      const ai = await callOpenAiJson({
        system: [
          'Eres LicitIA. Analiza licitaciones publicas espanolas con criterio conservador.',
          'No inventes requisitos. Si no hay evidencia oficial, responde "no encontrado".',
          'Separa hechos oficiales de inferencias y conserva citas a documentos o enlace oficial.'
        ].join(' '),
        prompt: aiPrompt,
        schemaName: 'licitia_tender_analysis',
        schema: analysisSchema
      });
      if (ai?.parsed) {
        analysis = validateAnalysis({ ...ai.parsed, score });
        model = ai.model;
        usage = ai.usage || {};
      }
    } catch (error) {
      aiRunSuccess = false;
      warning = error instanceof Error ? error.message : 'AI analysis fallback';
      analysis = deterministic;
    }

    analysis = validateAnalysis(analysis);
    const citations = collectCitations(analysis);
    const aiRun = await insertAiRun({
      organizationId,
      userId: user.id,
      tenderId,
      endpoint: 'analyze-tender',
      model,
      output: analysis,
      citations,
      usage,
      success: aiRunSuccess,
      errorMessage: warning
    });

    await insertAudit(req, {
      organization_id: organizationId,
      actor_user_id: user.id,
      action: 'ai.tender_analysis.created',
      resource_type: 'ai_run',
      resource_id: aiRun?.id || null,
      metadata: {
        tender_id: tenderId,
        model,
        success: aiRunSuccess,
        fallback: Boolean(warning)
      }
    });

    return jsonResponse(req, {
      ok: true,
      analysis,
      aiRunId: aiRun?.id || null,
      warning
    });
  } catch (error) {
    return jsonResponse(req, { error: error instanceof Error ? error.message : 'Unexpected error' }, 400);
  }
});
