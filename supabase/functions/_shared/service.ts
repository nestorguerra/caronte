type RestOptions = {
  method?: string;
  body?: unknown;
  prefer?: string;
};

export type AuthUser = {
  id: string;
  email?: string;
  user_metadata?: Record<string, unknown>;
};

export const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
export const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
export const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || serviceRoleKey;

export function hasServiceConfig() {
  return Boolean(supabaseUrl && serviceRoleKey && anonKey);
}

function parseJson(text: string) {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export async function rest(path: string, options: RestOptions = {}) {
  if (!hasServiceConfig()) throw new Error('Backend not configured');
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
  const data = parseJson(text);
  if (!resp.ok) {
    const message = typeof data === 'object' && data && 'message' in data
      ? String(data.message)
      : `REST ${resp.status}`;
    throw new Error(message);
  }
  return data;
}

export async function getUser(req: Request): Promise<AuthUser> {
  const authorization = req.headers.get('authorization') || '';
  if (!authorization.startsWith('Bearer ')) throw new Error('Missing bearer token');
  if (!supabaseUrl || !anonKey) throw new Error('Backend not configured');
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

export function clientIp(req: Request) {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || req.headers.get('cf-connecting-ip')
    || null;
}

export function userAgent(req: Request) {
  return req.headers.get('user-agent') || null;
}

export function addDays(days: number) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

export function csv(value: unknown) {
  if (Array.isArray(value)) return value.map(String).map((item) => item.trim()).filter(Boolean);
  return String(value || '').split(',').map((item) => item.trim()).filter(Boolean);
}

export function cents(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.round(parsed * 100);
}

export function clampInt(value: unknown, min: number, max: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return Math.min(max, Math.max(min, Math.round(parsed)));
}

export async function insertAudit(req: Request, event: {
  organization_id?: string | null;
  actor_user_id?: string | null;
  action: string;
  resource_type?: string | null;
  resource_id?: string | null;
  metadata?: Record<string, unknown>;
}) {
  await rest('audit_events', {
    method: 'POST',
    body: {
      organization_id: event.organization_id || null,
      actor_user_id: event.actor_user_id || null,
      action: event.action,
      resource_type: event.resource_type || null,
      resource_id: event.resource_id || null,
      ip_address: clientIp(req),
      user_agent: userAgent(req),
      metadata: event.metadata || {}
    },
    prefer: 'return=minimal'
  });
}

export async function getActiveMembership(userId: string) {
  const memberships = await rest(
    `organization_members?user_id=eq.${userId}&status=eq.active&select=id,organization_id,role&order=created_at.asc&limit=1`
  );
  return Array.isArray(memberships) ? memberships[0] : null;
}

export async function assertOrgMember(userId: string, organizationId: string) {
  const memberships = await rest(
    `organization_members?organization_id=eq.${organizationId}&user_id=eq.${userId}&status=eq.active&select=id,role&limit=1`
  );
  const membership = Array.isArray(memberships) ? memberships[0] : null;
  if (!membership) throw new Error('User is not an active organization member');
  return membership;
}

export async function requireActiveMembership(req: Request) {
  const user = await getUser(req);
  const membership = await getActiveMembership(user.id);
  if (!membership?.organization_id) throw new Error('User has no active organization');
  return { user, membership, organizationId: String(membership.organization_id) };
}

export async function requireOrgRole(userId: string, organizationId: string, roles: string[]) {
  const membership = await assertOrgMember(userId, organizationId);
  if (!roles.includes(String(membership.role))) {
    throw new Error('Insufficient organization permissions');
  }
  return membership;
}

export async function requireJobCaller(req: Request, roles = ['owner', 'admin']) {
  const configuredSecret = Deno.env.get('INGESTION_SECRET') || '';
  const providedSecret = req.headers.get('x-licitia-job-secret')
    || req.headers.get('x-ingestion-secret')
    || '';
  if (configuredSecret && providedSecret && configuredSecret === providedSecret) {
    return { mode: 'secret' as const, user: null, membership: null, organizationId: null };
  }
  const user = await getUser(req);
  const membership = await getActiveMembership(user.id);
  if (!membership?.organization_id) throw new Error('User has no active organization');
  if (!roles.includes(String(membership.role))) throw new Error('Insufficient organization permissions');
  return {
    mode: 'user' as const,
    user,
    membership,
    organizationId: String(membership.organization_id)
  };
}

export async function getSource(code: string) {
  const rows = await rest(`procurement_sources?code=eq.${encodeURIComponent(code)}&select=*&limit=1`);
  const source = Array.isArray(rows) ? rows[0] : null;
  if (!source?.id) throw new Error(`Procurement source not found: ${code}`);
  return source;
}

export async function startIngestionRun(input: {
  source_id?: string | null;
  source_code: string;
  job_type: string;
  requested_url?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const rows = await rest('procurement_ingestion_runs', {
    method: 'POST',
    body: {
      source_id: input.source_id || null,
      source_code: input.source_code,
      job_type: input.job_type,
      requested_url: input.requested_url || null,
      status: 'running',
      metadata: input.metadata || {}
    }
  });
  return Array.isArray(rows) ? rows[0] : rows;
}

export async function finishIngestionRun(id: string, input: {
  status: 'succeeded' | 'failed' | 'partial';
  items_seen?: number;
  items_upserted?: number;
  items_failed?: number;
  error_message?: string | null;
  metadata?: Record<string, unknown>;
}) {
  await rest(`procurement_ingestion_runs?id=eq.${id}`, {
    method: 'PATCH',
    body: {
      status: input.status,
      items_seen: input.items_seen || 0,
      items_upserted: input.items_upserted || 0,
      items_failed: input.items_failed || 0,
      error_message: input.error_message || null,
      finished_at: new Date().toISOString(),
      metadata: input.metadata || {}
    },
    prefer: 'return=minimal'
  });
}

export function encodeParam(value: unknown) {
  return encodeURIComponent(String(value ?? ''));
}
