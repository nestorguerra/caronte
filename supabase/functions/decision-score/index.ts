import { jsonResponse } from '../_shared/cors.ts';
import { explainTenderScore } from '../_shared/scoring.ts';
import { encodeParam, hasServiceConfig, insertAudit, requireActiveMembership, rest } from '../_shared/service.ts';

const allowedDecisions = new Set(['go', 'no_go', 'review', 'pending']);

function first<T>(value: T[] | T | null): T | null {
  return Array.isArray(value) ? (value[0] || null) : value;
}

async function visibleTender(tenderId: string, organizationId: string) {
  const tender = first(await rest(`tenders?id=eq.${encodeParam(tenderId)}&select=*&limit=1`));
  if (!tender) throw new Error('Tender not found');
  if (tender.organization_id && tender.organization_id !== organizationId) {
    throw new Error('Tender is not visible for this organization');
  }
  return tender;
}

async function companyProfile(organizationId: string) {
  return first(await rest(`company_profiles?organization_id=eq.${organizationId}&select=*&limit=1`));
}

async function tenderDocuments(tenderId: string) {
  const rows = await rest(`tender_documents?tender_id=eq.${encodeParam(tenderId)}&select=*&order=created_at.desc&limit=20`);
  return Array.isArray(rows) ? rows : [];
}

async function ensureTrackedTender(input: {
  organizationId: string;
  tenderId: string;
  userId: string;
  decision?: string | null;
  score?: ReturnType<typeof explainTenderScore>;
  reason?: string | null;
}) {
  const existing = first(await rest(
    `tracked_tenders?organization_id=eq.${input.organizationId}&tender_id=eq.${encodeParam(input.tenderId)}&select=*&limit=1`
  ));
  const now = new Date().toISOString();
  const decision = allowedDecisions.has(String(input.decision)) ? String(input.decision) : null;
  const nextStatus = decision === 'go'
    ? 'go'
    : decision === 'no_go'
      ? 'no_go'
      : decision === 'review'
        ? 'analysis'
        : existing?.internal_status || 'analysis';
  const body = {
    owner_user_id: existing?.owner_user_id || input.userId,
    internal_status: nextStatus,
    decision: decision || existing?.decision || input.score?.recommendation || 'pending',
    decision_score: input.score?.total || existing?.decision_score || null,
    decision_breakdown: input.score || existing?.decision_breakdown || {},
    decision_reason: input.reason || existing?.decision_reason || null,
    decided_by: input.userId,
    decided_at: now
  };

  if (existing?.id) {
    const updated = await rest(`tracked_tenders?id=eq.${existing.id}`, {
      method: 'PATCH',
      body,
      prefer: 'return=representation'
    });
    return first(updated);
  }

  const created = await rest('tracked_tenders', {
    method: 'POST',
    body: {
      organization_id: input.organizationId,
      tender_id: input.tenderId,
      priority: 'normal',
      ...body
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

    const [tender, profile, documents] = await Promise.all([
      visibleTender(tenderId, organizationId),
      companyProfile(organizationId),
      tenderDocuments(tenderId)
    ]);
    const score = explainTenderScore({ tender, profile, documents });
    const shouldPersist = Boolean(payload.persist || payload.decision);
    const tracked = shouldPersist
      ? await ensureTrackedTender({
        organizationId,
        tenderId,
        userId: user.id,
        decision: payload.decision,
        score,
        reason: payload.reason ? String(payload.reason) : null
      })
      : first(await rest(`tracked_tenders?organization_id=eq.${organizationId}&tender_id=eq.${encodeParam(tenderId)}&select=*&limit=1`));

    if (shouldPersist) {
      await insertAudit(req, {
        organization_id: organizationId,
        actor_user_id: user.id,
        action: 'decision.go_no_go.updated',
        resource_type: 'tracked_tender',
        resource_id: tracked?.id || null,
        metadata: {
          tender_id: tenderId,
          score: score.total,
          recommendation: score.recommendation,
          decision: tracked?.decision || payload.decision || null
        }
      });
    }

    return jsonResponse(req, { ok: true, score, tracked });
  } catch (error) {
    return jsonResponse(req, { error: error instanceof Error ? error.message : 'Unexpected error' }, 400);
  }
});
