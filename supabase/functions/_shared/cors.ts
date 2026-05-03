export function corsHeaders(req: Request) {
  const allowed = (Deno.env.get('ALLOWED_ORIGINS') || '').split(',').map((item) => item.trim()).filter(Boolean);
  const origin = req.headers.get('origin') || '';
  const allowOrigin = allowed.includes(origin) ? origin : (allowed[0] || origin || '*');
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Vary': 'Origin'
  };
}

export function jsonResponse(req: Request, payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...corsHeaders(req),
      'Content-Type': 'application/json'
    }
  });
}
