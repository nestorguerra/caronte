export function defaultChecklistItems(input: {
  tender: Record<string, unknown>;
  documents: Array<Record<string, unknown>>;
}) {
  const deadline = String(input.tender.submission_deadline || '');
  const sourceUrl = String(input.tender.official_url || input.tender.source_url || '');
  const source = input.documents[0]?.official_url || sourceUrl || 'normalizacion_oficial';
  return [
    ['administrative', 'Validar pliegos administrativos y condiciones de presentacion'],
    ['economic_solvency', 'Comprobar solvencia economica y seguros exigidos'],
    ['technical_solvency', 'Comprobar solvencia tecnica, referencias y equipo'],
    ['technical_offer', 'Preparar memoria tecnica contra criterios de adjudicacion'],
    ['economic_offer', 'Preparar oferta economica y revisar limites de baja'],
    ['declarations', 'Preparar declaraciones responsables, DEUC y certificados'],
    ['submission', 'Revisar firma electronica, formato y portal de presentacion']
  ].map(([code, title], index) => ({
    id: `${code}-${index + 1}`,
    code,
    title,
    status: 'pending',
    responsible_user_id: null,
    due_at: deadline || null,
    source,
    evidence: source ? [{ source: 'official_reference', value: source }] : [],
    history: [{
      at: new Date().toISOString(),
      action: 'created',
      actor: 'system',
      note: 'Item automatico Sprint 4'
    }]
  }));
}

export function defaultMilestones(tender: Record<string, unknown>) {
  const out = [];
  if (tender.submission_deadline) {
    out.push({
      title: 'Fecha limite de presentacion',
      milestone_type: 'submission_deadline',
      due_at: String(tender.submission_deadline),
      source: 'official'
    });
  }
  if (tender.publication_date) {
    out.push({
      title: 'Publicacion oficial',
      milestone_type: 'publication',
      due_at: `${String(tender.publication_date).slice(0, 10)}T09:00:00Z`,
      source: 'official'
    });
  }
  return out;
}

export function icsCalendar(input: {
  name: string;
  milestones: Array<Record<string, unknown>>;
}) {
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//LicitIA//Sprint4//ES',
    `X-WR-CALNAME:${input.name.replace(/\n/g, ' ')}`
  ];
  for (const milestone of input.milestones) {
    const start = new Date(String(milestone.due_at || Date.now())).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
    lines.push(
      'BEGIN:VEVENT',
      `UID:${milestone.id || crypto.randomUUID()}@licitia`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${start}`,
      `SUMMARY:${String(milestone.title || 'Hito LicitIA').replace(/\n/g, ' ')}`,
      `DESCRIPTION:${String(milestone.milestone_type || milestone.source || '').replace(/\n/g, ' ')}`,
      'END:VEVENT'
    );
  }
  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}
