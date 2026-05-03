import { jsonResponse } from '../_shared/cors.ts';
import {
  finishIngestionRun,
  getSource,
  hasServiceConfig,
  requireJobCaller,
  rest,
  startIngestionRun
} from '../_shared/service.ts';
import { cleanText, dateOnly, stableKey, upsertTender, replaceTenderDocuments } from '../_shared/tenders.ts';
import { xmlElementBlocks, xmlRecord } from '../_shared/xml.ts';

function defaultBoeDate() {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - 1);
  while (date.getUTCDay() === 0) {
    date.setUTCDate(date.getUTCDate() - 1);
  }
  return date.toISOString().slice(0, 10).replaceAll('-', '');
}

function flattenObjects(value: unknown, out: Record<string, unknown>[] = []) {
  if (Array.isArray(value)) {
    value.forEach((item) => flattenObjects(item, out));
  } else if (value && typeof value === 'object') {
    const item = value as Record<string, unknown>;
    if (item.titulo || item.title || item.identificador || item.url_pdf || item.url_html) out.push(item);
    Object.values(item).forEach((child) => flattenObjects(child, out));
  }
  return out;
}

function getString(item: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = item[key];
    if (typeof value === 'string' || typeof value === 'number') {
      const text = cleanText(value);
      if (text) return text;
    }
  }
  return '';
}

function getUrl(item: Record<string, unknown>, keys: string[]) {
  const value = getString(item, keys);
  if (!value) return '';
  if (value.startsWith('http')) return value;
  if (value.startsWith('/')) return `https://www.boe.es${value}`;
  return value;
}

function likelyContractNotice(item: Record<string, unknown>) {
  const text = JSON.stringify(item).toLowerCase();
  return (
    text.includes('sección v') ||
    text.includes('seccion v') ||
    text.includes('"v.') ||
    text.includes('licit') ||
    text.includes('contrataci') ||
    text.includes('formalizaci')
  );
}

function xmlCandidates(xml: string) {
  return xmlElementBlocks(xml, 'item').map((node) => {
    const record = xmlRecord(node);
    record.raw_text = cleanText(node.replace(/<[^>]+>/g, ' ')).slice(0, 2000);
    return record;
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return jsonResponse(req, { ok: true });
  if (req.method !== 'POST') return jsonResponse(req, { error: 'Method not allowed' }, 405);
  if (!hasServiceConfig()) return jsonResponse(req, { error: 'Backend not configured' }, 503);

  let runId: string | null = null;
  try {
    await requireJobCaller(req);
    const payload = await req.json().catch(() => ({}));
    const date = String(payload.date || defaultBoeDate()).replaceAll('-', '');
    const limit = Math.min(Number(payload.limit || 80), 200);
    const source = await getSource('boe_opendata');
    const url = String(payload.url || `https://www.boe.es/datosabiertos/api/boe/sumario/${date}`);
    const run = await startIngestionRun({
      source_id: source.id,
      source_code: source.code,
      job_type: 'boe_daily',
      requested_url: url,
      metadata: { date, official_reference: 'BOE OpenData sumario' }
    });
    runId = run.id;

    const resp = await fetch(url, {
      headers: {
        Accept: 'application/json, application/xml;q=0.8',
        'User-Agent': 'LicitIA/0.3 official-data-ingestion'
      }
    });
    if (!resp.ok) throw new Error(`BOE HTTP ${resp.status}`);
    const contentType = resp.headers.get('content-type') || '';
    const text = await resp.text();
    const parsed = contentType.includes('json') || text.trim().startsWith('{') ? JSON.parse(text) : null;
    const rawCandidates = parsed ? flattenObjects(parsed) : xmlCandidates(text);
    const candidates = rawCandidates.filter(likelyContractNotice).slice(0, limit);

    let upserted = 0;
    let failed = 0;
    for (const item of candidates) {
      try {
        const externalId = getString(item, ['identificador', 'id', 'codigo', 'url_pdf', 'urlPdf', 'urlHtml']) || stableKey(JSON.stringify(item).slice(0, 180));
        const title = getString(item, ['titulo', 'title', 'texto', 'raw_text']) || 'Anuncio BOE de contratación';
        const officialUrl = getUrl(item, ['url_html', 'url_pdf', 'url_xml', 'urlHtml', 'urlPdf', 'urlXml', 'url']);
        const publicationDate = dateOnly(date);
        const result = await upsertTender({
          source_id: source.id,
          source_code: source.code,
          external_id: externalId,
          canonical_key: `boe-${stableKey(externalId)}`,
          title,
          contracting_body: getString(item, ['departamento', 'epigrafe', 'organismo']) || null,
          status: 'published',
          contract_type: 'public_contract_notice',
          cpv_codes: [],
          publication_date: publicationDate,
          official_url: officialUrl || null,
          source_url: url,
          source_updated_at: publicationDate ? `${publicationDate}T00:00:00Z` : null,
          document_count: officialUrl ? 1 : 0,
          raw_payload: item,
          data_quality_flags: ['boe_summary_limited_fields']
        });
        if (officialUrl) {
          await replaceTenderDocuments(result.id, source.id, [{
            title: 'Anuncio BOE',
            official_url: officialUrl,
            document_type: officialUrl.endsWith('.pdf') ? 'boe_pdf' : 'boe_html',
            published_at: publicationDate ? `${publicationDate}T00:00:00Z` : null
          }]);
        }
        upserted += 1;
      } catch {
        failed += 1;
      }
    }

    await rest(`procurement_sources?id=eq.${source.id}`, {
      method: 'PATCH',
      body: { last_ingested_at: new Date().toISOString() },
      prefer: 'return=minimal'
    });
    await finishIngestionRun(runId, {
      status: failed ? 'partial' : 'succeeded',
      items_seen: candidates.length,
      items_upserted: upserted,
      items_failed: failed,
      metadata: { date, parser: 'boe_sumario_json_flatten' }
    });

    return jsonResponse(req, { ok: true, source: source.code, date, itemsSeen: candidates.length, upserted, failed });
  } catch (error) {
    if (runId) {
      await finishIngestionRun(runId, {
        status: 'failed',
        error_message: error instanceof Error ? error.message : 'Unexpected error'
      }).catch(() => null);
    }
    return jsonResponse(req, { error: error instanceof Error ? error.message : 'Unexpected error' }, 400);
  }
});
