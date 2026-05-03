import { jsonResponse } from '../_shared/cors.ts';
import {
  getActiveMembership,
  getUser,
  hasServiceConfig,
  insertAudit,
  rest
} from '../_shared/service.ts';

function first<T>(value: T[] | T | null): T | null {
  return Array.isArray(value) ? (value[0] || null) : value;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return jsonResponse(req, { ok: true });
  if (req.method !== 'POST') return jsonResponse(req, { error: 'Method not allowed' }, 405);
  if (!hasServiceConfig()) return jsonResponse(req, { error: 'Backend not configured' }, 503);

  try {
    const user = await getUser(req);
    const membership = await getActiveMembership(user.id);
    if (!membership?.organization_id) {
      return jsonResponse(req, {
        ok: true,
        user: { id: user.id, email: user.email || null },
        hasOrganization: false,
        onboardingComplete: false
      });
    }

    const organizationId = membership.organization_id as string;
    const [
      organization,
      companyProfile,
      subscription,
      savedSearches,
      alertRules,
      invitations,
      legalAcceptances,
      auditEvents
    ] = await Promise.all([
      rest(`organizations?id=eq.${organizationId}&select=id,name,tax_id,country,sector,created_at,updated_at&limit=1`),
      rest(`company_profiles?organization_id=eq.${organizationId}&select=*&limit=1`),
      rest(`subscriptions?organization_id=eq.${organizationId}&select=id,status,started_at,current_period_ends_at,plans(code,name,payments_enabled,features)&order=created_at.desc&limit=1`),
      rest(`saved_searches?organization_id=eq.${organizationId}&select=id,name,query,filters,created_at&order=created_at.desc&limit=5`),
      rest(`alert_rules?organization_id=eq.${organizationId}&select=id,name,query,filters,cadence,channels,active,created_at&order=created_at.desc&limit=5`),
      rest(`organization_invitations?organization_id=eq.${organizationId}&select=id,email,role,status,invited_at,expires_at&order=invited_at.desc&limit=10`),
      rest(`user_legal_acceptances?organization_id=eq.${organizationId}&user_id=eq.${user.id}&select=id,terms_version,privacy_version,ai_notice_version,communications_consent,accepted_at&order=accepted_at.desc&limit=1`),
      rest(`audit_events?organization_id=eq.${organizationId}&select=id,action,resource_type,created_at,metadata&order=created_at.desc&limit=12`)
    ]);

    const profile = first(companyProfile);
    const legal = first(legalAcceptances);
    const sub = first(subscription);
    const onboardingComplete = Boolean(
      first(organization)
      && profile
      && Number(profile.onboarding_progress || 0) >= 60
      && Array.isArray(savedSearches)
      && savedSearches.length > 0
      && legal
      && sub
    );

    await insertAudit(req, {
      organization_id: organizationId,
      actor_user_id: user.id,
      action: 'onboarding.state_viewed',
      resource_type: 'organization',
      resource_id: organizationId,
      metadata: { onboarding_complete: onboardingComplete }
    }).catch(() => null);

    return jsonResponse(req, {
      ok: true,
      user: { id: user.id, email: user.email || null },
      membership,
      organization: first(organization),
      companyProfile: profile,
      subscription: sub,
      savedSearches,
      alertRules,
      invitations,
      legalAcceptance: legal,
      auditEvents,
      hasOrganization: true,
      onboardingComplete
    });
  } catch (error) {
    return jsonResponse(req, { error: error instanceof Error ? error.message : 'Unexpected error' }, 400);
  }
});
