import { jsonResponse } from '../_shared/cors.ts';
import { encodeParam, hasServiceConfig, requireActiveMembership, requireOrgRole, rest } from '../_shared/service.ts';

function countRows(value: unknown) {
  return Array.isArray(value) ? value.length : 0;
}

function sinceHours(hours: number) {
  return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
}

function latestBySource(rows: Array<Record<string, unknown>>) {
  const grouped: Record<string, Record<string, unknown>> = {};
  for (const row of rows) {
    const source = String(row.source_code || 'unknown');
    if (!grouped[source]) grouped[source] = row;
  }
  return grouped;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return jsonResponse(req, { ok: true });
  if (req.method !== 'POST') return jsonResponse(req, { error: 'Method not allowed' }, 405);
  if (!hasServiceConfig()) return jsonResponse(req, { error: 'Backend not configured' }, 503);

  try {
    const { user, organizationId } = await requireActiveMembership(req);
    await requireOrgRole(user.id, organizationId, ['owner', 'admin']);
    const since = sinceHours(24);
    const encodedSince = encodeParam(since);
    const [
      ingestionRuns,
      failedIngestionRuns,
      notificationDeliveries,
      aiRuns,
      failedAiRuns,
      activeAlerts,
      tracked,
      pendingTasks,
      failedNotifications
    ] = await Promise.all([
      rest('procurement_ingestion_runs?select=id,source_code,job_type,status,items_seen,items_upserted,items_failed,error_message,created_at,finished_at&order=created_at.desc&limit=30'),
      rest(`procurement_ingestion_runs?status=eq.failed&created_at=gte.${encodedSince}&select=id,source_code,job_type,error_message,created_at&order=created_at.desc&limit=20`),
      rest(`notification_deliveries?organization_id=eq.${organizationId}&created_at=gte.${encodedSince}&select=id,status,channel,created_at,error_message&limit=100`),
      rest(`ai_runs?organization_id=eq.${organizationId}&created_at=gte.${encodedSince}&select=id,endpoint,model,success,status,created_at,error_message,token_usage&order=created_at.desc&limit=80`),
      rest(`ai_runs?organization_id=eq.${organizationId}&success=eq.false&created_at=gte.${encodedSince}&select=id,endpoint,error_message,created_at&order=created_at.desc&limit=20`),
      rest(`alert_rules?organization_id=eq.${organizationId}&active=eq.true&select=id,name,cadence,last_run_at,last_error`),
      rest(`tracked_tenders?organization_id=eq.${organizationId}&select=id,internal_status,decision,priority,created_at`),
      rest(`tasks?organization_id=eq.${organizationId}&status=in.(open,in_progress)&select=id,priority,due_at`),
      rest(`notification_deliveries?organization_id=eq.${organizationId}&status=eq.failed&created_at=gte.${encodedSince}&select=id,channel,destination,error_message,created_at&order=created_at.desc&limit=20`)
    ]);

    const runs = Array.isArray(ingestionRuns) ? ingestionRuns : [];
    const deliveries = Array.isArray(notificationDeliveries) ? notificationDeliveries : [];
    const ai = Array.isArray(aiRuns) ? aiRuns : [];
    const deliveryFailures = deliveries.filter((item) => item.status === 'failed').length;
    const aiFailures = ai.filter((item) => item.success === false || item.status === 'failed').length;
    const failedJobs = countRows(failedIngestionRuns);
    const state = failedJobs || deliveryFailures || aiFailures ? 'warning' : 'ok';

    return jsonResponse(req, {
      ok: true,
      state,
      generatedAt: new Date().toISOString(),
      checks: {
        api: 'ok',
        database: 'ok',
        ingestion: failedJobs ? 'warning' : 'ok',
        notifications: deliveryFailures ? 'warning' : 'ok',
        ai: aiFailures ? 'warning' : 'ok'
      },
      ingestion: {
        latestBySource: latestBySource(runs),
        failedLast24h: failedIngestionRuns
      },
      notifications: {
        totalLast24h: deliveries.length,
        failedLast24h: failedNotifications,
        statuses: deliveries.reduce((acc: Record<string, number>, item: Record<string, unknown>) => {
          const key = String(item.status || 'unknown');
          acc[key] = (acc[key] || 0) + 1;
          return acc;
        }, {})
      },
      ai: {
        totalLast24h: ai.length,
        failedLast24h: failedAiRuns,
        byEndpoint: ai.reduce((acc: Record<string, number>, item: Record<string, unknown>) => {
          const key = String(item.endpoint || item.model || 'unknown');
          acc[key] = (acc[key] || 0) + 1;
          return acc;
        }, {})
      },
      workload: {
        activeAlerts: countRows(activeAlerts),
        trackedTenders: countRows(tracked),
        pendingTasks: countRows(pendingTasks)
      }
    });
  } catch (error) {
    return jsonResponse(req, { error: error instanceof Error ? error.message : 'Unexpected error' }, 400);
  }
});
