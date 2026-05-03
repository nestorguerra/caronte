import { csv } from './service.ts';
import { territorialMatches } from './territory.ts';

export type ScoreFactor = {
  code: string;
  label: string;
  score: number;
  weight: number;
  explanation: string;
  evidence: Array<{
    source: string;
    value: string;
  }>;
};

export type ExplainableScore = {
  total: number;
  recommendation: 'go' | 'review' | 'no_go';
  confidence: number;
  factors: ScoreFactor[];
  generated_at: string;
};

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function text(value: unknown) {
  return String(value || '').trim();
}

function array(value: unknown) {
  return Array.isArray(value) ? value.map(String).filter(Boolean) : csv(value);
}

function factor(code: string, label: string, score: number, weight: number, explanation: string, evidence: ScoreFactor['evidence']): ScoreFactor {
  return { code, label, score: clamp(score), weight, explanation, evidence };
}

function startsWithAny(values: string[], targets: string[], digits = 4) {
  return values.some((value) => targets.some((target) => value.slice(0, digits) && value.slice(0, digits) === target.slice(0, digits)));
}

function amountScore(amount: number, min: number, max: number) {
  if (!amount || (!min && !max)) return 55;
  if (min && amount < min) return clamp(65 - ((min - amount) / min) * 45);
  if (max && amount > max) return clamp(70 - ((amount - max) / max) * 50);
  return 90;
}

function deadlineScore(value: unknown) {
  const deadline = Date.parse(text(value));
  if (!deadline) return 45;
  const days = Math.ceil((deadline - Date.now()) / (24 * 60 * 60 * 1000));
  if (days < 0) return 0;
  if (days <= 3) return 20;
  if (days <= 10) return 55;
  if (days <= 30) return 85;
  return 75;
}

function recommendation(total: number): ExplainableScore['recommendation'] {
  if (total >= 72) return 'go';
  if (total <= 42) return 'no_go';
  return 'review';
}

export function explainTenderScore(input: {
  tender: Record<string, unknown>;
  profile?: Record<string, unknown> | null;
  documents?: Array<Record<string, unknown>>;
  historicalSignals?: Record<string, unknown> | null;
}): ExplainableScore {
  const tender = input.tender;
  const profile = input.profile || {};
  const documents = input.documents || [];
  const tenderCpvs = array(tender.cpv_codes);
  const targetCpvs = array(profile.target_cpvs);
  const regions = array(profile.operating_regions).map((item) => item.toLowerCase());
  const tenderRegion = text(tender.region).toLowerCase();
  const amount = Number(tender.base_budget_cents || tender.estimated_value_cents || 0);
  const minAmount = Number(profile.min_contract_value_cents || 0);
  const maxAmount = Number(profile.max_contract_value_cents || 0);
  const certifications = array(profile.certifications);
  const services = text(profile.services_description).toLowerCase();
  const title = `${text(tender.title)} ${text(tender.contracting_body)}`.toLowerCase();
  const rawPayload = JSON.stringify(tender.raw_payload || {}).toLowerCase();

  const cpvMatch = targetCpvs.length && tenderCpvs.length ? startsWithAny(tenderCpvs, targetCpvs) : false;
  const territoryMatch = !regions.length || !tenderRegion ? false : regions.some((region) => territorialMatches(tenderRegion, region));
  const serviceWords = services.split(/\W+/).filter((word) => word.length > 4).slice(0, 14);
  const serviceHits = serviceWords.filter((word) => title.includes(word)).length;
  const hasDocs = documents.length > 0 || Number(tender.document_count || 0) > 0;
  const deadline = deadlineScore(tender.submission_deadline);
  const docRisk = hasDocs ? 78 : 35;
  const solvencySignals = `${rawPayload} ${title}`;
  const asksEconomicSolvency = /solvencia econom|volumen anual|patrimonio neto|seguro de responsabilidad/.test(solvencySignals);
  const asksTechnicalSolvency = /solvencia tecnica|trabajos realizados|equipo tecnico|experiencia/.test(solvencySignals);
  const asksCertifications = /iso|ens|certificaci|acreditaci/.test(solvencySignals);

  const factors: ScoreFactor[] = [
    factor(
      'cpv_service',
      'Encaje CPV/servicio',
      cpvMatch ? 92 : serviceHits ? 68 + serviceHits * 4 : targetCpvs.length ? 35 : 55,
      18,
      cpvMatch ? 'El CPV de la licitacion coincide con los CPV objetivo del perfil.' : 'No hay coincidencia CPV clara; se usa coincidencia textual de servicios.',
      [
        { source: 'tender.cpv_codes', value: tenderCpvs.join(', ') || 'No informado' },
        { source: 'company_profile.target_cpvs', value: targetCpvs.join(', ') || 'No informado' }
      ]
    ),
    factor(
      'territory',
      'Territorio',
      territoryMatch ? 90 : regions.length ? 45 : 55,
      9,
      territoryMatch ? 'El ambito geografico objetivo cubre la licitacion.' : 'No hay coincidencia territorial suficiente en los datos normalizados.',
      [
        { source: 'tender.region', value: text(tender.region) || 'No informado' },
        { source: 'company_profile.operating_regions', value: regions.join(', ') || 'No informado' }
      ]
    ),
    factor(
      'amount',
      'Importe',
      amountScore(amount, minAmount, maxAmount),
      11,
      amount ? 'El importe se compara con el rango objetivo de la empresa.' : 'No hay importe normalizado; se reduce la confianza.',
      [
        { source: 'tender.amount', value: amount ? `${Math.round(amount / 100)} EUR` : 'No informado' },
        { source: 'company_profile.amount_range', value: `${minAmount ? Math.round(minAmount / 100) : '-'} / ${maxAmount ? Math.round(maxAmount / 100) : '-'} EUR` }
      ]
    ),
    factor(
      'economic_solvency',
      'Solvencia economica',
      asksEconomicSolvency ? 58 : 72,
      9,
      asksEconomicSolvency ? 'La fuente menciona requisitos economicos; conviene validarlos contra cuentas y seguros.' : 'No se detectan requisitos economicos explicitos en los datos disponibles.',
      [{ source: 'official_extract', value: asksEconomicSolvency ? 'Mencion detectada' : 'No encontrado' }]
    ),
    factor(
      'technical_solvency',
      'Solvencia tecnica',
      asksTechnicalSolvency ? 62 : 76,
      10,
      asksTechnicalSolvency ? 'La fuente menciona solvencia tecnica o experiencia; requiere revision.' : 'No se detectan requisitos tecnicos criticos en el extracto.',
      [{ source: 'official_extract', value: asksTechnicalSolvency ? 'Mencion detectada' : 'No encontrado' }]
    ),
    factor(
      'certifications',
      'Certificaciones',
      asksCertifications ? (certifications.length ? 78 : 42) : 70,
      8,
      asksCertifications ? 'La fuente menciona certificaciones; se compara con las certificaciones del perfil.' : 'No se detecta exigencia de certificaciones en los datos disponibles.',
      [{ source: 'company_profile.certifications', value: certifications.join(', ') || 'No informado' }]
    ),
    factor(
      'experience',
      'Experiencia',
      Number(profile.years_experience || 0) >= 3 ? 80 : asksTechnicalSolvency ? 48 : 62,
      8,
      'Se estima con los anos de experiencia del perfil y las menciones de solvencia tecnica.',
      [{ source: 'company_profile.years_experience', value: text(profile.years_experience) || 'No informado' }]
    ),
    factor(
      'deadline',
      'Plazo restante',
      deadline,
      11,
      deadline >= 80 ? 'El plazo permite preparar candidatura con margen.' : deadline <= 25 ? 'El plazo es muy ajustado o vencido.' : 'El plazo exige planificacion inmediata.',
      [{ source: 'tender.submission_deadline', value: text(tender.submission_deadline) || 'No informado' }]
    ),
    factor(
      'historical_competition',
      'Competencia historica',
      Number(input.historicalSignals?.competition_score || 0) || 50,
      7,
      'Todavia no hay historico competitivo normalizado suficiente; factor neutral hasta Sprint 5.',
      [{ source: 'historical_awards', value: input.historicalSignals ? 'Disponible parcial' : 'No disponible' }]
    ),
    factor(
      'document_risk',
      'Riesgo documental',
      docRisk,
      9,
      hasDocs ? 'Existen documentos/enlaces oficiales para revisar evidencia.' : 'No hay documentos oficiales asociados; alto riesgo documental.',
      [{ source: 'tender_documents', value: `${documents.length || Number(tender.document_count || 0)} documentos/enlaces` }]
    )
  ];

  const weighted = factors.reduce((acc, item) => acc + item.score * item.weight, 0);
  const totalWeight = factors.reduce((acc, item) => acc + item.weight, 0);
  const total = clamp(weighted / totalWeight);
  const evidenceCount = factors.flatMap((item) => item.evidence).filter((item) => item.value && item.value !== 'No informado').length;

  return {
    total,
    recommendation: recommendation(total),
    confidence: clamp(42 + evidenceCount * 4),
    factors,
    generated_at: new Date().toISOString()
  };
}
