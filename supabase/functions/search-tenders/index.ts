import { jsonResponse } from '../_shared/cors.ts';
import { encodeParam, hasServiceConfig, requireActiveMembership, rest } from '../_shared/service.ts';
import { scoreTender } from '../_shared/tenders.ts';
import { territorialMatches } from '../_shared/territory.ts';

function includesText(value: unknown, query: string) {
  if (!query) return true;
  return String(value || '').toLowerCase().includes(query.toLowerCase());
}

function asArray(value: unknown) {
  return Array.isArray(value) ? value.map(String).filter(Boolean) : String(value || '').split(',').map((item) => item.trim()).filter(Boolean);
}

function matchesFilters(tender: Record<string, unknown>, filters: Record<string, unknown>) {
  const query = String(filters.query || '').trim();
  if (query && ![tender.title, tender.contracting_body, tender.external_id].some((field) => includesText(field, query))) return false;
  const cpv = asArray(filters.cpv);
  const tenderCpvs = Array.isArray(tender.cpv_codes) ? tender.cpv_codes.map(String) : [];
  if (cpv.length && !tenderCpvs.some((code) => cpv.some((wanted) => code.startsWith(wanted.slice(0, 4))))) return false;
  if (filters.contracting_body && !includesText(tender.contracting_body, String(filters.contracting_body))) return false;
  if (filters.region && !territorialMatches(tender.region, filters.region)) return false;
  if (filters.status && !includesText(tender.status, String(filters.status))) return false;
  if (filters.contract_type && !includesText(tender.contract_type, String(filters.contract_type))) return false;
  if (filters.procedure_type && !includesText(tender.procedure_type, String(filters.procedure_type))) return false;
  const amount = Number(tender.base_budget_cents || tender.estimated_value_cents || 0);
  const min = Number(filters.amount_min_cents || 0);
  const max = Number(filters.amount_max_cents || 0);
  if (min && amount && amount < min) return false;
  if (max && amount && amount > max) return false;
  if (filters.published_from && String(tender.publication_date || '') < String(filters.published_from)) return false;
  if (filters.published_to && String(tender.publication_date || '') > String(filters.published_to)) return false;
  if (filters.deadline_from && String(tender.submission_deadline || '') < String(filters.deadline_from)) return false;
  if (filters.deadline_to && String(tender.submission_deadline || '') > String(filters.deadline_to)) return false;
  if (filters.only_open === true && tender.submission_deadline && Date.parse(String(tender.submission_deadline)) < Date.now()) return false;
  if (filters.with_documents === true && Number(tender.document_count || 0) < 1) return false;
  return true;
}

function sortResults(results: Array<Record<string, unknown>>, sort: string) {
  return results.sort((a, b) => {
    if (sort === 'deadline') return Date.parse(String(a.submission_deadline || '2999-12-31')) - Date.parse(String(b.submission_deadline || '2999-12-31'));
    if (sort === 'amount') return Number(b.base_budget_cents || b.estimated_value_cents || 0) - Number(a.base_budget_cents || a.estimated_value_cents || 0);
    if (sort === 'score') return Number(b.match_score || 0) - Number(a.match_score || 0);
    return String(b.publication_date || '').localeCompare(String(a.publication_date || ''));
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return jsonResponse(req, { ok: true });
  if (req.method !== 'POST') return jsonResponse(req, { error: 'Method not allowed' }, 405);
  if (!hasServiceConfig()) return jsonResponse(req, { error: 'Backend not configured' }, 503);

  try {
    const { organizationId } = await requireActiveMembership(req);
    const payload = await req.json().catch(() => ({}));
    const filters = payload.filters && typeof payload.filters === 'object' ? payload.filters as Record<string, unknown> : {};
    const limit = Math.min(Number(payload.limit || 25), 50);
    const offset = Math.max(Number(payload.offset || 0), 0);
    const sort = String(payload.sort || 'publication');
    const query = String(filters.query || '').trim();
    const select = 'id,source_id,external_id,canonical_key,title,contracting_body,status,contract_type,procedure_type,cpv_codes,region,publication_date,submission_deadline,estimated_value_cents,base_budget_cents,currency,official_url,source_url,document_count,created_at,updated_at';
    const textFilter = query ? `&or=(title.ilike.*${encodeParam(query)}*,contracting_body.ilike.*${encodeParam(query)}*,external_id.ilike.*${encodeParam(query)}*)` : '';
    const rows = await rest(`tenders?organization_id=is.null&select=${select}${textFilter}&order=publication_date.desc.nullslast&limit=220`);
    const profileRows = await rest(`company_profiles?organization_id=eq.${organizationId}&select=target_cpvs,operating_regions,min_contract_value_cents,max_contract_value_cents&limit=1`);
    const profile = Array.isArray(profileRows) ? profileRows[0] : null;
    const all = (Array.isArray(rows) ? rows : [])
      .filter((row) => matchesFilters(row, filters))
      .map((row) => ({
        ...row,
        match_score: scoreTender(row, filters, profile)
      }));
    const sorted = sortResults(all, sort);
    const page = sorted.slice(offset, offset + limit);
    const ids = page.map((row) => row.id).filter(Boolean);
    let trackedByTender: Record<string, unknown> = {};
    if (ids.length) {
      const tracked = await rest(`tracked_tenders?organization_id=eq.${organizationId}&tender_id=in.(${ids.join(',')})&select=id,tender_id,internal_status,priority,notes,owner_user_id`);
      trackedByTender = Object.fromEntries((Array.isArray(tracked) ? tracked : []).map((row) => [row.tender_id, row]));
    }
    return jsonResponse(req, {
      ok: true,
      total: sorted.length,
      offset,
      limit,
      results: page.map((row) => ({
        ...row,
        tracked: trackedByTender[String(row.id)] || null
      }))
    });
  } catch (error) {
    return jsonResponse(req, { error: error instanceof Error ? error.message : 'Unexpected error' }, 400);
  }
});
