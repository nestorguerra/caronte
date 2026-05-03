import { jsonResponse } from '../_shared/cors.ts';
import { createZipBase64 } from '../_shared/exports.ts';
import { encodeParam, hasServiceConfig, insertAudit, requireActiveMembership, rest } from '../_shared/service.ts';

function first<T>(value: T[] | T | null): T | null {
  return Array.isArray(value) ? (value[0] || null) : value;
}

async function ensureTracked(organizationId: string, userId: string, tenderId: string) {
  const existing = first(await rest(`tracked_tenders?organization_id=eq.${organizationId}&tender_id=eq.${encodeParam(tenderId)}&select=*&limit=1`));
  if (existing) return existing;
  return first(await rest('tracked_tenders', {
    method: 'POST',
    body: {
      organization_id: organizationId,
      tender_id: tenderId,
      owner_user_id: userId,
      internal_status: 'preparing',
      priority: 'normal',
      notes: 'Dossier Sprint 5'
    }
  }));
}

async function bundle(organizationId: string, dossierId: string) {
  const [dossier, items, docs] = await Promise.all([
    rest(`dossier_packages?id=eq.${encodeParam(dossierId)}&organization_id=eq.${organizationId}&select=*&limit=1`),
    rest(`dossier_items?dossier_package_id=eq.${encodeParam(dossierId)}&organization_id=eq.${organizationId}&select=*&order=sort_order.asc,created_at.asc`),
    rest(`document_library?organization_id=eq.${organizationId}&select=*&order=updated_at.desc&limit=100`)
  ]);
  return {
    dossier: first(dossier),
    items: Array.isArray(items) ? items : [],
    documents: Array.isArray(docs) ? docs : []
  };
}

function completeness(items: Array<Record<string, unknown>>) {
  const required = items.filter((item) => item.required !== false);
  if (!required.length) return 100;
  const attached = required.filter((item) => ['attached', 'not_applicable'].includes(String(item.status)));
  return Math.round((attached.length / required.length) * 100);
}

async function prepare(req: Request, organizationId: string, userId: string, tenderId: string) {
  if (!tenderId) throw new Error('tenderId is required');
  const [tenderRows, officialDocs] = await Promise.all([
    rest(`tenders?id=eq.${encodeParam(tenderId)}&select=*&limit=1`),
    rest(`tender_documents?tender_id=eq.${encodeParam(tenderId)}&select=*&order=created_at.desc&limit=20`)
  ]);
  const tender = first(tenderRows);
  if (!tender) throw new Error('Tender not found');
  if (tender.organization_id && tender.organization_id !== organizationId) throw new Error('Tender is not visible for this organization');
  const tracked = await ensureTracked(organizationId, userId, tenderId);
  let dossier = first(await rest(`dossier_packages?organization_id=eq.${organizationId}&tracked_tender_id=eq.${tracked.id}&select=*&order=created_at.desc&limit=1`));
  if (!dossier) {
    dossier = first(await rest('dossier_packages', {
      method: 'POST',
      body: {
        organization_id: organizationId,
        tracked_tender_id: tracked.id,
        created_by: userId,
        title: `Dossier - ${String(tender.title || 'licitacion').slice(0, 110)}`,
        status: 'draft',
        completeness_score: 0,
        export_metadata: {}
      }
    }));
    const baseItems = [
      ['certificate', 'Certificados administrativos y tributarios'],
      ['solvency', 'Solvencia economica y tecnica'],
      ['technical_memory', 'Memoria tecnica editable'],
      ['power_of_attorney', 'Poderes y representacion'],
      ['insurance', 'Seguro de responsabilidad si aplica']
    ];
    const officialItems = (Array.isArray(officialDocs) ? officialDocs : []).slice(0, 6).map((doc, index) => ({
      organization_id: organizationId,
      dossier_package_id: dossier.id,
      tender_document_id: doc.id,
      item_type: 'official_document',
      title: doc.title || `Documento oficial ${index + 1}`,
      required: false,
      status: 'attached',
      sort_order: index,
      metadata: { official_url: doc.official_url || null }
    }));
    await rest('dossier_items', {
      method: 'POST',
      body: [
        ...baseItems.map(([type, title], index) => ({
          organization_id: organizationId,
          dossier_package_id: dossier.id,
          item_type: 'document',
          title,
          required: true,
          status: 'pending',
          sort_order: index + 10,
          metadata: { document_type: type }
        })),
        ...officialItems
      ],
      prefer: 'return=minimal'
    });
  }
  const data = await bundle(organizationId, dossier.id);
  const score = completeness(data.items);
  await rest(`dossier_packages?id=eq.${dossier.id}`, {
    method: 'PATCH',
    body: { completeness_score: score, status: score >= 80 ? 'ready' : 'draft' },
    prefer: 'return=minimal'
  });
  await insertAudit(req, {
    organization_id: organizationId,
    actor_user_id: userId,
    action: 'dossier.prepared',
    resource_type: 'dossier_package',
    resource_id: dossier.id,
    metadata: { tender_id: tenderId, completeness_score: score }
  });
  return { ...data, tracked, completenessScore: score };
}

async function upsertDocument(req: Request, organizationId: string, userId: string, payload: Record<string, unknown>) {
  const title = String(payload.title || '').trim();
  if (!title) throw new Error('title is required');
  const document = first(await rest('document_library', {
    method: 'POST',
    body: {
      organization_id: organizationId,
      uploaded_by: userId,
      document_type: payload.documentType || 'other',
      title,
      storage_bucket: 'licitia-documents',
      storage_path: payload.storagePath || null,
      version_number: Number(payload.versionNumber || 1),
      content_hash: payload.contentHash || null,
      mime_type: payload.mimeType || null,
      size_bytes: payload.sizeBytes || null,
      expires_at: payload.expiresAt || null,
      metadata: payload.metadata && typeof payload.metadata === 'object' ? payload.metadata : {}
    }
  }));
  await insertAudit(req, {
    organization_id: organizationId,
    actor_user_id: userId,
    action: 'document_library.created',
    resource_type: 'document_library',
    resource_id: document?.id || null,
    metadata: { title, document_type: payload.documentType || 'other' }
  });
  return document;
}

async function exportDossier(req: Request, organizationId: string, userId: string, dossierId: string) {
  const data = await bundle(organizationId, dossierId);
  if (!data.dossier) throw new Error('Dossier not found');
  const manifest = {
    exported_at: new Date().toISOString(),
    dossier: data.dossier,
    items: data.items,
    documents: data.documents
  };
  const zipBase64 = createZipBase64([
    { path: 'manifest.json', content: JSON.stringify(manifest, null, 2) },
    { path: 'checklist.csv', content: ['title;status;required', ...data.items.map((item) => `${item.title};${item.status};${item.required}`)].join('\n') },
    { path: 'README.txt', content: 'Export Sprint 5 LicitIA. Este ZIP contiene manifiesto, checklist y referencias documentales. Los binarios privados se mantienen en Supabase Storage.' }
  ]);
  const filename = `licitia-dossier-${String(data.dossier.id).slice(0, 8)}.zip`;
  const exportJob = first(await rest('export_jobs', {
    method: 'POST',
    body: {
      organization_id: organizationId,
      created_by: userId,
      dossier_package_id: dossierId,
      export_type: 'zip',
      status: 'succeeded',
      filename,
      metadata: { generated_inline: true, item_count: data.items.length }
    }
  }));
  await rest(`dossier_packages?id=eq.${dossierId}`, {
    method: 'PATCH',
    body: {
      status: 'exported',
      export_metadata: { latest_export_job_id: exportJob?.id || null, latest_exported_at: new Date().toISOString() }
    },
    prefer: 'return=minimal'
  });
  await insertAudit(req, {
    organization_id: organizationId,
    actor_user_id: userId,
    action: 'dossier.exported.zip',
    resource_type: 'dossier_package',
    resource_id: dossierId,
    metadata: { filename, export_job_id: exportJob?.id || null }
  });
  return { filename, mimeType: 'application/zip', base64: zipBase64, exportJobId: exportJob?.id || null };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return jsonResponse(req, { ok: true });
  if (req.method !== 'POST') return jsonResponse(req, { error: 'Method not allowed' }, 405);
  if (!hasServiceConfig()) return jsonResponse(req, { error: 'Backend not configured' }, 503);

  try {
    const { user, organizationId } = await requireActiveMembership(req);
    const payload = await req.json().catch(() => ({}));
    const action = String(payload.action || 'prepare');
    if (action === 'upsertDocument') {
      const document = await upsertDocument(req, organizationId, user.id, payload);
      return jsonResponse(req, { ok: true, document });
    }
    if (action === 'export') {
      const exported = await exportDossier(req, organizationId, user.id, String(payload.dossierId || ''));
      return jsonResponse(req, { ok: true, export: exported });
    }
    if (action === 'list') {
      const docs = await rest(`document_library?organization_id=eq.${organizationId}&select=*&order=updated_at.desc&limit=100`);
      const dossiers = await rest(`dossier_packages?organization_id=eq.${organizationId}&select=*&order=updated_at.desc&limit=30`);
      return jsonResponse(req, { ok: true, documents: Array.isArray(docs) ? docs : [], dossiers: Array.isArray(dossiers) ? dossiers : [] });
    }
    const data = await prepare(req, organizationId, user.id, String(payload.tenderId || ''));
    return jsonResponse(req, { ok: true, ...data });
  } catch (error) {
    return jsonResponse(req, { error: error instanceof Error ? error.message : 'Unexpected error' }, 400);
  }
});
