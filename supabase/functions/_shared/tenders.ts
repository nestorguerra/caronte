import { encodeParam, rest } from './service.ts';
import { territorialMatches } from './territory.ts';

export type NormalizedTender = {
  source_id: string;
  source_code: string;
  external_id: string;
  canonical_key: string;
  title: string;
  contracting_body?: string | null;
  status?: string | null;
  contract_type?: string | null;
  procedure_type?: string | null;
  cpv_codes?: string[];
  country?: string;
  region?: string | null;
  publication_date?: string | null;
  submission_deadline?: string | null;
  estimated_value_cents?: number | null;
  base_budget_cents?: number | null;
  currency?: string;
  official_url?: string | null;
  source_url?: string | null;
  source_updated_at?: string | null;
  document_count?: number;
  raw_payload?: Record<string, unknown>;
  data_quality_flags?: string[];
};

export function cleanText(value: unknown) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .replace(/[\u0000-\u001f]/g, ' ')
    .trim();
}

export function stableKey(value: string) {
  return cleanText(value).toLowerCase().replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').slice(0, 180);
}

export function dateOnly(value: unknown) {
  const raw = cleanText(value);
  if (!raw) return null;
  const match = raw.match(/(\d{4})-(\d{2})-(\d{2})/) || raw.match(/(\d{4})(\d{2})(\d{2})/);
  if (!match) return null;
  return `${match[1]}-${match[2]}-${match[3]}`;
}

export function isoDateTime(date: unknown, time?: unknown) {
  const d = dateOnly(date);
  if (!d) return null;
  const t = cleanText(time || '23:59:00');
  const normalizedTime = /^\d{2}:\d{2}/.test(t) ? t : '23:59:00';
  return `${d}T${normalizedTime.length === 5 ? `${normalizedTime}:00` : normalizedTime}`;
}

export function parseAmountToCents(value: unknown) {
  const raw = cleanText(value).replace(/\./g, '').replace(',', '.');
  const match = raw.match(/\d+(\.\d+)?/);
  if (!match) return null;
  const parsed = Number(match[0]);
  if (!Number.isFinite(parsed)) return null;
  return Math.round(parsed * 100);
}

export function firstNodeText(root: Document | Element, localNames: string[]) {
  for (const localName of localNames) {
    const nodes = root.getElementsByTagName('*');
    for (const node of nodes) {
      if (node.localName === localName) return cleanText(node.textContent);
    }
  }
  return '';
}

export function nodeTexts(root: Document | Element, localNames: string[]) {
  const out = new Set<string>();
  const nodes = root.getElementsByTagName('*');
  for (const node of nodes) {
    if (localNames.includes(node.localName)) {
      const text = cleanText(node.textContent);
      if (text) out.add(text);
    }
  }
  return [...out];
}

export function linksFromEntry(entry: Element) {
  return Array.from(entry.getElementsByTagName('link'))
    .map((link) => link.getAttribute('href') || '')
    .filter(Boolean);
}

export function jsonFingerprint(payload: unknown) {
  const text = JSON.stringify(payload || {});
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) {
    hash = ((hash << 5) - hash + text.charCodeAt(i)) | 0;
  }
  return Math.abs(hash).toString(36);
}

export async function upsertTender(tender: NormalizedTender) {
  const existing = await rest(
    `tenders?source_id=eq.${tender.source_id}&external_id=eq.${encodeParam(tender.external_id)}&select=id,raw_payload,document_count&limit=1`
  );
  const current = Array.isArray(existing) ? existing[0] : null;
  const body = {
    organization_id: null,
    source_id: tender.source_id,
    external_id: tender.external_id,
    canonical_key: tender.canonical_key,
    title: tender.title,
    contracting_body: tender.contracting_body || null,
    status: tender.status || 'published',
    contract_type: tender.contract_type || null,
    procedure_type: tender.procedure_type || null,
    cpv_codes: tender.cpv_codes || [],
    country: tender.country || 'ES',
    region: tender.region || null,
    publication_date: tender.publication_date || null,
    submission_deadline: tender.submission_deadline || null,
    estimated_value_cents: tender.estimated_value_cents || null,
    base_budget_cents: tender.base_budget_cents || null,
    currency: tender.currency || 'EUR',
    official_url: tender.official_url || null,
    source_url: tender.source_url || null,
    source_updated_at: tender.source_updated_at || null,
    last_seen_at: new Date().toISOString(),
    normalized_at: new Date().toISOString(),
    document_count: tender.document_count || 0,
    raw_payload: tender.raw_payload || {},
    data_quality_flags: tender.data_quality_flags || []
  };

  if (current?.id) {
    await rest(`tenders?id=eq.${current.id}`, {
      method: 'PATCH',
      body,
      prefer: 'return=minimal'
    });
    await insertVersionIfChanged(current.id, tender, current.raw_payload);
    return { id: current.id as string, created: false };
  }

  const created = await rest('tenders', { method: 'POST', body });
  const row = Array.isArray(created) ? created[0] : created;
  if (row?.id) await insertVersionIfChanged(row.id, tender, null);
  return { id: row?.id as string, created: true };
}

async function insertVersionIfChanged(tenderId: string, tender: NormalizedTender, previousPayload: unknown) {
  const fingerprint = jsonFingerprint(tender.raw_payload);
  if (previousPayload && jsonFingerprint(previousPayload) === fingerprint) return;
  await rest('tender_versions', {
    method: 'POST',
    body: {
      organization_id: null,
      tender_id: tenderId,
      version_label: `${tender.source_code}:${tender.external_id}:${fingerprint}`,
      change_type: previousPayload ? 'updated' : 'created',
      source_payload: tender.raw_payload || {},
      diff_summary: {
        title: tender.title,
        source_code: tender.source_code,
        status: tender.status || null
      },
      source_url: tender.source_url || tender.official_url || null,
      source_fingerprint: fingerprint
    },
    prefer: 'return=minimal'
  });
}

export async function replaceTenderDocuments(tenderId: string, sourceId: string, documents: Array<{
  title: string;
  official_url: string;
  document_type?: string;
  published_at?: string | null;
}>) {
  if (!documents.length) return 0;
  const existing = await rest(`tender_documents?tender_id=eq.${tenderId}&select=id,official_url`);
  const existingUrls = new Set((Array.isArray(existing) ? existing : []).map((doc) => doc.official_url));
  let inserted = 0;
  for (const doc of documents) {
    if (!doc.official_url || existingUrls.has(doc.official_url)) continue;
    await rest('tender_documents', {
      method: 'POST',
      body: {
        organization_id: null,
        tender_id: tenderId,
        source_id: sourceId,
        document_type: doc.document_type || 'official_link',
        title: doc.title || 'Documento oficial',
        official_url: doc.official_url,
        published_at: doc.published_at || null,
        metadata: { ingestion: 'sprint3' }
      },
      prefer: 'return=minimal'
    });
    inserted += 1;
  }
  if (inserted > 0) {
    await rest(`tenders?id=eq.${tenderId}`, {
      method: 'PATCH',
      body: { document_count: Number((Array.isArray(existing) ? existing.length : 0) + inserted) },
      prefer: 'return=minimal'
    });
  }
  return inserted;
}

export function scoreTender(tender: Record<string, unknown>, filters: Record<string, unknown>, profile?: Record<string, unknown>) {
  let score = 50;
  const cpvs = Array.isArray(tender.cpv_codes) ? tender.cpv_codes.map(String) : [];
  const targetCpvs = Array.isArray(profile?.target_cpvs) ? profile?.target_cpvs.map(String) : [];
  const requestedCpvs = Array.isArray(filters.cpv) ? filters.cpv.map(String) : [];
  if (targetCpvs.length && cpvs.some((cpv) => targetCpvs.some((target) => cpv.startsWith(target.slice(0, 4))))) score += 20;
  if (requestedCpvs.length && cpvs.some((cpv) => requestedCpvs.some((target) => cpv.startsWith(target.slice(0, 4))))) score += 15;
  const deadline = tender.submission_deadline ? Date.parse(String(tender.submission_deadline)) : 0;
  if (deadline > Date.now()) score += 10;
  const requestedRegion = String(filters.region || filters.territory || '');
  const profileRegions = Array.isArray(profile?.operating_regions) ? profile?.operating_regions.map(String) : [];
  if (requestedRegion && territorialMatches(tender.region, requestedRegion)) score += 8;
  else if (profileRegions.length && profileRegions.some((region) => territorialMatches(tender.region, region))) score += 6;
  if (Number(tender.document_count || 0) > 0) score += 5;
  return Math.max(0, Math.min(100, score));
}
