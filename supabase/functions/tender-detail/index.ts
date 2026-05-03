import { jsonResponse } from '../_shared/cors.ts';
import { encodeParam, hasServiceConfig, requireActiveMembership, rest } from '../_shared/service.ts';

function first<T>(value: T[] | T | null): T | null {
  return Array.isArray(value) ? (value[0] || null) : value;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return jsonResponse(req, { ok: true });
  if (req.method !== 'POST') return jsonResponse(req, { error: 'Method not allowed' }, 405);
  if (!hasServiceConfig()) return jsonResponse(req, { error: 'Backend not configured' }, 503);

  try {
    const { organizationId } = await requireActiveMembership(req);
    const payload = await req.json().catch(() => ({}));
    const tenderId = String(payload.tenderId || '').trim();
    if (!tenderId) throw new Error('tenderId is required');

    const [tender, lots, documents, versions, tracked] = await Promise.all([
      rest(`tenders?id=eq.${encodeParam(tenderId)}&select=*&limit=1`),
      rest(`tender_lots?tender_id=eq.${encodeParam(tenderId)}&select=*&order=created_at.asc`),
      rest(`tender_documents?tender_id=eq.${encodeParam(tenderId)}&select=*&order=created_at.desc`),
      rest(`tender_versions?tender_id=eq.${encodeParam(tenderId)}&select=id,version_label,change_type,diff_summary,source_url,source_fingerprint,ingested_at&order=ingested_at.desc&limit=12`),
      rest(`tracked_tenders?organization_id=eq.${organizationId}&tender_id=eq.${encodeParam(tenderId)}&select=*&limit=1`)
    ]);
    const row = first(tender);
    if (!row) throw new Error('Tender not found');
    if (row.organization_id && row.organization_id !== organizationId) throw new Error('Tender is not visible for this organization');

    return jsonResponse(req, {
      ok: true,
      tender: row,
      lots: Array.isArray(lots) ? lots : [],
      documents: Array.isArray(documents) ? documents : [],
      versions: Array.isArray(versions) ? versions : [],
      tracked: first(tracked)
    });
  } catch (error) {
    return jsonResponse(req, { error: error instanceof Error ? error.message : 'Unexpected error' }, 400);
  }
});
