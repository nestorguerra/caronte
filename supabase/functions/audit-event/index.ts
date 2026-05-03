import { jsonResponse } from '../_shared/cors.ts';
import { assertOrgMember, getUser, hasServiceConfig, insertAudit } from '../_shared/service.ts';

const runtimeVersion = 'auth-runtime-v2';

const allowedActions = new Set([
  'auth.login',
  'auth.logout',
  'legal.notice_viewed',
  'onboarding.started',
  'onboarding.cancelled',
  'user_settings.updated',
  'onboarding_completed',
  'search_executed',
  'tender_tracked',
  'decision_recorded',
  'proposal_exported',
  'dossier_exported',
  'ops_tab_changed'
]);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return jsonResponse(req, { ok: true });
  if (req.method !== 'POST') return jsonResponse(req, { error: 'Method not allowed' }, 405);
  if (!hasServiceConfig()) return jsonResponse(req, { error: 'Backend not configured' }, 503);

  try {
    const user = await getUser(req);
    const payload = await req.json();
    const action = String(payload.action || '').trim();
    if (!allowedActions.has(action)) throw new Error('Audit action is not allowed');
    const organizationId = payload.organizationId ? String(payload.organizationId) : null;
    if (organizationId) await assertOrgMember(user.id, organizationId);

    await insertAudit(req, {
      organization_id: organizationId,
      actor_user_id: user.id,
      action,
      resource_type: payload.resourceType || null,
      resource_id: payload.resourceId || null,
      metadata: payload.metadata && typeof payload.metadata === 'object' ? payload.metadata : {}
    });

    return jsonResponse(req, { ok: true, runtimeVersion });
  } catch (error) {
    return jsonResponse(req, { error: error instanceof Error ? error.message : 'Unexpected error' }, 400);
  }
});
