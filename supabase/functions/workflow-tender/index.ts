import { jsonResponse } from '../_shared/cors.ts';
import { defaultChecklistItems, defaultMilestones, icsCalendar } from '../_shared/workflow.ts';
import { encodeParam, hasServiceConfig, insertAudit, requireActiveMembership, rest } from '../_shared/service.ts';

const taskStatuses = new Set(['open', 'in_progress', 'done', 'cancelled']);
const taskPriorities = new Set(['low', 'normal', 'high', 'urgent']);

function first<T>(value: T[] | T | null): T | null {
  return Array.isArray(value) ? (value[0] || null) : value;
}

function now() {
  return new Date().toISOString();
}

async function visibleTender(tenderId: string, organizationId: string) {
  const tender = first(await rest(`tenders?id=eq.${encodeParam(tenderId)}&select=*&limit=1`));
  if (!tender) throw new Error('Tender not found');
  if (tender.organization_id && tender.organization_id !== organizationId) {
    throw new Error('Tender is not visible for this organization');
  }
  return tender;
}

async function ensureTrackedTender(input: {
  organizationId: string;
  tenderId: string;
  userId: string;
}) {
  const existing = first(await rest(
    `tracked_tenders?organization_id=eq.${input.organizationId}&tender_id=eq.${encodeParam(input.tenderId)}&select=*&limit=1`
  ));
  if (existing) return existing;
  const created = await rest('tracked_tenders', {
    method: 'POST',
    body: {
      organization_id: input.organizationId,
      tender_id: input.tenderId,
      owner_user_id: input.userId,
      internal_status: 'analysis',
      priority: 'normal',
      notes: 'Expediente preparado desde Sprint 4'
    }
  });
  return first(created);
}

async function loadBundle(organizationId: string, trackedTenderId: string) {
  const [checklists, tasks, milestones, comments] = await Promise.all([
    rest(`document_checklists?organization_id=eq.${organizationId}&tracked_tender_id=eq.${trackedTenderId}&select=*&order=created_at.asc`),
    rest(`tasks?organization_id=eq.${organizationId}&tracked_tender_id=eq.${trackedTenderId}&select=*&order=due_at.asc.nullslast,created_at.asc`),
    rest(`milestones?organization_id=eq.${organizationId}&tracked_tender_id=eq.${trackedTenderId}&select=*&order=due_at.asc`),
    rest(`task_comments?organization_id=eq.${organizationId}&select=*&order=created_at.asc&limit=100`)
  ]);
  const taskIds = new Set((Array.isArray(tasks) ? tasks : []).map((task) => task.id));
  return {
    checklist: Array.isArray(checklists) ? (checklists[0] || null) : null,
    tasks: Array.isArray(tasks) ? tasks : [],
    milestones: Array.isArray(milestones) ? milestones : [],
    comments: (Array.isArray(comments) ? comments : []).filter((comment) => taskIds.has(comment.task_id))
  };
}

async function bootstrapWorkflow(input: {
  req: Request;
  organizationId: string;
  tenderId: string;
  userId: string;
  aiRunId?: string | null;
}) {
  const [tender, documents] = await Promise.all([
    visibleTender(input.tenderId, input.organizationId),
    rest(`tender_documents?tender_id=eq.${encodeParam(input.tenderId)}&select=*&order=created_at.desc&limit=20`)
  ]);
  const tracked = await ensureTrackedTender(input);
  const bundle = await loadBundle(input.organizationId, tracked.id);

  let checklist = bundle.checklist;
  if (!checklist) {
    checklist = first(await rest('document_checklists', {
      method: 'POST',
      body: {
        organization_id: input.organizationId,
        tracked_tender_id: tracked.id,
        title: `Checklist documental - ${String(tender.title || 'licitacion').slice(0, 90)}`,
        items: defaultChecklistItems({ tender, documents: Array.isArray(documents) ? documents : [] }),
        source: 'auto',
        generated_from_ai_run_id: input.aiRunId || null,
        created_by: input.userId,
        history: [{ at: now(), action: 'created', actor_user_id: input.userId, source: 'workflow-tender' }]
      }
    }));
  }

  let tasks = bundle.tasks;
  if (!tasks.length) {
    const dueAt = tender.submission_deadline || null;
    const created = await rest('tasks', {
      method: 'POST',
      body: [
        {
          organization_id: input.organizationId,
          tracked_tender_id: tracked.id,
          assigned_to: input.userId,
          created_by: input.userId,
          title: 'Validar pliegos y requisitos de solvencia',
          description: 'Confirmar importes, plazo, solvencia economica y solvencia tecnica con evidencias oficiales.',
          priority: 'high',
          due_at: dueAt,
          metadata: { source: 'sprint4_auto' }
        },
        {
          organization_id: input.organizationId,
          tracked_tender_id: tracked.id,
          assigned_to: input.userId,
          created_by: input.userId,
          title: 'Preparar decision Go/No-Go',
          description: 'Revisar scoring, riesgos, capacidad de entrega y margen comercial antes de aprobar candidatura.',
          priority: 'normal',
          due_at: dueAt,
          metadata: { source: 'sprint4_auto' }
        },
        {
          organization_id: input.organizationId,
          tracked_tender_id: tracked.id,
          assigned_to: input.userId,
          created_by: input.userId,
          title: 'Planificar entrega y responsables',
          description: 'Asignar responsables de memoria tecnica, oferta economica, documentacion administrativa y subida a portal.',
          priority: 'normal',
          due_at: dueAt,
          metadata: { source: 'sprint4_auto' }
        }
      ]
    });
    tasks = Array.isArray(created) ? created : [];
  }

  let milestones = bundle.milestones;
  if (!milestones.length) {
    const defaults = defaultMilestones(tender);
    if (defaults.length) {
      const created = await rest('milestones', {
        method: 'POST',
        body: defaults.map((milestone) => ({
          ...milestone,
          organization_id: input.organizationId,
          tracked_tender_id: tracked.id,
          created_by: input.userId,
          reminder_at: milestone.due_at ? new Date(Date.parse(String(milestone.due_at)) - 48 * 60 * 60 * 1000).toISOString() : null,
          export_uid: crypto.randomUUID(),
          metadata: { source: 'sprint4_auto' }
        }))
      });
      milestones = Array.isArray(created) ? created : [];
    }
  }

  await insertAudit(input.req, {
    organization_id: input.organizationId,
    actor_user_id: input.userId,
    action: 'workflow.bootstrap.created',
    resource_type: 'tracked_tender',
    resource_id: tracked.id,
    metadata: {
      tender_id: input.tenderId,
      checklist_id: checklist?.id || null,
      tasks: tasks.length,
      milestones: milestones.length
    }
  });

  const refreshed = await loadBundle(input.organizationId, tracked.id);
  return { tender, tracked, ...refreshed, ics: icsCalendar({ name: tender.title || 'LicitIA', milestones: refreshed.milestones }) };
}

async function updateChecklistItem(input: {
  req: Request;
  organizationId: string;
  userId: string;
  checklistId: string;
  itemId: string;
  patch: Record<string, unknown>;
}) {
  const checklist = first(await rest(
    `document_checklists?organization_id=eq.${input.organizationId}&id=eq.${encodeParam(input.checklistId)}&select=*&limit=1`
  ));
  if (!checklist) throw new Error('Checklist not found');
  const items = Array.isArray(checklist.items) ? checklist.items : [];
  const updatedItems = items.map((item: Record<string, unknown>) => {
    if (String(item.id) !== input.itemId) return item;
    return {
      ...item,
      status: input.patch.status || item.status,
      responsible_user_id: input.patch.responsibleUserId ?? item.responsible_user_id ?? null,
      due_at: input.patch.dueAt ?? item.due_at ?? null,
      history: [
        ...(Array.isArray(item.history) ? item.history : []),
        { at: now(), action: 'updated', actor_user_id: input.userId, patch: input.patch }
      ]
    };
  });
  const history = [
    ...(Array.isArray(checklist.history) ? checklist.history : []),
    { at: now(), action: 'item_updated', actor_user_id: input.userId, item_id: input.itemId }
  ];
  const updated = first(await rest(`document_checklists?id=eq.${input.checklistId}`, {
    method: 'PATCH',
    body: { items: updatedItems, history },
    prefer: 'return=representation'
  }));
  await insertAudit(input.req, {
    organization_id: input.organizationId,
    actor_user_id: input.userId,
    action: 'checklist.item.updated',
    resource_type: 'document_checklist',
    resource_id: input.checklistId,
    metadata: { item_id: input.itemId, patch: input.patch }
  });
  return updated;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return jsonResponse(req, { ok: true });
  if (req.method !== 'POST') return jsonResponse(req, { error: 'Method not allowed' }, 405);
  if (!hasServiceConfig()) return jsonResponse(req, { error: 'Backend not configured' }, 503);

  try {
    const { user, organizationId } = await requireActiveMembership(req);
    const payload = await req.json().catch(() => ({}));
    const action = String(payload.action || 'bootstrap');

    if (action === 'updateChecklistItem') {
      const checklist = await updateChecklistItem({
        req,
        organizationId,
        userId: user.id,
        checklistId: String(payload.checklistId || ''),
        itemId: String(payload.itemId || ''),
        patch: payload.patch && typeof payload.patch === 'object' ? payload.patch : {}
      });
      return jsonResponse(req, { ok: true, checklist });
    }

    if (action === 'createTask') {
      const trackedTenderId = String(payload.trackedTenderId || '');
      if (!trackedTenderId) throw new Error('trackedTenderId is required');
      const created = first(await rest('tasks', {
        method: 'POST',
        body: {
          organization_id: organizationId,
          tracked_tender_id: trackedTenderId,
          assigned_to: payload.assignedTo || user.id,
          created_by: user.id,
          title: String(payload.title || '').trim(),
          description: payload.description ? String(payload.description) : null,
          status: taskStatuses.has(String(payload.status)) ? String(payload.status) : 'open',
          priority: taskPriorities.has(String(payload.priority)) ? String(payload.priority) : 'normal',
          due_at: payload.dueAt || null,
          metadata: payload.metadata && typeof payload.metadata === 'object' ? payload.metadata : {}
        }
      }));
      return jsonResponse(req, { ok: true, task: created });
    }

    if (action === 'updateTask') {
      const taskId = String(payload.taskId || '');
      if (!taskId) throw new Error('taskId is required');
      const patch: Record<string, unknown> = {};
      if (taskStatuses.has(String(payload.status))) {
        patch.status = String(payload.status);
        patch.completed_at = payload.status === 'done' ? now() : null;
      }
      if (taskPriorities.has(String(payload.priority))) patch.priority = String(payload.priority);
      if (payload.assignedTo) patch.assigned_to = payload.assignedTo;
      if (payload.dueAt !== undefined) patch.due_at = payload.dueAt || null;
      const updated = first(await rest(`tasks?organization_id=eq.${organizationId}&id=eq.${encodeParam(taskId)}`, {
        method: 'PATCH',
        body: patch,
        prefer: 'return=representation'
      }));
      if (payload.comment) {
        await rest('task_comments', {
          method: 'POST',
          body: {
            organization_id: organizationId,
            task_id: taskId,
            author_user_id: user.id,
            body: String(payload.comment)
          },
          prefer: 'return=minimal'
        });
      }
      return jsonResponse(req, { ok: true, task: updated });
    }

    if (action === 'createMilestone') {
      const trackedTenderId = String(payload.trackedTenderId || '');
      if (!trackedTenderId) throw new Error('trackedTenderId is required');
      const created = first(await rest('milestones', {
        method: 'POST',
        body: {
          organization_id: organizationId,
          tracked_tender_id: trackedTenderId,
          title: String(payload.title || '').trim(),
          milestone_type: payload.milestoneType || 'internal',
          due_at: payload.dueAt,
          source: 'manual',
          created_by: user.id,
          reminder_at: payload.reminderAt || null,
          export_uid: crypto.randomUUID(),
          metadata: payload.metadata && typeof payload.metadata === 'object' ? payload.metadata : {}
        }
      }));
      return jsonResponse(req, { ok: true, milestone: created });
    }

    const tenderId = String(payload.tenderId || '').trim();
    if (!tenderId) throw new Error('tenderId is required');
    const bundle = await bootstrapWorkflow({
      req,
      organizationId,
      tenderId,
      userId: user.id,
      aiRunId: payload.aiRunId ? String(payload.aiRunId) : null
    });
    return jsonResponse(req, { ok: true, ...bundle });
  } catch (error) {
    return jsonResponse(req, { error: error instanceof Error ? error.message : 'Unexpected error' }, 400);
  }
});
