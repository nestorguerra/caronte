import { jsonResponse } from '../_shared/cors.ts';
import {
  assertOrgMember,
  cents,
  clampInt,
  csv,
  getUser,
  hasServiceConfig,
  insertAudit,
  rest
} from '../_shared/service.ts';

function first<T>(value: T[] | T | null): T | null {
  return Array.isArray(value) ? (value[0] || null) : value;
}

function profileCompletion(profile: Record<string, unknown>) {
  const checks = [
    profile.legal_name,
    profile.services_description,
    csv(profile.target_cpvs).length > 0,
    csv(profile.operating_regions).length > 0,
    profile.annual_revenue_range,
    profile.employee_range,
    csv(profile.target_contract_types).length > 0,
    profile.min_contract_value_cents || profile.max_contract_value_cents
  ];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return jsonResponse(req, { ok: true });
  if (req.method !== 'POST') return jsonResponse(req, { error: 'Method not allowed' }, 405);
  if (!hasServiceConfig()) return jsonResponse(req, { error: 'Backend not configured' }, 503);

  try {
    const user = await getUser(req);
    const payload = await req.json();
    const organizationId = String(payload.organizationId || '').trim();
    if (!organizationId) throw new Error('organizationId is required');
    const membership = await assertOrgMember(user.id, organizationId);
    if (!['owner', 'admin', 'bid_manager'].includes(String(membership.role))) {
      throw new Error('Insufficient permissions to update company profile');
    }

    const profile = payload.companyProfile && typeof payload.companyProfile === 'object'
      ? payload.companyProfile as Record<string, unknown>
      : {};
    const body = {
      legal_name: String(profile.legal_name || '').trim(),
      trade_name: String(profile.trade_name || '').trim(),
      tax_id: profile.tax_id || null,
      sectors: csv(profile.sectors),
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
      preferences: profile.preferences && typeof profile.preferences === 'object' ? profile.preferences : {}
    };
    const progress = profileCompletion(body);
    const existing = first(await rest(`company_profiles?organization_id=eq.${organizationId}&select=id&limit=1`));
    if (!existing?.id) throw new Error('Company profile not found');
    await rest(`company_profiles?id=eq.${existing.id}`, {
      method: 'PATCH',
      body: {
        ...body,
        onboarding_progress: progress,
        profile_completed_at: progress >= 80 ? new Date().toISOString() : null
      },
      prefer: 'return=minimal'
    });

    await insertAudit(req, {
      organization_id: organizationId,
      actor_user_id: user.id,
      action: 'company_profile.updated',
      resource_type: 'company_profile',
      resource_id: existing.id,
      metadata: { onboarding_progress: progress }
    });

    return jsonResponse(req, { ok: true, profileId: existing.id, onboardingProgress: progress });
  } catch (error) {
    return jsonResponse(req, { error: error instanceof Error ? error.message : 'Unexpected error' }, 400);
  }
});
