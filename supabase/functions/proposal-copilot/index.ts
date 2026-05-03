import { callOpenAiJson } from '../_shared/ai.ts';
import { jsonResponse } from '../_shared/cors.ts';
import { createDocxBase64 } from '../_shared/exports.ts';
import { encodeParam, hasServiceConfig, insertAudit, requireActiveMembership, rest } from '../_shared/service.ts';

function first<T>(value: T[] | T | null): T | null {
  return Array.isArray(value) ? (value[0] || null) : value;
}

function text(value: unknown) {
  return String(value || '').trim();
}

function join(value: unknown) {
  return Array.isArray(value) ? value.filter(Boolean).join(', ') : text(value);
}

function money(cents: unknown) {
  const value = Number(cents || 0);
  if (!value) return 'no informado';
  return `${Math.round(value / 100).toLocaleString('es-ES')} EUR`;
}

const GPT_MODELS = ['gpt-5.5', 'gpt-5.4', 'gpt-5.4-mini'];

function normalizeGptModel(value: unknown) {
  const model = text(value);
  if (GPT_MODELS.includes(model)) return model;
  const envModel = Deno.env.get('OPENAI_MODEL') || '';
  return GPT_MODELS.includes(envModel) ? envModel : 'gpt-5.5';
}

function userOpenAiApiKey(value: unknown) {
  const apiKey = text(value);
  return apiKey || undefined;
}

async function visibleTender(tenderId: string, organizationId: string) {
  const tender = first(await rest(`tenders?id=eq.${encodeParam(tenderId)}&select=*&limit=1`));
  if (!tender) throw new Error('Tender not found');
  if (tender.organization_id && tender.organization_id !== organizationId) throw new Error('Tender is not visible for this organization');
  return tender;
}

async function trackedForTender(organizationId: string, tenderId: string, userId: string) {
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
      notes: 'Expediente activado para propuesta Sprint 5'
    }
  }));
}

function proposalDepth(input: {
  tender: Record<string, unknown>;
  documents: Array<Record<string, unknown>>;
}) {
  const documentSignal = Math.max(input.documents.length, Number(input.tender.document_count || 0));
  const amount = Number(input.tender.base_budget_cents || input.tender.estimated_value_cents || 0) / 100;
  if (documentSignal >= 6 || amount >= 2_500_000) return 'alta';
  if (documentSignal >= 2 || amount >= 300_000) return 'media';
  return 'base';
}

function documentLines(documents: Array<Record<string, unknown>>, tender: Record<string, unknown>) {
  if (documents.length) {
    return documents.slice(0, 12).map((doc, index) => {
      const title = text(doc.title) || `Documento oficial ${index + 1}`;
      const type = text(doc.document_type) || 'documento oficial';
      const url = text(doc.official_url) || text(doc.storage_path) || 'referencia interna';
      return `- ${title} (${type}): ${url}`;
    });
  }
  return [`- Enlace oficial de la licitacion: ${text(tender.official_url) || 'no informado'}`];
}

function deterministicProposal(input: {
  tender: Record<string, unknown>;
  profile: Record<string, unknown> | null;
  documents: Array<Record<string, unknown>>;
}) {
  const tender = input.tender;
  const profile = input.profile || {};
  const depth = proposalDepth({ tender, documents: input.documents });
  const entity = text(tender.contracting_body) || 'el organo de contratacion';
  const title = text(tender.title) || 'Licitacion';
  const budget = money(tender.base_budget_cents || tender.estimated_value_cents);
  const deadline = text(tender.submission_deadline) || 'no informado';
  const cpv = join(tender.cpv_codes) || 'no informado';
  const serviceDescription = text(profile.services_description) || 'Pendiente de completar la descripcion de servicios, metodologia, equipo y medios tecnicos propios.';
  const pending = [
    !input.documents.length ? 'Revisar pliegos completos y anexos oficiales.' : '',
    !profile.legal_name ? 'Completar razon social y datos de empresa.' : '',
    !profile.services_description ? 'Completar descripcion de servicios y referencias.' : '',
    (!Array.isArray(profile.certifications) || !profile.certifications.length) ? 'Confirmar certificaciones y acreditaciones aplicables.' : ''
  ].filter(Boolean);
  const depthLines = depth === 'alta'
    ? [
      'La propuesta se desarrolla con nivel alto de detalle por volumen documental o importe relevante.',
      'Cada bloque debe revisarse contra el PCAP, PPT y anexos antes de presentacion.'
    ]
    : depth === 'media'
      ? [
        'La propuesta se desarrolla con detalle medio, suficiente para revision tecnica inicial.',
        'Los apartados sensibles quedan marcados para contraste con pliegos.'
      ]
      : [
        'La propuesta se mantiene prudente porque la informacion disponible es limitada.',
        'Se evita inventar requisitos, solvencia, medios o compromisos no confirmados.'
      ];

  return [
    `# Propuesta tecnica - ${title}`,
    '',
    '## 1. Portada y datos de control',
    `Entidad licitadora: ${text(profile.legal_name) || 'pendiente de completar'}.`,
    `Organo de contratacion: ${entity}.`,
    `Presupuesto o valor estimado de referencia: ${budget}.`,
    `Plazo limite de presentacion: ${deadline}.`,
    `CPV detectado: ${cpv}.`,
    `Procedimiento: ${text(tender.procedure_type) || 'no informado'}.`,
    '',
    '## 2. Resumen ejecutivo',
    `Esta propuesta plantea una respuesta tecnica para ${entity} sobre el expediente "${title}". El objetivo es presentar una oferta clara, trazable y defendible, alineada con los datos oficiales disponibles y preparada para revision humana antes de presentacion.`,
    ...depthLines,
    '',
    '## 3. Comprension del contrato',
    `Objeto detectado: ${title}.`,
    `Tipo de contrato: ${text(tender.contract_type) || 'no informado'}. Ambito territorial: ${text(tender.region) || text(tender.country) || 'no informado'}.`,
    'Lectura inicial del encargo:',
    '- Confirmar alcance exacto, lotes, criterios de adjudicacion y documentacion administrativa contra los pliegos.',
    '- Separar compromisos tecnicos verificables de supuestos pendientes.',
    '- Alinear la memoria tecnica con solvencia, medios, experiencia y restricciones de presentacion.',
    '',
    '## 4. Enfoque tecnico propuesto',
    serviceDescription,
    '',
    'El enfoque recomendado se estructura en cuatro capas:',
    '- Direccion del servicio: interlocucion unica, plan de arranque, seguimiento y reporting.',
    '- Ejecucion tecnica: metodologia, entregables, controles de calidad y gestion de incidencias.',
    '- Cumplimiento documental: matriz de requisitos, evidencias, firmas y control de versiones.',
    '- Mejora continua: medicion de resultados, acciones correctoras y cierre ordenado.',
    '',
    '## 5. Plan de trabajo',
    '| Fase | Objetivo | Entregables | Control |',
    '| --- | --- | --- | --- |',
    '| Arranque | Validar alcance, requisitos y responsables | Acta de inicio, plan de trabajo, matriz de riesgos | Reuniones de lanzamiento y aprobacion |',
    '| Ejecucion | Desarrollar el servicio segun pliego | Entregables tecnicos, informes de avance, evidencias | Seguimiento de KPIs y control documental |',
    '| Calidad | Verificar cumplimiento y trazabilidad | Checklist de calidad, incidencias, medidas correctoras | Revision interna y validacion con responsable |',
    '| Cierre | Consolidar resultados y documentacion | Informe final, inventario documental, lecciones aprendidas | Aprobacion de cierre |',
    '',
    '## 6. Equipo, experiencia y solvencia',
    `Experiencia declarada: ${text(profile.years_experience) || 'no informada'} anos.`,
    `Certificaciones indicadas: ${join(profile.certifications) || 'no informadas'}.`,
    'Propuesta de organizacion:',
    '- Responsable de contrato: seguimiento, coordinacion y relacion con el organo de contratacion.',
    '- Responsable tecnico: definicion metodologica, supervision de entregables y control de calidad.',
    '- Equipo operativo: ejecucion de tareas, documentacion de evidencias y escalado de incidencias.',
    '- Soporte administrativo: preparacion de documentacion, control de plazos y archivo.',
    '',
    '## 7. Calidad, seguimiento y gobierno',
    'La propuesta incorpora un modelo de gobierno orientado a reducir riesgo de incumplimiento:',
    '- Reunion de arranque para fijar alcance, responsables, calendario y canales de comunicacion.',
    '- Cuadro de seguimiento con tareas, hitos, riesgos, entregables y estado documental.',
    '- Control de versiones sobre la documentacion entregada.',
    '- Revision previa de requisitos criticos antes de cualquier entrega formal.',
    '- Registro de incidencias y decisiones para dejar trazabilidad operativa.',
    '',
    '## 8. Riesgos y controles',
    '| Riesgo | Impacto | Control propuesto |',
    '| --- | --- | --- |',
    '| Requisito del pliego no identificado | Exclusion o baja puntuacion | Matriz de cumplimiento PCAP/PPT antes de entrega |',
    '| Solvencia no acreditada | Riesgo administrativo | Validacion documental y evidencias antes de presentacion |',
    '| Alcance tecnico ambiguo | Desviaciones en ejecucion | Acta de arranque y confirmacion de entregables |',
    '| Plazo ajustado | Riesgo de calidad | Planificacion inversa desde la fecha limite |',
    '| Dependencias externas | Retrasos o incumplimientos | Responsable asignado y plan de contingencia |',
    '',
    '## 9. Matriz inicial de cumplimiento',
    '| Bloque | Estado | Accion recomendada |',
    '| --- | --- | --- |',
    `| Datos de licitacion | Parcial | Revisar expediente oficial y anexos de ${entity} |`,
    `| Documentacion oficial | ${input.documents.length ? 'Localizada' : 'Pendiente'} | Verificar pliegos, anuncios, anexos y rectificaciones |`,
    `| Solvencia | ${profile.legal_name ? 'Pendiente de contraste' : 'Sin datos suficientes'} | Cruzar perfil de empresa con requisitos PCAP |`,
    '| Oferta tecnica | Borrador inicial | Adaptar lenguaje y compromisos al PPT |',
    '| Oferta economica | No generada | Preparar escenario economico separado y validado |',
    '',
    '## 10. Datos pendientes antes de presentar',
    ...(pending.length ? pending.map((item) => `- ${item}`) : ['- Sin pendientes criticos detectados en los datos normalizados.']),
    '',
    '## 11. Fuentes utilizadas',
    ...documentLines(input.documents, tender)
  ].join('\n');
}

async function ensureProject(input: {
  organizationId: string;
  userId: string;
  tender: Record<string, unknown>;
  tracked: Record<string, unknown>;
  aiRunId?: string | null;
}) {
  const existing = first(await rest(
    `proposal_projects?organization_id=eq.${input.organizationId}&tracked_tender_id=eq.${input.tracked.id}&select=*&order=created_at.desc&limit=1`
  ));
  if (existing) return existing;
  return first(await rest('proposal_projects', {
    method: 'POST',
    body: {
      organization_id: input.organizationId,
      tracked_tender_id: input.tracked.id,
      tender_id: input.tender.id,
      title: `Propuesta - ${String(input.tender.title || 'licitacion').slice(0, 110)}`,
      status: 'draft',
      created_by: input.userId,
      source_ai_run_id: input.aiRunId || null,
      metadata: { source: 'proposal-copilot' }
    }
  }));
}

async function nextVersion(projectId: string) {
  const rows = await rest(`proposal_versions?proposal_project_id=eq.${projectId}&select=version_number&order=version_number.desc&limit=1`);
  const current = first(rows);
  return Number(current?.version_number || 0) + 1;
}

async function insertAiRun(input: {
  organizationId: string;
  userId: string;
  tenderId: string;
  model: string;
  output: unknown;
  usage: Record<string, unknown>;
  success: boolean;
  errorMessage?: string | null;
}) {
  return first(await rest('ai_runs', {
    method: 'POST',
    body: {
      organization_id: input.organizationId,
      actor_user_id: input.userId,
      use_case: 'proposal_copilot',
      endpoint: 'proposal-copilot',
      model: input.model,
      prompt_version: 'sprint5.proposal.v2',
      input_refs: { tender_id: input.tenderId },
      output: input.output,
      citations: [],
      token_usage: input.usage,
      status: input.success ? 'succeeded' : 'failed',
      success: input.success,
      error_message: input.errorMessage || null
    }
  }));
}

async function exportVersion(req: Request, organizationId: string, userId: string, proposalVersionId: string) {
  const version = first(await rest(`proposal_versions?id=eq.${encodeParam(proposalVersionId)}&organization_id=eq.${organizationId}&select=*&limit=1`));
  if (!version) throw new Error('Proposal version not found');
  const project = first(await rest(`proposal_projects?id=eq.${version.proposal_project_id}&organization_id=eq.${organizationId}&select=*&limit=1`));
  const filename = `licitia-propuesta-v${version.version_number}.docx`;
  const base64 = createDocxBase64({
    title: project?.title || 'Propuesta LicitIA',
    markdown: version.content_markdown
  });
  const exportJob = first(await rest('export_jobs', {
    method: 'POST',
    body: {
      organization_id: organizationId,
      created_by: userId,
      proposal_version_id: proposalVersionId,
      export_type: 'docx',
      status: 'succeeded',
      filename,
      metadata: { generated_inline: true, version_number: version.version_number }
    }
  }));
  await rest(`proposal_versions?id=eq.${version.id}`, {
    method: 'PATCH',
    body: {
      export_metadata: {
        ...(version.export_metadata || {}),
        latest_docx_export_job_id: exportJob?.id || null,
        latest_docx_exported_at: new Date().toISOString()
      }
    },
    prefer: 'return=minimal'
  });
  await insertAudit(req, {
    organization_id: organizationId,
    actor_user_id: userId,
    action: 'proposal.exported.docx',
    resource_type: 'proposal_version',
    resource_id: proposalVersionId,
    metadata: { filename, export_job_id: exportJob?.id || null }
  });
  return { filename, mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', base64, exportJobId: exportJob?.id || null };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return jsonResponse(req, { ok: true });
  if (req.method !== 'POST') return jsonResponse(req, { error: 'Method not allowed' }, 405);
  if (!hasServiceConfig()) return jsonResponse(req, { error: 'Backend not configured' }, 503);

  try {
    const { user, organizationId } = await requireActiveMembership(req);
    const payload = await req.json().catch(() => ({}));
    const action = String(payload.action || 'draft');
    if (action === 'export') {
      const exportData = await exportVersion(req, organizationId, user.id, String(payload.proposalVersionId || ''));
      return jsonResponse(req, { ok: true, export: exportData });
    }

    const tenderId = String(payload.tenderId || '').trim();
    if (!tenderId) throw new Error('tenderId is required');
    const [tender, profileRows, documents] = await Promise.all([
      visibleTender(tenderId, organizationId),
      rest(`company_profiles?organization_id=eq.${organizationId}&select=*&limit=1`),
      rest(`tender_documents?tender_id=eq.${encodeParam(tenderId)}&select=*&order=created_at.desc&limit=20`)
    ]);
    const profile = first(profileRows);
    const documentRows = Array.isArray(documents) ? documents : [];
    let markdown = deterministicProposal({ tender, profile, documents: documentRows });
    const requestedModel = normalizeGptModel(payload.openaiModel);
    const apiKey = userOpenAiApiKey(payload.openaiApiKey);
    const depth = proposalDepth({ tender, documents: documentRows });
    let model = 'deterministic-proposal-v2';
    let usage: Record<string, unknown> = {};
    let success = true;
    let warning: string | null = null;

    try {
      const ai = await callOpenAiJson({
        system: [
          'Eres LicitIA, un copiloto experto en licitacion publica espanola.',
          'Genera propuestas tecnicas profesionales, extensas, editables y trazables.',
          'No inventes solvencia, certificaciones, experiencia, requisitos ni datos economicos.',
          'Si falta informacion del pliego, marca el dato como pendiente y plantea una accion de revision.'
        ].join(' '),
        prompt: JSON.stringify({
          generation_rules: {
            language: 'es-ES',
            tone: 'corporativo, claro y sobrio',
            depth,
            expected_extension: depth === 'alta'
              ? 'propuesta larga, 3500-5000 palabras si el contexto lo permite'
              : depth === 'media'
                ? 'propuesta media-larga, 2200-3200 palabras si el contexto lo permite'
                : 'propuesta prudente, 1400-2200 palabras si el contexto lo permite',
            mandatory_sections: [
              'Portada y datos de control',
              'Resumen ejecutivo',
              'Comprension del contrato',
              'Enfoque tecnico propuesto',
              'Plan de trabajo',
              'Equipo, experiencia y solvencia',
              'Calidad, seguimiento y gobierno',
              'Riesgos y controles',
              'Matriz de cumplimiento',
              'Datos pendientes',
              'Fuentes utilizadas'
            ],
            use_markdown_tables: true,
            cite_official_sources: true
          },
          tender,
          profile,
          documents: documentRows,
          professional_base: markdown
        }),
        schemaName: 'licitia_proposal_draft',
        schema: {
          type: 'object',
          additionalProperties: false,
          required: ['markdown', 'pending_data'],
          properties: {
            markdown: { type: 'string' },
            pending_data: { type: 'array', items: { type: 'string' } }
          }
        },
        model: requestedModel,
        apiKey,
        maxOutputTokens: depth === 'alta' ? 10000 : 8000
      });
      if (ai?.parsed?.markdown) {
        const aiMarkdown = String(ai.parsed.markdown).trim();
        if (aiMarkdown.length >= 3200 || aiMarkdown.length >= markdown.length * 0.75) {
          markdown = aiMarkdown;
        } else {
          warning = 'La IA devolvio un borrador demasiado corto; se uso la base profesional ampliada.';
        }
        model = ai.model;
        usage = ai.usage || {};
      }
    } catch (error) {
      success = false;
      warning = error instanceof Error ? error.message : 'AI proposal fallback';
    }

    const aiRun = await insertAiRun({
      organizationId,
      userId: user.id,
      tenderId,
      model,
      output: { markdown, warning },
      usage,
      success,
      errorMessage: warning
    });
    const tracked = await trackedForTender(organizationId, tenderId, user.id);
    const project = await ensureProject({ organizationId, userId: user.id, tender, tracked, aiRunId: aiRun?.id || null });
    const versionNumber = await nextVersion(project.id);
    const version = first(await rest('proposal_versions', {
      method: 'POST',
      body: {
        organization_id: organizationId,
        proposal_project_id: project.id,
        version_number: versionNumber,
        content_markdown: markdown,
        ai_run_id: aiRun?.id || null,
        created_by: user.id,
        format: 'markdown',
        metadata: { source: 'proposal-copilot', warning }
      }
    }));

    await insertAudit(req, {
      organization_id: organizationId,
      actor_user_id: user.id,
      action: 'proposal.draft.created',
      resource_type: 'proposal_version',
      resource_id: version?.id || null,
      metadata: { tender_id: tenderId, proposal_project_id: project.id, version_number: versionNumber, model }
    });

    return jsonResponse(req, { ok: true, project, version, markdown, warning });
  } catch (error) {
    return jsonResponse(req, { error: error instanceof Error ? error.message : 'Unexpected error' }, 400);
  }
});
