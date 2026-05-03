import type { ExplainableScore } from './scoring.ts';

export type Citation = {
  source: string;
  title: string;
  url?: string | null;
  fragment: string;
};

export type TenderAnalysis = {
  summary: string;
  official_facts: Array<{
    label: string;
    value: string;
    citations: Citation[];
  }>;
  inferred_risks: Array<{
    label: string;
    level: 'low' | 'medium' | 'high';
    reason: string;
    citations: Citation[];
  }>;
  requirements: Array<{
    label: string;
    status: 'found' | 'not_found' | 'inferred';
    detail: string;
    citations: Citation[];
  }>;
  score: ExplainableScore;
};

const citationSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['source', 'title', 'url', 'fragment'],
  properties: {
    source: { type: 'string' },
    title: { type: 'string' },
    url: { type: ['string', 'null'] },
    fragment: { type: 'string' }
  }
};

const scoreEvidenceSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['source', 'value'],
  properties: {
    source: { type: 'string' },
    value: { type: 'string' }
  }
};

const scoreFactorSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['code', 'label', 'score', 'weight', 'explanation', 'evidence'],
  properties: {
    code: { type: 'string' },
    label: { type: 'string' },
    score: { type: 'number' },
    weight: { type: 'number' },
    explanation: { type: 'string' },
    evidence: { type: 'array', items: scoreEvidenceSchema }
  }
};

const scoreSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['total', 'recommendation', 'confidence', 'factors', 'generated_at'],
  properties: {
    total: { type: 'number' },
    recommendation: { type: 'string', enum: ['go', 'review', 'no_go'] },
    confidence: { type: 'number' },
    factors: { type: 'array', items: scoreFactorSchema },
    generated_at: { type: 'string' }
  }
};

export const analysisSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['summary', 'official_facts', 'inferred_risks', 'requirements', 'score'],
  properties: {
    summary: { type: 'string' },
    official_facts: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['label', 'value', 'citations'],
        properties: {
          label: { type: 'string' },
          value: { type: 'string' },
          citations: { type: 'array', items: citationSchema }
        }
      }
    },
    inferred_risks: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['label', 'level', 'reason', 'citations'],
        properties: {
          label: { type: 'string' },
          level: { type: 'string', enum: ['low', 'medium', 'high'] },
          reason: { type: 'string' },
          citations: { type: 'array', items: citationSchema }
        }
      }
    },
    requirements: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['label', 'status', 'detail', 'citations'],
        properties: {
          label: { type: 'string' },
          status: { type: 'string', enum: ['found', 'not_found', 'inferred'] },
          detail: { type: 'string' },
          citations: { type: 'array', items: citationSchema }
        }
      }
    },
    score: scoreSchema
  }
};

function text(value: unknown) {
  return String(value || '').trim();
}

export function citationsFromDocuments(documents: Array<Record<string, unknown>>, fallbackUrl?: string | null): Citation[] {
  const docs = documents.slice(0, 6).map((doc, index) => ({
    source: String(doc.document_type || 'official_document'),
    title: String(doc.title || `Documento oficial ${index + 1}`),
    url: doc.official_url ? String(doc.official_url) : null,
    fragment: 'Referencia oficial enlazada desde la fuente de contratacion.'
  }));
  if (docs.length) return docs;
  return [{
    source: 'official_url',
    title: 'Enlace oficial de la licitacion',
    url: fallbackUrl || null,
    fragment: 'No hay documento descargado; se cita el enlace oficial normalizado.'
  }];
}

export function buildDeterministicAnalysis(input: {
  tender: Record<string, unknown>;
  documents: Array<Record<string, unknown>>;
  score: ExplainableScore;
}): TenderAnalysis {
  const tender = input.tender;
  const citations = citationsFromDocuments(input.documents, text(tender.official_url));
  const amount = Number(tender.base_budget_cents || tender.estimated_value_cents || 0);
  const deadline = text(tender.submission_deadline);
  const title = text(tender.title);
  const cpv = Array.isArray(tender.cpv_codes) ? tender.cpv_codes.join(', ') : '';

  return {
    summary: `${title || 'Licitacion oficial'} publicada por ${text(tender.contracting_body) || 'organismo no informado'}. Recomendacion ${input.score.recommendation.toUpperCase()} con score ${input.score.total}/100.`,
    official_facts: [
      {
        label: 'Importe',
        value: amount ? `${Math.round(amount / 100)} EUR` : 'no encontrado',
        citations
      },
      {
        label: 'Plazo',
        value: deadline || 'no encontrado',
        citations
      },
      {
        label: 'CPV',
        value: cpv || 'no encontrado',
        citations
      }
    ],
    inferred_risks: input.score.factors
      .filter((factor) => factor.score < 55)
      .slice(0, 5)
      .map((factor) => ({
        label: factor.label,
        level: factor.score < 35 ? 'high' : 'medium',
        reason: factor.explanation,
        citations
      })),
    requirements: [
      {
        label: 'Solvencia economica',
        status: input.score.factors.find((factor) => factor.code === 'economic_solvency')?.score === 72 ? 'not_found' : 'inferred',
        detail: input.score.factors.find((factor) => factor.code === 'economic_solvency')?.explanation || 'No encontrado',
        citations
      },
      {
        label: 'Solvencia tecnica',
        status: input.score.factors.find((factor) => factor.code === 'technical_solvency')?.score === 76 ? 'not_found' : 'inferred',
        detail: input.score.factors.find((factor) => factor.code === 'technical_solvency')?.explanation || 'No encontrado',
        citations
      },
      {
        label: 'Riesgo documental',
        status: input.documents.length ? 'found' : 'not_found',
        detail: input.documents.length ? 'Hay documentos/enlaces oficiales para revisar.' : 'No hay documentos asociados en la base.',
        citations
      }
    ],
    score: input.score
  };
}

export function validateAnalysis(value: unknown): TenderAnalysis {
  const data = value && typeof value === 'object' ? value as TenderAnalysis : null;
  if (!data || typeof data.summary !== 'string') throw new Error('AI analysis schema error: summary is required');
  if (!Array.isArray(data.official_facts)) throw new Error('AI analysis schema error: official_facts must be an array');
  if (!Array.isArray(data.inferred_risks)) throw new Error('AI analysis schema error: inferred_risks must be an array');
  if (!Array.isArray(data.requirements)) throw new Error('AI analysis schema error: requirements must be an array');
  if (!data.score || typeof data.score.total !== 'number') throw new Error('AI analysis schema error: score is required');
  return data;
}

export async function callOpenAiJson(input: {
  system: string;
  prompt: string;
  schemaName: string;
  schema: Record<string, unknown>;
  model?: string;
  apiKey?: string;
  maxOutputTokens?: number;
}) {
  const apiKey = input.apiKey || Deno.env.get('OPENAI_API_KEY') || '';
  if (!apiKey) return null;
  const model = input.model || Deno.env.get('OPENAI_MODEL') || 'gpt-5.4-mini';
  const resp = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model,
      max_output_tokens: input.maxOutputTokens || 6000,
      input: [
        { role: 'system', content: input.system },
        { role: 'user', content: input.prompt }
      ],
      text: {
        format: {
          type: 'json_schema',
          name: input.schemaName,
          schema: input.schema,
          strict: true
        }
      }
    })
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error(data?.error?.message || `openai_http_${resp.status}`);
  const output = data.output_text || data.output?.flatMap((item: Record<string, unknown>) => Array.isArray(item.content) ? item.content : []).find((item: Record<string, unknown>) => item.type === 'output_text')?.text;
  if (!output) throw new Error('openai_empty_output');
  return {
    model,
    usage: data.usage || {},
    parsed: JSON.parse(output)
  };
}
