import { jsonResponse } from '../_shared/cors.ts';
import { clientIp, getUser, hasServiceConfig, rest, userAgent } from '../_shared/service.ts';

function safeText(value: unknown, limit = 1600) {
  return String(value || '').replace(/Bearer\s+[A-Za-z0-9._-]+/g, 'Bearer [redacted]').slice(0, limit);
}

function fingerprint(input: { source: string; message: string; url?: string | null }) {
  const base = `${input.source}:${input.message}:${input.url || ''}`.toLowerCase();
  let hash = 0;
  for (let index = 0; index < base.length; index += 1) {
    hash = ((hash << 5) - hash + base.charCodeAt(index)) | 0;
  }
  return `err_${Math.abs(hash)}`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return jsonResponse(req, { ok: true });
  if (req.method !== 'POST') return jsonResponse(req, { error: 'Method not allowed' }, 405);
  if (!hasServiceConfig()) return jsonResponse(req, { error: 'Backend not configured' }, 503);

  try {
    const payload = await req.json().catch(() => ({}));
    const user = await getUser(req).catch(() => null);
    let organizationId = payload.organizationId ? String(payload.organizationId) : null;
    if (user?.id && !organizationId) {
      const memberships = await rest(`organization_members?user_id=eq.${user.id}&status=eq.active&select=organization_id&limit=1`).catch(() => []);
      const membership = Array.isArray(memberships) ? memberships[0] : null;
      organizationId = membership?.organization_id || null;
    }
    const message = safeText(payload.message || 'Unknown frontend error', 600);
    const source = ['frontend', 'edge_function', 'job', 'database'].includes(String(payload.source)) ? String(payload.source) : 'frontend';
    const severity = ['info', 'warning', 'error', 'critical'].includes(String(payload.severity)) ? String(payload.severity) : 'error';
    const created = await rest('error_events', {
      method: 'POST',
      body: {
        organization_id: organizationId,
        actor_user_id: user?.id || null,
        severity,
        source,
        message,
        stack: safeText(payload.stack, 2400) || null,
        url: safeText(payload.url, 800) || null,
        user_agent: userAgent(req),
        fingerprint: fingerprint({ source, message, url: payload.url }),
        context: {
          ...(payload.context && typeof payload.context === 'object' ? payload.context : {}),
          ip: clientIp(req)
        }
      }
    });
    return jsonResponse(req, { ok: true, eventId: Array.isArray(created) ? created[0]?.id : created?.id });
  } catch (error) {
    return jsonResponse(req, { error: error instanceof Error ? error.message : 'Unexpected error' }, 400);
  }
});
