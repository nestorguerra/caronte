import { jsonResponse } from '../_shared/cors.ts';
import {
  encodeParam,
  finishIngestionRun,
  hasServiceConfig,
  requireJobCaller,
  rest,
  startIngestionRun
} from '../_shared/service.ts';
import { scoreTender } from '../_shared/tenders.ts';
import { territorialMatches } from '../_shared/territory.ts';

function asArray(value: unknown) {
  return Array.isArray(value) ? value.map(String).filter(Boolean) : String(value || '').split(',').map((item) => item.trim()).filter(Boolean);
}

function includesText(value: unknown, query: string) {
  if (!query) return true;
  return String(value || '').toLowerCase().includes(query.toLowerCase());
}

function matchesRule(tender: Record<string, unknown>, rule: Record<string, unknown>) {
  const filters = rule.filters && typeof rule.filters === 'object' ? rule.filters as Record<string, unknown> : {};
  const query = String(rule.query || filters.query || '').trim();
  if (query && ![tender.title, tender.contracting_body, tender.external_id].some((field) => includesText(field, query))) return false;
  const cpv = asArray(filters.cpv);
  const tenderCpvs = Array.isArray(tender.cpv_codes) ? tender.cpv_codes.map(String) : [];
  if (cpv.length && !tenderCpvs.some((code) => cpv.some((wanted) => code.startsWith(wanted.slice(0, 4))))) return false;
  if (filters.territory && !territorialMatches(tender.region, filters.territory)) return false;
  if (filters.only_open !== false && tender.submission_deadline && Date.parse(String(tender.submission_deadline)) < Date.now()) return false;
  return true;
}

async function sendEmail(to: string, subject: string, html: string) {
  const apiKey = Deno.env.get('RESEND_API_KEY') || '';
  const from = Deno.env.get('NOTIFICATION_FROM') || '';
  if (!apiKey || !from) {
    return { status: 'skipped', providerMessageId: null, error: 'email_provider_not_configured' };
  }
  const resp = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ from, to, subject, html })
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) return { status: 'failed', providerMessageId: null, error: data?.message || `email_http_${resp.status}` };
  return { status: 'sent', providerMessageId: data?.id || null, error: null };
}

async function activeRecipients(organizationId: string) {
  const rows = await rest(`organization_members?organization_id=eq.${organizationId}&status=eq.active&select=user_id,invited_email`);
  return (Array.isArray(rows) ? rows : [])
    .map((row) => row.invited_email)
    .filter((email) => typeof email === 'string' && email.includes('@'));
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return jsonResponse(req, { ok: true });
  if (req.method !== 'POST') return jsonResponse(req, { error: 'Method not allowed' }, 405);
  if (!hasServiceConfig()) return jsonResponse(req, { error: 'Backend not configured' }, 503);

  let runId: string | null = null;
  try {
    const caller = await requireJobCaller(req);
    const payload = await req.json().catch(() => ({}));
    const run = await startIngestionRun({
      source_code: 'licitia_alerts',
      job_type: 'alerts',
      metadata: { caller: caller.mode }
    });
    runId = run.id;

    const orgFilter = caller.organizationId && !payload.allOrganizations
      ? `&organization_id=eq.${caller.organizationId}`
      : '';
    const rules = await rest(`alert_rules?active=eq.true${orgFilter}&select=id,organization_id,name,query,filters,cadence,channels,last_run_at&limit=100`);
    const tenders = await rest('tenders?organization_id=is.null&select=id,title,external_id,contracting_body,cpv_codes,region,submission_deadline,publication_date,official_url,base_budget_cents,estimated_value_cents,document_count&order=publication_date.desc.nullslast&limit=160');
    let eventsCreated = 0;
    let deliveries = 0;
    let skipped = 0;

    for (const rule of Array.isArray(rules) ? rules : []) {
      const profileRows = await rest(`company_profiles?organization_id=eq.${rule.organization_id}&select=target_cpvs,operating_regions,min_contract_value_cents,max_contract_value_cents&limit=1`);
      const profile = Array.isArray(profileRows) ? profileRows[0] : null;
      const matches = (Array.isArray(tenders) ? tenders : [])
        .filter((tender) => matchesRule(tender, rule))
        .slice(0, 10);
      const recipients = await activeRecipients(rule.organization_id);
      for (const tender of matches) {
        const score = scoreTender(tender, rule.filters || {}, profile);
        const dedupeKey = `${rule.id}:${tender.id}:${tender.publication_date || tender.submission_deadline || 'current'}`;
        const existing = await rest(`alert_events?organization_id=eq.${rule.organization_id}&dedupe_key=eq.${encodeParam(dedupeKey)}&select=id&limit=1`);
        if (Array.isArray(existing) && existing.length) continue;
        const created = await rest('alert_events', {
          method: 'POST',
          body: {
            organization_id: rule.organization_id,
            alert_rule_id: rule.id,
            tender_id: tender.id,
            event_type: 'match',
            dedupe_key: dedupeKey,
            payload: { score, tender_title: tender.title, rule_name: rule.name }
          }
        });
        const event = Array.isArray(created) ? created[0] : created;
        eventsCreated += 1;
        const subject = `LicitIA: nueva oportunidad (${score}/100)`;
        const body = `<p><strong>${tender.title}</strong></p><p>${tender.contracting_body || ''}</p><p>Score: ${score}/100</p><p><a href="${tender.official_url || '#'}">Abrir enlace oficial</a></p>`;
        if (!recipients.length) skipped += 1;
        for (const to of recipients) {
          const email = await sendEmail(to, subject, body);
          await rest('notification_deliveries', {
            method: 'POST',
            body: {
              organization_id: rule.organization_id,
              alert_event_id: event.id,
              channel: 'email',
              destination: to,
              status: email.status,
              provider_message_id: email.providerMessageId,
              error_message: email.error,
              subject,
              body_preview: `${tender.title} · Score ${score}/100`,
              sent_at: email.status === 'sent' ? new Date().toISOString() : null,
              metadata: { rule_id: rule.id, tender_id: tender.id }
            },
            prefer: 'return=minimal'
          });
          deliveries += 1;
        }
      }
      await rest(`alert_rules?id=eq.${rule.id}`, {
        method: 'PATCH',
        body: { last_run_at: new Date().toISOString(), last_error: null },
        prefer: 'return=minimal'
      });
    }

    await finishIngestionRun(runId, {
      status: 'succeeded',
      items_seen: Array.isArray(rules) ? rules.length : 0,
      items_upserted: eventsCreated,
      items_failed: 0,
      metadata: { deliveries, skipped }
    });

    return jsonResponse(req, { ok: true, rules: Array.isArray(rules) ? rules.length : 0, eventsCreated, deliveries, skipped });
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
