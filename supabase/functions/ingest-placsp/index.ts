import { jsonResponse } from '../_shared/cors.ts';
import {
  finishIngestionRun,
  getSource,
  hasServiceConfig,
  requireJobCaller,
  rest,
  startIngestionRun
} from '../_shared/service.ts';
import {
  cleanText,
  isoDateTime,
  parseAmountToCents,
  replaceTenderDocuments,
  stableKey,
  upsertTender
} from '../_shared/tenders.ts';
import { buildTerritoryLabel } from '../_shared/territory.ts';
import { firstXmlText, xmlAttributeValues, xmlElementBlocks, xmlTexts } from '../_shared/xml.ts';

const SOURCES = {
  profiles: {
    code: 'placsp_profiles',
    jobType: 'placsp_profiles',
    url: 'https://contrataciondelsectorpublico.gob.es/sindicacion/sindicacion_643/licitacionesPerfilesContratanteCompleto3.atom'
  },
  aggregated: {
    code: 'placsp_aggregated',
    jobType: 'placsp_aggregated',
    url: 'https://contrataciondelsectorpublico.gob.es/sindicacion/sindicacion_1044/PlataformasAgregadasSinMenores.atom'
  }
};

function entryText(entryXml: string, tag: string) {
  return firstXmlText(entryXml, [tag]);
}

function tagAttribute(tag: string, attribute: string) {
  const match = tag.match(new RegExp(`${attribute}=(["'])(.*?)\\1`, 'i'));
  return match?.[2] || '';
}

function absoluteUrl(value: string, baseUrl: string) {
  try {
    return new URL(value, baseUrl).toString();
  } catch {
    return '';
  }
}

function nextAtomUrl(xml: string, currentUrl: string) {
  const tags = xml.match(/<(?:[A-Za-z0-9_.-]+:)?link\b[^>]*>/gi) || [];
  for (const tag of tags) {
    if (tagAttribute(tag, 'rel') !== 'next') continue;
    const href = tagAttribute(tag, 'href');
    if (href) return absoluteUrl(href, currentUrl);
  }
  return '';
}

async function fetchAtomEntries(startUrl: string, limit: number, maxPages: number) {
  const entries: Array<{ entry: string; sourceUrl: string }> = [];
  const pageUrls: string[] = [];
  const seen = new Set<string>();
  let nextUrl = startUrl;

  while (nextUrl && entries.length < limit && pageUrls.length < maxPages && !seen.has(nextUrl)) {
    seen.add(nextUrl);
    const resp = await fetch(nextUrl, {
      headers: {
        Accept: 'application/atom+xml, application/xml, text/xml',
        'User-Agent': 'LicitIA/0.4 official-data-ingestion'
      }
    });
    if (!resp.ok) throw new Error(`PLACSP HTTP ${resp.status}`);
    const xml = await resp.text();
    pageUrls.push(nextUrl);
    for (const entry of xmlElementBlocks(xml, 'entry')) {
      if (entries.length >= limit) break;
      entries.push({ entry, sourceUrl: nextUrl });
    }
    nextUrl = nextAtomUrl(xml, nextUrl);
  }

  return { entries, pageUrls, hasMore: Boolean(nextUrl) };
}

function normalizeEntry(entryXml: string, source: Record<string, unknown>, sourceUrl: string) {
  const links = xmlAttributeValues(entryXml, 'link', 'href');
  const title = entryText(entryXml, 'title') || firstXmlText(entryXml, ['Name']) || 'Licitacion PLACSP';
  const updated = entryText(entryXml, 'updated') || firstXmlText(entryXml, ['IssueDate']);
  const externalId = firstXmlText(entryXml, ['ContractFolderID'])
    || entryText(entryXml, 'id')
    || links[0]
    || stableKey(title);
  const cpvCodes = xmlTexts(entryXml, ['ItemClassificationCode', 'Code'])
    .filter((value) => /^\d{4,8}$/.test(value))
    .slice(0, 12);
  const deadlineDate = firstXmlText(entryXml, ['EndDate']);
  const deadlineTime = firstXmlText(entryXml, ['EndTime']);
  const body = firstXmlText(entryXml, ['ContractingPartyName', 'Name']);
  const budget = firstXmlText(entryXml, ['EstimatedOverallContractAmount', 'TaxExclusiveAmount', 'TotalAmount']);
  const status = firstXmlText(entryXml, ['ContractFolderStatusCode', 'ContractFolderStatus']);
  const officialUrl = links.find((link) => link.includes('contrataciondelsectorpublico')) || links[0] || null;
  const territory = buildTerritoryLabel(
    firstXmlText(entryXml, ['CountrySubentity']),
    firstXmlText(entryXml, ['CountrySubentityCode']),
    firstXmlText(entryXml, ['CityName'])
  );
  const docs = links
    .filter((link) => /document|doc|download|descarga|licitacion/i.test(link))
    .map((link) => ({
      title: 'Enlace oficial PLACSP',
      official_url: link,
      document_type: 'placsp_link',
      published_at: updated || null
    }));

  return {
    tender: {
      source_id: String(source.id),
      source_code: String(source.code),
      external_id: cleanText(externalId),
      canonical_key: `placsp-${stableKey(externalId)}`,
      title,
      contracting_body: body || null,
      status: status || 'published',
      contract_type: firstXmlText(entryXml, ['ContractCode', 'TypeCode']) || null,
      procedure_type: firstXmlText(entryXml, ['ProcedureCode']) || null,
      cpv_codes: cpvCodes,
      region: territory || null,
      publication_date: updated ? updated.slice(0, 10) : null,
      submission_deadline: isoDateTime(deadlineDate, deadlineTime),
      estimated_value_cents: parseAmountToCents(budget),
      base_budget_cents: parseAmountToCents(budget),
      official_url: officialUrl,
      source_url: sourceUrl,
      source_updated_at: updated || null,
      document_count: docs.length,
      raw_payload: {
        id: entryText(entryXml, 'id'),
        title,
        updated,
        links,
        extract: cleanText(entryXml.replace(/<[^>]+>/g, ' ')).slice(0, 5000)
      },
      data_quality_flags: cpvCodes.length ? [] : ['missing_cpv']
    },
    documents: docs
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return jsonResponse(req, { ok: true });
  if (req.method !== 'POST') return jsonResponse(req, { error: 'Method not allowed' }, 405);
  if (!hasServiceConfig()) return jsonResponse(req, { error: 'Backend not configured' }, 503);

  let runId: string | null = null;
  try {
    await requireJobCaller(req);
    const payload = await req.json().catch(() => ({}));
    const sourceKey = payload.source === 'aggregated' ? 'aggregated' : 'profiles';
    const requestedSource = SOURCES[sourceKey];
    const source = await getSource(requestedSource.code);
    const url = String(payload.url || source.base_url || requestedSource.url);
    const limit = Math.min(Number(payload.limit || 300), 350);
    const maxPages = Math.min(Math.max(Number(payload.maxPages || 4), 1), 10);
    const run = await startIngestionRun({
      source_id: source.id,
      source_code: source.code,
      job_type: requestedSource.jobType,
      requested_url: url,
      metadata: { official_reference: 'PLACSP Atom open data' }
    });
    runId = run.id;

    const { entries, pageUrls, hasMore } = await fetchAtomEntries(url, limit, maxPages);

    let upserted = 0;
    let failed = 0;
    let docsInserted = 0;
    for (const item of entries) {
      try {
        const normalized = normalizeEntry(item.entry, source, item.sourceUrl);
        const result = await upsertTender(normalized.tender);
        docsInserted += await replaceTenderDocuments(result.id, source.id, normalized.documents);
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
      items_seen: entries.length,
      items_upserted: upserted,
      items_failed: failed,
      metadata: { parser: 'placsp_atom_v2', documents_inserted: docsInserted, pages_fetched: pageUrls.length, has_more: hasMore }
    });

    return jsonResponse(req, { ok: true, source: source.code, itemsSeen: entries.length, upserted, failed, documentsInserted: docsInserted, pagesFetched: pageUrls.length, hasMore });
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
