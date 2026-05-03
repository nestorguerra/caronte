import { jsonResponse } from '../_shared/cors.ts';
import { encodeParam, hasServiceConfig, insertAudit, requireActiveMembership, rest } from '../_shared/service.ts';

const allowedStatuses = new Set(['new', 'analysis', 'go', 'no_go', 'preparing', 'submitted', 'discarded', 'awarded', 'lost']);
const allowedPriorities = new Set(['low', 'normal', 'high']);

function first<T>(value: T[] | T | null): T | null {
  return Array.isArray(value) ? (value[0] || null) : value;
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
    const tender = first(await rest(`tenders?id=eq.${encodeParam(tenderId)}&select=id,title,organization_id&limit=1`));
    if (!tender) throw new Error('Tender not found');
    if (tender.organization_id && tender.organization_id !== organizationId) throw new Error('Tender is not visible for this organization');

    const internalStatus = allowedStatuses.has(String(payload.internalStatus)) ? String(payload.internalStatus) : 'new';
    const priority = allowedPriorities.has(String(payload.priority)) ? String(payload.priority) : 'normal';
    const notes = String(payload.notes || '').trim() || null;
    const existing = first(await rest(`tracked_tenders?organization_id=eq.${organizationId}&tender_id=eq.${encodeParam(tenderId)}&select=id,internal_status&limit=1`));
    let trackedId = existing?.id as string | undefined;
    if (trackedId) {
      await rest(`tracked_tenders?id=eq.${trackedId}`, {
        method: 'PATCH',
        body: {
          internal_status: internalStatus,
          priority,
          notes,
          owner_user_id: payload.ownerUserId || user.id
        },
        prefer: 'return=minimal'
      });
    } else {
      const created = await rest('tracked_tenders', {
        method: 'POST',
        body: {
          organization_id: organizationId,
          tender_id: tenderId,
          owner_user_id: payload.ownerUserId || user.id,
          internal_status: internalStatus,
          priority,
          notes
        }
      });
      trackedId = first(created)?.id;
    }

    await insertAudit(req, {
      organization_id: organizationId,
      actor_user_id: user.id,
      action: existing?.id ? 'tracked_tender.updated' : 'tracked_tender.created',
      resource_type: 'tracked_tender',
      resource_id: trackedId || null,
      metadata: {
        tender_id: tenderId,
        tender_title: tender.title,
        internal_status: internalStatus,
        previous_status: existing?.internal_status || null
      }
    });

    return jsonResponse(req, { ok: true, trackedTenderId: trackedId, internalStatus, priority });
  } catch (error) {
    return jsonResponse(req, { error: error instanceof Error ? error.message : 'Unexpected error' }, 400);
  }
});
