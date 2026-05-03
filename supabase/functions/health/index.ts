import { jsonResponse } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return jsonResponse(req, { ok: true });

  const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  let database = 'not_configured';

  if (supabaseUrl && serviceRoleKey) {
    try {
      const resp = await fetch(`${supabaseUrl}/rest/v1/plans?select=id&limit=1`, {
        headers: {
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`
        }
      });
      database = resp.ok ? 'ok' : `error_${resp.status}`;
    } catch {
      database = 'unreachable';
    }
  }

  const ok = Boolean(supabaseUrl && serviceRoleKey && database === 'ok');
  return jsonResponse(req, {
    ok,
    service: 'licitia-api',
    environment: Deno.env.get('APP_ENV') || 'unknown',
    database,
    timestamp: new Date().toISOString()
  }, ok ? 200 : 503);
});
