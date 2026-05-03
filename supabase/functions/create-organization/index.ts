import { jsonResponse } from '../_shared/cors.ts';

type RestOptions = {
  method?: string;
  body?: unknown;
  prefer?: string;
};

const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || serviceRoleKey;

async function rest(path: string, options: RestOptions = {}) {
  const resp = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
    method: options.method || 'GET',
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      'Content-Type': 'application/json',
      Prefer: options.prefer || 'return=representation'
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  const text = await resp.text();
  const data = text ? JSON.parse(text) : null;
  if (!resp.ok) {
    throw new Error(data?.message || `REST ${resp.status}`);
  }
  return data;
}

async function getUser(req: Request) {
  const authorization = req.headers.get('authorization') || '';
  if (!authorization.startsWith('Bearer ')) throw new Error('Missing bearer token');
  const resp = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: {
      apikey: anonKey,
      Authorization: authorization
    }
  });
  const data = await resp.json();
  if (!resp.ok || !data?.id) throw new Error('Invalid user session');
  return data;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return jsonResponse(req, { ok: true });
  if (req.method !== 'POST') return jsonResponse(req, { error: 'Method not allowed' }, 405);
  if (!supabaseUrl || !serviceRoleKey) return jsonResponse(req, { error: 'Backend not configured' }, 503);

  try {
    const user = await getUser(req);
    const payload = await req.json();
    const org = payload.organization || {};
    const profile = payload.companyProfile || {};
    const orgName = String(org.name || '').trim();
    if (orgName.length < 2) return jsonResponse(req, { error: 'Organization name is required' }, 400);

    const createdOrg = await rest('organizations', {
      method: 'POST',
      body: {
        name: orgName,
        tax_id: org.tax_id || null,
        country: org.country || 'ES',
        sector: org.sector || '',
        created_by: user.id
      }
    });
    const organization = Array.isArray(createdOrg) ? createdOrg[0] : createdOrg;

    await rest('organization_members', {
      method: 'POST',
      body: {
        organization_id: organization.id,
        user_id: user.id,
        role: 'owner',
        status: 'active',
        invited_email: user.email || null
      }
    });

    const plans = await rest('plans?code=eq.free_beta_month&select=id&limit=1');
    const plan = Array.isArray(plans) ? plans[0] : null;
    if (plan?.id) {
      await rest('subscriptions', {
        method: 'POST',
        body: {
          organization_id: organization.id,
          plan_id: plan.id,
          status: 'trialing_free',
          started_at: new Date().toISOString(),
          current_period_ends_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
        }
      });
    }

    await rest('company_profiles', {
      method: 'POST',
      body: {
        organization_id: organization.id,
        legal_name: orgName,
        tax_id: org.tax_id || null,
        services_description: profile.services_description || '',
        target_cpvs: profile.target_cpvs || [],
        certifications: profile.certifications || [],
        sectors: profile.sectors || (org.sector ? [org.sector] : []),
        cnae: profile.cnae || null,
        min_contract_value_cents: profile.min_contract_value_cents || null,
        max_contract_value_cents: profile.max_contract_value_cents || null,
        target_contract_types: profile.target_contract_types || [],
        annual_revenue_range: profile.annual_revenue_range || '',
        employee_range: profile.employee_range || '',
        operating_regions: profile.operating_regions || [],
        onboarding_progress: 55,
        created_by: user.id
      }
    });

    await rest('audit_events', {
      method: 'POST',
      body: {
        organization_id: organization.id,
        actor_user_id: user.id,
        action: 'organization.created',
        resource_type: 'organization',
        resource_id: organization.id,
        metadata: { source: 'onboarding' }
      }
    });

    return jsonResponse(req, { ok: true, organization });
  } catch (error) {
    return jsonResponse(req, { error: error.message || 'Unexpected error' }, 400);
  }
});
