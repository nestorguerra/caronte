import { jsonResponse } from '../_shared/cors.ts';
import {
  addDays,
  cents,
  clampInt,
  csv,
  getActiveMembership,
  getUser,
  hasServiceConfig,
  insertAudit,
  rest,
  userAgent,
  clientIp
} from '../_shared/service.ts';

const TERMS_VERSION = 'beta-2026-04';
const PRIVACY_VERSION = 'beta-2026-04';
const AI_NOTICE_VERSION = 'beta-2026-04';

function first<T>(value: T[] | T | null): T | null {
  return Array.isArray(value) ? (value[0] || null) : value;
}

function normalizeEmail(email: unknown) {
  return String(email || '').trim().toLowerCase();
}

function normalizeSearches(payload: Record<string, unknown>) {
  const raw = Array.isArray(payload.savedSearches) ? payload.savedSearches : [];
  return raw
    .slice(0, 5)
    .map((item, index) => {
      const search = item && typeof item === 'object' ? item as Record<string, unknown> : {};
      const query = String(search.query || '').trim();
      const name = String(search.name || query || `Busqueda inicial ${index + 1}`).trim();
      return {
        name,
        query,
        filters: search.filters && typeof search.filters === 'object' ? search.filters : {}
      };
    })
    .filter((search) => search.query.length >= 2);
}

function profileCompletion(profile: Record<string, unknown>) {
  const preferences = profile.preferences && typeof profile.preferences === 'object'
    ? profile.preferences as Record<string, unknown>
    : {};
  const targetSignals = csv(profile.target_cpvs).length > 0 || csv(preferences.search_terms).length > 0;
  const checks = [
    profile.legal_name,
    csv(profile.sectors).length > 0,
    profile.services_description,
    targetSignals,
    csv(profile.operating_regions).length > 0,
    profile.min_contract_value_cents || profile.max_contract_value_cents
  ];
  const completed = checks.filter(Boolean).length;
  return Math.round((completed / checks.length) * 100);
}

async function ensureOrganization(req: Request, user: { id: string; email?: string }, payload: Record<string, unknown>) {
  const orgPayload = payload.organization && typeof payload.organization === 'object'
    ? payload.organization as Record<string, unknown>
    : {};
  const activeMembership = await getActiveMembership(user.id);
  if (activeMembership?.organization_id) {
    await rest(`organizations?id=eq.${activeMembership.organization_id}`, {
      method: 'PATCH',
      body: {
        name: String(orgPayload.name || '').trim(),
        tax_id: orgPayload.tax_id || null,
        country: orgPayload.country || 'ES',
        sector: orgPayload.sector || ''
      },
      prefer: 'return=minimal'
    });
    return activeMembership.organization_id as string;
  }

  const orgName = String(orgPayload.name || '').trim();
  if (orgName.length < 2) throw new Error('Organization name is required');
  const created = await rest('organizations', {
    method: 'POST',
    body: {
      name: orgName,
      tax_id: orgPayload.tax_id || null,
      country: orgPayload.country || 'ES',
      sector: orgPayload.sector || '',
      created_by: user.id
    }
  });
  const organization = first(created);
  if (!organization?.id) throw new Error('Organization could not be created');

  await rest('organization_members', {
    method: 'POST',
    body: {
      organization_id: organization.id,
      user_id: user.id,
      role: 'owner',
      status: 'active',
      invited_email: user.email || null
    },
    prefer: 'return=minimal'
  });

  await insertAudit(req, {
    organization_id: organization.id,
    actor_user_id: user.id,
    action: 'organization.created',
    resource_type: 'organization',
    resource_id: organization.id,
    metadata: { source: 'sprint2_onboarding' }
  });

  return organization.id as string;
}

async function ensureSubscription(organizationId: string) {
  const plans = await rest('plans?code=eq.free_beta_month&select=id,trial_days&limit=1');
  const plan = first(plans);
  if (!plan?.id) throw new Error('Free beta plan is not configured');
  const existing = first(await rest(`subscriptions?organization_id=eq.${organizationId}&select=id,started_at,current_period_ends_at,status&limit=1`));
  const periodEnd = addDays(Number(plan.trial_days || 30));

  if (existing?.id) {
    await rest(`subscriptions?id=eq.${existing.id}`, {
      method: 'PATCH',
      body: {
        plan_id: plan.id,
        status: existing.status || 'trialing_free',
        current_period_ends_at: existing.current_period_ends_at || periodEnd
      },
      prefer: 'return=minimal'
    });
    return existing.id as string;
  }

  const created = await rest('subscriptions', {
    method: 'POST',
    body: {
      organization_id: organizationId,
      plan_id: plan.id,
      status: 'trialing_free',
      started_at: new Date().toISOString(),
      current_period_ends_at: periodEnd
    }
  });
  return first(created)?.id as string;
}

async function upsertCompanyProfile(organizationId: string, userId: string, payload: Record<string, unknown>) {
  const org = payload.organization && typeof payload.organization === 'object'
    ? payload.organization as Record<string, unknown>
    : {};
  const profile = payload.companyProfile && typeof payload.companyProfile === 'object'
    ? payload.companyProfile as Record<string, unknown>
    : {};
  const body = {
    organization_id: organizationId,
    legal_name: String(profile.legal_name || org.name || '').trim(),
    trade_name: String(profile.trade_name || org.name || '').trim(),
    tax_id: profile.tax_id || org.tax_id || null,
    sectors: csv(profile.sectors || org.sector),
    cnae: profile.cnae || null,
    services_description: String(profile.services_description || '').trim(),
    target_cpvs: csv(profile.target_cpvs),
    certifications: csv(profile.certifications),
    business_classification: profile.business_classification || '',
    annual_revenue_range: profile.annual_revenue_range || '',
    employee_range: profile.employee_range || '',
    years_experience: clampInt(profile.years_experience, 0, 100),
    operating_regions: csv(profile.operating_regions),
    min_contract_value_cents: cents(profile.min_contract_value_eur) ?? profile.min_contract_value_cents ?? null,
    max_contract_value_cents: cents(profile.max_contract_value_eur) ?? profile.max_contract_value_cents ?? null,
    target_contract_types: csv(profile.target_contract_types),
    preferences: profile.preferences && typeof profile.preferences === 'object' ? profile.preferences : {},
    created_by: userId
  };
  const progress = profileCompletion(body);
  const existing = first(await rest(`company_profiles?organization_id=eq.${organizationId}&select=id&limit=1`));
  if (existing?.id) {
    await rest(`company_profiles?id=eq.${existing.id}`, {
      method: 'PATCH',
      body: {
        ...body,
        onboarding_progress: progress,
        profile_completed_at: progress >= 80 ? new Date().toISOString() : null
      },
      prefer: 'return=minimal'
    });
    return existing.id as string;
  }
  const created = await rest('company_profiles', {
    method: 'POST',
    body: {
      ...body,
      onboarding_progress: progress,
      profile_completed_at: progress >= 80 ? new Date().toISOString() : null
    }
  });
  return first(created)?.id as string;
}

async function ensureSavedSearches(organizationId: string, userId: string, payload: Record<string, unknown>) {
  const searches = normalizeSearches(payload);
  if (searches.length < 1) throw new Error('At least one saved search is required');
  let created = 0;
  for (const search of searches) {
    const exists = first(await rest(
      `saved_searches?organization_id=eq.${organizationId}&name=eq.${encodeURIComponent(search.name)}&select=id&limit=1`
    ));
    if (exists?.id) continue;
    await rest('saved_searches', {
      method: 'POST',
      body: {
        organization_id: organizationId,
        created_by: userId,
        name: search.name,
        query: search.query,
        filters: search.filters
      },
      prefer: 'return=minimal'
    });
    created += 1;
  }
  return { requested: searches.length, created };
}

async function ensureAlertRule(organizationId: string, userId: string, payload: Record<string, unknown>) {
  const searches = normalizeSearches(payload);
  const primary = searches[0];
  if (!primary) return null;
  const alertPayload = payload.alertRule && typeof payload.alertRule === 'object'
    ? payload.alertRule as Record<string, unknown>
    : {};
  const name = String(alertPayload.name || `Alerta inicial: ${primary.name}`).trim();
  const exists = first(await rest(
    `alert_rules?organization_id=eq.${organizationId}&name=eq.${encodeURIComponent(name)}&select=id&limit=1`
  ));
  if (exists?.id) return exists.id as string;
  const created = await rest('alert_rules', {
    method: 'POST',
    body: {
      organization_id: organizationId,
      created_by: userId,
      name,
      query: primary.query,
      filters: primary.filters,
      cadence: alertPayload.cadence === 'weekly' ? 'weekly' : 'daily',
      channels: alertPayload.channels && typeof alertPayload.channels === 'object'
        ? alertPayload.channels
        : { email: true },
      active: true
    }
  });
  return first(created)?.id as string;
}

async function ensureInvitations(req: Request, organizationId: string, userId: string, payload: Record<string, unknown>) {
  const raw = Array.isArray(payload.invitations) ? payload.invitations : [];
  const invitations = raw
    .map((item) => item && typeof item === 'object' ? item as Record<string, unknown> : { email: item })
    .map((item) => ({
      email: normalizeEmail(item.email),
      role: ['admin', 'bid_manager', 'legal', 'finance', 'viewer'].includes(String(item.role)) ? String(item.role) : 'viewer'
    }))
    .filter((item) => item.email.includes('@'))
    .slice(0, 10);

  let created = 0;
  for (const invite of invitations) {
    const existing = first(await rest(
      `organization_invitations?organization_id=eq.${organizationId}&email=eq.${encodeURIComponent(invite.email)}&status=eq.pending&select=id&limit=1`
    ));
    if (!existing?.id) {
      await rest('organization_invitations', {
        method: 'POST',
        body: {
          organization_id: organizationId,
          email: invite.email,
          role: invite.role,
          invited_by: userId,
          metadata: { delivery: 'email_pending_provider' }
        },
        prefer: 'return=minimal'
      });
      created += 1;
    }

    const member = first(await rest(
      `organization_members?organization_id=eq.${organizationId}&invited_email=eq.${encodeURIComponent(invite.email)}&select=id&limit=1`
    ));
    if (!member?.id) {
      await rest('organization_members', {
        method: 'POST',
        body: {
          organization_id: organizationId,
          invited_email: invite.email,
          role: invite.role,
          status: 'invited'
        },
        prefer: 'return=minimal'
      });
    }
  }

  if (created > 0) {
    await insertAudit(req, {
      organization_id: organizationId,
      actor_user_id: userId,
      action: 'members.invited',
      resource_type: 'organization_invitation',
      metadata: { count: created }
    });
  }

  return { requested: invitations.length, created };
}

async function acceptLegal(req: Request, organizationId: string, userId: string, payload: Record<string, unknown>) {
  const legal = payload.legalAcceptance && typeof payload.legalAcceptance === 'object'
    ? payload.legalAcceptance as Record<string, unknown>
    : {};
  if (legal.accepted !== true) throw new Error('Legal acceptance is required');
  const versions = {
    terms_version: String(legal.termsVersion || TERMS_VERSION),
    privacy_version: String(legal.privacyVersion || PRIVACY_VERSION),
    ai_notice_version: String(legal.aiNoticeVersion || AI_NOTICE_VERSION)
  };
  const existing = first(await rest(
    `user_legal_acceptances?organization_id=eq.${organizationId}&user_id=eq.${userId}&terms_version=eq.${versions.terms_version}&privacy_version=eq.${versions.privacy_version}&ai_notice_version=eq.${versions.ai_notice_version}&select=id&limit=1`
  ));
  if (existing?.id) return existing.id as string;
  const created = await rest('user_legal_acceptances', {
    method: 'POST',
    body: {
      organization_id: organizationId,
      user_id: userId,
      ...versions,
      communications_consent: legal.communicationsConsent === true,
      ip_address: clientIp(req),
      user_agent: userAgent(req),
      metadata: { source: 'onboarding_free_beta' }
    }
  });
  return first(created)?.id as string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return jsonResponse(req, { ok: true });
  if (req.method !== 'POST') return jsonResponse(req, { error: 'Method not allowed' }, 405);
  if (!hasServiceConfig()) return jsonResponse(req, { error: 'Backend not configured' }, 503);

  try {
    const user = await getUser(req);
    const payload = await req.json();
    const organizationId = await ensureOrganization(req, user, payload);
    const profileId = await upsertCompanyProfile(organizationId, user.id, payload);
    const savedSearches = await ensureSavedSearches(organizationId, user.id, payload);
    const alertRuleId = await ensureAlertRule(organizationId, user.id, payload);
    const invitations = await ensureInvitations(req, organizationId, user.id, payload);
    const subscriptionId = await ensureSubscription(organizationId);
    const legalAcceptanceId = await acceptLegal(req, organizationId, user.id, payload);

    await insertAudit(req, {
      organization_id: organizationId,
      actor_user_id: user.id,
      action: 'onboarding.completed',
      resource_type: 'organization',
      resource_id: organizationId,
      metadata: {
        profile_id: profileId,
        saved_searches: savedSearches.requested,
        alert_rule_id: alertRuleId,
        invitations: invitations.requested,
        subscription_id: subscriptionId,
        legal_acceptance_id: legalAcceptanceId,
        payments_required: false
      }
    });

    return jsonResponse(req, {
      ok: true,
      organizationId,
      profileId,
      subscriptionId,
      savedSearches,
      alertRuleId,
      invitations,
      legalAcceptanceId,
      payments: {
        enabled: false,
        message: 'Durante el primer mes LicitIA es gratuita. No tienes que introducir tarjeta ni metodo de pago. Te avisaremos antes de activar cualquier plan de pago.'
      }
    });
  } catch (error) {
    return jsonResponse(req, { error: error instanceof Error ? error.message : 'Unexpected error' }, 400);
  }
});
