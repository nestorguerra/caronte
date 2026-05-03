import { jsonResponse } from '../_shared/cors.ts';
import { rowsToCsv } from '../_shared/exports.ts';
import { encodeParam, hasServiceConfig, insertAudit, requireActiveMembership, rest } from '../_shared/service.ts';

function first<T>(value: T[] | T | null): T | null {
  return Array.isArray(value) ? (value[0] || null) : value;
}

function normalizeName(value: unknown) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\b(s\.?l\.?|s\.?a\.?|ute|union temporal de empresas)\b/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function discount(base: unknown, award: unknown) {
  const baseValue = Number(base || 0);
  const awardValue = Number(award || 0);
  if (!baseValue || !awardValue) return null;
  return Number((((baseValue - awardValue) / baseValue) * 100).toFixed(4));
}

function average(values: number[]) {
  if (!values.length) return null;
  return Number((values.reduce((acc, value) => acc + value, 0) / values.length).toFixed(2));
}

function median(values: number[]) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : Number(((sorted[middle - 1] + sorted[middle]) / 2).toFixed(2));
}

function summarize(rows: Array<Record<string, unknown>>) {
  const discounts = rows.map((row) => Number(row.discount_pct)).filter(Number.isFinite);
  const byAwardee = new Map<string, { awardee_name: string; awards: number; amount_cents: number; discounts: number[] }>();
  const byBody = new Map<string, number>();
  const byYear = new Map<string, number>();
  for (const row of rows) {
    const key = String(row.normalized_awardee_name || normalizeName(row.awardee_name));
    const current = byAwardee.get(key) || { awardee_name: String(row.awardee_name || key), awards: 0, amount_cents: 0, discounts: [] };
    current.awards += 1;
    current.amount_cents += Number(row.award_amount_cents || 0);
    if (Number.isFinite(Number(row.discount_pct))) current.discounts.push(Number(row.discount_pct));
    byAwardee.set(key, current);
    const body = String(row.contracting_body || 'No informado');
    byBody.set(body, (byBody.get(body) || 0) + 1);
    const year = String(row.award_date || row.created_at || '').slice(0, 4) || 's/f';
    byYear.set(year, (byYear.get(year) || 0) + 1);
  }
  return {
    totalAwards: rows.length,
    averageDiscountPct: average(discounts),
    medianDiscountPct: median(discounts),
    topAwardees: [...byAwardee.values()]
      .sort((a, b) => b.awards - a.awards || b.amount_cents - a.amount_cents)
      .slice(0, 10)
      .map((item) => ({
        ...item,
        average_discount_pct: average(item.discounts)
      })),
    byContractingBody: [...byBody.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([name, count]) => ({ name, count })),
    byYear: [...byYear.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([year, count]) => ({ year, count }))
  };
}

async function dashboard(organizationId: string, filters: Record<string, unknown>) {
  const cpv = String(filters.cpv || '').trim();
  const body = String(filters.contractingBody || '').trim();
  const region = String(filters.region || '').trim();
  const cpvFilter = cpv ? `&cpv_codes=cs.{${encodeParam(cpv)}}` : '';
  const bodyFilter = body ? `&contracting_body=ilike.*${encodeParam(body)}*` : '';
  const regionFilter = region ? `&region=ilike.*${encodeParam(region)}*` : '';
  const rows = await rest(`award_history?or=(organization_id.is.null,organization_id.eq.${organizationId})${cpvFilter}${bodyFilter}${regionFilter}&select=*&order=award_date.desc.nullslast&limit=500`);
  const awards = Array.isArray(rows) ? rows : [];
  return { awards, summary: summarize(awards) };
}

async function ensureCompany(organizationId: string, userId: string, name: string) {
  const normalized = normalizeName(name);
  const existing = first(await rest(`companies?organization_id=eq.${organizationId}&normalized_name=eq.${encodeParam(normalized)}&select=*&limit=1`));
  if (existing) return existing;
  return first(await rest('companies', {
    method: 'POST',
    body: {
      organization_id: organizationId,
      name,
      normalized_name: normalized,
      is_ute: /\bute\b|union temporal/i.test(name),
      confidence: 0.86,
      created_by: userId,
      metadata: { source: 'competitive-intel' }
    }
  }));
}

async function importAward(req: Request, organizationId: string, userId: string, payload: Record<string, unknown>) {
  const awardeeName = String(payload.awardeeName || '').trim();
  if (!awardeeName) throw new Error('awardeeName is required');
  const company = await ensureCompany(organizationId, userId, awardeeName);
  const baseBudgetCents = Math.round(Number(payload.baseBudgetEur || 0) * 100) || Number(payload.baseBudgetCents || 0) || null;
  const awardAmountCents = Math.round(Number(payload.awardAmountEur || 0) * 100) || Number(payload.awardAmountCents || 0) || null;
  const award = first(await rest('award_history', {
    method: 'POST',
    body: {
      organization_id: organizationId,
      tender_id: payload.tenderId || null,
      tender_lot_id: payload.tenderLotId || null,
      company_id: company?.id || null,
      awardee_name: awardeeName,
      normalized_awardee_name: normalizeName(awardeeName),
      contracting_body: payload.contractingBody || null,
      cpv_codes: Array.isArray(payload.cpvCodes) ? payload.cpvCodes : [],
      region: payload.region || null,
      base_budget_cents: baseBudgetCents,
      award_amount_cents: awardAmountCents,
      discount_pct: discount(baseBudgetCents, awardAmountCents),
      award_date: payload.awardDate || null,
      source_url: payload.sourceUrl || null,
      source_payload: payload
    }
  }));
  await insertAudit(req, {
    organization_id: organizationId,
    actor_user_id: userId,
    action: 'competitive.award.imported',
    resource_type: 'award_history',
    resource_id: award?.id || null,
    metadata: { awardee_name: awardeeName }
  });
  return award;
}

async function saveScenario(req: Request, organizationId: string, userId: string, payload: Record<string, unknown>) {
  const trackedTenderId = String(payload.trackedTenderId || '');
  if (!trackedTenderId) throw new Error('trackedTenderId is required');
  const tracked = first(await rest(`tracked_tenders?id=eq.${encodeParam(trackedTenderId)}&organization_id=eq.${organizationId}&select=*,tenders(*)&limit=1`));
  if (!tracked) throw new Error('Tracked tender not found');
  const tender = tracked.tenders || {};
  const baseAmount = Number(payload.baseAmountCents || tender.base_budget_cents || tender.estimated_value_cents || 0);
  const discountPct = Number(payload.discountPct || 0);
  const bidAmount = Number(payload.bidAmountCents || Math.round(baseAmount * (1 - discountPct / 100)));
  const estimatedCost = Number(payload.estimatedCostCents || 0);
  const winProbability = Number(payload.winProbabilityPct || 35);
  const marginPct = bidAmount && estimatedCost ? Number((((bidAmount - estimatedCost) / bidAmount) * 100).toFixed(4)) : null;
  const expectedValue = Math.round((bidAmount - estimatedCost) * (winProbability / 100));
  const scenario = first(await rest('economic_scenarios', {
    method: 'POST',
    body: {
      organization_id: organizationId,
      tracked_tender_id: trackedTenderId,
      created_by: userId,
      name: payload.name || `Escenario ${new Date().toLocaleDateString('es-ES')}`,
      base_amount_cents: baseAmount || null,
      bid_amount_cents: bidAmount || null,
      estimated_cost_cents: estimatedCost || null,
      discount_pct: discountPct,
      margin_pct: marginPct,
      win_probability_pct: winProbability,
      expected_value_cents: expectedValue,
      assumptions: payload.assumptions && typeof payload.assumptions === 'object' ? payload.assumptions : {}
    }
  }));
  await insertAudit(req, {
    organization_id: organizationId,
    actor_user_id: userId,
    action: 'economic_scenario.created',
    resource_type: 'economic_scenario',
    resource_id: scenario?.id || null,
    metadata: { tracked_tender_id: trackedTenderId, discount_pct: discountPct, margin_pct: marginPct }
  });
  return scenario;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return jsonResponse(req, { ok: true });
  if (req.method !== 'POST') return jsonResponse(req, { error: 'Method not allowed' }, 405);
  if (!hasServiceConfig()) return jsonResponse(req, { error: 'Backend not configured' }, 503);

  try {
    const { user, organizationId } = await requireActiveMembership(req);
    const payload = await req.json().catch(() => ({}));
    const action = String(payload.action || 'dashboard');

    if (action === 'importAward') {
      const award = await importAward(req, organizationId, user.id, payload);
      return jsonResponse(req, { ok: true, award });
    }
    if (action === 'saveScenario') {
      const scenario = await saveScenario(req, organizationId, user.id, payload);
      return jsonResponse(req, { ok: true, scenario });
    }

    const data = await dashboard(organizationId, payload.filters && typeof payload.filters === 'object' ? payload.filters : {});
    if (action === 'exportCsv') {
      return jsonResponse(req, {
        ok: true,
        filename: 'licitia-inteligencia-competitiva.csv',
        csv: rowsToCsv(data.awards, ['awardee_name', 'contracting_body', 'region', 'base_budget_cents', 'award_amount_cents', 'discount_pct', 'award_date', 'source_url'])
      });
    }
    return jsonResponse(req, { ok: true, ...data });
  } catch (error) {
    return jsonResponse(req, { error: error instanceof Error ? error.message : 'Unexpected error' }, 400);
  }
});
