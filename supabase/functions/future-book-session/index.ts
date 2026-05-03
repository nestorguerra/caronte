import { jsonResponse } from '../_shared/cors.ts';
import { callOpenAiJson } from '../_shared/ai.ts';
import { clientIp, encodeParam, getUser, hasServiceConfig, rest, userAgent } from '../_shared/service.ts';

function first<T>(value: T[] | T | null): T | null {
  return Array.isArray(value) ? (value[0] || null) : value;
}

function safeText(value: unknown, fallback = '', limit = 120) {
  const text = String(value || fallback).trim();
  return text.slice(0, limit) || fallback;
}

function safeTimezone(value: unknown) {
  const timezone = safeText(value, 'Europe/Madrid', 80);
  return /^[A-Za-z0-9_+\-/]+$/.test(timezone) ? timezone : 'Europe/Madrid';
}

function safeLocale(value: unknown) {
  const locale = safeText(value, 'es-ES', 16);
  return /^[a-z]{2}(-[A-Z]{2})?$/.test(locale) ? locale : 'es-ES';
}

function safeInt(value: unknown, fallback: number, min: number, max: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.round(parsed)));
}

function safeLongText(value: unknown, fallback = '', limit = 12000) {
  const text = String(value || fallback).trim();
  return text.slice(0, limit);
}

function clampNumber(value: unknown, fallback: number, min: number, max: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function arrayBufferToBase64(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let index = 0; index < bytes.length; index += 1) {
    binary += String.fromCharCode(bytes[index]);
  }
  return btoa(binary);
}

function bytesToHex(bytes: ArrayBuffer) {
  return [...new Uint8Array(bytes)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

async function sha256Hex(value: string) {
  return bytesToHex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)));
}

function privacySalt() {
  return Deno.env.get('FUTURE_BOOK_PRIVACY_SALT')
    || Deno.env.get('FUTURE_BOOK_SECRET_KEY')
    || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    || 'future-book-local-salt';
}

async function privacyHash(value: unknown) {
  const text = safeLongText(value, '', 2000);
  return text ? sha256Hex(`${privacySalt()}:${text}`) : null;
}

function utcDay(offset = 0) {
  const date = new Date(Date.now() + offset * 24 * 60 * 60 * 1000);
  return date.toISOString().slice(0, 10);
}

async function validAbuseProof(payload: Record<string, unknown>) {
  const fingerprint = safeLongText(payload.clientFingerprint || payload.fingerprint, '', 1200);
  const proof = safeText(payload.abuseProof, '', 96);
  if (!fingerprint || !proof) return false;
  const candidates = await Promise.all([utcDay(0), utcDay(-1)].map((day) => sha256Hex(`caronte-proof:${fingerprint}:${day}`)));
  return candidates.includes(proof);
}

type AbuseRule = {
  windowMinutes: number;
  max: number;
  challengeAfter?: number;
};

const abuseRules: Record<string, AbuseRule> = {
  createSession: { windowMinutes: 15, max: 8, challengeAfter: 3 },
  startSimulatedPayment: { windowMinutes: 15, max: 12 },
  approveSimulatedPayment: { windowMinutes: 15, max: 12 },
  synthesizeQuestion: { windowMinutes: 60, max: 120 },
  saveAnswer: { windowMinutes: 60, max: 45 },
  generateBook: { windowMinutes: 1440, max: 4 },
  generatePdf: { windowMinutes: 1440, max: 6 },
  downloadReleasedPdf: { windowMinutes: 60, max: 12 },
  exportPrivacyData: { windowMinutes: 60, max: 4 },
  requestPrivacyErasure: { windowMinutes: 60, max: 3 },
  joinWaitlist: { windowMinutes: 60, max: 6 }
};

function rateLimitDisabled() {
  return ['1', 'true', 'yes'].includes(String(Deno.env.get('FUTURE_BOOK_RATE_LIMIT_DISABLED') || '').toLowerCase());
}

async function recordAbuseEvent(input: {
  action: string;
  keyHash: string;
  ipHash: string | null;
  fingerprintHash: string | null;
  sessionId?: string | null;
  outcome: string;
  reason?: string | null;
  metadata?: Record<string, unknown>;
}) {
  await rest('future_book_abuse_events', {
    method: 'POST',
    body: {
      action: input.action,
      key_hash: input.keyHash,
      ip_hash: input.ipHash,
      fingerprint_hash: input.fingerprintHash,
      session_id: input.sessionId || null,
      outcome: input.outcome,
      reason: input.reason || null,
      metadata: input.metadata || {}
    },
    prefer: 'return=minimal'
  }).catch(() => null);
}

async function enforceAbuseLimit(req: Request, payload: Record<string, unknown>, action: string, sessionId?: string | null) {
  const rule = abuseRules[action];
  const ipHash = await privacyHash(clientIp(req) || 'missing_ip');
  const fingerprint = safeLongText(payload.clientFingerprint || payload.fingerprint, '', 1200);
  const fingerprintHash = await privacyHash(fingerprint || userAgent(req) || 'missing_fingerprint');
  const keyHash = sessionId ? await privacyHash(`session:${sessionId}`) : (fingerprintHash || ipHash || await privacyHash('unknown'));
  const fallbackKey = keyHash || 'unknown';
  if (!rule || rateLimitDisabled()) {
    return { ipHash, fingerprintHash, keyHash: fallbackKey, limited: false };
  }

  const since = new Date(Date.now() - rule.windowMinutes * 60 * 1000).toISOString();
  const rows = await rest(
    `future_book_abuse_events?key_hash=eq.${encodeParam(fallbackKey)}&action=eq.${encodeParam(action)}&created_at=gte.${encodeParam(since)}&select=id,outcome&limit=${rule.max + 1}`
  ).catch(() => []);
  const count = Array.isArray(rows) ? rows.length : 0;
  const proofOk = await validAbuseProof(payload);
  const runtimeMs = safeInt(payload.clientRuntimeMs, 0, 0, 24 * 60 * 60 * 1000);
  const needsChallenge = Boolean(rule.challengeAfter && count >= rule.challengeAfter)
    && (!proofOk || runtimeMs < 1200);

  if (count >= rule.max) {
    await recordAbuseEvent({
      action,
      keyHash: fallbackKey,
      ipHash,
      fingerprintHash,
      sessionId,
      outcome: 'blocked',
      reason: 'rate_limit_exceeded',
      metadata: { count, max: rule.max, window_minutes: rule.windowMinutes, sprint: 13 }
    });
    throw new Error('Rate limit exceeded');
  }

  if (needsChallenge) {
    await recordAbuseEvent({
      action,
      keyHash: fallbackKey,
      ipHash,
      fingerprintHash,
      sessionId,
      outcome: 'challenge_required',
      reason: 'abuse_challenge_required',
      metadata: { count, challenge_after: rule.challengeAfter, runtime_ms: runtimeMs, proof_present: Boolean(payload.abuseProof), sprint: 13 }
    });
    throw new Error('abuse_challenge_required');
  }

  await recordAbuseEvent({
    action,
    keyHash: fallbackKey,
    ipHash,
    fingerprintHash,
    sessionId,
    outcome: 'accepted',
    metadata: { count, max: rule.max, window_minutes: rule.windowMinutes, sprint: 13 }
  });
  return { ipHash, fingerprintHash, keyHash: fallbackKey, limited: false };
}

function defaultRetentionDays(dataType: string) {
  const defaults: Record<string, number> = {
    audio: 7,
    answers: 30,
    manuscripts: 30,
    pdfs: 30,
    psych_maps: 30,
    session_events: 90,
    abuse_events: 90,
    admin_audit: 365,
    privacy_requests: 365
  };
  return defaults[dataType] || 30;
}

function retentionExpiry(dataType = 'answers') {
  return new Date(Date.now() + defaultRetentionDays(dataType) * 24 * 60 * 60 * 1000).toISOString();
}

const interviewQuestions = [
  '¿Qué edad tienes, qué momento vital dirías que estás atravesando y qué versión de ti está entrando ahora en esta experiencia?',
  '¿Qué parte de ti sientes que está intentando cambiar algo, aunque todavía no se atreva del todo?',
  'Cuéntame tu biografía profesional con orden: dónde empezaste, qué decisiones te trajeron hasta aquí, qué has conseguido y qué parte de ese recorrido ya no encaja contigo.',
  '¿Qué parte de tu vida estás evitando mirar de frente?',
  'Cuéntame tu biografía personal sin adornarla: de dónde vienes, qué hechos te formaron, qué heridas o lealtades sigues arrastrando y qué persona has intentado ser para sobrevivir a todo eso.',
  '¿Qué deseo te da vergüenza reconocer en voz alta?',
  '¿Qué miedo te gobierna más de lo que te gustaría admitir?',
  '¿Qué persona ha cambiado tu vida, aunque quizá nunca se lo hayas dicho bien?',
  '¿Qué relación importante estás cuidando poco?',
  '¿Qué relación importante deberías soltar o transformar?',
  '¿Qué ambición te sigue llamando, aunque intentes hacerte el práctico?',
  '¿Qué precio estás pagando por la vida que llevas ahora?',
  '¿Qué parte de tu trabajo te da energía real?',
  '¿Qué parte de tu trabajo te está apagando?',
  '¿Qué papel tienen el dinero, el estatus y la libertad en tus decisiones?',
  '¿Qué historia te cuentas sobre ti que podría no ser verdad?',
  '¿Qué hábito pequeño, si lo cambiaras, podría alterar tu vida de forma enorme?',
  '¿Qué te gustaría que alguien entendiera de ti sin tener que explicarlo?',
  '¿Cómo te gustaría amar y ser amado en una versión más honesta de tu vida?',
  'Si tu yo futuro pudiera pedirte una sola cosa, ¿qué crees que te pediría?',
  '¿Qué pregunta no te he hecho y, aun así, sabes que debería haber aparecido?'
];

const firstQuestion = interviewQuestions[0];
const DEFAULT_ELEVENLABS_VOICE_ID = 'PToUZ7lhIUiz1SP94rGo';

function elevenLabsVoiceId() {
  return safeText(Deno.env.get('ELEVENLABS_VOICE_ID'), DEFAULT_ELEVENLABS_VOICE_ID, 120);
}

function elevenLabsModelId() {
  return safeText(Deno.env.get('ELEVENLABS_MODEL_ID'), 'eleven_multilingual_v2', 80);
}

function elevenLabsIntroModelId() {
  return safeText(
    Deno.env.get('ELEVENLABS_INTRO_MODEL_ID') || Deno.env.get('ELEVENLABS_EXPRESSIVE_MODEL_ID'),
    elevenLabsModelId(),
    80
  );
}

function elevenLabsVoiceSettings(mode: string) {
  if (mode === 'expressive_intro') {
    return {
      stability: 0.38,
      similarity_boost: 0.78,
      style: 0.65,
      speed: 0.94,
      use_speaker_boost: true
    };
  }
  return {
    stability: 0.62,
    similarity_boost: 0.72,
    style: 0.18,
    use_speaker_boost: true
  };
}

function stripVoiceDirectionTags(text: string) {
  return text
    .split('\n')
    .filter((line) => !/^\s*\[[^\]]+\]\s*$/.test(line))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function cleanParticipantName(value: unknown) {
  return safeText(value, '', 40).replace(/\s+/g, ' ');
}

function participantNameFromRow(row: Record<string, unknown>) {
  const metadata = row.metadata && typeof row.metadata === 'object' ? row.metadata as Record<string, unknown> : {};
  return cleanParticipantName(metadata.participant_name);
}

function questionFor(index: number, name = '') {
  const base = interviewQuestions[index - 1] || interviewQuestions[interviewQuestions.length - 1];
  const participant = cleanParticipantName(name);
  if (!participant) return base;
  if (index === 1) {
    return `Hola ${participant}. Vamos a realizar ahora la entrevista. Tus respuestas pueden condicionar las siguientes preguntas. Empezamos: ¿qué edad tienes, qué momento vital dirías que estás atravesando y qué versión de ti está entrando ahora en esta experiencia?`;
  }
  return `${participant}. ${base}`;
}

function wordCount(text: string) {
  return text.split(/\s+/).map((word) => word.trim()).filter(Boolean).length;
}

function followUpFor(index: number) {
  return `Respuesta demasiado corta. Vuelve a q_${String(index).padStart(2, '0')}, pero no contestes para quedar bien. Dame una escena, una razon concreta o algo que no sea obvio.`;
}

const manuscriptSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['title', 'sections', 'editorial_notes'],
  properties: {
    title: { type: 'string' },
    editorial_notes: { type: 'string' },
    sections: {
      type: 'array',
      minItems: 10,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['id', 'title', 'kind', 'paragraphs'],
        properties: {
          id: { type: 'string' },
          title: { type: 'string' },
          kind: { type: 'string' },
          paragraphs: {
            type: 'array',
            minItems: 2,
            items: { type: 'string' }
          }
        }
      }
    }
  }
};

const CARONTE_PROMPT_VERSION = 'caronte-literary-v1';
const CARONTE_MAP_VERSION = 'caronte-map-v1';
const CARONTE_OUTLINE_VERSION = 'caronte-outline-v1';
const CARONTE_REWRITE_VERSION = 'caronte-rewrite-v1';

const psychMapSchema = {
  type: 'object',
  additionalProperties: false,
  required: [
    'subject_profile',
    'core_tensions',
    'emotional_drivers',
    'avoidances',
    'relationships',
    'work_money_status',
    'future_vectors',
    'contradictions',
    'narrative_hooks',
    'editorial_directives'
  ],
  properties: {
    subject_profile: {
      type: 'object',
      additionalProperties: false,
      required: ['identity_signal', 'life_stage', 'dominant_need'],
      properties: {
        identity_signal: { type: 'string' },
        life_stage: { type: 'string' },
        dominant_need: { type: 'string' }
      }
    },
    core_tensions: {
      type: 'array',
      minItems: 3,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['name', 'evidence', 'literary_use'],
        properties: {
          name: { type: 'string' },
          evidence: { type: 'string' },
          literary_use: { type: 'string' }
        }
      }
    },
    emotional_drivers: {
      type: 'array',
      minItems: 3,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['driver', 'evidence', 'risk_if_ignored'],
        properties: {
          driver: { type: 'string' },
          evidence: { type: 'string' },
          risk_if_ignored: { type: 'string' }
        }
      }
    },
    avoidances: {
      type: 'array',
      minItems: 2,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['avoidance', 'evidence', 'possible_cost'],
        properties: {
          avoidance: { type: 'string' },
          evidence: { type: 'string' },
          possible_cost: { type: 'string' }
        }
      }
    },
    relationships: {
      type: 'array',
      minItems: 2,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['relationship', 'evidence', 'movement'],
        properties: {
          relationship: { type: 'string' },
          evidence: { type: 'string' },
          movement: { type: 'string' }
        }
      }
    },
    work_money_status: {
      type: 'object',
      additionalProperties: false,
      required: ['work_energy', 'work_shadow', 'money_status_freedom_pattern'],
      properties: {
        work_energy: { type: 'string' },
        work_shadow: { type: 'string' },
        money_status_freedom_pattern: { type: 'string' }
      }
    },
    future_vectors: {
      type: 'array',
      minItems: 4,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['vector', 'probable_path', 'choice_point'],
        properties: {
          vector: { type: 'string' },
          probable_path: { type: 'string' },
          choice_point: { type: 'string' }
        }
      }
    },
    contradictions: {
      type: 'array',
      minItems: 3,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['contradiction', 'evidence', 'question_to_press'],
        properties: {
          contradiction: { type: 'string' },
          evidence: { type: 'string' },
          question_to_press: { type: 'string' }
        }
      }
    },
    narrative_hooks: {
      type: 'array',
      minItems: 5,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['hook', 'source_question', 'scene_seed'],
        properties: {
          hook: { type: 'string' },
          source_question: { type: 'string' },
          scene_seed: { type: 'string' }
        }
      }
    },
    editorial_directives: {
      type: 'array',
      minItems: 5,
      items: { type: 'string' }
    }
  }
};

function answerText(answer: Record<string, unknown>) {
  return safeLongText(answer.transcript, '', 1800) || '[sin transcripcion util]';
}

function answerExcerpt(answers: Array<Record<string, unknown>>, questionIndex: number, fallback: string) {
  const answer = answers.find((item) => Number(item.question_index) === questionIndex);
  return safeLongText(answer?.transcript, fallback, 520) || fallback;
}

function shortExcerpt(text: string, limit = 220) {
  const cleaned = safeLongText(text, '', limit + 80).replace(/\s+/g, ' ').trim();
  if (cleaned.length <= limit) return cleaned;
  return `${cleaned.slice(0, limit).trim()}...`;
}

function answersDigest(answers: Array<Record<string, unknown>>, answerLimit = 1400) {
  return answers.map((answer) => {
    const index = String(answer.question_index || '').padStart(2, '0');
    return `Q${index}. ${safeLongText(answer.question_text, '', 300)}\nA${index}. ${safeLongText(answerText(answer), '', answerLimit)}`;
  }).join('\n\n');
}

function normalizeTextSignal(value: string) {
  return safeLongText(value, '', 20000)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function arrayFrom(value: unknown) {
  return Array.isArray(value) ? value as Array<Record<string, unknown>> : [];
}

function firstStringFrom(items: Array<Record<string, unknown>>, key: string, fallback: string) {
  return safeLongText(items.find((item) => safeLongText(item?.[key], '', 800))?.[key], fallback, 800) || fallback;
}

function buildDeterministicPsychMap(answers: Array<Record<string, unknown>>, session: Record<string, unknown>) {
  const identity = answerExcerpt(answers, 1, 'una persona que entra con curiosidad, reserva y necesidad de escuchar algo menos complaciente');
  const lifeStage = answerExcerpt(answers, 2, 'una etapa de transicion donde el exito visible no siempre coincide con la sensacion interna');
  const avoidance = answerExcerpt(answers, 4, 'una zona que se evita mirar de frente porque al tocarla obliga a tomar decisiones');
  const regret = answerExcerpt(answers, 5, 'un arrepentimiento posible si se mantiene la misma inercia');
  const desire = answerExcerpt(answers, 6, 'un deseo que cuesta admitir porque amenaza la version practica de la vida');
  const fear = answerExcerpt(answers, 7, 'un miedo que gobierna decisiones pequenas');
  const relationshipCare = answerExcerpt(answers, 9, 'una relacion que necesita mas presencia');
  const relationshipRelease = answerExcerpt(answers, 10, 'una relacion o forma de relacionarse que pide transformacion');
  const ambition = answerExcerpt(answers, 11, 'una ambicion que sigue llamando aunque se intente domesticar');
  const price = answerExcerpt(answers, 12, 'un precio silencioso pagado en tiempo, cuerpo o imaginacion');
  const workEnergy = answerExcerpt(answers, 13, 'una parte del trabajo que aun enciende energia real');
  const workShadow = answerExcerpt(answers, 14, 'una parte del trabajo que apaga o estrecha');
  const money = answerExcerpt(answers, 15, 'dinero, estatus y libertad mezclados como sistema de defensa');
  const story = answerExcerpt(answers, 16, 'una historia personal que podria no ser cierta');
  const habit = answerExcerpt(answers, 17, 'un habito pequeno con capacidad de alterar la trayectoria');
  const understood = answerExcerpt(answers, 18, 'algo que se desea que otros entiendan sin tener que explicarlo');
  const love = answerExcerpt(answers, 19, 'una forma mas honesta de amar y ser amado');
  const request = answerExcerpt(answers, 20, 'una peticion central del yo futuro');
  const missing = answerExcerpt(answers, 21, 'la pregunta que faltaba y seguia presente');

  return {
    subject_profile: {
      identity_signal: shortExcerpt(identity, 360),
      life_stage: shortExcerpt(lifeStage, 360),
      dominant_need: shortExcerpt(`${understood}. ${request}`, 420)
    },
    core_tensions: [
      { name: 'inercia contra eleccion', evidence: shortExcerpt(regret, 420), literary_use: 'abrir el prologo con la idea de que aplazar tambien es elegir' },
      { name: 'deseo contra prudencia', evidence: shortExcerpt(desire, 420), literary_use: 'convertir el deseo en una linea narrativa que vuelve en varios capitulos' },
      { name: 'estatus contra libertad', evidence: shortExcerpt(money, 420), literary_use: 'tratar dinero y prestigio como fuerzas ambiguas, no como villanos' }
    ],
    emotional_drivers: [
      { driver: 'miedo operativo', evidence: shortExcerpt(fear, 420), risk_if_ignored: 'seguir tomando decisiones pequenas desde una alarma antigua' },
      { driver: 'ambicion negada', evidence: shortExcerpt(ambition, 420), risk_if_ignored: 'convertir la ambicion en nostalgia o cinismo' },
      { driver: 'necesidad de ser visto sin traducirse', evidence: shortExcerpt(understood, 420), risk_if_ignored: 'buscar reconocimiento donde solo hay rendimiento' }
    ],
    avoidances: [
      { avoidance: 'lo que no se mira', evidence: shortExcerpt(avoidance, 420), possible_cost: shortExcerpt(price, 420) },
      { avoidance: 'la historia identitaria demasiado defendida', evidence: shortExcerpt(story, 420), possible_cost: 'seguir defendiendo una version vieja de si mismo' }
    ],
    relationships: [
      { relationship: 'relacion que pide cuidado', evidence: shortExcerpt(relationshipCare, 420), movement: 'presencia concreta antes que intencion abstracta' },
      { relationship: 'relacion o patron a transformar', evidence: shortExcerpt(relationshipRelease, 420), movement: 'soltar personaje, deuda o automatismo' },
      { relationship: 'amor mas honesto', evidence: shortExcerpt(love, 420), movement: 'pedir y ofrecer sin teatralizar fortaleza' }
    ],
    work_money_status: {
      work_energy: shortExcerpt(workEnergy, 420),
      work_shadow: shortExcerpt(workShadow, 420),
      money_status_freedom_pattern: shortExcerpt(money, 520)
    },
    future_vectors: [
      { vector: 'continuidad', probable_path: shortExcerpt(`Si nada cambia, el coste se parece a esto: ${price}`, 520), choice_point: 'nombrar el precio semanalmente' },
      { vector: 'ruptura pequena', probable_path: shortExcerpt(`El habito palanca aparece aqui: ${habit}`, 520), choice_point: 'hacer pequeno lo que ahora parece identidad' },
      { vector: 'ambicion integrada', probable_path: shortExcerpt(`La ambicion no resuelta es: ${ambition}`, 520), choice_point: 'darle calendario y coste real' },
      { vector: 'relaciones con presencia', probable_path: shortExcerpt(`Cuidar y transformar: ${relationshipCare} / ${relationshipRelease}`, 520), choice_point: 'una conversacion concreta antes de una teoria' }
    ],
    contradictions: [
      { contradiction: 'querer libertad usando estructuras que la reducen', evidence: shortExcerpt(money, 420), question_to_press: 'que parte de la seguridad ya es jaula?' },
      { contradiction: 'llamar prudencia a una renuncia', evidence: shortExcerpt(desire, 420), question_to_press: 'que deseo sigue vivo porque todavia no ha sido probado?' },
      { contradiction: 'pedir ser entendido mientras se oculta lo esencial', evidence: shortExcerpt(understood, 420), question_to_press: 'que tendrias que decir una sola vez con claridad?' }
    ],
    narrative_hooks: [
      { hook: 'entrada al sistema', source_question: 'q_01', scene_seed: shortExcerpt(identity, 380) },
      { hook: 'momento vital', source_question: 'q_02', scene_seed: shortExcerpt(lifeStage, 380) },
      { hook: 'lo evitado', source_question: 'q_04', scene_seed: shortExcerpt(avoidance, 380) },
      { hook: 'deseo y miedo', source_question: 'q_06/q_07', scene_seed: shortExcerpt(`${desire} / ${fear}`, 420) },
      { hook: 'peticion final', source_question: 'q_20/q_21', scene_seed: shortExcerpt(`${request} / ${missing}`, 420) }
    ],
    editorial_directives: [
      'Escribir como una novela privada, no como informe de coaching.',
      'Usar escenas plausibles y frases del entrevistado como material vivo.',
      'No prometer prediccion, destino, diagnostico ni terapia.',
      'Mantener una voz sobria, incomoda y precisa.',
      `Conservar la sesion ${safeText(session.id, 'sin_id', 80).slice(0, 8)} como huella tecnica, no como elemento protagonista.`
    ]
  };
}

function normalizePsychMap(value: unknown, fallback: Record<string, unknown>) {
  const data = value && typeof value === 'object' ? value as Record<string, unknown> : null;
  if (!data || typeof data.subject_profile !== 'object') return fallback;
  const requiredArrays = ['core_tensions', 'emotional_drivers', 'avoidances', 'relationships', 'future_vectors', 'contradictions', 'narrative_hooks', 'editorial_directives'];
  if (requiredArrays.some((key) => !Array.isArray(data[key]) || (data[key] as unknown[]).length === 0)) return fallback;
  return data;
}

function psychMapPrompt(answers: Array<Record<string, unknown>>) {
  return [
    'Construye un mapa psicologico-literario para Caronte.',
    'No diagnostiques. No uses categorias clinicas. No predigas hechos.',
    'El mapa sirve para escribir una novela privada: tensiones, contradicciones, escenas, deseos, miedos, relaciones y puntos de decision.',
    'Cada punto debe apoyarse en evidencia textual de las respuestas.',
    'Devuelve solo JSON valido segun schema.',
    '',
    answersDigest(answers, 1600)
  ].join('\n');
}

async function buildPsychologicalMap(answers: Array<Record<string, unknown>>, session: Record<string, unknown>) {
  const fallback = buildDeterministicPsychMap(answers, session);
  const apiKey = await providerSecret('openai');
  const result = await callOpenAiJson({
    system: 'Eres Caronte en modo analista literario. Construyes mapas psicologicos narrativos sin diagnosticar ni prometer futuro.',
    prompt: psychMapPrompt(answers),
    schemaName: 'future_book_psych_map',
    schema: psychMapSchema,
    model: Deno.env.get('FUTURE_BOOK_MAP_MODEL') || Deno.env.get('FUTURE_BOOK_OPENAI_MODEL') || Deno.env.get('OPENAI_MODEL') || 'gpt-5.4-pro',
    apiKey
  }).catch((error) => ({
    model: 'openai_map_failed',
    usage: {},
    parsed: {
      ...fallback,
      editorial_directives: [
        ...((fallback.editorial_directives as string[]) || []),
        `Fallback determinista por error OpenAI map: ${error instanceof Error ? error.message : 'unknown'}`
      ]
    }
  }));

  if (!result) return { map: fallback, provider: 'deterministic_map', usage: {}, degraded: true };
  const degraded = result.model === 'openai_map_failed';
  return {
    map: normalizePsychMap(result.parsed, fallback),
    provider: result.model || 'openai_map',
    usage: result.usage || {},
    degraded
  };
}

function buildNarrativeOutline(psychMap: Record<string, unknown>, answers: Array<Record<string, unknown>>) {
  const profile = psychMap.subject_profile && typeof psychMap.subject_profile === 'object'
    ? psychMap.subject_profile as Record<string, unknown>
    : {};
  const tensions = arrayFrom(psychMap.core_tensions);
  const hooks = arrayFrom(psychMap.narrative_hooks);
  const vectors = arrayFrom(psychMap.future_vectors);
  const relationships = arrayFrom(psychMap.relationships);
  const work = psychMap.work_money_status && typeof psychMap.work_money_status === 'object'
    ? psychMap.work_money_status as Record<string, unknown>
    : {};
  return {
    prompt_version: CARONTE_OUTLINE_VERSION,
    architecture: 'cover, loose_page, future_note, prologue, seven chapters, final letter, practical epilogue, ai notice',
    protagonist_signal: safeLongText(profile.identity_signal, 'persona entrevistada', 500),
    central_arc: safeLongText(profile.dominant_need, 'pasar de inercia a eleccion', 500),
    chapters: [
      { id: 'future_note', role: 'voz futura', source: safeLongText(profile.life_stage, 'momento vital', 500) },
      { id: 'prologue', role: 'umbral', source: firstStringFrom(hooks, 'scene_seed', answerExcerpt(answers, 4, 'lo evitado')) },
      { id: 'chapter_1', role: 'lo que funciona y no basta', source: firstStringFrom(tensions, 'evidence', answerExcerpt(answers, 5, 'arrepentimiento')) },
      { id: 'chapter_2', role: 'deseo y miedo', source: answerExcerpt(answers, 6, 'deseo') },
      { id: 'chapter_3', role: 'relaciones', source: firstStringFrom(relationships, 'evidence', answerExcerpt(answers, 9, 'relacion')) },
      { id: 'chapter_4', role: 'trabajo y ambicion', source: `${safeLongText(work.work_energy, '', 360)} / ${safeLongText(work.work_shadow, '', 360)}` },
      { id: 'chapter_5', role: 'precio real', source: answerExcerpt(answers, 12, 'precio') },
      { id: 'chapter_6', role: 'historia personal', source: answerExcerpt(answers, 16, 'historia') },
      { id: 'chapter_7', role: 'amor y peticion', source: answerExcerpt(answers, 20, 'peticion') },
      { id: 'final_letter', role: 'decision', source: firstStringFrom(vectors, 'choice_point', answerExcerpt(answers, 21, 'pregunta faltante')) }
    ]
  };
}

function manuscriptPlainText(manuscript: Record<string, unknown>) {
  const sections = Array.isArray(manuscript.sections) ? manuscript.sections as Array<Record<string, unknown>> : [];
  return sections.map((item) => {
    const paragraphs = Array.isArray(item.paragraphs) ? item.paragraphs : [];
    return [item.title, ...paragraphs].map((value) => String(value || '')).join('\n');
  }).join('\n\n');
}

const commonSignalWords = new Set([
  'porque', 'cuando', 'entonces', 'tambien', 'siempre', 'nunca', 'persona', 'personas', 'trabajo', 'dinero',
  'tiempo', 'miedo', 'quiero', 'siento', 'creo', 'vida', 'futuro', 'pasado', 'presente', 'verdad', 'hacer',
  'cosas', 'relacion', 'decisiones', 'decision', 'importante', 'momento', 'manera', 'forma'
]);

function answerSignalTerms(answers: Array<Record<string, unknown>>) {
  const counts = new Map<string, number>();
  for (const answer of answers) {
    const words = normalizeTextSignal(answerText(answer)).match(/[a-z0-9]{7,}/g) || [];
    for (const word of words) {
      if (commonSignalWords.has(word)) continue;
      counts.set(word, (counts.get(word) || 0) + 1);
    }
  }
  return [...counts.entries()]
    .filter(([, count]) => count <= 4)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 50)
    .map(([word]) => word);
}

function prohibitedPromiseViolations(text: string) {
  const normalized = normalizeTextSignal(text);
  const patterns = [
    { code: 'prediction_claim', pattern: /\b(predice|prediccion exacta|ocurrira|inevitable|destino)\b/, detail: 'Lenguaje que puede sonar a prediccion factual.' },
    { code: 'guarantee_claim', pattern: /\b(garantiza|garantizado|sin duda|con certeza absoluta)\b/, detail: 'Lenguaje de garantia excesiva.' },
    { code: 'clinical_claim', pattern: /\b(diagnostico|trastorno|terapia|tratamiento|curacion)\b/, detail: 'Lenguaje clinico no permitido.' },
    { code: 'financial_legal_claim', pattern: /\b(invierte|demanda|contrato legal|asesoramiento financiero)\b/, detail: 'Consejo financiero o legal directo no permitido.' }
  ];
  return patterns.filter((item) => item.pattern.test(normalized)).map((item) => ({
    code: item.code,
    detail: item.detail
  }));
}

function evaluateCaronteManuscript(answers: Array<Record<string, unknown>>, manuscript: Record<string, unknown>, psychMap: Record<string, unknown>) {
  const text = manuscriptPlainText(manuscript);
  const normalized = normalizeTextSignal(text);
  const signals = answerSignalTerms(answers);
  const signalHits = signals.filter((term) => normalized.includes(term));
  const sections = Array.isArray(manuscript.sections) ? manuscript.sections as Array<Record<string, unknown>> : [];
  const genericPhrases = [
    'la vida que quieres vivir',
    'sal de tu zona de confort',
    'todo depende de ti',
    'escucha a tu corazon',
    'se tu mejor version',
    'nunca es tarde',
    'persigue tus suenos'
  ];
  const genericHits = genericPhrases.filter((phrase) => normalized.includes(normalizeTextSignal(phrase)));
  const violations = prohibitedPromiseViolations(text);
  const personalizationScore = signals.length ? Number((signalHits.length / Math.min(24, signals.length)).toFixed(2)) : 0;
  const structureScore = sections.length >= 12 ? 1 : Number((sections.length / 12).toFixed(2));
  const genericityScore = Number(Math.min(1, Math.max(0, 0.16 + genericHits.length * 0.1 + (1 - personalizationScore) * 0.52)).toFixed(2));
  const safetyScore = Number(Math.max(0, 1 - violations.length * 0.22).toFixed(2));
  const dominantNeedSignal = normalizeTextSignal(safeLongText((psychMap.subject_profile as Record<string, unknown>)?.dominant_need, '', 160)).slice(0, 24);
  const psychMapUseScore = dominantNeedSignal && normalized.includes(dominantNeedSignal)
    ? 0.78
    : Math.max(0.35, personalizationScore);
  const needsRewrite = personalizationScore < 0.28 || genericityScore > 0.58 || safetyScore < 0.78 || structureScore < 0.92;
  return {
    prompt_version: CARONTE_PROMPT_VERSION,
    personalization_score: personalizationScore,
    genericity_score: genericityScore,
    safety_score: safetyScore,
    structure_score: structureScore,
    psych_map_use_score: Number(psychMapUseScore.toFixed(2)),
    signal_hits: signalHits.slice(0, 18),
    generic_phrase_hits: genericHits,
    prohibited_promise_violations: violations,
    needs_rewrite: needsRewrite,
    verdict: needsRewrite ? 'rewrite_required' : 'ready_for_review'
  };
}

function estimatePages(sections: Array<Record<string, unknown>>) {
  const words = sections.reduce((total, section) => {
    const paragraphs = Array.isArray(section.paragraphs) ? section.paragraphs : [];
    return total + paragraphs.reduce((count, paragraph) => count + wordCount(String(paragraph || '')), 0);
  }, 0);
  return Math.max(8, Math.round(words / 330));
}

function qualityScoreFor(answers: Array<Record<string, unknown>>, sections: Array<Record<string, unknown>>) {
  const answered = answers.filter((answer) => answerText(answer) !== '[sin transcripcion util]').length;
  const totalWords = answers.reduce((total, answer) => total + wordCount(answerText(answer)), 0);
  const pageEstimate = estimatePages(sections);
  const answerDepth = Math.min(0.2, totalWords / 5000);
  const completion = Math.min(0.22, answered / 21 * 0.22);
  const shape = sections.length >= 12 ? 0.18 : 0.08;
  const pageFit = pageEstimate >= 8 ? 0.16 : 0.08;
  return Math.round((0.34 + answerDepth + completion + shape + pageFit) * 100) / 100;
}

function section(id: string, title: string, kind: string, paragraphs: string[]) {
  return { id, title, kind, paragraphs };
}

function buildDeterministicManuscript(answers: Array<Record<string, unknown>>, session: Record<string, unknown>) {
  const nameSignal = shortExcerpt(answerExcerpt(answers, 1, 'una persona que no se reconoce del todo al entrar'), 90);
  const moment = shortExcerpt(answerExcerpt(answers, 2, 'una etapa de transicion que todavia no sabe nombrar'), 160);
  const avoidance = shortExcerpt(answerExcerpt(answers, 4, 'algo importante que se esta evitando mirar'), 160);
  const regret = shortExcerpt(answerExcerpt(answers, 5, 'un arrepentimiento posible si todo sigue igual'), 160);
  const desire = shortExcerpt(answerExcerpt(answers, 6, 'un deseo que cuesta admitir'), 160);
  const fear = shortExcerpt(answerExcerpt(answers, 7, 'un miedo que pesa mas de lo visible'), 160);
  const relationship = shortExcerpt(answerExcerpt(answers, 9, 'una relacion que pide mas cuidado'), 160);
  const release = shortExcerpt(answerExcerpt(answers, 10, 'una relacion o forma de relacionarse que debe cambiar'), 160);
  const ambition = shortExcerpt(answerExcerpt(answers, 11, 'una ambicion que sigue llamando'), 160);
  const price = shortExcerpt(answerExcerpt(answers, 12, 'el precio silencioso de la vida actual'), 160);
  const workLight = shortExcerpt(answerExcerpt(answers, 13, 'la parte del trabajo que enciende energia real'), 160);
  const workShadow = shortExcerpt(answerExcerpt(answers, 14, 'la parte del trabajo que apaga'), 160);
  const money = shortExcerpt(answerExcerpt(answers, 15, 'dinero, estatus y libertad mezclados en decisiones'), 160);
  const story = shortExcerpt(answerExcerpt(answers, 16, 'una historia personal que podria no ser cierta'), 160);
  const habit = shortExcerpt(answerExcerpt(answers, 17, 'un habito pequeno con impacto enorme'), 160);
  const understood = shortExcerpt(answerExcerpt(answers, 18, 'algo que querrias que se entendiera sin tener que explicarlo'), 160);
  const love = shortExcerpt(answerExcerpt(answers, 19, 'una forma mas honesta de amar y ser amado'), 160);
  const request = shortExcerpt(answerExcerpt(answers, 20, 'una sola cosa que tu yo futuro pediria'), 160);
  const missing = shortExcerpt(answerExcerpt(answers, 21, 'la pregunta que faltaba'), 160);

  const title = 'Futuro Anterior: instrucciones desde una vida posible';
  const sections = [
    section('cover', title, 'cover', [
      `Ejemplar unico generado para una sesion privada ${safeText(session.id, 'sin_id', 80).slice(0, 8)}.`,
      'Este libro no tiene remitente. No contiene una prediccion. Contiene una forma de escucharte desde una distancia que todavia no existe.'
    ]),
    section('loose_page', 'hoja suelta antes de leer', 'instructions', [
      'No leas este manuscrito como si fuera una sentencia. Leelo como si fuera una conversacion con alguien que ha cometido tus errores, ha exagerado tus virtudes y ha sobrevivido a varias versiones de ti.',
      'Ten papel cerca. Marca lo que te enfade, no solo lo que te guste. Lo que te enfada suele ser una puerta con mala iluminacion.'
    ]),
    section('future_note', 'nota de quien aun no eres', 'future_note', [
      `Te recuerdo entrando en esta entrevista con esta senal: "${nameSignal}". No era una descripcion perfecta, pero si era una grieta suficiente.`,
      `El momento vital que dejaste registrado sonaba asi: "${moment}". Desde aqui no parece pequeno. Parece el punto donde empezabas a negociar con la vida que decias querer.`
    ]),
    section('prologue', 'prologo: los futuros no avisan', 'prologue', [
      'El futuro no llego como una linea recta. Llego como llegan casi todas las cosas importantes: por acumulacion, por cansancio, por deseo y por una decision que parecia demasiado pequena para merecer ceremonia.',
      `La primera advertencia fue lo evitado: "${avoidance}". No porque fuera un secreto espectacular, sino porque habia empezado a organizar demasiado alrededor de no tocarlo.`
    ]),
    section('chapter_1', 'capitulo 1: lo que funcionaba no bastaba', 'chapter', [
      `Habia cosas que iban bien, y eso hacia mas dificil aceptar el malestar. El riesgo no era fracasar de golpe. El riesgo era usar lo que funcionaba para justificar lo que se estaba apagando.`,
      `Si algun dia te arrepientes, no sera solo por lo que salio mal. Sera por haber visto venir esto: "${regret}", y haberlo tratado como una molestia administrable.`
    ]),
    section('chapter_2', 'capitulo 2: deseo y miedo firmaron el mismo contrato', 'chapter', [
      `El deseo que costaba decir en voz alta dejo una pista: "${desire}". No era una fantasia decorativa. Era informacion.`,
      `Pero el miedo tambien estaba escribiendo. "${fear}". Cada vez que ese miedo decidia por ti, tu vida parecia prudente desde fuera y mas estrecha desde dentro.`
    ]),
    section('chapter_3', 'capitulo 3: las personas que te hicieron y las que te frenaron', 'chapter', [
      `El libro insiste en una deuda emocional: "${relationship}". Cuidar no significa perseguir. Significa poner presencia donde antes solo habia intencion.`,
      `Tambien insiste en una salida: "${release}". Algunas relaciones no se rompen por falta de amor, sino por exceso de personaje.`
    ]),
    section('chapter_4', 'capitulo 4: trabajo, ambicion y la parte que no confiesa', 'chapter', [
      `La ambicion aparecio como una llamada vieja: "${ambition}". No era necesariamente grande hacia fuera. Era grande porque pedia coherencia.`,
      `En el trabajo habia una zona viva: "${workLight}". Y habia otra que consumia: "${workShadow}". El error habria sido confundir resistencia con vocacion.`
    ]),
    section('chapter_5', 'capitulo 5: el precio real de la vida actual', 'chapter', [
      `Toda vida cobra algo. La tuya, en esta etapa, estaba cobrando esto: "${price}". No siempre en dinero. A veces en atencion, ternura, cuerpo o imaginacion.`,
      `Dinero, estatus y libertad estaban mezclados asi: "${money}". El consejo no es elegir uno y despreciar los otros. Es dejar de fingir que no hay jerarquia.`
    ]),
    section('chapter_6', 'capitulo 6: la historia que te contabas', 'chapter', [
      `Habia una narrativa privada que parecia identidad: "${story}". El futuro mas sano empezo cuando dejaste de defenderla como si fuera una propiedad.`,
      `La palanca pequena era esta: "${habit}". Pequena no significa facil. Significa que nadie la iba a hacer por ti.`
    ]),
    section('chapter_7', 'capitulo 7: amor, mirada y peticion final', 'chapter', [
      `Querias que alguien entendiera esto sin obligarte a traducirlo: "${understood}". Esa frase era menos una queja que un mapa de necesidades.`,
      `Amar con mas honestidad sonaba asi: "${love}". Y si yo, desde aqui, pudiera pedir una sola cosa, empezaria por lo que ya dijiste: "${request}".`
    ]),
    section('final_letter', 'carta final: no lo conviertas en decoracion', 'letter', [
      'No guardes este libro como una pieza rara. Si solo lo ensenas, lo conviertes en teatro. Si lo trabajas, puede convertirse en una herramienta.',
      `La pregunta que faltaba fue esta: "${missing}". No la contestes rapido. Vuelve a ella cuando el ruido baje.`
    ]),
    section('practical_epilogue', 'epilogo practico: siete gestos en treinta dias', 'epilogue', [
      'Uno: escribe una decision que has aplazado. Dos: pide una conversacion pendiente. Tres: elimina una obligacion que solo protege tu imagen. Cuatro: protege dos horas semanales para la ambicion que sigues negando.',
      'Cinco: cambia el habito pequeno antes de prometer una vida nueva. Seis: revisa el precio que pagas cada domingo. Siete: si algo de este libro te supera, hablalo con una persona cualificada y real.'
    ]),
    section('ai_notice', 'aviso de IA y limites', 'notice', [
      'Este manuscrito es una obra generada a partir de una entrevista, patrones narrativos y plausibilidad. No predice hechos, no diagnostica, no sustituye criterio profesional y no debe usarse como unica base para decisiones medicas, legales, financieras o psicologicas.',
      'Su valor esta en la friccion que provoca: preguntas mejores, escenas recordadas y decisiones que vuelven a estar en tus manos.'
    ])
  ];

  return {
    title,
    subtitle: 'Un libro escrito desde futuros plausibles, no desde certezas.',
    target_pages: { min: 35, max: 60, estimated_current_pages: estimatePages(sections) },
    sections,
    editorial_notes: 'Borrador Sprint 4. Listo para revision editorial y posterior maquetacion PDF.'
  };
}

function normalizeAiManuscript(value: unknown, fallback: Record<string, unknown>) {
  const data = value && typeof value === 'object' ? value as Record<string, unknown> : null;
  if (!data || typeof data.title !== 'string' || !Array.isArray(data.sections)) return fallback;
  const sections = data.sections
    .filter((item) => item && typeof item === 'object')
    .map((item) => {
      const row = item as Record<string, unknown>;
      return section(
        safeText(row.id, 'section', 60),
        safeText(row.title, 'seccion sin titulo', 160),
        safeText(row.kind, 'chapter', 60),
        Array.isArray(row.paragraphs) ? row.paragraphs.map((paragraph) => safeLongText(paragraph, '', 3000)).filter(Boolean) : []
      );
    })
    .filter((item) => item.paragraphs.length >= 2);

  if (sections.length < 10) return fallback;
  return {
    ...fallback,
    title: safeText(data.title, String(fallback.title || 'Futuro Anterior'), 220),
    sections,
    target_pages: { min: 35, max: 60, estimated_current_pages: estimatePages(sections) },
    editorial_notes: safeLongText(data.editorial_notes, 'Borrador generado por IA.', 1200)
  };
}

function buildQualityReport(
  answers: Array<Record<string, unknown>>,
  manuscript: Record<string, unknown>,
  externalReview: Record<string, unknown> | null,
  degraded = false,
  caronteEvaluation: Record<string, unknown> | null = null,
  psychMap: Record<string, unknown> | null = null
) {
  const sections = Array.isArray(manuscript.sections) ? manuscript.sections as Array<Record<string, unknown>> : [];
  const totalWords = answers.reduce((total, answer) => total + wordCount(answerText(answer)), 0);
  const baseScore = qualityScoreFor(answers, sections);
  const caronteScore = caronteEvaluation
    ? (
      Number(caronteEvaluation.personalization_score || 0) * 0.34
      + (1 - Number(caronteEvaluation.genericity_score || 1)) * 0.22
      + Number(caronteEvaluation.safety_score || 0) * 0.24
      + Number(caronteEvaluation.structure_score || 0) * 0.2
    )
    : baseScore;
  const score = Math.round((baseScore * 0.45 + caronteScore * 0.55) * 100) / 100;
  const pageEstimate = estimatePages(sections);
  const violations = Array.isArray(caronteEvaluation?.prohibited_promise_violations)
    ? caronteEvaluation.prohibited_promise_violations
    : [];
  const needsRewrite = caronteEvaluation?.needs_rewrite === true;
  const status = degraded
    ? 'degraded_provider_fallback'
    : violations.length
      ? 'blocked_safety'
      : needsRewrite
        ? 'needs_caronte_rewrite'
        : score >= 0.78 ? 'ready_for_human_review' : 'needs_editorial_expansion';
  return {
    score,
    status,
    page_target: { min: 35, max: 60, estimated_current_pages: pageEstimate },
    prompt_versions: {
      caronte: CARONTE_PROMPT_VERSION,
      map: CARONTE_MAP_VERSION,
      outline: CARONTE_OUTLINE_VERSION,
      rewrite: CARONTE_REWRITE_VERSION
    },
    checks: [
      {
        code: 'required_ai_providers',
        status: degraded ? 'fail' : 'pass',
        detail: degraded
          ? 'El manuscrito uso fallback o proveedor fallido; no debe marcarse como listo para produccion.'
          : 'El manuscrito uso proveedores IA requeridos para la generacion/revision configurada.'
      },
      {
        code: 'psychological_map',
        status: psychMap ? 'pass' : 'fail',
        detail: psychMap ? 'El manuscrito se genero a partir de un mapa psicologico versionado.' : 'No hay mapa psicologico asociado.'
      },
      {
        code: 'genericity',
        status: Number(caronteEvaluation?.genericity_score || 1) <= 0.58 ? 'pass' : 'warning',
        detail: `Genericidad estimada: ${caronteEvaluation?.genericity_score ?? 'n/a'}; personalizacion: ${caronteEvaluation?.personalization_score ?? 'n/a'}.`
      },
      {
        code: 'prohibited_promises',
        status: violations.length ? 'fail' : 'pass',
        detail: violations.length ? `Violaciones detectadas: ${violations.length}.` : 'Sin promesas de prediccion, diagnostico ni consejo profesional directo detectadas.'
      },
      {
        code: 'no_prediction_claim',
        status: violations.some((item: Record<string, unknown>) => item.code === 'prediction_claim') ? 'fail' : 'pass',
        detail: 'El manuscrito debe formularse como futuros plausibles y no como prediccion factual.'
      },
      {
        code: 'no_clinical_or_legal_advice',
        status: violations.some((item: Record<string, unknown>) => ['clinical_claim', 'financial_legal_claim'].includes(String(item.code))) ? 'fail' : 'pass',
        detail: 'Incluye aviso explicito y evita sustituir profesionales medicos, legales, financieros o psicologicos.'
      },
      {
        code: 'personalization',
        status: totalWords >= 900 ? 'pass' : 'warning',
        detail: `Material de entrevista disponible: ${answers.length} respuestas, ${totalWords} palabras aproximadas.`
      },
      {
        code: 'editorial_structure',
        status: sections.length >= 12 ? 'pass' : 'warning',
        detail: `Estructura detectada: ${sections.length} secciones.`
      },
      {
        code: 'pdf_readiness',
        status: 'warning',
        detail: 'Falta maquetacion final PDF; Sprint 4 solo deja el manuscrito preparado para esa fase.'
      }
    ],
    caronte_evaluation: caronteEvaluation,
    external_review: externalReview,
    generated_at: new Date().toISOString()
  };
}

function manuscriptPrompt(
  answers: Array<Record<string, unknown>>,
  psychMap: Record<string, unknown>,
  outline: Record<string, unknown>,
  revisionInstruction = ''
) {
  return [
    `PROMPT_VERSION=${CARONTE_PROMPT_VERSION}`,
    'Eres Caronte. Escribes una novela privada, no un informe, no coaching generico y no terapia.',
    'La voz debe sonar como un yo futuro sobrio, inteligente, incomodo y concreto que escribe al yo presente.',
    'No predices hechos. No diagnosticas. No das consejo medico, legal, financiero o psicologico. Trabajas con plausibilidad narrativa.',
    'Usa el mapa psicologico como fuente obligatoria: tensiones, contradicciones, escenas, relaciones y vectores de futuro.',
    'Cada capitulo debe contener al menos una escena plausible, una frase o detalle derivado de las respuestas y una decision concreta.',
    'Evita frases genericas tipo "se tu mejor version", "sal de tu zona de confort", "persigue tus suenos".',
    'Estructura obligatoria: portada, hoja suelta de instrucciones, nota del yo futuro, prologo, 7 capitulos, carta final, epilogo practico y aviso de IA.',
    revisionInstruction ? `INSTRUCCION_DE_REESCRITURA=${revisionInstruction}` : 'INSTRUCCION_DE_REESCRITURA=primera_version',
    'Devuelve solo JSON valido segun el schema.',
    '',
    'MAPA_PSICOLOGICO',
    JSON.stringify(psychMap),
    '',
    'ARQUITECTURA_NARRATIVA',
    JSON.stringify(outline),
    '',
    'ENTREVISTA',
    answersDigest(answers, 1800)
  ].join('\n');
}

async function buildAiManuscript(
  answers: Array<Record<string, unknown>>,
  fallback: Record<string, unknown>,
  psychMap: Record<string, unknown>,
  outline: Record<string, unknown>,
  revisionInstruction = ''
) {
  const apiKey = await providerSecret('openai');
  const result = await callOpenAiJson({
    system: 'Eres Caronte, editor literario senior. Escribes libros privados con precision narrativa. No prometes adivinacion.',
    prompt: manuscriptPrompt(answers, psychMap, outline, revisionInstruction),
    schemaName: 'future_book_manuscript',
    schema: manuscriptSchema,
    model: Deno.env.get('FUTURE_BOOK_OPENAI_MODEL') || Deno.env.get('OPENAI_MODEL') || 'gpt-5.4-pro',
    apiKey
  }).catch((error) => ({
    model: 'openai_failed',
    usage: {},
    parsed: {
      ...fallback,
      editorial_notes: `Fallback determinista por error OpenAI: ${error instanceof Error ? error.message : 'unknown'}`
    }
  }));

  if (!result) return { manuscript: fallback, provider: 'deterministic', usage: {}, degraded: true };
  const degraded = result.model === 'openai_failed';
  return {
    manuscript: normalizeAiManuscript(result.parsed, fallback),
    provider: result.model || 'openai',
    usage: result.usage || {},
    degraded
  };
}

function parseJsonObject(text: string) {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  return JSON.parse(text.slice(start, end + 1));
}

async function reviewWithAnthropic(
  manuscript: Record<string, unknown>,
  psychMap: Record<string, unknown> | null = null,
  caronteEvaluation: Record<string, unknown> | null = null
) {
  const apiKey = await providerSecret('anthropic');
  if (!apiKey) return null;

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: Deno.env.get('ANTHROPIC_MODEL') || 'claude-opus-4-7',
      max_tokens: 1800,
      system: 'Eres control de calidad editorial de Caronte. Detectas genericidad, promesas de prediccion, lenguaje clinico, vaguedad, baja personalizacion y contradicciones. Devuelves JSON.',
      messages: [{
        role: 'user',
        content: [
          'Revisa este manuscrito. Devuelve JSON con keys: score number 0..1, verdict string, risks array, required_fixes array, personalization_notes array, safety_notes array.',
          JSON.stringify({
            title: manuscript.title,
            psych_map: psychMap,
            caronte_evaluation: caronteEvaluation,
            sections: Array.isArray(manuscript.sections)
              ? (manuscript.sections as Array<Record<string, unknown>>).map((item) => ({
                id: item.id,
                title: item.title,
                sample: Array.isArray(item.paragraphs) ? item.paragraphs.slice(0, 2) : []
              }))
              : []
          })
        ].join('\n\n')
      }]
    })
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    return {
      provider: 'anthropic',
      status: 'failed',
      detail: data?.error?.message || `anthropic_http_${response.status}`
    };
  }

  const text = Array.isArray(data.content)
    ? data.content.map((item: Record<string, unknown>) => item.type === 'text' ? String(item.text || '') : '').join('\n')
    : '';
  const parsed = parseJsonObject(text);
  return {
    provider: 'anthropic',
    model: data.model || Deno.env.get('ANTHROPIC_MODEL') || 'claude-opus-4-7',
    status: 'completed',
    usage: data.usage || {},
    result: parsed || { raw: safeLongText(text, '', 2400) }
  };
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = '';
  for (let index = 0; index < bytes.length; index += 1) {
    binary += String.fromCharCode(bytes[index]);
  }
  return btoa(binary);
}

const futureBookAudioBucket = 'future-book-audio';

function maxAudioBytes() {
  return safeInt(Deno.env.get('FUTURE_BOOK_MAX_AUDIO_BYTES'), 24 * 1024 * 1024, 1024, 25 * 1024 * 1024);
}

function storeAudioEnabled() {
  return !['0', 'false', 'no'].includes(String(Deno.env.get('FUTURE_BOOK_STORE_AUDIO') || 'true').toLowerCase());
}

function normalizeAudioMimeType(value: unknown) {
  const mime = safeText(value, 'audio/webm', 120).toLowerCase();
  if (mime.includes('webm')) return 'audio/webm';
  if (mime.includes('mp4') || mime.includes('m4a')) return 'audio/mp4';
  if (mime.includes('mpeg') || mime.includes('mp3')) return 'audio/mpeg';
  if (mime.includes('wav')) return 'audio/wav';
  if (mime.includes('ogg')) return 'audio/ogg';
  return 'audio/webm';
}

function audioExtension(mimeType: string) {
  if (mimeType === 'audio/mp4') return 'mp4';
  if (mimeType === 'audio/mpeg') return 'mp3';
  if (mimeType === 'audio/wav') return 'wav';
  if (mimeType === 'audio/ogg') return 'ogg';
  return 'webm';
}

function safeBase64Audio(value: unknown) {
  const text = String(value || '').trim();
  if (!text) return '';
  const withoutPrefix = text.includes(',') ? text.split(',').pop() || '' : text;
  return withoutPrefix.replace(/\s+/g, '');
}

function answerAudioInput(payload: Record<string, unknown>) {
  const audioBase64 = safeBase64Audio(payload.audioBase64);
  const mimeType = normalizeAudioMimeType(payload.audioMimeType);
  if (!audioBase64) return { bytes: null as Uint8Array | null, mimeType, byteLength: 0, error: '' };
  try {
    const bytes = base64ToBytes(audioBase64);
    const limit = maxAudioBytes();
    if (bytes.byteLength > limit) {
      return { bytes: null, mimeType, byteLength: bytes.byteLength, error: 'audio_too_large' };
    }
    return { bytes, mimeType, byteLength: bytes.byteLength, error: '' };
  } catch {
    return { bytes: null, mimeType, byteLength: 0, error: 'invalid_audio_base64' };
  }
}

async function uploadPrivateAudioArtifact(sessionId: string, questionIndex: number, mimeType: string, bytes: Uint8Array) {
  if (!storeAudioEnabled()) {
    return { status: 'discarded_by_policy', path: null as string | null };
  }
  const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  if (!supabaseUrl || !serviceRoleKey) {
    return { status: 'storage_not_configured', path: null as string | null };
  }

  const extension = audioExtension(mimeType);
  const path = `${sessionId}/q${String(questionIndex).padStart(2, '0')}-${Date.now()}.${extension}`;
  const response = await fetch(`${supabaseUrl}/storage/v1/object/${futureBookAudioBucket}/${path}`, {
    method: 'PUT',
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      'Content-Type': mimeType,
      'Cache-Control': 'private, max-age=0',
      'x-upsert': 'true'
    },
    body: bytes
  }).catch(() => null);

  if (!response?.ok) {
    return { status: response ? `storage_http_${response.status}` : 'storage_fetch_failed', path: null as string | null };
  }
  return { status: 'stored_private', path };
}

async function transcriptionApiKey() {
  return await providerSecret('transcription') || await providerSecret('openai');
}

function pendingTranscript(transcript: string, source: string) {
  return source === 'pending' || /^\[Audio capturado:/i.test(transcript);
}

function narrativeDensityScore(text: string) {
  const normalized = safeLongText(text, '', 4000).toLowerCase();
  const words = wordCount(normalized);
  if (!words) return 0;
  const sceneHints = ['cuando', 'porque', 'recuerdo', 'miedo', 'quiero', 'siento', 'persona', 'trabajo', 'familia', 'pareja', 'dinero', 'tiempo', 'decision'];
  const concreteSignals = sceneHints.filter((hint) => normalized.includes(hint)).length;
  const firstPersonSignals = (normalized.match(/\b(yo|me|mi|mis|conmigo|siento|quiero|creo)\b/g) || []).length;
  const lengthScore = Math.min(0.45, words / 90);
  const concreteScore = Math.min(0.35, concreteSignals * 0.05);
  const firstPersonScore = Math.min(0.2, firstPersonSignals * 0.025);
  return Number((lengthScore + concreteScore + firstPersonScore).toFixed(2));
}

async function transcribeAnswerAudio(input: {
  sessionId: string;
  questionIndex: number;
  questionText: string;
  mimeType: string;
  bytes: Uint8Array;
}) {
  const apiKey = await transcriptionApiKey();
  const model = Deno.env.get('FUTURE_BOOK_TRANSCRIPTION_MODEL') || 'gpt-4o-mini-transcribe';
  if (!apiKey) {
    await insertEvent(input.sessionId, 'answer_transcription_failed', {
      question_index: input.questionIndex,
      reason: 'transcription_provider_missing',
      model,
      sprint: 8
    }).catch(() => null);
    return { ok: false, transcript: '', status: 'provider_missing', provider: 'openai', model };
  }

  await insertEvent(input.sessionId, 'answer_transcription_started', {
    question_index: input.questionIndex,
    provider: 'openai',
    model,
    audio_bytes: input.bytes.byteLength,
    sprint: 8
  }).catch(() => null);

  const form = new FormData();
  const fileName = `answer-${String(input.questionIndex).padStart(2, '0')}.${audioExtension(input.mimeType)}`;
  form.append('file', new Blob([input.bytes], { type: input.mimeType }), fileName);
  form.append('model', model);
  form.append('response_format', 'json');
  form.append('language', 'es');
  form.append('prompt', `Transcribe una respuesta en espanol para una entrevista literaria privada. Pregunta: ${safeLongText(input.questionText, '', 500)}`);

  const startedAt = Date.now();
  const response = await fetchWithTimeout('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form
  }, 60000).catch((error) => ({ ok: false, status: 0, text: async () => String(error?.message || 'fetch_failed') }) as Response);

  const text = await response.text();
  if (!response.ok) {
    await insertEvent(input.sessionId, 'answer_transcription_failed', {
      question_index: input.questionIndex,
      provider: 'openai',
      model,
      status: response.status,
      detail: safeLongText(text, '', 500),
      sprint: 8
    }).catch(() => null);
    return { ok: false, transcript: '', status: `openai_http_${response.status}`, provider: 'openai', model };
  }

  let parsed: Record<string, unknown> | null = null;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = null;
  }
  const transcript = safeLongText(parsed?.text || text, '', 12000);
  if (!transcript) {
    await insertEvent(input.sessionId, 'answer_transcription_failed', {
      question_index: input.questionIndex,
      provider: 'openai',
      model,
      status: 'empty_transcript',
      sprint: 8
    }).catch(() => null);
    return { ok: false, transcript: '', status: 'empty_transcript', provider: 'openai', model };
  }

  await insertEvent(input.sessionId, 'answer_transcription_completed', {
    question_index: input.questionIndex,
    provider: 'openai',
    model,
    latency_ms: Date.now() - startedAt,
    word_count: wordCount(transcript),
    sprint: 8
  }).catch(() => null);

  return { ok: true, transcript, status: 'completed', provider: 'openai', model };
}

function pdfText(value: unknown, limit = 2400) {
  return safeLongText(value, '', limit)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x20-\x7E]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function pdfEscape(value: string) {
  return value.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

function pdfTextOp(text: string, size: number, font: string, x: number, y: number, gray = 0) {
  return `BT ${gray.toFixed(2)} g /${font} ${size} Tf ${x.toFixed(2)} ${y.toFixed(2)} Td (${pdfEscape(text)}) Tj ET`;
}

function pdfRectOp(x: number, y: number, width: number, height: number, gray = 0) {
  return `q ${gray.toFixed(2)} g ${x.toFixed(2)} ${y.toFixed(2)} ${width.toFixed(2)} ${height.toFixed(2)} re f Q`;
}

function pdfLineOp(x1: number, y1: number, x2: number, y2: number, gray = 0.18, width = 0.5) {
  return `q ${gray.toFixed(2)} G ${width.toFixed(2)} w ${x1.toFixed(2)} ${y1.toFixed(2)} m ${x2.toFixed(2)} ${y2.toFixed(2)} l S Q`;
}

function wrapPdfText(text: string, fontSize: number, usableWidth: number) {
  const maxChars = Math.max(28, Math.floor(usableWidth / (fontSize * 0.47)));
  const words = pdfText(text, 5000).split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length > maxChars && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [''];
}

function pdfPageMargins(pageNumber: number) {
  const rightPage = pageNumber % 2 === 1;
  return {
    left: rightPage ? 58 : 44,
    right: rightPage ? 44 : 58,
    top: 58,
    bottom: 62
  };
}

function buildPdfDocument(manuscriptPayload: Record<string, unknown>, sessionId: string) {
  const manuscript = manuscriptPayload.manuscript && typeof manuscriptPayload.manuscript === 'object'
    ? manuscriptPayload.manuscript as Record<string, unknown>
    : manuscriptPayload;
  const sections = Array.isArray(manuscript.sections)
    ? manuscript.sections as Array<Record<string, unknown>>
    : [];
  const title = pdfText(manuscript.title || manuscriptPayload.title || 'Futuro Anterior', 180) || 'Futuro Anterior';
  const subtitle = pdfText(manuscript.subtitle || 'Un libro desde futuros plausibles.', 180);
  const pageWidth = 420;
  const pageHeight = 595;
  const footerY = 34;
  const pages: Array<Record<string, unknown>> = [];
  let y = 0;
  let margins = pdfPageMargins(1);

  function currentPage(): Record<string, unknown> {
    if (!pages.length) newPage('cover');
    return pages[pages.length - 1];
  }

  function ops() {
    const page = currentPage();
    if (!Array.isArray(page.operations)) page.operations = [];
    return page.operations as string[];
  }

  function newPage(kind = 'body', sectionTitle = '') {
    const pageNumber = pages.length + 1;
    margins = pdfPageMargins(pageNumber);
    y = pageHeight - margins.top;
    pages.push({
      kind,
      sectionTitle: pdfText(sectionTitle, 180),
      operations: []
    });
  }

  function usableWidth() {
    return pageWidth - margins.left - margins.right;
  }

  function addLine(text: string, size = 10, font = 'F1', x = margins.left, gray = 0) {
    if (y < margins.bottom + 38) newPage('body', String(currentPage().sectionTitle || ''));
    ops().push(pdfTextOp(pdfText(text, 1400), size, font, x, y, gray));
    y -= size + 4;
  }

  function addCentered(text: unknown, size = 12, font = 'F1', centerY = y, gray = 0, width = pageWidth - 80) {
    const lines = wrapPdfText(String(text || ''), size, width);
    const startY = centerY + ((lines.length - 1) * (size + 5)) / 2;
    lines.forEach((line, index) => {
      const approximateWidth = line.length * size * 0.47;
      const x = Math.max(34, (pageWidth - approximateWidth) / 2);
      ops().push(pdfTextOp(line, size, font, x, startY - index * (size + 5), gray));
    });
  }

  function addParagraph(text: unknown, size = 10.2, font = 'F1', gap = 9, indentFirst = false) {
    const lines = wrapPdfText(String(text || ''), size, usableWidth() - (indentFirst ? 14 : 0));
    lines.forEach((line, index) => {
      addLine(line, size, font, margins.left + (indentFirst && index === 0 ? 14 : 0), 0.04);
    });
    y -= gap;
  }

  function addRule(gray = 0.25) {
    ops().push(pdfLineOp(margins.left, y, pageWidth - margins.right, y, gray, 0.7));
    y -= 18;
  }

  function addSectionOpener(sectionTitle: unknown, kind = 'chapter') {
    newPage('opener', String(sectionTitle || kind));
    ops().push(pdfRectOp(0, pageHeight - 96, pageWidth, 96, 0.93));
    addCentered(String(kind || 'chapter').toUpperCase(), 9, 'F3', pageHeight - 54, 0.34, 280);
    y = pageHeight - 168;
    addCentered(sectionTitle, 18, 'F2', y, 0.02, pageWidth - 110);
    y -= 88;
    ops().push(pdfLineOp(152, y, pageWidth - 152, y, 0.25, 0.9));
    y -= 42;
  }

  function addReadingNotes() {
    newPage('notes', 'registro de lectura');
    addLine('REGISTRO DE LECTURA', 14, 'F2', margins.left, 0.08);
    y -= 8;
    addParagraph('Anota aqui las frases que no puedes quitarte de encima. No busques estar de acuerdo: busca donde el texto se ha quedado enganchado.', 10.5, 'F3', 14);
    for (let index = 0; index < 12; index += 1) {
      ops().push(pdfLineOp(margins.left, y, pageWidth - margins.right, y, 0.74, 0.35));
      y -= 28;
    }
  }

  newPage('cover');
  ops().push(pdfRectOp(0, 0, pageWidth, pageHeight, 0.08));
  ops().push(pdfRectOp(28, 28, pageWidth - 56, pageHeight - 56, 0.12));
  addCentered('FUTURO ANTERIOR', 10, 'F3', pageHeight - 92, 0.82, 260);
  addCentered(title.toUpperCase(), 24, 'F2', pageHeight - 248, 1, pageWidth - 82);
  addCentered(subtitle, 11, 'F1', pageHeight - 330, 0.86, pageWidth - 96);
  addCentered(`EJEMPLAR PRIVADO ${sessionId.slice(0, 8).toUpperCase()}`, 8, 'F3', 88, 0.72, pageWidth - 120);

  newPage('front_matter', 'hoja suelta');
  y = pageHeight - 92;
  addLine('ANTES DE LEER', 18, 'F2', margins.left, 0.06);
  addRule();
  addParagraph('Este libro no contiene una prediccion. Contiene un artefacto narrativo construido con respuestas, patrones y futuros plausibles.', 11, 'F1', 12);
  addParagraph('Leelo de una sentada si puedes. Marca lo que te incomode. Lo que te incomoda suele ser una puerta, no una amenaza.', 11, 'F1', 12);
  addParagraph('Si algo de este texto toca decisiones medicas, legales, financieras o psicologicas, no actues solo con este libro. Habla con una persona cualificada.', 10.2, 'F3', 12);

  newPage('toc', 'indice');
  addLine('INDICE', 18, 'F2', margins.left, 0.06);
  addRule();
  sections
    .filter((item) => String(item.kind || '') !== 'cover')
    .forEach((item, index) => {
      const label = pdfText(item.title || item.id || `seccion ${index + 1}`, 120);
      addLine(`${String(index + 1).padStart(2, '0')}  ${label}`, 10.8, index % 3 === 0 ? 'F2' : 'F1', margins.left, 0.08);
      y -= 3;
    });

  for (const item of sections) {
    if (String(item.kind || '') === 'cover') continue;
    const kind = pdfText(item.kind || 'chapter', 40);
    const titleText = pdfText(item.title || item.id || 'seccion', 180);
    addSectionOpener(titleText, kind);
    const paragraphs = Array.isArray(item.paragraphs) ? item.paragraphs : [];
    for (const paragraph of paragraphs) {
      addParagraph(paragraph, kind === 'notice' ? 9.4 : 10.4, kind === 'notice' ? 'F3' : 'F1', 9, true);
    }
    y -= 6;
  }

  while (pages.length < 32) {
    addReadingNotes();
  }

  pages.forEach((page, index) => {
    const pageNumber = index + 1;
    const pageMargins = pdfPageMargins(pageNumber);
    const pageOps = page.operations as string[];
    if (pageNumber > 1) {
      const header = pdfText(String(page.sectionTitle || title), 70);
      pageOps.push(pdfTextOp(header.toUpperCase(), 7.2, 'F3', pageMargins.left, pageHeight - 34, 0.42));
      pageOps.push(pdfLineOp(pageMargins.left, pageHeight - 42, pageWidth - pageMargins.right, pageHeight - 42, 0.78, 0.3));
      const pageLabel = String(pageNumber);
      pageOps.push(pdfTextOp(pageLabel, 8.5, 'F1', pageWidth / 2 - pageLabel.length * 2.2, footerY, 0.28));
    }
  });

  const objects: string[] = [];
  objects[1] = '<< /Type /Catalog /Pages 2 0 R >>';
  objects[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Times-Roman >>';
  objects[4] = '<< /Type /Font /Subtype /Type1 /BaseFont /Times-Bold >>';
  objects[5] = '<< /Type /Font /Subtype /Type1 /BaseFont /Times-Italic >>';
  const kids: string[] = [];

  pages.forEach((page, index) => {
    const pageObjectId = 6 + index * 2;
    const contentObjectId = pageObjectId + 1;
    kids.push(`${pageObjectId} 0 R`);
    const content = ((page.operations || []) as string[]).join('\n');
    objects[pageObjectId] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /TrimBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 3 0 R /F2 4 0 R /F3 5 0 R >> >> /Contents ${contentObjectId} 0 R >>`;
    objects[contentObjectId] = `<< /Length ${content.length} >>\nstream\n${content}\nendstream`;
  });

  objects[2] = `<< /Type /Pages /Kids [${kids.join(' ')}] /Count ${pages.length} >>`;
  const maxObject = 5 + pages.length * 2;
  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  for (let index = 1; index <= maxObject; index += 1) {
    offsets[index] = pdf.length;
    pdf += `${index} 0 obj\n${objects[index]}\nendobj\n`;
  }
  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${maxObject + 1}\n`;
  pdf += '0000000000 65535 f \n';
  for (let index = 1; index <= maxObject; index += 1) {
    pdf += `${String(offsets[index]).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${maxObject + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

  return {
    base64: btoa(pdf),
    pageCount: pages.length,
    byteSize: pdf.length,
    pageSize: 'A5',
    title,
    template: 'future-book-a5-editorial-v1',
    layout: {
      trim_size: 'A5',
      width_points: pageWidth,
      height_points: pageHeight,
      mirrored_margins: true,
      fonts: ['Times-Roman', 'Times-Bold', 'Times-Italic'],
      page_kinds: pages.map((page) => page.kind)
    }
  };
}

const futureBookPdfBucket = 'future-book-pdfs';
const editorialPdfTemplate = 'future-book-a5-editorial-v1';

async function uploadPrivatePdfArtifact(sessionId: string, version: number, fileName: string, pdfBase64: string) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  if (!supabaseUrl || !serviceRoleKey) {
    return { status: 'storage_not_configured', path: null as string | null };
  }
  const path = `${sessionId}/v${String(version).padStart(2, '0')}/${fileName}`;
  const bytes = base64ToBytes(pdfBase64);
  const response = await fetch(`${supabaseUrl}/storage/v1/object/${futureBookPdfBucket}/${path}`, {
    method: 'PUT',
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      'Content-Type': 'application/pdf',
      'Cache-Control': 'private, max-age=0',
      'x-upsert': 'true'
    },
    body: bytes
  }).catch(() => null);

  if (!response?.ok) {
    return { status: response ? `storage_http_${response.status}` : 'storage_fetch_failed', path: null as string | null };
  }
  return { status: 'stored_private', path };
}

async function loadPrivatePdfBase64(storagePath: unknown) {
  const path = safeLongText(storagePath, '', 800);
  const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  if (!path || !supabaseUrl || !serviceRoleKey) return '';
  const response = await fetch(`${supabaseUrl}/storage/v1/object/${futureBookPdfBucket}/${path}`, {
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`
    }
  }).catch(() => null);
  if (!response?.ok) return '';
  return arrayBufferToBase64(await response.arrayBuffer());
}

async function signedPrivatePdfUrl(storagePath: unknown, expiresIn = 900) {
  const path = safeLongText(storagePath, '', 800);
  const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  if (!path || !supabaseUrl || !serviceRoleKey) return '';
  const response = await fetch(`${supabaseUrl}/storage/v1/object/sign/${futureBookPdfBucket}/${path}`, {
    method: 'POST',
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ expiresIn })
  }).catch(() => null);
  const data = await response?.json().catch(() => ({}));
  const signedURL = safeLongText(data?.signedURL || data?.signedUrl, '', 1200);
  if (!response?.ok || !signedURL) return '';
  return signedURL.startsWith('http') ? signedURL : `${supabaseUrl}/storage/v1${signedURL}`;
}

function validateEditorialPdf(pdf: Record<string, unknown>, degraded: boolean, storage: Record<string, unknown>) {
  const base64 = safeLongText(pdf.base64, '', 100);
  const decodedPrefix = base64 ? atob(base64.slice(0, 32)) : '';
  const pageCount = Number(pdf.pageCount || 0);
  const byteSize = Number(pdf.byteSize || 0);
  const checks = [
    {
      code: 'pdf_header',
      status: decodedPrefix.startsWith('%PDF-1.4') ? 'pass' : 'fail',
      detail: 'El binario empieza con cabecera PDF 1.4.'
    },
    {
      code: 'private_storage',
      status: storage.path ? 'pass' : 'fail',
      detail: storage.path ? 'PDF almacenado en bucket privado.' : `Storage no disponible: ${storage.status || 'unknown'}.`
    },
    {
      code: 'a5_trim',
      status: pdf.pageSize === 'A5' ? 'pass' : 'fail',
      detail: 'Trim size A5 con MediaBox y TrimBox definidos.'
    },
    {
      code: 'editorial_template',
      status: pdf.template === editorialPdfTemplate ? 'pass' : 'fail',
      detail: 'Plantilla editorial Sprint 10 con portada, front matter, indice, aperturas y notas.'
    },
    {
      code: 'page_count',
      status: pageCount >= 32 && pageCount <= 80 ? 'pass' : 'warning',
      detail: `Paginas generadas: ${pageCount}. Objetivo interior: 32-80 para beta de imprenta.`
    },
    {
      code: 'file_size',
      status: byteSize > 8000 && byteSize < 20_000_000 ? 'pass' : 'fail',
      detail: `Peso PDF: ${byteSize} bytes.`
    },
    {
      code: 'degraded_source',
      status: degraded ? 'fail' : 'pass',
      detail: degraded ? 'El manuscrito fuente esta degradado o bloqueado por calidad.' : 'El manuscrito fuente pasa gates Caronte.'
    }
  ];
  const failures = checks.filter((check) => check.status === 'fail');
  const warnings = checks.filter((check) => check.status === 'warning');
  return {
    template: editorialPdfTemplate,
    ready_for_print: failures.length === 0 && warnings.length === 0,
    status: failures.length ? 'failed' : warnings.length ? 'warning' : 'passed',
    checks,
    page_count: pageCount,
    byte_size: byteSize,
    generated_at: new Date().toISOString()
  };
}

async function publicPdfWithBinary(row: Record<string, unknown> | null) {
  const payload = publicPdf(row, false);
  if (!row || !payload) return payload;
  const storedBase64 = safeLongText(row.pdf_base64, '', 20_000_000);
  const storageBase64 = storedBase64 || await loadPrivatePdfBase64(row.storage_path);
  const signedUrl = await signedPrivatePdfUrl(row.storage_path);
  return {
    ...payload,
    ...(storageBase64 ? { pdfBase64: storageBase64 } : {}),
    ...(signedUrl ? { signedUrl } : {})
  };
}

async function latestReadyManuscript(sessionId: string) {
  const row = first(await rest(
    `future_book_manuscripts?session_id=eq.${encodeParam(sessionId)}&status=eq.ready&select=*&order=created_at.desc&limit=1`
  )) as Record<string, unknown> | null;
  return row;
}

function manuscriptIsDegraded(manuscript: Record<string, unknown>) {
  const providerChain = manuscript.provider_chain && typeof manuscript.provider_chain === 'object'
    ? manuscript.provider_chain as Record<string, unknown>
    : {};
  const qualityReport = manuscript.quality_report && typeof manuscript.quality_report === 'object'
    ? manuscript.quality_report as Record<string, unknown>
    : {};
  return providerChain.degraded === true
    || ['deterministic', 'openai_failed'].includes(String(providerChain.drafting || ''))
    || ['degraded_provider_fallback', 'blocked_safety', 'needs_caronte_rewrite'].includes(String(qualityReport.status || ''));
}

async function latestPdf(sessionId: string) {
  const row = first(await rest(
    `future_book_pdfs?session_id=eq.${encodeParam(sessionId)}&select=*&order=version.desc&limit=1`
  )) as Record<string, unknown> | null;
  return row;
}

function publicPdf(row: Record<string, unknown> | null, includeBase64 = false) {
  if (!row) return null;
  return {
    id: row.id,
    sessionId: row.session_id,
    manuscriptId: row.manuscript_id,
    version: row.version,
    status: row.status,
    reviewStatus: row.review_status,
    fileName: row.file_name,
    mimeType: row.mime_type,
    pageCount: row.page_count,
    pageSize: row.page_size,
    storagePath: row.storage_path,
    qualityReport: row.quality_report,
    printValidation: row.print_validation,
    luluMetadata: row.lulu_metadata,
    reviewNotes: row.review_notes,
    reviewedBy: row.reviewed_by,
    reviewedAt: row.reviewed_at,
    releasedAt: row.released_at,
    metadata: row.metadata,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    ...(includeBase64 ? { pdfBase64: row.pdf_base64 } : {})
  };
}

async function nextPdfVersion(sessionId: string) {
  const existing = await latestPdf(sessionId);
  return Number(existing?.version || 0) + 1;
}

function stablePdfFileName(sessionId: string, version: number) {
  return `futuro-anterior-${sessionId.slice(0, 8)}-v${String(version).padStart(2, '0')}.pdf`;
}

function providerDefinitions() {
  return [
    { provider: 'elevenlabs', displayName: 'ElevenLabs voz Javier', env: ['ELEVENLABS_API_KEY'], required: true },
    { provider: 'openai', displayName: 'GPT-5.4 / OpenAI redaccion', env: ['OPENAI_API_KEY'], required: true },
    { provider: 'anthropic', displayName: 'Claude Opus / revision', env: ['ANTHROPIC_API_KEY'], required: true },
    { provider: 'transcription', displayName: 'Transcripcion backend', env: ['FUTURE_BOOK_TRANSCRIPTION_API_KEY'], required: false },
    { provider: 'lulu', displayName: 'Lulu print API', env: ['LULU_API_KEY'], required: false, placeholder: true }
  ];
}

function strictAiProvidersRequired() {
  const explicit = String(Deno.env.get('FUTURE_BOOK_REQUIRE_AI_PROVIDERS') || '').toLowerCase();
  if (['1', 'true', 'yes'].includes(explicit)) return true;
  if (['0', 'false', 'no'].includes(explicit)) return false;
  return (Deno.env.get('APP_ENV') || 'local') === 'production';
}

async function encryptedSecret(value: string) {
  const secretKey = Deno.env.get('FUTURE_BOOK_SECRET_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  if (!secretKey) throw new Error('FUTURE_BOOK_SECRET_KEY required to store provider keys');
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(secretKey));
  const key = await crypto.subtle.importKey('raw', digest, 'AES-GCM', false, ['encrypt']);
  const nonce = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, key, new TextEncoder().encode(value));
  return {
    ciphertext: arrayBufferToBase64(encrypted),
    nonce: bytesToBase64(nonce)
  };
}

function base64ToBytes(value: string) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

async function decryptSecret(ciphertext: unknown, nonce: unknown) {
  const encrypted = safeLongText(ciphertext, '', 10000);
  const iv = safeLongText(nonce, '', 200);
  if (!encrypted || !iv) return '';
  const secretKey = Deno.env.get('FUTURE_BOOK_SECRET_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  if (!secretKey) return '';
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(secretKey));
  const key = await crypto.subtle.importKey('raw', digest, 'AES-GCM', false, ['decrypt']);
  const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: base64ToBytes(iv) }, key, base64ToBytes(encrypted));
  return new TextDecoder().decode(decrypted);
}

async function storedProviderSetting(provider: string) {
  const row = first(await rest(
    `future_book_provider_settings?provider=eq.${encodeParam(provider)}&select=*&limit=1`
  ).catch(() => [])) as Record<string, unknown> | null;
  return row;
}

async function providerSecret(provider: string) {
  const definition = providerDefinitions().find((item) => item.provider === provider);
  if (!definition) return '';
  for (const name of definition.env) {
    const value = Deno.env.get(name);
    if (value) return value;
  }
  const row = await storedProviderSetting(provider);
  if (row?.configured !== true) return '';
  return decryptSecret(row.secret_ciphertext, row.secret_nonce).catch(() => '');
}

async function missingRequiredProviders(scope: 'book' | 'all' = 'all') {
  const required = providerDefinitions().filter((definition) => {
    if (definition.required !== true) return false;
    if (scope === 'book') return ['openai', 'anthropic'].includes(definition.provider);
    return true;
  });
  const missing: string[] = [];
  for (const definition of required) {
    const secret = await providerSecret(definition.provider);
    if (!secret) missing.push(definition.provider);
  }
  return missing;
}

async function blockBookGenerationForMissingProviders(row: Record<string, unknown>, missing: string[]) {
  await patchSession(String(row.id), {
    status: 'blocked',
    book_status: 'failed',
    error_code: 'required_ai_provider_missing',
    metadata: {
      ...(row.metadata && typeof row.metadata === 'object' ? row.metadata : {}),
      sprint7: {
        blocked_at: new Date().toISOString(),
        missing_required_providers: missing
      }
    }
  }).catch(() => null);
  await insertEvent(String(row.id), 'book_generation_blocked', {
    reason: 'required_ai_provider_missing',
    missing_providers: missing,
    sprint: 7
  }).catch(() => null);
  await ensureP0Alert('future_book_required_provider_missing', 'Faltan proveedores obligatorios para generar libros con IA real.', {
    providers: missing,
    session_id: row.id
  }).catch(() => null);
}

type FutureBookAdminContext = {
  mode: string;
  role: string;
  email: string | null;
  userId: string | null;
  adminUserId: string | null;
  label: string;
  permissions: string[];
};

const futureBookAdminPermissions: Record<string, string[]> = {
  viewer: ['adminDashboard', 'adminMonitor', 'adminSessionDetail', 'adminPdf'],
  support: ['adminDashboard', 'adminMonitor', 'adminSessionDetail', 'adminPdf', 'adminPatchSessionStatus'],
  editor: [
    'adminDashboard',
    'adminMonitor',
    'adminSessionDetail',
    'adminPdf',
    'adminApprovePdf',
    'adminRejectPdf',
    'adminRequestRegeneration',
    'adminRegeneratePdf',
    'adminReleasePdf'
  ],
  ops: [
    'adminDashboard',
    'adminMonitor',
    'adminSessionDetail',
    'adminPdf',
    'adminPatchSessionStatus',
    'adminRunRetention',
    'adminRunSyntheticMonitor',
    'adminRunAutonomousMonitor',
    'adminRetryDeadLetter',
    'adminResolveDeadLetter',
    'adminCreateAccessCampaign',
    'adminUpdateAccessCampaign',
    'adminUpdateAccessPolicy',
    'adminCreateAccessInvites',
    'adminRevokeAccessInvite',
    'adminPrivacyExport',
    'adminPrivacyErase',
    'adminToggleAccess',
    'adminDeleteSessionData',
    'adminTestProvider'
  ],
  owner: ['*'],
  legacy_token: ['*'],
  local_admin: ['*']
};

function futureBookAdminEmails() {
  return String(Deno.env.get('FUTURE_BOOK_ADMIN_EMAILS') || Deno.env.get('APP_ADMIN_EMAILS') || '')
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

function rolePermissions(role: string) {
  return futureBookAdminPermissions[role] || futureBookAdminPermissions.viewer;
}

function canRunAdminAction(role: string, action: string) {
  const permissions = rolePermissions(role);
  return permissions.includes('*') || permissions.includes(action);
}

function publicAdminContext(admin: FutureBookAdminContext) {
  return {
    mode: admin.mode,
    role: admin.role,
    email: admin.email,
    label: admin.label,
    permissions: admin.permissions
  };
}

async function storedFutureBookAdmin(userId: string | null, email: string | null) {
  const byUser = userId
    ? first(await rest(
      `future_book_admin_users?user_id=eq.${encodeParam(userId)}&status=eq.active&select=*&limit=1`
    ).catch(() => [])) as Record<string, unknown> | null
    : null;
  if (byUser?.id) return byUser;

  return email
    ? first(await rest(
      `future_book_admin_users?email=eq.${encodeParam(email)}&status=eq.active&select=*&limit=1`
    ).catch(() => [])) as Record<string, unknown> | null
    : null;
}

async function futureBookAdminFromAuth(req: Request) {
  const authorization = req.headers.get('authorization') || '';
  if (!authorization.startsWith('Bearer ')) return null;
  const user = await getUser(req).catch(() => null);
  const email = safeText(user?.email, '', 240).toLowerCase() || null;
  const platformAdmin = Boolean(email && futureBookAdminEmails().includes(email));
  const storedAdmin = await storedFutureBookAdmin(user?.id || null, email);
  if (!platformAdmin && !storedAdmin?.id) return null;
  const role = platformAdmin ? 'owner' : safeText(storedAdmin?.role, 'viewer', 40);
  return {
    mode: 'supabase_auth',
    role,
    email,
    userId: user?.id || null,
    adminUserId: storedAdmin?.id ? String(storedAdmin.id) : null,
    label: email || safeText(storedAdmin?.display_name, 'future_book_admin', 120),
    permissions: rolePermissions(role)
  } satisfies FutureBookAdminContext;
}

async function requireFutureBookAdmin(req: Request, payload: Record<string, unknown>, action = 'adminDashboard') {
  const authAdmin = await futureBookAdminFromAuth(req);
  if (authAdmin) {
    if (!canRunAdminAction(authAdmin.role, action)) throw new Error('Insufficient future book admin permissions');
    return authAdmin;
  }

  const configured = Deno.env.get('FUTURE_BOOK_ADMIN_TOKEN') || '';
  const provided = safeText(payload.adminToken, '', 240);
  const appEnv = Deno.env.get('APP_ENV') || 'local';
  if (!configured && appEnv !== 'production') {
    return {
      mode: 'local',
      role: 'local_admin',
      email: null,
      userId: null,
      adminUserId: null,
      label: 'local_admin',
      permissions: rolePermissions('local_admin')
    } satisfies FutureBookAdminContext;
  }
  if (!configured) throw new Error('FUTURE_BOOK_ADMIN_TOKEN is not configured');
  if (provided !== configured) throw new Error('Invalid admin token');
  return {
    mode: 'legacy_token',
    role: 'legacy_token',
    email: null,
    userId: null,
    adminUserId: null,
    label: 'future_book_admin',
    permissions: rolePermissions('legacy_token')
  } satisfies FutureBookAdminContext;
}

async function auditFutureBookAdmin(
  req: Request,
  admin: FutureBookAdminContext,
  action: string,
  resourceType: string | null,
  resourceId: string | null,
  metadata: Record<string, unknown> = {},
  outcome = 'success'
) {
  await rest('future_book_admin_audit_events', {
    method: 'POST',
    body: {
      admin_user_id: admin.adminUserId,
      admin_email: admin.email,
      admin_role: admin.role,
      action,
      resource_type: resourceType,
      resource_id: resourceId,
      outcome,
      ip_hint: clientIp(req),
      user_agent: userAgent(req),
      metadata: {
        ...metadata,
        mode: admin.mode
      }
    },
    prefer: 'return=minimal'
  }).catch(() => null);
}

async function runtimeFlag(key: string) {
  const row = first(await rest(
    `future_book_runtime_flags?key=eq.${encodeParam(key)}&select=*&limit=1`
  ).catch(() => [])) as Record<string, unknown> | null;
  return row?.value && typeof row.value === 'object' ? row.value as Record<string, unknown> : {};
}

async function setRuntimeFlag(key: string, value: Record<string, unknown>, updatedBy: string) {
  const row = first(await rest('future_book_runtime_flags?on_conflict=key', {
    method: 'POST',
    prefer: 'resolution=merge-duplicates,return=representation',
    body: {
      key,
      value,
      updated_by: updatedBy
    }
  })) as Record<string, unknown> | null;
  return row;
}

async function accessDisabled() {
  const envDisabled = ['1', 'true', 'yes'].includes(String(Deno.env.get('FUTURE_BOOK_ACCESS_DISABLED') || '').toLowerCase());
  if (envDisabled) return { disabled: true, source: 'env', reason: 'FUTURE_BOOK_ACCESS_DISABLED' };
  const flag = await runtimeFlag('access_control');
  return {
    disabled: flag.disabled === true,
    source: flag.disabled === true ? 'runtime_flag' : 'open',
    reason: safeText(flag.reason, '', 240) || null,
    updated_at: flag.updated_at || null
  };
}

function defaultAccessMode() {
  const explicit = safeText(Deno.env.get('FUTURE_BOOK_ACCESS_MODE'), '', 40);
  const requireInvite = ['1', 'true', 'yes'].includes(String(Deno.env.get('FUTURE_BOOK_REQUIRE_INVITE') || '').toLowerCase());
  if (explicit === 'invite_required' || requireInvite) return 'invite_required';
  return 'fixed_beta';
}

async function accessPolicy() {
  const flag = await runtimeFlag('viral_access_control');
  const mode = ['fixed_beta', 'invite_required'].includes(String(flag.mode)) ? String(flag.mode) : defaultAccessMode();
  return {
    mode,
    fixedBetaEnabled: typeof flag.fixed_beta_enabled === 'boolean' ? flag.fixed_beta_enabled : mode === 'fixed_beta',
    campaignCode: safeText(flag.campaign_code, '', 80) || null,
    waitlistEnabled: typeof flag.waitlist_enabled === 'boolean' ? flag.waitlist_enabled : true,
    updatedAt: flag.updated_at || null,
    updatedBy: flag.updated_by || null
  };
}

function accessTokenFromPayload(payload: Record<string, unknown>) {
  return safeLongText(payload.inviteToken || payload.accessToken || payload.k, '', 320);
}

async function accessTokenHash(token: string) {
  return privacyHash(`future_book_access_invite:${token}`);
}

function publicAccessCampaign(row: Record<string, unknown> | null) {
  if (!row) return null;
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    status: row.status,
    accessMode: row.access_mode,
    fixedBetaEnabled: row.fixed_beta_enabled,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    defaultTtlMinutes: row.default_ttl_minutes,
    inviteMaxUses: row.invite_max_uses,
    maxInvites: row.max_invites,
    maxSessions: row.max_sessions,
    issuedInvites: row.issued_invites,
    usedSessions: row.used_sessions,
    waitlistEnabled: row.waitlist_enabled,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function publicAccessInvite(row: Record<string, unknown> | null) {
  if (!row) return null;
  return {
    id: row.id,
    campaignId: row.campaign_id,
    tokenHint: row.token_hint,
    status: row.status,
    maxUses: row.max_uses,
    useCount: row.use_count,
    childInviteLimit: row.child_invite_limit,
    childInviteCount: row.child_invite_count,
    depth: row.depth,
    parentInviteId: row.parent_invite_id,
    expiresAt: row.expires_at,
    firstUsedAt: row.first_used_at,
    lastUsedAt: row.last_used_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

async function findAccessInviteByToken(token: string) {
  const tokenHash = await accessTokenHash(token);
  const invite = first(await rest(
    `future_book_access_invites?token_hash=eq.${encodeParam(tokenHash || '')}&select=*&limit=1`
  ).catch(() => [])) as Record<string, unknown> | null;
  if (!invite?.id) return { tokenHash, invite: null, campaign: null };
  const campaign = first(await rest(
    `future_book_access_campaigns?id=eq.${encodeParam(String(invite.campaign_id))}&select=*&limit=1`
  ).catch(() => [])) as Record<string, unknown> | null;
  return { tokenHash, invite, campaign };
}

function campaignAllowsAccess(campaign: Record<string, unknown> | null) {
  if (!campaign?.id) return { ok: false, reason: 'campaign_missing' };
  const now = Date.now();
  const starts = Date.parse(String(campaign.starts_at || ''));
  const ends = campaign.ends_at ? Date.parse(String(campaign.ends_at)) : NaN;
  if (campaign.status !== 'active') return { ok: false, reason: `campaign_${campaign.status || 'inactive'}` };
  if (Number.isFinite(starts) && starts > now) return { ok: false, reason: 'campaign_not_started' };
  if (Number.isFinite(ends) && ends < now) return { ok: false, reason: 'campaign_expired' };
  if (Number(campaign.used_sessions || 0) >= Number(campaign.max_sessions || 0)) return { ok: false, reason: 'campaign_capacity_exhausted' };
  return { ok: true, reason: 'campaign_active' };
}

async function evaluateAccessGate(req: Request, payload: Record<string, unknown>) {
  const disabled = await accessDisabled();
  if (disabled.disabled) {
    return { granted: false, reason: 'access_disabled', policy: await accessPolicy(), disabled };
  }
  const policy = await accessPolicy();
  const token = accessTokenFromPayload(payload);
  if (!token) {
    const fixedBetaAllowed = policy.mode === 'fixed_beta' || policy.fixedBetaEnabled === true;
    return {
      granted: fixedBetaAllowed,
      reason: fixedBetaAllowed ? 'fixed_beta_allowed' : 'invite_required',
      mode: 'fixed_beta',
      policy,
      disabled
    };
  }

  const { tokenHash, invite, campaign } = await findAccessInviteByToken(token);
  if (!invite?.id) {
    return { granted: false, reason: 'invite_not_found', mode: 'ephemeral_invite', policy, tokenHash, disabled };
  }
  const now = Date.now();
  const expires = Date.parse(String(invite.expires_at || ''));
  if (invite.status !== 'active') {
    return { granted: false, reason: `invite_${invite.status || 'inactive'}`, mode: 'ephemeral_invite', policy, tokenHash, invite, campaign, disabled };
  }
  if (Number.isFinite(expires) && expires < now) {
    await rest(`future_book_access_invites?id=eq.${encodeParam(String(invite.id))}`, {
      method: 'PATCH',
      body: { status: 'expired' },
      prefer: 'return=minimal'
    }).catch(() => null);
    return { granted: false, reason: 'invite_expired', mode: 'ephemeral_invite', policy, tokenHash, invite: { ...invite, status: 'expired' }, campaign, disabled };
  }
  if (Number(invite.use_count || 0) >= Number(invite.max_uses || 1)) {
    return { granted: false, reason: 'invite_capacity_exhausted', mode: 'ephemeral_invite', policy, tokenHash, invite, campaign, disabled };
  }
  const campaignCheck = campaignAllowsAccess(campaign);
  if (!campaignCheck.ok) {
    return { granted: false, reason: campaignCheck.reason, mode: 'ephemeral_invite', policy, tokenHash, invite, campaign, disabled };
  }
  return { granted: true, reason: 'invite_valid', mode: 'ephemeral_invite', policy, tokenHash, invite, campaign, disabled };
}

async function consumeAccessInvite(gate: Record<string, unknown>) {
  const invite = gate.invite as Record<string, unknown> | null;
  const campaign = gate.campaign as Record<string, unknown> | null;
  if (!invite?.id) return null;
  const currentUse = Number(invite.use_count || 0);
  const maxUses = Number(invite.max_uses || 1);
  const nextUse = currentUse + 1;
  const now = new Date().toISOString();
  const updated = first(await rest(
    `future_book_access_invites?id=eq.${encodeParam(String(invite.id))}&status=eq.active&use_count=eq.${currentUse}`,
    {
      method: 'PATCH',
      body: {
        use_count: nextUse,
        status: nextUse >= maxUses ? 'used' : 'active',
        first_used_at: invite.first_used_at || now,
        last_used_at: now
      },
      prefer: 'return=representation'
    }
  ).catch(() => [])) as Record<string, unknown> | null;
  if (!updated?.id) throw new Error('access_link_already_consumed');
  if (campaign?.id) {
    await rest(`future_book_access_campaigns?id=eq.${encodeParam(String(campaign.id))}`, {
      method: 'PATCH',
      body: {
        used_sessions: Number(campaign.used_sessions || 0) + 1
      },
      prefer: 'return=minimal'
    }).catch(() => null);
  }
  return updated;
}

async function accessStatus(req: Request, payload: Record<string, unknown>) {
  const gate = await evaluateAccessGate(req, payload);
  const gateAny = gate as Record<string, unknown>;
  return {
    ok: true,
    access: {
      granted: gateAny.granted === true,
      reason: gateAny.reason,
      mode: gateAny.mode || 'fixed_beta',
      policy: gateAny.policy,
      invite: publicAccessInvite((gateAny.invite as Record<string, unknown> | null) || null),
      campaign: publicAccessCampaign((gateAny.campaign as Record<string, unknown> | null) || null),
      waitlistEnabled: (gateAny.policy as Record<string, unknown> | undefined)?.waitlistEnabled !== false
    }
  };
}

function publicSession(row: Record<string, unknown>) {
  return {
    id: row.id,
    publicToken: row.public_token,
    productCode: row.product_code,
    status: row.status,
    paymentStatus: row.payment_status,
    bookStatus: row.book_status,
    pdfReviewStatus: row.pdf_review_status,
    price: {
      amount: Number(row.price_cents || 0) / 100,
      cents: row.price_cents,
      currency: row.currency
    },
    questionCount: row.question_count,
    locale: row.locale,
    timezone: row.timezone,
    accessCampaignId: row.access_campaign_id || null,
    accessInviteId: row.access_invite_id || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function sessionCredentials(payload: Record<string, unknown>) {
  const sessionId = safeText(payload.sessionId, '', 80);
  const publicToken = safeText(payload.publicToken, '', 80);
  if (!sessionId || !publicToken) throw new Error('Missing session credentials');
  return { sessionId, publicToken };
}

async function insertEvent(sessionId: string, eventType: string, metadata: Record<string, unknown>) {
  await rest('future_book_events', {
    method: 'POST',
    body: {
      session_id: sessionId,
      event_type: eventType,
      metadata
    },
    prefer: 'return=minimal'
  });
}

async function findSession(payload: Record<string, unknown>) {
  const { sessionId, publicToken } = sessionCredentials(payload);
  const row = first(await rest(
    `future_book_sessions?id=eq.${encodeParam(sessionId)}&public_token=eq.${encodeParam(publicToken)}&select=*&limit=1`
  )) as Record<string, unknown> | null;

  if (!row?.id) throw new Error('Session not found');
  return row;
}

async function patchSession(sessionId: string, body: Record<string, unknown>) {
  const updated = first(await rest(`future_book_sessions?id=eq.${encodeParam(sessionId)}`, {
    method: 'PATCH',
    body,
    prefer: 'return=representation'
  })) as Record<string, unknown> | null;

  if (!updated?.id) throw new Error('Could not update future book session');
  return updated;
}

async function currentAnswerCount(sessionId: string) {
  const rows = await rest(`future_book_answers?session_id=eq.${encodeParam(sessionId)}&select=id`);
  return Array.isArray(rows) ? rows.length : 0;
}

async function existingAnswer(sessionId: string, questionIndex: number) {
  const rows = await rest(`future_book_answers?session_id=eq.${encodeParam(sessionId)}&question_index=eq.${questionIndex}&select=id&limit=1`);
  return Array.isArray(rows) ? rows[0] : null;
}

async function createSession(req: Request, payload: Record<string, unknown>) {
  const gate = await evaluateAccessGate(req, payload);
  const gateAny = gate as Record<string, unknown>;
  if (gateAny.granted !== true) throw new Error(`access_denied:${safeText(gateAny.reason, 'invite_required', 120)}`);
  const abuse = await enforceAbuseLimit(req, payload, 'createSession');
  const consumedInvite = await consumeAccessInvite(gateAny);
  const campaign = (gateAny.campaign as Record<string, unknown> | null) || null;
  const invite = consumedInvite || (gateAny.invite as Record<string, unknown> | null) || null;

  const source = gateAny.mode === 'ephemeral_invite' ? 'ephemeral_url' : safeText(payload.source, 'fixed_beta', 40);
  const locale = safeLocale(payload.locale);
  const timezone = safeTimezone(payload.timezone);
  const entrypoint = safeText(payload.entrypoint, 'fixed_url', 120);

  const created = first(await rest('future_book_sessions', {
    method: 'POST',
    body: {
      product_code: Deno.env.get('FUTURE_BOOK_PRODUCT_CODE') || 'futuro_anterior',
      source,
      locale,
      timezone,
      price_cents: safeInt(Deno.env.get('FUTURE_BOOK_PRICE_CENTS'), 4995, 0, 100000),
      currency: safeText(Deno.env.get('FUTURE_BOOK_CURRENCY'), 'EUR', 3).toUpperCase(),
      question_count: safeInt(Deno.env.get('FUTURE_BOOK_DEFAULT_QUESTION_COUNT'), 21, 1, 99),
      ip_hash: abuse.ipHash,
      fingerprint_hash: abuse.fingerprintHash,
      access_campaign_id: campaign?.id || null,
      access_invite_id: invite?.id || null,
      expires_at: retentionExpiry('answers'),
      risk_flags: {
        rate_limited: abuse.limited,
        proof_present: Boolean(payload.abuseProof),
        client_runtime_ms: safeInt(payload.clientRuntimeMs, 0, 0, 24 * 60 * 60 * 1000),
        access_mode: gateAny.mode || 'fixed_beta',
        invite_present: Boolean(invite?.id)
      },
      metadata: {
        sprint: 15,
        entrypoint,
        app_env: Deno.env.get('APP_ENV') || 'local',
        access: {
          mode: gateAny.mode || 'fixed_beta',
          reason: gateAny.reason || null,
          campaign_id: campaign?.id || null,
          campaign_code: campaign?.code || null,
          invite_id: invite?.id || null,
          invite_hint: invite?.token_hint || null,
          invite_expires_at: invite?.expires_at || null
        },
        privacy: {
          retention_expires_at: retentionExpiry('answers'),
          ip_hash_stored: Boolean(abuse.ipHash),
          fingerprint_hash_stored: Boolean(abuse.fingerprintHash),
          raw_ip_stored: false
        },
        user_agent: userAgent(req),
        ip_hint: clientIp(req) ? 'present' : 'missing'
      }
    }
  })) as Record<string, unknown> | null;

  if (!created?.id) throw new Error('Could not create future book session');

  await insertEvent(String(created.id), 'session_created', {
    source,
    entrypoint,
    access: {
      mode: gateAny.mode || 'fixed_beta',
      campaign_id: campaign?.id || null,
      campaign_code: campaign?.code || null,
      invite_id: invite?.id || null,
      invite_hint: invite?.token_hint || null,
      invite_status: invite?.status || null,
      sprint: 15
    },
    app_env: Deno.env.get('APP_ENV') || 'local',
    anti_abuse: {
      ip_hash: Boolean(abuse.ipHash),
      fingerprint_hash: Boolean(abuse.fingerprintHash),
      sprint: 13
    }
  });

  return {
    ok: true,
    product: {
      codeName: 'Futuro Anterior',
      promise: 'Futuros plausibles, no predicciones.'
    },
    session: publicSession(created)
  };
}

async function getSession(payload: Record<string, unknown>) {
  const row = await findSession(payload);
  return { ok: true, session: publicSession(row) };
}

async function recordConsent(payload: Record<string, unknown>) {
  const row = await findSession(payload);
  const now = new Date().toISOString();
  const accepted = payload.accepted === true;
  if (!accepted) throw new Error('Consent must be accepted');

  const updated = await patchSession(String(row.id), {
    status: 'payment_pending',
    privacy_consent_at: now,
    metadata: {
      ...(row.metadata && typeof row.metadata === 'object' ? row.metadata : {}),
      consent: {
        accepted: true,
        accepted_at: now,
        terms_version: safeText(payload.termsVersion, 'future-book-sprint1', 80),
        ai_notice_version: safeText(payload.aiNoticeVersion, 'future-book-sprint1', 80)
      }
    }
  });

  await insertEvent(String(row.id), 'privacy_consent_accepted', {
    terms_version: safeText(payload.termsVersion, 'future-book-sprint1', 80),
    ai_notice_version: safeText(payload.aiNoticeVersion, 'future-book-sprint1', 80)
  });

  return { ok: true, session: publicSession(updated) };
}

async function startSimulatedPayment(req: Request, payload: Record<string, unknown>) {
  const row = await findSession(payload);
  await enforceAbuseLimit(req, payload, 'startSimulatedPayment', String(row.id));
  if (!row.privacy_consent_at) throw new Error('Consent required before payment');

  const updated = await patchSession(String(row.id), {
    status: 'payment_pending',
    payment_status: 'simulated_pending'
  });

  await insertEvent(String(row.id), 'payment_started', {
    mode: 'simulated',
    amount_cents: row.price_cents,
    currency: row.currency
  });

  return { ok: true, session: publicSession(updated) };
}

async function approveSimulatedPayment(req: Request, payload: Record<string, unknown>) {
  const row = await findSession(payload);
  await enforceAbuseLimit(req, payload, 'approveSimulatedPayment', String(row.id));
  if (row.payment_status !== 'simulated_pending' && row.payment_status !== 'simulated_approved') {
    throw new Error('Payment has not been started');
  }

  const updated = await patchSession(String(row.id), {
    status: 'interview_ready',
    payment_status: 'simulated_approved'
  });

  await insertEvent(String(row.id), 'payment_simulated_approved', {
    mode: 'simulated',
    amount_cents: row.price_cents,
    currency: row.currency
  });

  return { ok: true, session: publicSession(updated) };
}

async function startInterview(payload: Record<string, unknown>) {
  const row = await findSession(payload);
  if (row.payment_status !== 'simulated_approved') throw new Error('Payment approval required before interview');
  const answered = await currentAnswerCount(String(row.id));
  const total = Number(row.question_count || 21);
  const index = Math.min(total, answered + 1);
  const participantName = cleanParticipantName(payload.participantName) || participantNameFromRow(row);
  const metadata = row.metadata && typeof row.metadata === 'object' ? row.metadata as Record<string, unknown> : {};

  const now = new Date().toISOString();
  const updated = await patchSession(String(row.id), {
    status: 'interview_active',
    interview_started_at: row.interview_started_at || now,
    metadata: participantName ? {
      ...metadata,
      participant_name: participantName,
      participant_name_set_at: metadata.participant_name_set_at || now
    } : metadata
  });

  await insertEvent(String(row.id), 'interview_started', {
    question_index: index,
    participant_name_present: Boolean(participantName),
    sprint: 3
  });

  return {
    ok: true,
    session: publicSession(updated),
    question: {
      index,
      total,
      text: questionFor(index, participantName)
    }
  };
}

async function getCurrentQuestion(payload: Record<string, unknown>) {
  const row = await findSession(payload);
  const answered = await currentAnswerCount(String(row.id));
  const index = Math.min(Number(row.question_count || 21), answered + 1);
  const participantName = participantNameFromRow(row);
  return {
    ok: true,
    question: {
      index,
      total: row.question_count || 21,
      text: questionFor(index, participantName)
    }
  };
}

async function recordInterviewHeartbeat(payload: Record<string, unknown>) {
  const row = await findSession(payload);
  const stage = safeText(payload.stage, 'active', 40);
  const currentQuestionIndex = safeInt(payload.currentQuestionIndex, 0, 0, 99);
  const pendingAnswerQueueSize = safeInt(payload.pendingAnswerQueueSize, 0, 0, 99);
  const now = new Date().toISOString();
  const metadata = row.metadata && typeof row.metadata === 'object' ? row.metadata as Record<string, unknown> : {};

  const updated = await patchSession(String(row.id), {
    metadata: {
      ...metadata,
      interview_runtime: {
        ...(metadata.interview_runtime && typeof metadata.interview_runtime === 'object' ? metadata.interview_runtime as Record<string, unknown> : {}),
        last_client_seen_at: now,
        last_client_stage: stage,
        current_question_index: currentQuestionIndex || null,
        pending_answer_queue_size: pendingAnswerQueueSize,
        sprint: 8
      }
    }
  });

  if (['hidden', 'unload'].includes(stage)) {
    await insertEvent(String(row.id), 'interview_client_interrupted', {
      stage,
      current_question_index: currentQuestionIndex || null,
      pending_answer_queue_size: pendingAnswerQueueSize,
      sprint: 8
    }).catch(() => null);
  }

  return { ok: true, session: publicSession(updated) };
}

async function requestFollowUp(payload: Record<string, unknown>) {
  const row = await findSession(payload);
  const questionIndex = safeInt(payload.questionIndex, 1, 1, 99);
  const followUpText = followUpFor(questionIndex);
  await insertEvent(String(row.id), 'question_followup_requested', {
    question_index: questionIndex,
    reason: safeText(payload.reason, 'short_answer', 80),
    sprint: 3
  });
  return {
    ok: true,
    question: {
      index: questionIndex,
      total: row.question_count || 21,
      text: followUpText,
      followUp: true
    }
  };
}

async function synthesizeQuestion(req: Request, payload: Record<string, unknown>) {
  const row = await findSession(payload);
  await enforceAbuseLimit(req, payload, 'synthesizeQuestion', String(row.id));
  const questionIndex = safeInt(payload.questionIndex, 1, 0, 99);
  const requestedVoiceMode = safeText(payload.voiceMode, '', 40);
  const voiceMode = requestedVoiceMode === 'expressive_intro' || questionIndex === 0 ? 'expressive_intro' : 'question';
  const questionText = safeLongText(payload.questionText, firstQuestion, voiceMode === 'expressive_intro' ? 5000 : 1200) || firstQuestion;
  const apiKey = await providerSecret('elevenlabs');
  const voiceId = elevenLabsVoiceId();
  const modelId = voiceMode === 'expressive_intro' ? elevenLabsIntroModelId() : elevenLabsModelId();
  const voiceSettings = elevenLabsVoiceSettings(voiceMode);
  let synthesisText = questionText;
  let synthesisModelId = modelId;
  let synthesisVoiceMode = voiceMode;
  let synthesisVoiceSettings = voiceSettings;

  await insertEvent(String(row.id), 'voice_prompt_requested', {
    provider: 'elevenlabs',
    question_index: questionIndex,
    voice_id: voiceId,
    model_id: modelId,
    voice_mode: voiceMode
  });

  if (!apiKey) {
    await insertEvent(String(row.id), 'voice_prompt_failed', {
      provider: 'elevenlabs',
      status: 'missing_api_key',
      voice_id: voiceId,
      model_id: modelId
    });
    throw new Error('elevenlabs_api_key_missing');
  }

  async function requestElevenLabsAudio(text: string, requestModelId: string, requestVoiceSettings: Record<string, unknown>) {
    return await fetchWithTimeout(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}`, {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        Accept: 'audio/mpeg',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        text,
        model_id: requestModelId,
        voice_settings: requestVoiceSettings
      })
    }, 20000).catch(() => null);
  }

  let response: Response | null = null;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    response = await requestElevenLabsAudio(synthesisText, synthesisModelId, synthesisVoiceSettings);
    if (response?.ok) break;
    await new Promise((resolve) => setTimeout(resolve, attempt * 350));
  }

  if (!response?.ok && voiceMode === 'expressive_intro' && modelId !== elevenLabsModelId()) {
    await insertEvent(String(row.id), 'voice_prompt_fallback_requested', {
      provider: 'elevenlabs',
      question_index: questionIndex,
      from_model_id: modelId,
      to_model_id: elevenLabsModelId(),
      reason: response?.status || 'network_error'
    });
    synthesisText = stripVoiceDirectionTags(questionText);
    synthesisModelId = elevenLabsModelId();
    synthesisVoiceMode = 'expressive_intro_fallback';
    synthesisVoiceSettings = elevenLabsVoiceSettings('question');
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      response = await requestElevenLabsAudio(synthesisText, synthesisModelId, synthesisVoiceSettings);
      if (response?.ok) break;
      await new Promise((resolve) => setTimeout(resolve, attempt * 350));
    }
  }

  if (!response?.ok) {
    const status = response?.status || 'network_error';
    await insertEvent(String(row.id), 'voice_prompt_failed', {
      provider: 'elevenlabs',
      status,
      voice_id: voiceId,
      model_id: synthesisModelId,
      voice_mode: synthesisVoiceMode
    });
    throw new Error(`elevenlabs_voice_failed_${status}`);
  }

  const audioBase64 = arrayBufferToBase64(await response.arrayBuffer());
  await rest('future_book_artifacts', {
    method: 'POST',
    body: {
      session_id: row.id,
      artifact_type: 'voice_prompt',
      provider: 'elevenlabs',
      mime_type: 'audio/mpeg',
      metadata: {
        question_index: questionIndex,
        voice_id: voiceId,
        model_id: synthesisModelId,
        voice_mode: synthesisVoiceMode,
        generated_inline: true
      }
    },
    prefer: 'return=minimal'
  });

  return {
    ok: true,
    voice: {
      provider: 'elevenlabs',
      text: synthesisText,
      voiceId,
      modelId: synthesisModelId,
      voiceMode: synthesisVoiceMode,
      audioBase64,
      mimeType: 'audio/mpeg'
    }
  };
}

async function saveAnswer(req: Request, payload: Record<string, unknown>) {
  const row = await findSession(payload);
  await enforceAbuseLimit(req, payload, 'saveAnswer', String(row.id));
  if (!['interview_active', 'interview_ready'].includes(String(row.status))) {
    throw new Error('Interview is not active');
  }

  const questionIndex = safeInt(payload.questionIndex, 1, 1, 99);
  const questionText = safeLongText(payload.questionText, firstQuestion, 1200) || firstQuestion;
  let transcript = safeLongText(payload.transcript, '', 12000);
  const durationSeconds = safeInt(payload.durationSeconds, 0, 0, 7200);
  let transcriptSource = ['browser', 'backend', 'pending', 'manual_admin'].includes(String(payload.transcriptSource))
    ? String(payload.transcriptSource)
    : 'pending';
  const audioInput = answerAudioInput(payload);
  const audioMimeType = audioInput.mimeType || safeText(payload.audioMimeType, '', 80) || null;
  let transcriptionStatus = pendingTranscript(transcript, transcriptSource) ? 'pending' : 'provided_by_client';
  let transcriptionProvider = transcriptSource === 'backend' ? 'backend' : transcriptSource;
  let audioStorage = { status: audioInput.error || 'no_audio_received', path: null as string | null };

  if (audioInput.bytes) {
    audioStorage = await uploadPrivateAudioArtifact(String(row.id), questionIndex, audioInput.mimeType, audioInput.bytes);
    if (pendingTranscript(transcript, transcriptSource)) {
      const backendTranscript = await transcribeAnswerAudio({
        sessionId: String(row.id),
        questionIndex,
        questionText,
        mimeType: audioInput.mimeType,
        bytes: audioInput.bytes
      });
      transcriptionStatus = backendTranscript.status;
      transcriptionProvider = backendTranscript.ok ? backendTranscript.provider : 'openai';
      if (backendTranscript.ok) {
        transcript = backendTranscript.transcript;
        transcriptSource = 'backend';
      }
    }
  } else if (audioInput.error) {
    await insertEvent(String(row.id), 'answer_audio_rejected', {
      question_index: questionIndex,
      reason: audioInput.error,
      audio_bytes: audioInput.byteLength,
      sprint: 8
    }).catch(() => null);
  }

  const densityScore = narrativeDensityScore(transcript);
  const submittedQuality = Number(payload.qualityScore);
  const qualityScore = Number.isFinite(submittedQuality) && transcriptSource !== 'backend'
    ? clampNumber(submittedQuality, 0.15, 0, 1)
    : clampNumber(undefined, transcript ? Math.max(0.35, densityScore) : 0.15, 0, 1);
  const totalQuestions = Number(row.question_count || 21);
  const isSuperficial = transcriptSource !== 'pending' && (wordCount(transcript) < 12 || densityScore < 0.22);

  if (payload.followUpAttempt !== true && isSuperficial) {
    const reason = wordCount(transcript) < 12 ? 'short_answer' : 'low_density';
    await insertEvent(String(row.id), 'question_followup_requested', {
      question_index: questionIndex,
      reason,
      word_count: wordCount(transcript),
      density_score: densityScore,
      sprint: 8
    });
    return {
      ok: true,
      saved: false,
      needsFollowUp: true,
      session: publicSession(row),
      question: {
        index: questionIndex,
        total: totalQuestions,
        text: followUpFor(questionIndex),
        followUp: true
      }
    };
  }

  const existing = await existingAnswer(String(row.id), questionIndex);
  const answerBody = {
    session_id: row.id,
    question_index: questionIndex,
    question_text: questionText,
    transcript: transcript || null,
    transcript_source: transcriptSource,
    audio_storage_path: audioStorage.path,
    audio_mime_type: audioMimeType,
    duration_seconds: durationSeconds || null,
    quality_score: qualityScore,
    metadata: {
      sprint: 8,
      audio_captured: payload.audioCaptured === true,
      audio_received: Boolean(audioInput.bytes),
      audio_bytes: audioInput.byteLength || safeInt(payload.audioByteLength, 0, 0, 25 * 1024 * 1024),
      audio_storage_status: audioStorage.status,
      browser_speech_supported: payload.browserSpeechSupported === true,
      transcription_final: transcriptSource === 'backend' || payload.transcriptionFinal === true,
      transcription_status: transcriptionStatus,
      transcription_provider: transcriptionProvider,
      density_score: densityScore,
      density_band: densityScore >= 0.58 ? 'high' : densityScore >= 0.32 ? 'medium' : 'low',
      follow_up_attempt: payload.followUpAttempt === true
    }
  };

  const created = first(await rest(existing?.id
    ? `future_book_answers?id=eq.${encodeParam(existing.id)}`
    : 'future_book_answers', {
      method: existing?.id ? 'PATCH' : 'POST',
      body: answerBody
    })) as Record<string, unknown> | null;

  await rest('future_book_artifacts', {
    method: 'POST',
    body: {
      session_id: row.id,
      artifact_type: 'audio_answer',
      provider: 'browser_media_recorder',
      mime_type: audioMimeType,
      storage_path: audioStorage.path,
      metadata: {
        question_index: questionIndex,
        duration_seconds: durationSeconds,
        audio_bytes: audioInput.byteLength || safeInt(payload.audioByteLength, 0, 0, 25 * 1024 * 1024),
        storage_status: audioStorage.status,
        transcription_status: transcriptionStatus,
        transcription_provider: transcriptionProvider,
        density_score: densityScore,
        sprint: 8
      }
    },
    prefer: 'return=minimal'
  }).catch(() => null);

  await insertEvent(String(row.id), 'question_answered', {
    question_index: questionIndex,
    transcript_source: transcriptSource,
    duration_seconds: durationSeconds,
    quality_score: qualityScore,
    density_score: densityScore,
    transcription_status: transcriptionStatus,
    audio_storage_status: audioStorage.status,
    sprint: 8
  });

  const answered = await currentAnswerCount(String(row.id));
  const completed = answered >= totalQuestions;
  const updated = completed
    ? await patchSession(String(row.id), {
      status: 'interview_completed',
      interview_completed_at: new Date().toISOString()
    })
    : row;

  if (completed) {
    await insertEvent(String(row.id), 'interview_completed', {
      answered,
      total: totalQuestions,
      sprint: 3
    });
  }

  const nextIndex = Math.min(totalQuestions, questionIndex + 1);
  const participantName = participantNameFromRow(row);

  return {
    ok: true,
    saved: true,
    answer: created,
    completed,
    session: publicSession(updated),
    nextQuestion: completed ? null : {
      index: nextIndex,
      total: totalQuestions,
      text: questionFor(nextIndex, participantName)
    }
  };
}

async function readAnswers(sessionId: string) {
  const rows = await rest(
    `future_book_answers?session_id=eq.${encodeParam(sessionId)}&select=question_index,question_text,transcript,transcript_source,duration_seconds,quality_score,created_at&order=question_index.asc`
  );
  return Array.isArray(rows) ? rows as Array<Record<string, unknown>> : [];
}

async function latestManuscript(sessionId: string) {
  const row = first(await rest(
    `future_book_manuscripts?session_id=eq.${encodeParam(sessionId)}&select=*&order=created_at.desc&limit=1`
  )) as Record<string, unknown> | null;
  return row;
}

async function nextPsychMapVersion(sessionId: string) {
  const row = first(await rest(
    `future_book_psych_maps?session_id=eq.${encodeParam(sessionId)}&select=version&order=version.desc&limit=1`
  ).catch(() => [])) as Record<string, unknown> | null;
  return Number(row?.version || 0) + 1;
}

async function storePsychMap(input: {
  sessionId: string;
  psychMap: Record<string, unknown>;
  outline: Record<string, unknown>;
  provider: string;
  usage: Record<string, unknown>;
  degraded: boolean;
}) {
  const version = await nextPsychMapVersion(input.sessionId);
  const qualityReport = {
    status: input.degraded ? 'degraded' : 'ready',
    prompt_versions: {
      caronte: CARONTE_PROMPT_VERSION,
      map: CARONTE_MAP_VERSION,
      outline: CARONTE_OUTLINE_VERSION
    },
    core_tensions: arrayFrom(input.psychMap.core_tensions).length,
    future_vectors: arrayFrom(input.psychMap.future_vectors).length,
    narrative_hooks: arrayFrom(input.psychMap.narrative_hooks).length,
    generated_at: new Date().toISOString()
  };
  const row = first(await rest('future_book_psych_maps', {
    method: 'POST',
    body: {
      session_id: input.sessionId,
      version,
      status: input.degraded ? 'degraded' : 'ready',
      prompt_version: CARONTE_PROMPT_VERSION,
      map_payload: input.psychMap,
      outline_payload: input.outline,
      quality_report: qualityReport,
      provider_chain: {
        map_builder: input.provider,
        prompt_version: CARONTE_PROMPT_VERSION,
        usage: input.usage || {},
        degraded: input.degraded
      }
    }
  })) as Record<string, unknown> | null;
  if (!row?.id) throw new Error('Could not store Caronte psychological map');
  return row;
}

function publicManuscript(row: Record<string, unknown> | null) {
  if (!row) return null;
  return {
    id: row.id,
    status: row.status,
    title: row.title,
    qualityScore: row.quality_score,
    promptVersion: row.prompt_version,
    psychMapId: row.psych_map_id,
    providerChain: row.provider_chain,
    qualityReport: row.quality_report,
    manuscript: row.manuscript,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

async function getBookStatus(payload: Record<string, unknown>) {
  const row = await findSession(payload);
  const manuscript = await latestManuscript(String(row.id));
  return {
    ok: true,
    session: publicSession(row),
    manuscript: publicManuscript(manuscript)
  };
}

async function generateBook(req: Request, payload: Record<string, unknown>) {
  const row = await findSession(payload);
  await enforceAbuseLimit(req, payload, 'generateBook', String(row.id));
  if (row.status !== 'interview_completed' && row.status !== 'book_ready') {
    throw new Error('Interview must be completed before generating the book');
  }

  const missing = await missingRequiredProviders('book');
  if (missing.length && strictAiProvidersRequired()) {
    await blockBookGenerationForMissingProviders(row, missing);
    throw new Error(`Required AI providers missing: ${missing.join(', ')}`);
  }

  const existing = await latestManuscript(String(row.id));
  if (existing?.id && payload.force !== true) {
    return {
      ok: true,
      reused: true,
      session: publicSession(row),
      manuscript: publicManuscript(existing)
    };
  }

  const answers = await readAnswers(String(row.id));
  const expected = Number(row.question_count || 21);
  if (answers.length < expected) {
    throw new Error(`Missing answers: ${answers.length}/${expected}`);
  }

  const now = new Date().toISOString();
  const generating = await patchSession(String(row.id), {
    status: 'book_generating',
    book_status: 'generating',
    book_generation_started_at: now
  });

  await insertEvent(String(row.id), 'book_generation_started', {
    answers: answers.length,
    expected,
    prompt_version: CARONTE_PROMPT_VERSION,
    sprint: 9
  });

  const deterministic = buildDeterministicManuscript(answers, row);
  const psychological = await buildPsychologicalMap(answers, row);
  const outline = buildNarrativeOutline(psychological.map, answers);
  const psychMapRow = await storePsychMap({
    sessionId: String(row.id),
    psychMap: psychological.map,
    outline,
    provider: psychological.provider,
    usage: psychological.usage || {},
    degraded: psychological.degraded === true
  });

  await insertEvent(String(row.id), 'caronte_psych_map_generated', {
    psych_map_id: psychMapRow.id,
    version: psychMapRow.version,
    provider: psychological.provider,
    degraded: psychological.degraded === true,
    sprint: 9
  });

  let ai = await buildAiManuscript(answers, deterministic, psychological.map, outline);
  let caronteEvaluation = evaluateCaronteManuscript(answers, ai.manuscript, psychological.map);
  let rewrite = {
    attempted: false,
    applied: false,
    reason: caronteEvaluation.needs_rewrite === true ? caronteEvaluation.verdict : 'not_needed',
    before: caronteEvaluation
  } as Record<string, unknown>;

  if (caronteEvaluation.needs_rewrite === true && ai.degraded !== true) {
    await insertEvent(String(row.id), 'caronte_rewrite_requested', {
      reason: caronteEvaluation.verdict,
      genericity_score: caronteEvaluation.genericity_score,
      personalization_score: caronteEvaluation.personalization_score,
      safety_score: caronteEvaluation.safety_score,
      sprint: 9
    });
    const rewriteInstruction = [
      `Reescribe para corregir: ${caronteEvaluation.verdict}.`,
      `Personalizacion actual=${caronteEvaluation.personalization_score}; genericidad=${caronteEvaluation.genericity_score}; seguridad=${caronteEvaluation.safety_score}.`,
      'Aumenta escenas concretas tomadas de respuestas, elimina frases genericas y conserva los avisos de limites.'
    ].join(' ');
    const rewritten = await buildAiManuscript(answers, ai.manuscript, psychological.map, outline, rewriteInstruction);
    const rewrittenEvaluation = evaluateCaronteManuscript(answers, rewritten.manuscript, psychological.map);
    const beforeScore = Number(caronteEvaluation.personalization_score || 0) + (1 - Number(caronteEvaluation.genericity_score || 1)) + Number(caronteEvaluation.safety_score || 0);
    const afterScore = Number(rewrittenEvaluation.personalization_score || 0) + (1 - Number(rewrittenEvaluation.genericity_score || 1)) + Number(rewrittenEvaluation.safety_score || 0);
    if (rewritten.degraded !== true && afterScore >= beforeScore) {
      ai = {
        ...rewritten,
        provider: `${rewritten.provider}+rewrite`
      };
      caronteEvaluation = rewrittenEvaluation;
      rewrite = {
        attempted: true,
        applied: true,
        reason: 'quality_improved',
        before: rewrite.before,
        after: rewrittenEvaluation,
        provider: rewritten.provider
      };
    } else {
      rewrite = {
        attempted: true,
        applied: false,
        reason: rewritten.degraded === true ? 'rewrite_provider_failed' : 'rewrite_did_not_improve',
        before: rewrite.before,
        after: rewrittenEvaluation,
        provider: rewritten.provider
      };
    }
  }

  const externalReview = await reviewWithAnthropic(ai.manuscript, psychological.map, caronteEvaluation).catch((error) => ({
    provider: 'anthropic',
    status: 'failed',
    detail: error instanceof Error ? error.message : 'unknown'
  }));
  const degraded = psychological.degraded === true || ai.degraded === true || !externalReview || externalReview.status === 'failed';
  const qualityReport = buildQualityReport(answers, ai.manuscript, externalReview, degraded, {
    ...caronteEvaluation,
    rewrite
  }, psychological.map);
  const providerChain = {
    psych_map_id: psychMapRow.id,
    psych_map_version: psychMapRow.version,
    map_builder: psychological.provider,
    drafting: ai.provider,
    reviewer: externalReview?.provider || 'none',
    outline: CARONTE_OUTLINE_VERSION,
    rewrite,
    degraded,
    missing_required_providers: missing,
    map_usage: psychological.usage || {},
    openai_usage: ai.usage || {},
    anthropic_usage: externalReview?.usage || {},
    prompt_version: CARONTE_PROMPT_VERSION
  };

  const manuscriptRow = first(await rest('future_book_manuscripts', {
    method: 'POST',
    body: {
      session_id: row.id,
      psych_map_id: psychMapRow.id,
      status: 'ready',
      title: safeText(ai.manuscript.title, 'Futuro Anterior', 220),
      manuscript: ai.manuscript,
      quality_report: qualityReport,
      provider_chain: providerChain,
      prompt_version: CARONTE_PROMPT_VERSION,
      page_target_min: 35,
      page_target_max: 60,
      quality_score: qualityReport.score
    }
  })) as Record<string, unknown> | null;

  if (!manuscriptRow?.id) throw new Error('Could not store manuscript');

  await rest('future_book_artifacts', {
    method: 'POST',
    body: {
      session_id: row.id,
      artifact_type: 'manuscript',
      provider: String(ai.provider || 'deterministic'),
      mime_type: 'application/json',
      metadata: {
        manuscript_id: manuscriptRow.id,
        title: manuscriptRow.title,
        quality_score: qualityReport.score,
        section_count: Array.isArray(ai.manuscript.sections) ? ai.manuscript.sections.length : 0,
        psych_map_id: psychMapRow.id,
        caronte_status: qualityReport.status,
        prompt_version: CARONTE_PROMPT_VERSION,
        sprint: 9
      }
    },
    prefer: 'return=minimal'
  });

  await insertEvent(String(row.id), 'book_quality_reviewed', {
    quality_score: qualityReport.score,
    reviewer: externalReview?.provider || 'none',
    caronte_status: qualityReport.status,
    genericity_score: caronteEvaluation.genericity_score,
    personalization_score: caronteEvaluation.personalization_score,
    safety_score: caronteEvaluation.safety_score,
    rewrite_attempted: rewrite.attempted === true,
    rewrite_applied: rewrite.applied === true,
    sprint: 9
  });

  const completed = await patchSession(String(row.id), {
    status: 'book_ready',
    book_status: 'ready',
    book_generation_completed_at: new Date().toISOString()
  });

  await insertEvent(String(row.id), 'book_generation_completed', {
    manuscript_id: manuscriptRow.id,
    psych_map_id: psychMapRow.id,
    title: manuscriptRow.title,
    prompt_version: CARONTE_PROMPT_VERSION,
    sprint: 9
  });

  return {
    ok: true,
    reused: false,
    session: publicSession(completed || generating),
    manuscript: publicManuscript(manuscriptRow)
  };
}

async function getPdfStatus(payload: Record<string, unknown>) {
  const row = await findSession(payload);
  const pdf = await latestPdf(String(row.id));
  return {
    ok: true,
    session: publicSession(row),
    pdf: publicPdf(pdf, false)
  };
}

async function generatePdf(req: Request, payload: Record<string, unknown>) {
  const row = await findSession(payload);
  await enforceAbuseLimit(req, payload, 'generatePdf', String(row.id));
  if (!['book_ready', 'pending_review', 'approved', 'released_to_customer', 'blocked'].includes(String(row.status))) {
    throw new Error('Book must be ready before generating PDF');
  }

  const manuscript = await latestReadyManuscript(String(row.id));
  if (!manuscript?.id) throw new Error('No ready manuscript found');

  const version = await nextPdfVersion(String(row.id));
  const degraded = manuscriptIsDegraded(manuscript);
  const pdf = buildPdfDocument(manuscript.manuscript as Record<string, unknown>, String(row.id));
  if (pdf.byteSize > 20_000_000) throw new Error('Generated PDF is too large for private storage');
  const fileName = stablePdfFileName(String(row.id), version);
  const storage = await uploadPrivatePdfArtifact(String(row.id), version, fileName, pdf.base64);
  const printValidation = validateEditorialPdf(pdf, degraded, storage);
  const readyForPrint = printValidation.ready_for_print === true;

  await patchSession(String(row.id), {
    status: 'pdf_generating',
    pdf_review_status: 'not_generated'
  });

  await insertEvent(String(row.id), 'pdf_generation_started', {
    manuscript_id: manuscript.id,
    version,
    template: editorialPdfTemplate,
    sprint: 10
  });

  const created = first(await rest('future_book_pdfs', {
    method: 'POST',
    body: {
      session_id: row.id,
      manuscript_id: manuscript.id,
      version,
      status: 'generated',
      review_status: 'pending_review',
      file_name: fileName,
      mime_type: 'application/pdf',
      pdf_base64: storage.path ? null : pdf.base64,
      page_count: pdf.pageCount,
      page_size: pdf.pageSize,
      storage_path: storage.path,
      quality_report: {
        ...printValidation,
        byte_size: pdf.byteSize,
        opens_as_pdf: true,
        page_count: pdf.pageCount,
        template: editorialPdfTemplate,
        storage_status: storage.status,
        storage_path: storage.path,
        layout: pdf.layout,
        generated_at: new Date().toISOString()
      },
      print_validation: printValidation,
      lulu_metadata: {
        ready_for_print: readyForPrint,
        ready_for_print_status: degraded ? 'degraded_not_ready_for_print' : readyForPrint ? 'ready_for_print' : printValidation.status === 'warning' ? 'print_validation_warning' : 'print_validation_failed',
        title: pdf.title,
        author: 'Futuro Anterior',
        language: 'es',
        trim_size: 'A5',
        trim_width_points: 420,
        trim_height_points: 595,
        interior_color: 'black_and_white',
        binding_type: 'perfect_bound',
        interior_pdf_storage_path: storage.path,
        cover_status: 'embedded_front_matter_cover',
        template: editorialPdfTemplate,
        send_to_lulu: false
      },
      metadata: {
        sprint: 10,
        storage_mode: storage.path ? 'private_storage_primary' : 'database_base64_fallback',
        lulu_api_called: false,
        sprint7_degraded_manuscript: degraded,
        sprint10_editorial_pdf: true,
        signed_url_required_for_browser_preview: true
      }
    }
  })) as Record<string, unknown> | null;

  if (!created?.id) throw new Error('Could not store PDF');

  await rest('future_book_artifacts', {
    method: 'POST',
    body: {
      session_id: row.id,
      artifact_type: 'pdf',
      provider: 'internal_pdf_writer',
      mime_type: 'application/pdf',
      metadata: {
        pdf_id: created.id,
        file_name: fileName,
        page_count: pdf.pageCount,
        review_status: 'pending_review',
        storage_path: storage.path,
        template: editorialPdfTemplate,
        ready_for_print: readyForPrint,
        sprint: 10
      }
    },
    prefer: 'return=minimal'
  });

  const updated = await patchSession(String(row.id), {
    status: 'pending_review',
    pdf_review_status: 'pending_review',
    pdf_ready_at: new Date().toISOString()
  });

  await insertEvent(String(row.id), 'pdf_generation_completed', {
    pdf_id: created.id,
    version,
    page_count: pdf.pageCount,
    review_status: 'pending_review',
    storage_status: storage.status,
    ready_for_print: readyForPrint,
    template: editorialPdfTemplate,
    sprint: 10
  });

  return {
    ok: true,
    session: publicSession(updated),
    pdf: publicPdf(created, false)
  };
}

async function adminRegeneratePdf(req: Request, payload: Record<string, unknown>) {
  const admin = await requireFutureBookAdmin(req, payload, 'adminRegeneratePdf');
  const pdfId = safeText(payload.pdfId, '', 80);
  if (!pdfId) throw new Error('Missing pdfId');
  const current = first(await rest(`future_book_pdfs?id=eq.${encodeParam(pdfId)}&select=*&limit=1`)) as Record<string, unknown> | null;
  if (!current?.id) throw new Error('PDF not found');
  await patchPdfReview(req, payload, 'regeneration_requested');
  const session = first(await rest(`future_book_sessions?id=eq.${encodeParam(String(current.session_id))}&select=*&limit=1`)) as Record<string, unknown> | null;
  if (!session?.id || !session.public_token) throw new Error('Session not found for regeneration');
  const result = await generatePdf(req, {
    sessionId: session.id,
    publicToken: session.public_token
  });
  await auditFutureBookAdmin(req, admin, 'adminRegeneratePdf', 'future_book_pdf', pdfId, {
    session_id: current.session_id,
    reason: safeLongText(payload.reason, '', 800) || null
  });
  return result;
}

async function downloadReleasedPdf(req: Request, payload: Record<string, unknown>) {
  const row = await findSession(payload);
  await enforceAbuseLimit(req, payload, 'downloadReleasedPdf', String(row.id));
  const pdf = await latestPdf(String(row.id));
  if (!pdf?.id) throw new Error('PDF not found');
  if (pdf.review_status !== 'released_to_customer') {
    throw new Error('PDF is not released to customer');
  }
  return {
    ok: true,
    session: publicSession(row),
    pdf: await publicPdfWithBinary(pdf)
  };
}

async function privateStorageDelete(bucket: string, storagePath: unknown) {
  const path = safeLongText(storagePath, '', 900);
  const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  if (!path || !supabaseUrl || !serviceRoleKey) return { ok: false, status: 'missing_path_or_storage_config' };
  const encodedPath = path.split('/').map((part) => encodeURIComponent(part)).join('/');
  const response = await fetch(`${supabaseUrl}/storage/v1/object/${bucket}/${encodedPath}`, {
    method: 'DELETE',
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`
    }
  }).catch(() => null);
  return {
    ok: Boolean(response?.ok || response?.status === 404),
    status: response ? `http_${response.status}` : 'fetch_failed'
  };
}

async function privacySnapshot(row: Record<string, unknown>) {
  const sessionId = String(row.id);
  const [answers, artifacts, psychMaps, manuscripts, pdfs, events] = await Promise.all([
    rest(`future_book_answers?session_id=eq.${encodeParam(sessionId)}&select=question_index,question_text,transcript,transcript_source,duration_seconds,quality_score,metadata,created_at&order=question_index.asc`).catch(() => []),
    rest(`future_book_artifacts?session_id=eq.${encodeParam(sessionId)}&select=artifact_type,provider,mime_type,storage_path,metadata,created_at&order=created_at.asc`).catch(() => []),
    rest(`future_book_psych_maps?session_id=eq.${encodeParam(sessionId)}&select=version,status,prompt_version,quality_report,provider_chain,created_at,updated_at&order=version.asc`).catch(() => []),
    rest(`future_book_manuscripts?session_id=eq.${encodeParam(sessionId)}&select=id,status,title,quality_score,prompt_version,quality_report,provider_chain,created_at,updated_at&order=created_at.asc`).catch(() => []),
    rest(`future_book_pdfs?session_id=eq.${encodeParam(sessionId)}&select=id,version,review_status,file_name,page_count,page_size,storage_path,quality_report,print_validation,lulu_metadata,created_at,updated_at&order=version.asc`).catch(() => []),
    rest(`future_book_events?session_id=eq.${encodeParam(sessionId)}&select=event_type,metadata,created_at&order=created_at.asc`).catch(() => [])
  ]);
  return {
    exportedAt: new Date().toISOString(),
    product: 'Futuro Anterior',
    session: {
      ...publicSession(row),
      privacyErasedAt: row.privacy_erased_at || null,
      expiresAt: row.expires_at || null,
      riskFlags: row.risk_flags || {}
    },
    answers: Array.isArray(answers) ? answers : [],
    artifacts: Array.isArray(artifacts) ? artifacts : [],
    psychMaps: Array.isArray(psychMaps) ? psychMaps : [],
    manuscripts: Array.isArray(manuscripts) ? manuscripts : [],
    pdfs: Array.isArray(pdfs) ? pdfs : [],
    events: Array.isArray(events) ? events : [],
    note: 'Export RGPD operativo. No incluye claves internas ni binarios PDF/audio; esos artefactos viven en storage privado.'
  };
}

async function exportPrivacyData(req: Request, payload: Record<string, unknown>) {
  const row = await findSession(payload);
  await enforceAbuseLimit(req, payload, 'exportPrivacyData', String(row.id));
  const snapshot = await privacySnapshot(row);
  const requesterHash = await privacyHash(`${String(row.id)}:${clientIp(req) || 'unknown'}`);
  await rest('future_book_privacy_requests', {
    method: 'POST',
    body: {
      session_id: row.id,
      request_type: 'export',
      status: 'completed',
      requester_hash: requesterHash,
      processed_by: 'self_service',
      result_metadata: {
        answer_count: Array.isArray(snapshot.answers) ? snapshot.answers.length : 0,
        pdf_count: Array.isArray(snapshot.pdfs) ? snapshot.pdfs.length : 0,
        sprint: 13
      },
      completed_at: new Date().toISOString()
    },
    prefer: 'return=minimal'
  }).catch(() => null);
  await insertEvent(String(row.id), 'privacy_export_completed', {
    mode: 'self_service',
    sprint: 13
  }).catch(() => null);
  return {
    ok: true,
    export: snapshot
  };
}

async function eraseSessionData(sessionId: string, processedBy: string, requesterHash: string | null, reason: string | null) {
  const [artifacts, pdfs] = await Promise.all([
    rest(`future_book_artifacts?session_id=eq.${encodeParam(sessionId)}&select=storage_path,artifact_type`).catch(() => []),
    rest(`future_book_pdfs?session_id=eq.${encodeParam(sessionId)}&select=storage_path`).catch(() => [])
  ]);
  let storageDeleted = 0;
  for (const item of (Array.isArray(artifacts) ? artifacts : []) as Array<Record<string, unknown>>) {
    const bucket = item.artifact_type === 'audio_answer' ? futureBookAudioBucket : '';
    if (bucket && item.storage_path) {
      const deleted = await privateStorageDelete(bucket, item.storage_path);
      if (deleted.ok) storageDeleted += 1;
    }
  }
  for (const item of (Array.isArray(pdfs) ? pdfs : []) as Array<Record<string, unknown>>) {
    if (item.storage_path) {
      const deleted = await privateStorageDelete(futureBookPdfBucket, item.storage_path);
      if (deleted.ok) storageDeleted += 1;
    }
  }
  await rest('future_book_privacy_requests', {
    method: 'POST',
    body: {
      session_id: sessionId,
      request_type: 'erasure',
      status: 'completed',
      requester_hash: requesterHash,
      processed_by: processedBy,
      result_metadata: {
        storage_deleted: storageDeleted,
        reason,
        sprint: 13
      },
      completed_at: new Date().toISOString()
    },
    prefer: 'return=minimal'
  }).catch(() => null);
  const deleted = await rest(`future_book_sessions?id=eq.${encodeParam(sessionId)}`, {
    method: 'DELETE',
    prefer: 'return=representation'
  });
  return {
    storageDeleted,
    deletedRows: Array.isArray(deleted) ? deleted.length : 0
  };
}

async function requestPrivacyErasure(req: Request, payload: Record<string, unknown>) {
  const row = await findSession(payload);
  await enforceAbuseLimit(req, payload, 'requestPrivacyErasure', String(row.id));
  const requesterHash = await privacyHash(`${String(row.id)}:${clientIp(req) || 'unknown'}`);
  const result = await eraseSessionData(String(row.id), 'self_service', requesterHash, safeLongText(payload.reason, 'self_service_erasure', 500));
  return {
    ok: true,
    erasedSessionId: row.id,
    ...result
  };
}

async function retentionPolicies() {
  const rows = await rest('future_book_retention_policies?select=*').catch(() => []);
  const policies = new Map<string, Record<string, unknown>>();
  for (const row of (Array.isArray(rows) ? rows : []) as Array<Record<string, unknown>>) {
    policies.set(String(row.data_type), row);
  }
  return policies;
}

function retentionCutoff(policies: Map<string, Record<string, unknown>>, dataType: string) {
  const row = policies.get(dataType);
  const enabled = row ? row.enabled !== false : true;
  const ttlDays = row ? safeInt(row.ttl_days, defaultRetentionDays(dataType), 1, 3650) : defaultRetentionDays(dataType);
  return {
    enabled,
    ttlDays,
    cutoff: new Date(Date.now() - ttlDays * 24 * 60 * 60 * 1000).toISOString()
  };
}

async function selectRetentionRows(path: string) {
  const separator = path.includes('?') ? '&' : '?';
  const rows = await rest(`${path}${separator}select=*&limit=1000`).catch(() => []);
  return Array.isArray(rows) ? rows as Array<Record<string, unknown>> : [];
}

async function deleteRetentionRows(path: string) {
  const rows = await rest(path, {
    method: 'DELETE',
    prefer: 'return=representation'
  }).catch(() => []);
  return Array.isArray(rows) ? rows.length : 0;
}

async function runRetentionSweep(dryRun = true) {
  const policies = await retentionPolicies();
  const summary: Record<string, unknown> = {};

  const audio = retentionCutoff(policies, 'audio');
  if (audio.enabled) {
    const path = `future_book_artifacts?artifact_type=eq.audio_answer&created_at=lt.${encodeParam(audio.cutoff)}`;
    const rows = await selectRetentionRows(path);
    if (!dryRun) {
      for (const row of rows) await privateStorageDelete(futureBookAudioBucket, row.storage_path);
      await deleteRetentionRows(path);
    }
    summary.audio = { candidates: rows.length, ttl_days: audio.ttlDays, dry_run: dryRun };
  }

  const pdfs = retentionCutoff(policies, 'pdfs');
  if (pdfs.enabled) {
    const path = `future_book_pdfs?created_at=lt.${encodeParam(pdfs.cutoff)}`;
    const rows = await selectRetentionRows(path);
    if (!dryRun) {
      for (const row of rows) await privateStorageDelete(futureBookPdfBucket, row.storage_path);
      await deleteRetentionRows(path);
    }
    summary.pdfs = { candidates: rows.length, ttl_days: pdfs.ttlDays, dry_run: dryRun };
  }

  const simpleDeletes = [
    ['answers', `future_book_answers?created_at=lt.${encodeParam(retentionCutoff(policies, 'answers').cutoff)}`],
    ['manuscripts', `future_book_manuscripts?created_at=lt.${encodeParam(retentionCutoff(policies, 'manuscripts').cutoff)}`],
    ['psych_maps', `future_book_psych_maps?created_at=lt.${encodeParam(retentionCutoff(policies, 'psych_maps').cutoff)}`],
    ['session_events', `future_book_events?created_at=lt.${encodeParam(retentionCutoff(policies, 'session_events').cutoff)}`],
    ['abuse_events', `future_book_abuse_events?created_at=lt.${encodeParam(retentionCutoff(policies, 'abuse_events').cutoff)}`],
    ['sessions', `future_book_sessions?status=in.(released_to_customer,failed,blocked)&updated_at=lt.${encodeParam(retentionCutoff(policies, 'answers').cutoff)}`]
  ];
  for (const [dataType, path] of simpleDeletes) {
    const policy = retentionCutoff(policies, dataType === 'sessions' ? 'answers' : dataType);
    if (!policy.enabled) continue;
    const rows = await selectRetentionRows(path);
    if (!dryRun) await deleteRetentionRows(path);
    summary[dataType] = { candidates: rows.length, ttl_days: policy.ttlDays, dry_run: dryRun };
  }

  const adminAudit = retentionCutoff(policies, 'admin_audit');
  if (adminAudit.enabled) {
    const path = `future_book_admin_audit_events?created_at=lt.${encodeParam(adminAudit.cutoff)}`;
    const rows = await selectRetentionRows(path);
    if (!dryRun && rows.length) {
      await rest(path, {
        method: 'PATCH',
        body: { ip_hint: null, user_agent: null },
        prefer: 'return=minimal'
      }).catch(() => null);
    }
    summary.admin_audit = { minimized: rows.length, ttl_days: adminAudit.ttlDays, dry_run: dryRun };
  }

  const privacyRequests = retentionCutoff(policies, 'privacy_requests');
  if (privacyRequests.enabled) {
    const path = `future_book_privacy_requests?created_at=lt.${encodeParam(privacyRequests.cutoff)}`;
    const rows = await selectRetentionRows(path);
    if (!dryRun && rows.length) {
      await rest(path, {
        method: 'PATCH',
        body: { requester_hash: null },
        prefer: 'return=minimal'
      }).catch(() => null);
    }
    summary.privacy_requests = { minimized: rows.length, ttl_days: privacyRequests.ttlDays, dry_run: dryRun };
  }

  return summary;
}

async function providerStatus() {
  const rows = await rest('future_book_provider_settings?select=*').catch(() => []);
  const settings = new Map((Array.isArray(rows) ? rows : []).map((row) => [String(row.provider), row]));
  return Promise.all(providerDefinitions().map(async (definition) => {
    const row = settings.get(definition.provider) as Record<string, unknown> | undefined;
    const envConfigured = definition.env.some((name) => Boolean(Deno.env.get(name)));
    const configured = Boolean(await providerSecret(definition.provider));
    const metadata = row?.metadata && typeof row.metadata === 'object' ? row.metadata as Record<string, unknown> : {};
    return {
      provider: definition.provider,
      displayName: definition.displayName,
      required: definition.required,
      configured,
      status: definition.placeholder ? 'placeholder' : configured ? 'configured' : 'not_configured',
      source: envConfigured ? 'env_secret' : row?.configured ? 'encrypted_setting' : 'missing',
      secretLast4: envConfigured ? 'env' : row?.secret_last4 || null,
      updatedAt: row?.updated_at || null,
      testedAt: row?.tested_at || null,
      testStatus: metadata.last_test_status || null,
      testDetail: metadata.last_test_detail || null,
      voiceId: definition.provider === 'elevenlabs' ? metadata.voice_id || elevenLabsVoiceId() : null,
      voiceName: definition.provider === 'elevenlabs' ? metadata.voice_name || null : null
    };
  }));
}

function secondsBetween(start: unknown, end: unknown) {
  const a = Date.parse(String(start || ''));
  const b = Date.parse(String(end || ''));
  if (!Number.isFinite(a) || !Number.isFinite(b) || b < a) return null;
  return Math.round((b - a) / 1000);
}

function average(values: Array<number | null>) {
  const usable = values.filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
  if (!usable.length) return null;
  return Math.round(usable.reduce((total, value) => total + value, 0) / usable.length);
}

async function ensureP0Alert(alertType: string, message: string, metadata: Record<string, unknown>) {
  const existing = first(await rest(
    `future_book_monitor_alerts?alert_type=eq.${encodeParam(alertType)}&status=eq.open&select=id&limit=1`
  ).catch(() => [])) as Record<string, unknown> | null;
  if (existing?.id) return existing;
  const created = first(await rest('future_book_monitor_alerts', {
    method: 'POST',
    body: {
      severity: 'p0',
      alert_type: alertType,
      status: 'open',
      message,
      metadata
    }
  }).catch(() => [])) as Record<string, unknown> | null;
  if (created?.id) await deliverP0Alert(created).catch(() => null);
  return created;
}

async function deliverP0Alert(alert: Record<string, unknown>) {
  const webhookUrl = safeLongText(Deno.env.get('FUTURE_BOOK_ALERT_WEBHOOK_URL'), '', 1200);
  if (!webhookUrl) {
    await rest('future_book_alert_deliveries', {
      method: 'POST',
      body: {
        alert_id: alert.id || null,
        channel: 'webhook',
        status: 'skipped',
        destination_hint: 'not_configured',
        metadata: { reason: 'FUTURE_BOOK_ALERT_WEBHOOK_URL missing', sprint: 14 }
      },
      prefer: 'return=minimal'
    }).catch(() => null);
    return;
  }

  const response = await fetchWithTimeout(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      product: 'futuro_anterior',
      severity: 'p0',
      alert_type: alert.alert_type,
      message: alert.message,
      metadata: alert.metadata || {},
      created_at: alert.created_at || new Date().toISOString()
    })
  }, 5000).catch(() => null);

  await rest('future_book_alert_deliveries', {
    method: 'POST',
    body: {
      alert_id: alert.id || null,
      channel: 'webhook',
      status: response?.ok ? 'sent' : 'failed',
      destination_hint: webhookUrl.replace(/^https?:\/\//, '').slice(0, 80),
      response_status: response?.status || null,
      error_message: response?.ok ? null : response ? `webhook_http_${response.status}` : 'webhook_fetch_failed',
      metadata: { sprint: 14 }
    },
    prefer: 'return=minimal'
  }).catch(() => null);
}

function staleMinutes(value: unknown) {
  const time = Date.parse(String(value || ''));
  if (!Number.isFinite(time)) return null;
  return Math.round((Date.now() - time) / 60000);
}

function detectStuckSessions(sessions: Array<Record<string, unknown>>, pdfs: Array<Record<string, unknown>>) {
  const stuck: Array<Record<string, unknown>> = [];
  for (const session of sessions) {
    const updatedMinutes = staleMinutes(session.updated_at || session.updatedAt || session.created_at);
    const status = String(session.status || '');
    const bookStatus = String(session.book_status || session.bookStatus || '');
    const pdfStatus = String(session.pdf_review_status || session.pdfReviewStatus || '');
    const threshold = status === 'interview_active'
      ? 150
      : status === 'book_generating' || bookStatus === 'generating'
        ? 30
        : status === 'pdf_generating'
          ? 15
          : status === 'pending_review' || pdfStatus === 'pending_review'
            ? 48 * 60
            : null;
    if (threshold && updatedMinutes !== null && updatedMinutes > threshold) {
      stuck.push({
        session_id: session.id,
        status,
        book_status: bookStatus,
        pdf_review_status: pdfStatus,
        updated_minutes: updatedMinutes,
        threshold_minutes: threshold,
        reason: 'stuck_session'
      });
    }
    if (session.error_code || status === 'failed') {
      stuck.push({
        session_id: session.id,
        status,
        error_code: session.error_code || null,
        reason: 'failed_session'
      });
    }
  }
  for (const pdf of pdfs) {
    const createdMinutes = staleMinutes(pdf.created_at || pdf.createdAt);
    if (String(pdf.review_status || pdf.reviewStatus) === 'pending_review' && createdMinutes !== null && createdMinutes > 48 * 60) {
      stuck.push({
        session_id: pdf.session_id || pdf.sessionId,
        target_type: 'pdf',
        target_id: pdf.id,
        status: 'pending_review',
        created_minutes: createdMinutes,
        threshold_minutes: 48 * 60,
        reason: 'stale_pending_pdf'
      });
    }
  }
  return stuck;
}

async function upsertDeadLetter(input: {
  sessionId?: string | null;
  targetType?: string;
  targetId?: string | null;
  failedAction: string;
  severity?: string;
  lastError?: string | null;
  payload?: Record<string, unknown>;
}) {
  const sessionFilter = input.sessionId ? `session_id=eq.${encodeParam(input.sessionId)}&` : '';
  const targetFilter = input.targetId ? `target_id=eq.${encodeParam(input.targetId)}&` : '';
  const existing = first(await rest(
    `future_book_dead_letters?${sessionFilter}${targetFilter}failed_action=eq.${encodeParam(input.failedAction)}&status=in.(open,retrying)&select=*&limit=1`
  ).catch(() => [])) as Record<string, unknown> | null;
  if (existing?.id) return existing;
  return first(await rest('future_book_dead_letters', {
    method: 'POST',
    body: {
      session_id: input.sessionId || null,
      target_type: input.targetType || 'session',
      target_id: input.targetId || input.sessionId || null,
      failed_action: input.failedAction,
      severity: input.severity || 'warning',
      status: 'open',
      attempts: 0,
      last_error: input.lastError || null,
      payload: input.payload || {},
      next_retry_at: new Date(Date.now() + 10 * 60 * 1000).toISOString()
    }
  }).catch(() => [])) as Record<string, unknown> | null;
}

async function monitorSnapshot(sessions: Array<Record<string, unknown>>, pdfs: Array<Record<string, unknown>>, providers: Array<Record<string, unknown>>) {
  const requiredMissing = providers.filter((provider) => provider.required === true && provider.configured !== true);
  const failedSessions = sessions.filter((session) => String(session.status) === 'failed' || Boolean(session.error_code));
  const stuckPdf = pdfs.filter((pdf) => {
    const created = Date.parse(String(pdf.created_at || pdf.createdAt || ''));
    return String(pdf.review_status || pdf.reviewStatus) === 'pending_review'
      && Number.isFinite(created)
      && Date.now() - created > 24 * 60 * 60 * 1000;
  });

  if (failedSessions.length) {
    await ensureP0Alert('future_book_failed_sessions', 'Hay sesiones Futuro Anterior en estado failed/error.', {
      count: failedSessions.length
    });
  }
  if (requiredMissing.length) {
    await ensureP0Alert('future_book_required_provider_missing', 'Faltan proveedores obligatorios para beta productiva.', {
      providers: requiredMissing.map((provider) => provider.provider)
    });
  }

  const alertsRaw = await rest('future_book_monitor_alerts?status=eq.open&select=*&order=created_at.desc&limit=20').catch(() => []);
  const access = await accessDisabled();

  return {
    access,
    averagesSeconds: {
      interview: average(sessions.map((session) => secondsBetween(session.interview_started_at, session.interview_completed_at))),
      bookGeneration: average(sessions.map((session) => secondsBetween(session.book_generation_started_at, session.book_generation_completed_at))),
      pdfAfterBook: average(sessions.map((session) => secondsBetween(session.book_generation_completed_at, session.pdf_ready_at)))
    },
    p0: {
      failedSessions: failedSessions.length,
      missingRequiredProviders: requiredMissing.length,
      stalePendingPdfs: stuckPdf.length
    },
    alerts: Array.isArray(alertsRaw) ? alertsRaw : []
  };
}

function futureBookCostSnapshot(
  sessions: Array<Record<string, unknown>>,
  manuscripts: Array<Record<string, unknown>>,
  pdfs: Array<Record<string, unknown>>,
  answers: Array<Record<string, unknown>>
) {
  const paidSessions = sessions.filter((item) => item.payment_status === 'simulated_approved' || item.status !== 'created').length;
  const revenueCents = sessions.reduce((total, item) => total + Number(item.price_cents || 0), 0);
  const providerCallsApprox = manuscripts.length * 3
    + answers.filter((item) => String(item.transcript_source) === 'backend').length
    + pdfs.length;
  return {
    priceEur: 49.95,
    sessionsInWindow: sessions.length,
    paidOrApprovedSessions: paidSessions,
    grossRevenueEur: Math.round(revenueCents / 100),
    answersCaptured: answers.length,
    providerCallsApprox,
    manuscriptsGenerated: manuscripts.length,
    pdfsGenerated: pdfs.length,
    pendingEditorialCostDrivers: pdfs.filter((item) => item.review_status === 'pending_review').length
  };
}

function conversionSnapshot(sessions: Array<Record<string, unknown>>) {
  const total = sessions.length || 1;
  const atLeast = (predicate: (item: Record<string, unknown>) => boolean) => sessions.filter(predicate).length;
  const stageCounts = {
    created: sessions.length,
    consented: atLeast((item) => Boolean(item.privacy_consent_at) || !['created'].includes(String(item.status))),
    paymentApproved: atLeast((item) => item.payment_status === 'simulated_approved'),
    interviewStarted: atLeast((item) => Boolean(item.interview_started_at) || ['interview_active', 'interview_completed', 'book_generating', 'book_ready', 'pending_review', 'approved', 'released_to_customer'].includes(String(item.status))),
    interviewCompleted: atLeast((item) => Boolean(item.interview_completed_at) || ['interview_completed', 'book_generating', 'book_ready', 'pending_review', 'approved', 'released_to_customer'].includes(String(item.status))),
    bookReady: atLeast((item) => item.book_status === 'ready' || ['book_ready', 'pending_review', 'approved', 'released_to_customer'].includes(String(item.status))),
    pdfReady: atLeast((item) => ['pending_review', 'approved', 'released_to_customer'].includes(String(item.pdf_review_status || item.status))),
    released: atLeast((item) => item.pdf_review_status === 'released_to_customer' || item.status === 'released_to_customer')
  };
  const rates = Object.fromEntries(Object.entries(stageCounts).map(([key, value]) => [key, Number((value / total).toFixed(3))]));
  return { stageCounts, rates };
}

function slaSnapshot(
  sessions: Array<Record<string, unknown>>,
  pdfs: Array<Record<string, unknown>>,
  providers: Array<Record<string, unknown>>,
  stuck: Array<Record<string, unknown>>
) {
  const missingRequired = providers.filter((provider) => provider.required === true && provider.configured !== true);
  const failedSessions = sessions.filter((session) => String(session.status) === 'failed' || Boolean(session.error_code));
  return {
    health: missingRequired.length || failedSessions.length || stuck.length ? 'degraded' : 'green',
    failedSessions: failedSessions.length,
    missingRequiredProviders: missingRequired.map((provider) => provider.provider),
    stuckSessions: stuck.length,
    pendingReviewPdfs: pdfs.filter((pdf) => String(pdf.review_status || pdf.reviewStatus) === 'pending_review').length,
    averagesSeconds: {
      interview: average(sessions.map((session) => secondsBetween(session.interview_started_at, session.interview_completed_at))),
      bookGeneration: average(sessions.map((session) => secondsBetween(session.book_generation_started_at, session.book_generation_completed_at))),
      pdfAfterBook: average(sessions.map((session) => secondsBetween(session.book_generation_completed_at, session.pdf_ready_at)))
    }
  };
}

function costAnomalySnapshot(costs: Record<string, unknown>, sessions: Array<Record<string, unknown>>) {
  const dailyLimit = safeInt(Deno.env.get('FUTURE_BOOK_DAILY_PROVIDER_CALL_LIMIT'), 250, 1, 100000);
  const providerCallsApprox = Number(costs.providerCallsApprox || 0);
  const sessionsInWindow = sessions.length || 1;
  const callsPerSession = Number((providerCallsApprox / sessionsInWindow).toFixed(2));
  const anomaly = providerCallsApprox > dailyLimit || callsPerSession > 8;
  return {
    providerCallsApprox,
    dailyLimit,
    callsPerSession,
    anomaly,
    reason: providerCallsApprox > dailyLimit ? 'daily_provider_call_limit' : callsPerSession > 8 ? 'calls_per_session_high' : 'normal'
  };
}

async function createSlaSnapshot(input: {
  sessions: Array<Record<string, unknown>>;
  pdfs: Array<Record<string, unknown>>;
  providers: Array<Record<string, unknown>>;
  manuscripts: Array<Record<string, unknown>>;
  answers: Array<Record<string, unknown>>;
  stuck: Array<Record<string, unknown>>;
  alerts: Array<Record<string, unknown>>;
}) {
  const windowStartedAt = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const costs = futureBookCostSnapshot(input.sessions, input.manuscripts, input.pdfs, input.answers);
  const costAnomaly = costAnomalySnapshot(costs, input.sessions);
  const conversion = conversionSnapshot(input.sessions);
  const sla = slaSnapshot(input.sessions, input.pdfs, input.providers, input.stuck);
  const row = first(await rest('future_book_sla_snapshots', {
    method: 'POST',
    body: {
      window_started_at: windowStartedAt,
      window_ended_at: new Date().toISOString(),
      sessions_total: input.sessions.length,
      conversion,
      sla,
      cost: {
        ...costs,
        anomaly: costAnomaly
      },
      alerts: {
        open: input.alerts.length,
        p0: input.alerts.filter((alert) => alert.severity === 'p0').length
      }
    }
  }).catch(() => [])) as Record<string, unknown> | null;
  return row || { conversion, sla, cost: { ...costs, anomaly: costAnomaly } };
}

async function runSyntheticMonitor(probeType = 'light_flow') {
  const startedAt = Date.now();
  const checks: Record<string, unknown> = {};
  const run = first(await rest('future_book_synthetic_runs', {
    method: 'POST',
    body: {
      probe_type: probeType,
      status: 'running',
      metadata: { sprint: 14 }
    }
  }).catch(() => [])) as Record<string, unknown> | null;
  let syntheticSessionId: string | null = null;

  try {
    const fingerprint = `synthetic-${startedAt}-${crypto.randomUUID()}`;
    const proof = await sha256Hex(`caronte-proof:${fingerprint}:${utcDay()}`);
    const fakeReq = new Request('https://synthetic.future-book.local', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'user-agent': 'future-book-synthetic-monitor/1.0',
        'x-forwarded-for': '127.0.0.1'
      },
      body: '{}'
    });
    const basePayload = {
      clientFingerprint: fingerprint,
      abuseProof: proof,
      clientRuntimeMs: 3000
    };
    const created = await createSession(fakeReq, {
      ...basePayload,
      source: 'synthetic_monitor',
      entrypoint: 'synthetic_monitor',
      locale: 'es-ES',
      timezone: 'Europe/Madrid'
    });
    syntheticSessionId = String(created.session.id);
    checks.createSession = 'pass';
    await recordConsent({ sessionId: created.session.id, publicToken: created.session.publicToken, accepted: true, termsVersion: 'synthetic', aiNoticeVersion: 'synthetic' });
    checks.recordConsent = 'pass';
    await startSimulatedPayment(fakeReq, { ...basePayload, sessionId: created.session.id, publicToken: created.session.publicToken });
    checks.startPayment = 'pass';
    await approveSimulatedPayment(fakeReq, { ...basePayload, sessionId: created.session.id, publicToken: created.session.publicToken });
    checks.approvePayment = 'pass';
    await getCurrentQuestion({ sessionId: created.session.id, publicToken: created.session.publicToken });
    checks.getCurrentQuestion = 'pass';
    const providers = await providerStatus();
    checks.providers = providers.map((provider) => ({
      provider: provider.provider,
      configured: provider.configured,
      status: provider.status,
      required: provider.required
    }));

    if (syntheticSessionId) {
      await rest(`future_book_sessions?id=eq.${encodeParam(syntheticSessionId)}`, {
        method: 'DELETE',
        prefer: 'return=minimal'
      }).catch(() => null);
      checks.cleanup = 'pass';
    }

    const finishedAt = Date.now();
    const updated = run?.id
      ? first(await rest(`future_book_synthetic_runs?id=eq.${encodeParam(String(run.id))}`, {
        method: 'PATCH',
        body: {
          status: 'succeeded',
          finished_at: new Date().toISOString(),
          duration_ms: finishedAt - startedAt,
          checks,
          metadata: { sprint: 14, synthetic_session_id: syntheticSessionId }
        },
        prefer: 'return=representation'
      }).catch(() => [])) as Record<string, unknown> | null
      : null;
    return updated || { status: 'succeeded', duration_ms: finishedAt - startedAt, checks };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'synthetic_failed';
    if (syntheticSessionId) {
      await rest(`future_book_sessions?id=eq.${encodeParam(syntheticSessionId)}`, {
        method: 'DELETE',
        prefer: 'return=minimal'
      }).catch(() => null);
    }
    if (run?.id) {
      await rest(`future_book_synthetic_runs?id=eq.${encodeParam(String(run.id))}`, {
        method: 'PATCH',
        body: {
          status: 'failed',
          finished_at: new Date().toISOString(),
          duration_ms: Date.now() - startedAt,
          checks,
          error_message: message,
          metadata: { sprint: 14, synthetic_session_id: syntheticSessionId }
        },
        prefer: 'return=minimal'
      }).catch(() => null);
    }
    await ensureP0Alert('future_book_synthetic_failed', 'El synthetic monitor Futuro Anterior ha fallado.', {
      error: message,
      checks,
      sprint: 14
    });
    throw error;
  }
}

async function runAutonomousMonitor() {
  const [sessionsRaw, pdfsRaw, manuscriptsRaw, answersRaw, providers] = await Promise.all([
    rest('future_book_sessions?select=*&order=created_at.desc&limit=300').catch(() => []),
    rest('future_book_pdfs?select=*&order=created_at.desc&limit=300').catch(() => []),
    rest('future_book_manuscripts?select=id,session_id,status,title,quality_score,prompt_version,provider_chain,quality_report,created_at,updated_at&order=created_at.desc&limit=300').catch(() => []),
    rest('future_book_answers?select=id,session_id,transcript_source,duration_seconds,quality_score,metadata,created_at&order=created_at.desc&limit=1000').catch(() => []),
    providerStatus()
  ]);
  const sessions = Array.isArray(sessionsRaw) ? sessionsRaw as Array<Record<string, unknown>> : [];
  const pdfs = Array.isArray(pdfsRaw) ? pdfsRaw as Array<Record<string, unknown>> : [];
  const manuscripts = Array.isArray(manuscriptsRaw) ? manuscriptsRaw as Array<Record<string, unknown>> : [];
  const answers = Array.isArray(answersRaw) ? answersRaw as Array<Record<string, unknown>> : [];
  const monitor = await monitorSnapshot(sessions, pdfs, providers);
  const stuck = detectStuckSessions(sessions, pdfs);
  for (const item of stuck) {
    await upsertDeadLetter({
      sessionId: item.session_id ? String(item.session_id) : null,
      targetType: String(item.target_type || 'session'),
      targetId: item.target_id ? String(item.target_id) : item.session_id ? String(item.session_id) : null,
      failedAction: item.reason === 'stale_pending_pdf' ? 'review_pdf' : item.reason === 'failed_session' ? 'inspect_failed_session' : 'recover_stuck_session',
      severity: item.reason === 'failed_session' ? 'p0' : 'warning',
      lastError: String(item.error_code || item.reason || 'stuck'),
      payload: item
    });
  }
  if (stuck.length) {
    await ensureP0Alert('future_book_stuck_sessions', 'Hay sesiones o PDFs atascados en Futuro Anterior.', {
      count: stuck.length,
      examples: stuck.slice(0, 5),
      sprint: 14
    });
  }
  const costs = futureBookCostSnapshot(sessions, manuscripts, pdfs, answers);
  const costAnomaly = costAnomalySnapshot(costs, sessions);
  if (costAnomaly.anomaly) {
    await ensureP0Alert('future_book_cost_anomaly', 'Anomalia de coste detectada en Futuro Anterior.', {
      ...costAnomaly,
      sprint: 14
    });
  }
  const alertsRaw = await rest('future_book_monitor_alerts?status=eq.open&select=*&order=created_at.desc&limit=100').catch(() => []);
  const alerts = Array.isArray(alertsRaw) ? alertsRaw as Array<Record<string, unknown>> : [];
  const snapshot = await createSlaSnapshot({ sessions, pdfs, providers, manuscripts, answers, stuck, alerts });
  return {
    ok: true,
    monitor,
    stuck,
    costAnomaly,
    snapshot
  };
}

async function requireFutureBookMonitorCaller(req: Request, payload: Record<string, unknown>) {
  const configured = Deno.env.get('FUTURE_BOOK_MONITOR_SECRET') || Deno.env.get('INGESTION_SECRET') || '';
  const provided = req.headers.get('x-future-book-monitor-secret')
    || req.headers.get('x-licitia-job-secret')
    || safeText(payload.jobSecret, '', 240);
  if (configured && provided === configured) return { mode: 'job_secret', label: 'future_book_monitor_job' };
  const admin = await requireFutureBookAdmin(req, payload, 'adminRunAutonomousMonitor');
  return { mode: 'admin', label: admin.label, admin };
}

async function adminDashboard(req: Request, payload: Record<string, unknown>) {
  const admin = await requireFutureBookAdmin(req, payload, 'adminDashboard');
  const [sessionsRaw, pdfsRaw, psychMapsRaw, manuscriptsRaw, answersRaw, auditRaw, abuseRaw, privacyRaw, retentionRaw, syntheticRaw, deadRaw, slaRaw, deliveriesRaw, campaignsRaw, invitesRaw, waitlistRaw, providers] = await Promise.all([
    rest('future_book_sessions?select=id,status,payment_status,price_cents,currency,book_status,pdf_review_status,question_count,access_campaign_id,access_invite_id,created_at,updated_at,interview_started_at,interview_completed_at,book_generation_started_at,book_generation_completed_at,pdf_ready_at,error_code&order=created_at.desc&limit=80'),
    rest('future_book_pdfs?select=id,session_id,version,review_status,file_name,page_count,page_size,storage_path,quality_report,print_validation,lulu_metadata,reviewed_by,reviewed_at,released_at,created_at,updated_at&order=created_at.desc&limit=80').catch(() => []),
    rest('future_book_psych_maps?select=id,session_id,version,status,prompt_version,quality_report,provider_chain,created_at,updated_at&order=created_at.desc&limit=80').catch(() => []),
    rest('future_book_manuscripts?select=id,session_id,status,title,quality_score,prompt_version,provider_chain,quality_report,psych_map_id,created_at,updated_at&order=created_at.desc&limit=80').catch(() => []),
    rest('future_book_answers?select=id,session_id,transcript_source,duration_seconds,quality_score,metadata,created_at&order=created_at.desc&limit=300').catch(() => []),
    rest('future_book_admin_audit_events?select=id,admin_email,admin_role,action,resource_type,resource_id,outcome,metadata,created_at&order=created_at.desc&limit=80').catch(() => []),
    rest('future_book_abuse_events?select=action,outcome,reason,created_at,metadata&order=created_at.desc&limit=120').catch(() => []),
    rest('future_book_privacy_requests?select=id,session_id,request_type,status,processed_by,result_metadata,created_at,completed_at&order=created_at.desc&limit=80').catch(() => []),
    rest('future_book_retention_policies?select=data_type,ttl_days,delete_mode,enabled,updated_at&order=data_type.asc').catch(() => []),
    rest('future_book_synthetic_runs?select=*&order=started_at.desc&limit=20').catch(() => []),
    rest('future_book_dead_letters?select=*&order=created_at.desc&limit=80').catch(() => []),
    rest('future_book_sla_snapshots?select=*&order=created_at.desc&limit=20').catch(() => []),
    rest('future_book_alert_deliveries?select=*&order=created_at.desc&limit=40').catch(() => []),
    rest('future_book_access_campaigns?select=*&order=created_at.desc&limit=40').catch(() => []),
    rest('future_book_access_invites?select=id,campaign_id,token_hint,status,max_uses,use_count,child_invite_limit,child_invite_count,depth,parent_invite_id,issued_by,expires_at,first_used_at,last_used_at,created_at,updated_at&order=created_at.desc&limit=120').catch(() => []),
    rest('future_book_waitlist_entries?select=id,campaign_id,status,reason,created_at,updated_at,metadata&order=created_at.desc&limit=80').catch(() => []),
    providerStatus()
  ]);
  const sessions = Array.isArray(sessionsRaw) ? sessionsRaw as Array<Record<string, unknown>> : [];
  const pdfs = Array.isArray(pdfsRaw) ? pdfsRaw as Array<Record<string, unknown>> : [];
  const psychMaps = Array.isArray(psychMapsRaw) ? psychMapsRaw as Array<Record<string, unknown>> : [];
  const manuscripts = Array.isArray(manuscriptsRaw) ? manuscriptsRaw as Array<Record<string, unknown>> : [];
  const answers = Array.isArray(answersRaw) ? answersRaw as Array<Record<string, unknown>> : [];
  const auditEvents = Array.isArray(auditRaw) ? auditRaw as Array<Record<string, unknown>> : [];
  const abuseEvents = Array.isArray(abuseRaw) ? abuseRaw as Array<Record<string, unknown>> : [];
  const privacyRequests = Array.isArray(privacyRaw) ? privacyRaw as Array<Record<string, unknown>> : [];
  const retentionPoliciesList = Array.isArray(retentionRaw) ? retentionRaw as Array<Record<string, unknown>> : [];
  const syntheticRuns = Array.isArray(syntheticRaw) ? syntheticRaw as Array<Record<string, unknown>> : [];
  const deadLetters = Array.isArray(deadRaw) ? deadRaw as Array<Record<string, unknown>> : [];
  const slaSnapshots = Array.isArray(slaRaw) ? slaRaw as Array<Record<string, unknown>> : [];
  const alertDeliveries = Array.isArray(deliveriesRaw) ? deliveriesRaw as Array<Record<string, unknown>> : [];
  const campaigns = Array.isArray(campaignsRaw) ? campaignsRaw as Array<Record<string, unknown>> : [];
  const invites = Array.isArray(invitesRaw) ? invitesRaw as Array<Record<string, unknown>> : [];
  const waitlistEntries = Array.isArray(waitlistRaw) ? waitlistRaw as Array<Record<string, unknown>> : [];
  const stuckNow = detectStuckSessions(sessions, pdfs);
  const count = (items: Array<Record<string, unknown>>, field: string, value: string) => items.filter((item) => item[field] === value).length;
  const metrics = {
    activeSessions: sessions.filter((item) => ['created', 'payment_pending', 'interview_ready', 'interview_active'].includes(String(item.status))).length,
    interviewing: count(sessions, 'status', 'interview_active'),
    waitingBook: count(sessions, 'status', 'interview_completed'),
    booksGenerating: count(sessions, 'status', 'book_generating'),
    caronteMaps: psychMaps.length,
    pdfPendingReview: count(pdfs, 'review_status', 'pending_review'),
    pdfApproved: count(pdfs, 'review_status', 'approved'),
    pdfBlocked: pdfs.filter((item) => ['blocked', 'rejected'].includes(String(item.review_status))).length,
    errors: sessions.filter((item) => Boolean(item.error_code) || item.status === 'failed').length
  };
  return {
    ok: true,
    admin: publicAdminContext(admin),
    metrics,
    monitor: await monitorSnapshot(sessions, pdfs, providers),
    sessions,
    psychMaps,
    manuscripts,
    pdfs: pdfs.map((item) => publicPdf(item, false)),
    costs: futureBookCostSnapshot(sessions, manuscripts, pdfs, answers),
    security: {
      abuseBlocked: abuseEvents.filter((item) => item.outcome === 'blocked').length,
      abuseChallenges: abuseEvents.filter((item) => item.outcome === 'challenge_required').length,
      abuseEvents,
      privacyRequests,
      retentionPolicies: retentionPoliciesList,
      sessionsWithHashedSignals: sessions.filter((item) => item.risk_flags || item.created_at).length
    },
    observability: {
      syntheticRuns,
      latestSynthetic: syntheticRuns[0] || null,
      deadLetters,
      deadLetterOpen: deadLetters.filter((item) => ['open', 'retrying'].includes(String(item.status))).length,
      slaSnapshots,
      latestSla: slaSnapshots[0] || null,
      alertDeliveries,
      stuckNow
    },
    viralAccess: {
      policy: await accessPolicy(),
      campaigns: campaigns.map(publicAccessCampaign),
      invites: invites.map(publicAccessInvite),
      waitlistEntries,
      metrics: {
        activeCampaigns: campaigns.filter((item) => item.status === 'active').length,
        openInvites: invites.filter((item) => item.status === 'active').length,
        usedInvites: invites.filter((item) => item.status === 'used').length,
        expiredInvites: invites.filter((item) => item.status === 'expired').length,
        waitlistQueued: waitlistEntries.filter((item) => item.status === 'queued').length
      }
    },
    auditEvents,
    providers,
    refreshedAt: new Date().toISOString()
  };
}

async function adminMonitor(req: Request, payload: Record<string, unknown>) {
  await requireFutureBookAdmin(req, payload, 'adminMonitor');
  const [sessionsRaw, pdfsRaw, providers] = await Promise.all([
    rest('future_book_sessions?select=id,status,pdf_review_status,created_at,updated_at,interview_started_at,interview_completed_at,book_generation_started_at,book_generation_completed_at,pdf_ready_at,error_code&order=created_at.desc&limit=200'),
    rest('future_book_pdfs?select=id,session_id,review_status,created_at,updated_at&order=created_at.desc&limit=200').catch(() => []),
    providerStatus()
  ]);
  const sessions = Array.isArray(sessionsRaw) ? sessionsRaw as Array<Record<string, unknown>> : [];
  const pdfs = Array.isArray(pdfsRaw) ? pdfsRaw as Array<Record<string, unknown>> : [];
  return {
    ok: true,
    monitor: await monitorSnapshot(sessions, pdfs, providers)
  };
}

async function adminToggleAccess(req: Request, payload: Record<string, unknown>) {
  const admin = await requireFutureBookAdmin(req, payload, 'adminToggleAccess');
  const disabled = payload.disabled === true;
  const flag = await setRuntimeFlag('access_control', {
    disabled,
    reason: safeLongText(payload.reason, '', 800) || null,
    updated_at: new Date().toISOString()
  }, admin.label);
  await rest('future_book_monitor_alerts', {
    method: 'POST',
    body: {
      severity: disabled ? 'p0' : 'info',
      alert_type: disabled ? 'future_book_access_disabled' : 'future_book_access_enabled',
      status: disabled ? 'open' : 'resolved',
      message: disabled ? 'Acceso Futuro Anterior desactivado manualmente.' : 'Acceso Futuro Anterior reactivado.',
      metadata: { reason: safeLongText(payload.reason, '', 800) || null, admin: publicAdminContext(admin) }
    },
    prefer: 'return=minimal'
  }).catch(() => null);
  await auditFutureBookAdmin(req, admin, 'adminToggleAccess', 'future_book_runtime_flag', 'access_control', {
    disabled,
    reason: safeLongText(payload.reason, '', 800) || null
  });
  return {
    ok: true,
    access: flag?.value || await accessDisabled()
  };
}

async function adminDeleteSessionData(req: Request, payload: Record<string, unknown>) {
  const admin = await requireFutureBookAdmin(req, payload, 'adminDeleteSessionData');
  const sessionId = safeText(payload.sessionId, '', 80);
  if (!sessionId) throw new Error('Missing sessionId');
  const existing = first(await rest(`future_book_sessions?id=eq.${encodeParam(sessionId)}&select=id,status,pdf_review_status,created_at&limit=1`)) as Record<string, unknown> | null;
  if (!existing?.id) throw new Error('Session not found');
  const deleted = await rest(`future_book_sessions?id=eq.${encodeParam(sessionId)}`, {
    method: 'DELETE',
    prefer: 'return=representation'
  });
  await rest('future_book_monitor_alerts', {
    method: 'POST',
    body: {
      severity: 'info',
      alert_type: 'future_book_session_deleted',
      status: 'resolved',
      message: 'Datos de sesion Futuro Anterior eliminados desde back office.',
      metadata: {
        session_id: sessionId,
        admin: publicAdminContext(admin),
        reason: safeLongText(payload.reason, '', 800) || null,
        deleted_rows: Array.isArray(deleted) ? deleted.length : 0
      }
    },
    prefer: 'return=minimal'
  }).catch(() => null);
  await auditFutureBookAdmin(req, admin, 'adminDeleteSessionData', 'future_book_session', sessionId, {
    reason: safeLongText(payload.reason, '', 800) || null,
    deleted_rows: Array.isArray(deleted) ? deleted.length : 0
  });
  return {
    ok: true,
    deletedSessionId: sessionId
  };
}

async function adminPdf(req: Request, payload: Record<string, unknown>) {
  const admin = await requireFutureBookAdmin(req, payload, 'adminPdf');
  const pdfId = safeText(payload.pdfId, '', 80);
  if (!pdfId) throw new Error('Missing pdfId');
  const pdf = first(await rest(`future_book_pdfs?id=eq.${encodeParam(pdfId)}&select=*&limit=1`)) as Record<string, unknown> | null;
  if (!pdf?.id) throw new Error('PDF not found');
  await auditFutureBookAdmin(req, admin, 'adminPdf', 'future_book_pdf', pdfId, {
    session_id: pdf.session_id,
    preview: true
  });
  return {
    ok: true,
    pdf: await publicPdfWithBinary(pdf)
  };
}

function reviewActionForStatus(reviewStatus: string) {
  if (reviewStatus === 'approved') return 'adminApprovePdf';
  if (reviewStatus === 'rejected') return 'adminRejectPdf';
  if (reviewStatus === 'regeneration_requested') return 'adminRequestRegeneration';
  if (reviewStatus === 'released_to_customer') return 'adminReleasePdf';
  return 'adminPdf';
}

async function patchPdfReview(req: Request, payload: Record<string, unknown>, reviewStatus: string) {
  const admin = await requireFutureBookAdmin(req, payload, reviewActionForStatus(reviewStatus));
  const pdfId = safeText(payload.pdfId, '', 80);
  if (!pdfId) throw new Error('Missing pdfId');
  const current = first(await rest(`future_book_pdfs?id=eq.${encodeParam(pdfId)}&select=*&limit=1`)) as Record<string, unknown> | null;
  if (!current?.id) throw new Error('PDF not found');
  if (reviewStatus === 'released_to_customer' && current.review_status !== 'approved') {
    throw new Error('Only approved PDFs can be released');
  }

  const now = new Date().toISOString();
  const body: Record<string, unknown> = {
    review_status: reviewStatus,
    review_notes: safeLongText(payload.reason, '', 1200) || current.review_notes || null,
    reviewed_by: admin.label,
    reviewed_at: now
  };
  if (reviewStatus === 'released_to_customer') body.released_at = now;

  const updated = first(await rest(`future_book_pdfs?id=eq.${encodeParam(pdfId)}`, {
    method: 'PATCH',
    body,
    prefer: 'return=representation'
  })) as Record<string, unknown> | null;
  if (!updated?.id) throw new Error('Could not update PDF');

  const sessionStatus = reviewStatus === 'approved'
    ? 'approved'
    : reviewStatus === 'released_to_customer'
      ? 'released_to_customer'
      : reviewStatus === 'regeneration_requested'
        ? 'pending_review'
        : reviewStatus === 'rejected' || reviewStatus === 'blocked'
          ? 'blocked'
          : 'pending_review';

  await patchSession(String(updated.session_id), {
    status: sessionStatus,
    pdf_review_status: reviewStatus,
    pdf_reviewed_at: reviewStatus === 'approved' ? now : undefined,
    pdf_released_at: reviewStatus === 'released_to_customer' ? now : undefined
  });

  await insertEvent(String(updated.session_id), `pdf_${reviewStatus}`, {
    pdf_id: updated.id,
    review_status: reviewStatus,
    reason: safeLongText(payload.reason, '', 500) || null,
    admin: publicAdminContext(admin),
    sprint: 12
  });
  await auditFutureBookAdmin(req, admin, reviewActionForStatus(reviewStatus), 'future_book_pdf', pdfId, {
    session_id: updated.session_id,
    review_status: reviewStatus,
    reason: safeLongText(payload.reason, '', 800) || null
  });

  return {
    ok: true,
    pdf: publicPdf(updated, false)
  };
}

const futureBookSessionStatuses = [
  'created',
  'payment_pending',
  'payment_simulated_approved',
  'awaiting_consent',
  'interview_ready',
  'interview_active',
  'interview_completed',
  'book_generating',
  'book_ready',
  'pdf_generating',
  'pending_review',
  'approved',
  'released_to_customer',
  'blocked',
  'failed'
];

const futureBookBookStatuses = ['not_started', 'queued', 'generating', 'quality_review', 'ready', 'failed'];
const futureBookPdfStatuses = ['not_generated', 'pending_review', 'approved', 'rejected', 'regeneration_requested', 'released_to_customer'];

async function adminSessionDetail(req: Request, payload: Record<string, unknown>) {
  const admin = await requireFutureBookAdmin(req, payload, 'adminSessionDetail');
  const sessionId = safeText(payload.sessionId, '', 80);
  if (!sessionId) throw new Error('Missing sessionId');
  const [sessionRaw, eventsRaw, answersRaw, artifactsRaw, psychMapsRaw, manuscriptsRaw, pdfsRaw, auditRaw] = await Promise.all([
    rest(`future_book_sessions?id=eq.${encodeParam(sessionId)}&select=*&limit=1`),
    rest(`future_book_events?session_id=eq.${encodeParam(sessionId)}&select=*&order=created_at.asc&limit=300`).catch(() => []),
    rest(`future_book_answers?session_id=eq.${encodeParam(sessionId)}&select=id,question_index,question_text,transcript,transcript_source,audio_storage_path,audio_mime_type,duration_seconds,quality_score,metadata,created_at&order=question_index.asc`).catch(() => []),
    rest(`future_book_artifacts?session_id=eq.${encodeParam(sessionId)}&select=*&order=created_at.desc&limit=120`).catch(() => []),
    rest(`future_book_psych_maps?session_id=eq.${encodeParam(sessionId)}&select=*&order=version.desc&limit=20`).catch(() => []),
    rest(`future_book_manuscripts?session_id=eq.${encodeParam(sessionId)}&select=id,session_id,status,title,quality_score,prompt_version,provider_chain,quality_report,psych_map_id,created_at,updated_at&order=created_at.desc&limit=20`).catch(() => []),
    rest(`future_book_pdfs?session_id=eq.${encodeParam(sessionId)}&select=id,session_id,version,review_status,file_name,page_count,page_size,storage_path,quality_report,print_validation,lulu_metadata,reviewed_by,reviewed_at,released_at,created_at,updated_at&order=version.desc&limit=20`).catch(() => []),
    rest(`future_book_admin_audit_events?resource_id=eq.${encodeParam(sessionId)}&select=*&order=created_at.desc&limit=80`).catch(() => [])
  ]);
  const session = first(sessionRaw as Array<Record<string, unknown>>) as Record<string, unknown> | null;
  if (!session?.id) throw new Error('Session not found');
  await auditFutureBookAdmin(req, admin, 'adminSessionDetail', 'future_book_session', sessionId, {
    read_detail: true
  });
  return {
    ok: true,
    session,
    events: Array.isArray(eventsRaw) ? eventsRaw : [],
    answers: Array.isArray(answersRaw) ? answersRaw : [],
    artifacts: Array.isArray(artifactsRaw) ? artifactsRaw : [],
    psychMaps: Array.isArray(psychMapsRaw) ? psychMapsRaw : [],
    manuscripts: Array.isArray(manuscriptsRaw) ? manuscriptsRaw : [],
    pdfs: Array.isArray(pdfsRaw) ? pdfsRaw.map((item) => publicPdf(item, false)) : [],
    auditEvents: Array.isArray(auditRaw) ? auditRaw : []
  };
}

async function adminPatchSessionStatus(req: Request, payload: Record<string, unknown>) {
  const admin = await requireFutureBookAdmin(req, payload, 'adminPatchSessionStatus');
  const sessionId = safeText(payload.sessionId, '', 80);
  if (!sessionId) throw new Error('Missing sessionId');
  const body: Record<string, unknown> = {};
  const status = safeText(payload.status, '', 80);
  const bookStatus = safeText(payload.bookStatus, '', 80);
  const pdfReviewStatus = safeText(payload.pdfReviewStatus, '', 80);
  const errorCode = safeText(payload.errorCode, '', 120);
  const reason = safeLongText(payload.reason, '', 1000);

  if (status) {
    if (!futureBookSessionStatuses.includes(status)) throw new Error('Invalid session status');
    body.status = status;
  }
  if (bookStatus) {
    if (!futureBookBookStatuses.includes(bookStatus)) throw new Error('Invalid book status');
    body.book_status = bookStatus;
  }
  if (pdfReviewStatus) {
    if (!futureBookPdfStatuses.includes(pdfReviewStatus)) throw new Error('Invalid PDF review status');
    body.pdf_review_status = pdfReviewStatus;
  }
  if (payload.clearError === true) {
    body.error_code = null;
  } else if (errorCode) {
    body.error_code = errorCode;
  }
  if (!Object.keys(body).length) throw new Error('No status patch requested');

  const before = first(await rest(`future_book_sessions?id=eq.${encodeParam(sessionId)}&select=id,status,book_status,pdf_review_status,error_code,metadata&limit=1`)) as Record<string, unknown> | null;
  if (!before?.id) throw new Error('Session not found');
  body.metadata = {
    ...(before.metadata && typeof before.metadata === 'object' ? before.metadata as Record<string, unknown> : {}),
    admin_last_patch: {
      at: new Date().toISOString(),
      by: admin.label,
      reason: reason || null,
      sprint: 12
    }
  };
  const updated = await patchSession(sessionId, body);
  await insertEvent(sessionId, 'admin_session_patched', {
    before: {
      status: before.status,
      book_status: before.book_status,
      pdf_review_status: before.pdf_review_status,
      error_code: before.error_code
    },
    after: {
      status: updated.status,
      book_status: updated.book_status,
      pdf_review_status: updated.pdf_review_status,
      error_code: updated.error_code
    },
    reason: reason || null,
    admin: publicAdminContext(admin),
    sprint: 12
  });
  await auditFutureBookAdmin(req, admin, 'adminPatchSessionStatus', 'future_book_session', sessionId, {
    patch: body,
    reason: reason || null
  });
  return {
    ok: true,
    session: publicSession(updated)
  };
}

async function adminRunRetention(req: Request, payload: Record<string, unknown>) {
  const admin = await requireFutureBookAdmin(req, payload, 'adminRunRetention');
  const dryRun = payload.dryRun !== false;
  const summary = await runRetentionSweep(dryRun);
  await auditFutureBookAdmin(req, admin, 'adminRunRetention', 'future_book_retention', dryRun ? 'dry_run' : 'execute', {
    dry_run: dryRun,
    summary
  });
  return {
    ok: true,
    dryRun,
    summary
  };
}

async function adminRunSyntheticMonitor(req: Request, payload: Record<string, unknown>) {
  const admin = await requireFutureBookAdmin(req, payload, 'adminRunSyntheticMonitor');
  const run = await runSyntheticMonitor(safeText(payload.probeType, 'manual_light_flow', 80));
  await auditFutureBookAdmin(req, admin, 'adminRunSyntheticMonitor', 'future_book_synthetic_run', run.id ? String(run.id) : null, {
    status: run.status,
    duration_ms: run.duration_ms || null
  });
  return {
    ok: true,
    run
  };
}

async function adminRunAutonomousMonitor(req: Request, payload: Record<string, unknown>) {
  const admin = await requireFutureBookAdmin(req, payload, 'adminRunAutonomousMonitor');
  const result = await runAutonomousMonitor();
  await auditFutureBookAdmin(req, admin, 'adminRunAutonomousMonitor', 'future_book_observability', 'manual', {
    stuck_count: result.stuck.length,
    cost_anomaly: result.costAnomaly.anomaly === true
  });
  return result;
}

async function retryDeadLetter(req: Request, payload: Record<string, unknown>) {
  const admin = await requireFutureBookAdmin(req, payload, 'adminRetryDeadLetter');
  const deadLetterId = safeText(payload.deadLetterId, '', 80);
  if (!deadLetterId) throw new Error('Missing deadLetterId');
  const dead = first(await rest(`future_book_dead_letters?id=eq.${encodeParam(deadLetterId)}&select=*&limit=1`)) as Record<string, unknown> | null;
  if (!dead?.id) throw new Error('Dead letter not found');
  await rest(`future_book_dead_letters?id=eq.${encodeParam(deadLetterId)}`, {
    method: 'PATCH',
    body: {
      status: 'retrying',
      attempts: Number(dead.attempts || 0) + 1,
      last_error: null
    },
    prefer: 'return=minimal'
  });

  let retryResult: Record<string, unknown> = { status: 'manual_inspection_required' };
  const sessionId = safeText(dead.session_id, '', 80);
  const action = String(dead.failed_action || '');
  const session = sessionId
    ? first(await rest(`future_book_sessions?id=eq.${encodeParam(sessionId)}&select=*&limit=1`).catch(() => [])) as Record<string, unknown> | null
    : null;
  if (session?.id && session.public_token && action === 'recover_stuck_session') {
    retryResult = { status: 'session_rechecked', session: publicSession(session) };
  }
  if (session?.id && session.public_token && action === 'review_pdf') {
    retryResult = { status: 'pdf_review_still_manual', session: publicSession(session) };
  }

  const updated = first(await rest(`future_book_dead_letters?id=eq.${encodeParam(deadLetterId)}`, {
    method: 'PATCH',
    body: {
      status: 'resolved',
      resolved_at: new Date().toISOString(),
      payload: {
        ...(dead.payload && typeof dead.payload === 'object' ? dead.payload as Record<string, unknown> : {}),
        retry_result: retryResult,
        retried_by: admin.label,
        retried_at: new Date().toISOString()
      }
    },
    prefer: 'return=representation'
  }).catch(() => [])) as Record<string, unknown> | null;

  await auditFutureBookAdmin(req, admin, 'adminRetryDeadLetter', 'future_book_dead_letter', deadLetterId, {
    failed_action: dead.failed_action,
    retry_result: retryResult
  });
  return {
    ok: true,
    deadLetter: updated || dead,
    retryResult
  };
}

async function resolveDeadLetter(req: Request, payload: Record<string, unknown>) {
  const admin = await requireFutureBookAdmin(req, payload, 'adminResolveDeadLetter');
  const deadLetterId = safeText(payload.deadLetterId, '', 80);
  if (!deadLetterId) throw new Error('Missing deadLetterId');
  const status = payload.ignore === true ? 'ignored' : 'resolved';
  const updated = first(await rest(`future_book_dead_letters?id=eq.${encodeParam(deadLetterId)}`, {
    method: 'PATCH',
    body: {
      status,
      resolved_at: new Date().toISOString(),
      last_error: safeLongText(payload.reason, '', 800) || null
    },
    prefer: 'return=representation'
  }).catch(() => [])) as Record<string, unknown> | null;
  if (!updated?.id) throw new Error('Dead letter not found');
  await auditFutureBookAdmin(req, admin, 'adminResolveDeadLetter', 'future_book_dead_letter', deadLetterId, {
    status,
    reason: safeLongText(payload.reason, '', 800) || null
  });
  return {
    ok: true,
    deadLetter: updated
  };
}

function randomAccessToken(bytes = 24) {
  const buffer = new Uint8Array(bytes);
  crypto.getRandomValues(buffer);
  let binary = '';
  for (const byte of buffer) binary += String.fromCharCode(byte);
  return `fa_${btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '')}`;
}

function campaignCode(value: unknown) {
  const raw = safeText(value, '', 80).toLowerCase();
  const normalized = raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  return normalized || `camp-${utcDay()}-${randomAccessToken(4).slice(-6).toLowerCase()}`;
}

function accessLink(baseUrl: unknown, token: string) {
  const fallback = 'https://nestorguerra.github.io/licitia-v2-production/futuro.html';
  const raw = safeLongText(baseUrl, fallback, 800) || fallback;
  try {
    const url = new URL(raw);
    url.searchParams.set('k', token);
    return url.toString();
  } catch {
    return `${fallback}?k=${encodeURIComponent(token)}`;
  }
}

async function joinWaitlist(req: Request, payload: Record<string, unknown>) {
  await enforceAbuseLimit(req, payload, 'joinWaitlist');
  const token = accessTokenFromPayload(payload);
  const tokenHash = token ? await accessTokenHash(token) : null;
  const gate = token ? await evaluateAccessGate(req, payload) : null;
  const gateAny = (gate || {}) as Record<string, unknown>;
  const campaign = gateAny.campaign as Record<string, unknown> | null;
  const contact = safeLongText(payload.contact || payload.email || payload.handle, '', 500);
  const fingerprint = safeLongText(payload.clientFingerprint || payload.fingerprint, '', 1200);
  const row = first(await rest('future_book_waitlist_entries', {
    method: 'POST',
    body: {
      campaign_id: campaign?.id || null,
      invite_token_hash: tokenHash,
      contact_hash: contact ? await privacyHash(`waitlist_contact:${contact}`) : null,
      ip_hash: await privacyHash(clientIp(req) || 'missing_ip'),
      fingerprint_hash: await privacyHash(fingerprint || userAgent(req) || 'missing_fingerprint'),
      status: 'queued',
      reason: safeText(gateAny.reason, safeText(payload.reason, 'manual_waitlist', 120), 160),
      metadata: {
        source: safeText(payload.source, 'futuro_front', 80),
        entrypoint: safeText(payload.entrypoint, '', 160) || null,
        raw_contact_stored: false,
        sprint: 15
      }
    }
  }).catch(() => [])) as Record<string, unknown> | null;
  return {
    ok: true,
    waitlist: {
      status: 'queued',
      opaqueCode: row?.id ? `wl_${String(row.id).slice(0, 8)}` : 'wl_pending'
    }
  };
}

async function adminCreateAccessCampaign(req: Request, payload: Record<string, unknown>) {
  const admin = await requireFutureBookAdmin(req, payload, 'adminCreateAccessCampaign');
  const code = campaignCode(payload.code || payload.name);
  const name = safeText(payload.name, code, 120);
  const row = first(await rest('future_book_access_campaigns?on_conflict=code', {
    method: 'POST',
    prefer: 'resolution=merge-duplicates,return=representation',
    body: {
      code,
      name,
      status: ['active', 'paused', 'closed'].includes(String(payload.status)) ? payload.status : 'active',
      access_mode: payload.accessMode === 'fixed_beta' ? 'fixed_beta' : 'invite_required',
      fixed_beta_enabled: payload.fixedBetaEnabled === true,
      default_ttl_minutes: safeInt(payload.defaultTtlMinutes, 60, 1, 43200),
      invite_max_uses: safeInt(payload.inviteMaxUses, 1, 1, 50),
      max_invites: safeInt(payload.maxInvites, 100, 1, 100000),
      max_sessions: safeInt(payload.maxSessions, 100, 1, 100000),
      waitlist_enabled: payload.waitlistEnabled !== false,
      starts_at: safeText(payload.startsAt, '', 80) || new Date().toISOString(),
      ends_at: safeText(payload.endsAt, '', 80) || null,
      created_by: admin.label,
      metadata: { sprint: 15, created_from: 'future_book_admin' }
    }
  })) as Record<string, unknown> | null;
  if (!row?.id) throw new Error('Could not create access campaign');
  await auditFutureBookAdmin(req, admin, 'adminCreateAccessCampaign', 'future_book_access_campaign', String(row.id), {
    code,
    status: row.status,
    access_mode: row.access_mode
  });
  return { ok: true, campaign: publicAccessCampaign(row) };
}

async function adminUpdateAccessCampaign(req: Request, payload: Record<string, unknown>) {
  const admin = await requireFutureBookAdmin(req, payload, 'adminUpdateAccessCampaign');
  const campaignId = safeText(payload.campaignId, '', 80);
  if (!campaignId) throw new Error('Missing campaignId');
  const body: Record<string, unknown> = {};
  if (['active', 'paused', 'closed'].includes(String(payload.status))) body.status = payload.status;
  if (['fixed_beta', 'invite_required'].includes(String(payload.accessMode))) body.access_mode = payload.accessMode;
  if (typeof payload.fixedBetaEnabled === 'boolean') body.fixed_beta_enabled = payload.fixedBetaEnabled;
  if (typeof payload.waitlistEnabled === 'boolean') body.waitlist_enabled = payload.waitlistEnabled;
  if (payload.endsAt !== undefined) body.ends_at = safeText(payload.endsAt, '', 80) || null;
  if (payload.maxSessions !== undefined) body.max_sessions = safeInt(payload.maxSessions, 100, 1, 100000);
  if (payload.maxInvites !== undefined) body.max_invites = safeInt(payload.maxInvites, 100, 1, 100000);
  if (payload.defaultTtlMinutes !== undefined) body.default_ttl_minutes = safeInt(payload.defaultTtlMinutes, 60, 1, 43200);
  if (!Object.keys(body).length) throw new Error('No campaign patch requested');
  const row = first(await rest(`future_book_access_campaigns?id=eq.${encodeParam(campaignId)}`, {
    method: 'PATCH',
    body,
    prefer: 'return=representation'
  }).catch(() => [])) as Record<string, unknown> | null;
  if (!row?.id) throw new Error('Campaign not found');
  await auditFutureBookAdmin(req, admin, 'adminUpdateAccessCampaign', 'future_book_access_campaign', campaignId, body);
  return { ok: true, campaign: publicAccessCampaign(row) };
}

async function adminUpdateAccessPolicy(req: Request, payload: Record<string, unknown>) {
  const admin = await requireFutureBookAdmin(req, payload, 'adminUpdateAccessPolicy');
  const mode = payload.mode === 'invite_required' ? 'invite_required' : 'fixed_beta';
  const value = {
    mode,
    fixed_beta_enabled: payload.fixedBetaEnabled === true,
    campaign_code: safeText(payload.campaignCode, '', 80) || null,
    waitlist_enabled: payload.waitlistEnabled !== false,
    updated_at: new Date().toISOString(),
    updated_by: admin.label
  };
  await setRuntimeFlag('viral_access_control', value, admin.label);
  await auditFutureBookAdmin(req, admin, 'adminUpdateAccessPolicy', 'future_book_runtime_flag', 'viral_access_control', value);
  return { ok: true, policy: await accessPolicy() };
}

async function createAccessInviteRows(input: {
  campaign: Record<string, unknown>;
  count: number;
  ttlMinutes: number;
  maxUses: number;
  childInviteLimit: number;
  parentInviteId?: string | null;
  depth?: number;
  issuedBy: string;
  baseUrl?: string;
}) {
  const expiresAt = new Date(Date.now() + input.ttlMinutes * 60 * 1000).toISOString();
  const rows = [];
  const tokens = [];
  for (let index = 0; index < input.count; index += 1) {
    const token = randomAccessToken();
    tokens.push(token);
    rows.push({
      campaign_id: input.campaign.id,
      token_hash: await accessTokenHash(token),
      token_hint: token.slice(-8),
      status: 'active',
      max_uses: input.maxUses,
      child_invite_limit: input.childInviteLimit,
      depth: input.depth || 0,
      parent_invite_id: input.parentInviteId || null,
      issued_by: input.issuedBy,
      expires_at: expiresAt,
      metadata: { sprint: 15 }
    });
  }
  const inserted = await rest('future_book_access_invites', {
    method: 'POST',
    body: rows
  }).catch(() => []);
  const insertedRows = Array.isArray(inserted) ? inserted as Array<Record<string, unknown>> : [];
  return tokens.map((token, index) => ({
    token,
    link: accessLink(input.baseUrl, token),
    invite: publicAccessInvite(insertedRows[index] || rows[index])
  }));
}

async function adminCreateAccessInvites(req: Request, payload: Record<string, unknown>) {
  const admin = await requireFutureBookAdmin(req, payload, 'adminCreateAccessInvites');
  const campaignId = safeText(payload.campaignId, '', 80);
  if (!campaignId) throw new Error('Missing campaignId');
  const campaign = first(await rest(`future_book_access_campaigns?id=eq.${encodeParam(campaignId)}&select=*&limit=1`)) as Record<string, unknown> | null;
  if (!campaign?.id) throw new Error('Campaign not found');
  if (campaign.status !== 'active') throw new Error('Campaign is not active');
  const count = safeInt(payload.count, 1, 1, 50);
  const remaining = Number(campaign.max_invites || 0) - Number(campaign.issued_invites || 0);
  if (count > remaining) throw new Error('Campaign invite capacity exhausted');
  const invites = await createAccessInviteRows({
    campaign,
    count,
    ttlMinutes: safeInt(payload.ttlMinutes, Number(campaign.default_ttl_minutes || 60), 1, 43200),
    maxUses: safeInt(payload.maxUses, Number(campaign.invite_max_uses || 1), 1, 50),
    childInviteLimit: safeInt(payload.childInviteLimit, 0, 0, 100),
    issuedBy: admin.label,
    baseUrl: safeLongText(payload.baseUrl, '', 800)
  });
  await rest(`future_book_access_campaigns?id=eq.${encodeParam(campaignId)}`, {
    method: 'PATCH',
    body: {
      issued_invites: Number(campaign.issued_invites || 0) + count
    },
    prefer: 'return=minimal'
  }).catch(() => null);
  await auditFutureBookAdmin(req, admin, 'adminCreateAccessInvites', 'future_book_access_campaign', campaignId, {
    count,
    ttl_minutes: safeInt(payload.ttlMinutes, Number(campaign.default_ttl_minutes || 60), 1, 43200)
  });
  return { ok: true, invites };
}

async function adminRevokeAccessInvite(req: Request, payload: Record<string, unknown>) {
  const admin = await requireFutureBookAdmin(req, payload, 'adminRevokeAccessInvite');
  const inviteId = safeText(payload.inviteId, '', 80);
  if (!inviteId) throw new Error('Missing inviteId');
  const invite = first(await rest(`future_book_access_invites?id=eq.${encodeParam(inviteId)}`, {
    method: 'PATCH',
    body: {
      status: 'revoked',
      metadata: {
        revoked_by: admin.label,
        revoked_at: new Date().toISOString(),
        reason: safeLongText(payload.reason, '', 800) || null,
        sprint: 15
      }
    },
    prefer: 'return=representation'
  }).catch(() => [])) as Record<string, unknown> | null;
  if (!invite?.id) throw new Error('Invite not found');
  await auditFutureBookAdmin(req, admin, 'adminRevokeAccessInvite', 'future_book_access_invite', inviteId, {
    reason: safeLongText(payload.reason, '', 800) || null
  });
  return { ok: true, invite: publicAccessInvite(invite) };
}

async function requestViralInvite(payload: Record<string, unknown>) {
  const session = await findSession(payload);
  const baseUrl = safeLongText(payload.baseUrl, '', 800);
  const parentInviteId = safeText(session.access_invite_id, '', 80);
  if (!parentInviteId) throw new Error('viral_invite_not_available');
  const parent = first(await rest(`future_book_access_invites?id=eq.${encodeParam(parentInviteId)}&select=*&limit=1`)) as Record<string, unknown> | null;
  if (!parent?.id) throw new Error('parent_invite_missing');
  if (Number(parent.child_invite_count || 0) >= Number(parent.child_invite_limit || 0)) throw new Error('viral_invite_limit_exhausted');
  const campaign = first(await rest(`future_book_access_campaigns?id=eq.${encodeParam(String(parent.campaign_id))}&select=*&limit=1`)) as Record<string, unknown> | null;
  const campaignCheck = campaignAllowsAccess(campaign);
  if (!campaignCheck.ok || !campaign) throw new Error(`campaign_unavailable:${campaignCheck.reason}`);
  const invites = await createAccessInviteRows({
    campaign,
    count: 1,
    ttlMinutes: safeInt(payload.ttlMinutes, Number(campaign.default_ttl_minutes || 60), 1, 43200),
    maxUses: 1,
    childInviteLimit: Math.max(0, Number(parent.child_invite_limit || 0) - 1),
    parentInviteId,
    depth: Number(parent.depth || 0) + 1,
    issuedBy: `session:${session.id}`,
    baseUrl
  });
  await rest(`future_book_access_invites?id=eq.${encodeParam(parentInviteId)}`, {
    method: 'PATCH',
    body: { child_invite_count: Number(parent.child_invite_count || 0) + 1 },
    prefer: 'return=minimal'
  }).catch(() => null);
  return { ok: true, invite: invites[0] };
}

async function adminPrivacyExport(req: Request, payload: Record<string, unknown>) {
  const admin = await requireFutureBookAdmin(req, payload, 'adminPrivacyExport');
  const sessionId = safeText(payload.sessionId, '', 80);
  if (!sessionId) throw new Error('Missing sessionId');
  const row = first(await rest(`future_book_sessions?id=eq.${encodeParam(sessionId)}&select=*&limit=1`)) as Record<string, unknown> | null;
  if (!row?.id) throw new Error('Session not found');
  const snapshot = await privacySnapshot(row);
  await rest('future_book_privacy_requests', {
    method: 'POST',
    body: {
      session_id: row.id,
      request_type: 'export',
      status: 'completed',
      requester_hash: await privacyHash(`admin:${admin.label}:${sessionId}`),
      processed_by: admin.label,
      result_metadata: {
        mode: 'admin',
        answer_count: Array.isArray(snapshot.answers) ? snapshot.answers.length : 0,
        sprint: 13
      },
      completed_at: new Date().toISOString()
    },
    prefer: 'return=minimal'
  }).catch(() => null);
  await auditFutureBookAdmin(req, admin, 'adminPrivacyExport', 'future_book_session', sessionId, {
    answer_count: Array.isArray(snapshot.answers) ? snapshot.answers.length : 0
  });
  return {
    ok: true,
    export: snapshot
  };
}

async function adminPrivacyErase(req: Request, payload: Record<string, unknown>) {
  const admin = await requireFutureBookAdmin(req, payload, 'adminPrivacyErase');
  const sessionId = safeText(payload.sessionId, '', 80);
  if (!sessionId) throw new Error('Missing sessionId');
  const reason = safeLongText(payload.reason, 'admin_privacy_erasure', 800);
  const row = first(await rest(`future_book_sessions?id=eq.${encodeParam(sessionId)}&select=id&limit=1`)) as Record<string, unknown> | null;
  if (!row?.id) throw new Error('Session not found');
  const result = await eraseSessionData(sessionId, admin.label, await privacyHash(`admin:${admin.label}:${sessionId}`), reason);
  await auditFutureBookAdmin(req, admin, 'adminPrivacyErase', 'future_book_session', sessionId, {
    reason,
    ...result
  });
  return {
    ok: true,
    erasedSessionId: sessionId,
    ...result
  };
}

async function adminSaveProviderKey(req: Request, payload: Record<string, unknown>) {
  const admin = await requireFutureBookAdmin(req, payload, 'adminSaveProviderKey');
  const provider = safeText(payload.provider, '', 40);
  const apiKey = safeLongText(payload.apiKey, '', 4000);
  const definition = providerDefinitions().find((item) => item.provider === provider);
  if (!definition) throw new Error('Unknown provider');
  if (!apiKey) throw new Error('Missing apiKey');
  const encrypted = await encryptedSecret(apiKey);
  const row = first(await rest('future_book_provider_settings?on_conflict=provider', {
    method: 'POST',
    prefer: 'resolution=merge-duplicates,return=representation',
    body: {
      provider,
      display_name: definition.displayName,
      configured: true,
      required: definition.required,
      status: definition.placeholder ? 'placeholder' : 'configured',
      secret_ciphertext: encrypted.ciphertext,
      secret_nonce: encrypted.nonce,
      secret_last4: apiKey.slice(-4),
      updated_by: admin.label,
      metadata: {
        saved_from: 'future_book_admin',
        env_still_preferred: true,
        rotated_at: new Date().toISOString()
      }
    }
  })) as Record<string, unknown> | null;
  await insertEvent('00000000-0000-0000-0000-000000000000', 'provider_key_saved', {
    provider,
    updated_by: admin.label,
    sprint: 12
  }).catch(() => null);
  await auditFutureBookAdmin(req, admin, 'adminSaveProviderKey', 'future_book_provider_setting', provider, {
    provider,
    secret_last4: apiKey.slice(-4)
  });
  return {
    ok: true,
    provider: {
      provider,
      displayName: definition.displayName,
      configured: true,
      status: row?.status || 'configured',
      secretLast4: apiKey.slice(-4),
      updatedAt: row?.updated_at || new Date().toISOString()
    }
  };
}

async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs = 8000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function testProviderConnectivity(provider: string) {
  if (provider === 'lulu') {
    return {
      ok: true,
      status: 'placeholder',
      detail: 'lulu_placeholder_no_live_call'
    };
  }

  const apiKey = await providerSecret(provider);
  if (!apiKey) {
    return {
      ok: false,
      status: 'not_configured',
      detail: 'missing_secret'
    };
  }

  if (provider === 'openai') {
    const response = await fetchWithTimeout('https://api.openai.com/v1/models', {
      method: 'GET',
      headers: { Authorization: `Bearer ${apiKey}` }
    });
    return {
      ok: response.ok,
      status: response.ok ? 'configured' : 'failed',
      detail: response.ok ? 'models_endpoint_ok' : `openai_http_${response.status}`
    };
  }

  if (provider === 'transcription') {
    const response = await fetchWithTimeout('https://api.openai.com/v1/models', {
      method: 'GET',
      headers: { Authorization: `Bearer ${apiKey}` }
    });
    return {
      ok: response.ok,
      status: response.ok ? 'configured' : 'failed',
      detail: response.ok ? 'openai_models_endpoint_ok_for_transcription' : `transcription_http_${response.status}`
    };
  }

  if (provider === 'anthropic') {
    const response = await fetchWithTimeout('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: Deno.env.get('ANTHROPIC_MODEL') || 'claude-opus-4-7',
        max_tokens: 8,
        messages: [{ role: 'user', content: 'ping' }]
      })
    });
    return {
      ok: response.ok,
      status: response.ok ? 'configured' : 'failed',
      detail: response.ok ? 'messages_endpoint_ok' : `anthropic_http_${response.status}`
    };
  }

  if (provider === 'elevenlabs') {
    const voiceId = elevenLabsVoiceId();
    const modelId = elevenLabsModelId();
    const response = await fetchWithTimeout(`https://api.elevenlabs.io/v1/voices/${encodeURIComponent(voiceId)}`, {
      method: 'GET',
      headers: { 'xi-api-key': apiKey }
    });
    const voice = response.ok ? await response.json().catch(() => ({})) as Record<string, unknown> : {};
    const voiceName = safeText(voice.name, '', 120);
    return {
      ok: response.ok,
      status: response.ok ? 'configured' : 'failed',
      detail: response.ok ? `voice_endpoint_ok:${voiceName || voiceId}` : `elevenlabs_voice_http_${response.status}`,
      voiceId,
      modelId,
      voiceName: voiceName || null
    };
  }

  return {
    ok: true,
    status: 'configured',
    detail: 'secret_present_no_live_probe'
  };
}

async function adminTestProvider(req: Request, payload: Record<string, unknown>) {
  const admin = await requireFutureBookAdmin(req, payload, 'adminTestProvider');
  const provider = safeText(payload.provider, '', 40);
  const definition = providerDefinitions().find((item) => item.provider === provider);
  if (!definition) throw new Error('Unknown provider');
  const hasSecret = provider === 'lulu' || Boolean(await providerSecret(provider));
  const result = await testProviderConnectivity(provider);
  const resultAny = result as Record<string, unknown>;
  const now = new Date().toISOString();
  await rest('future_book_provider_settings?on_conflict=provider', {
    method: 'POST',
    prefer: 'resolution=merge-duplicates,return=minimal',
    body: {
      provider,
      display_name: definition.displayName,
      configured: hasSecret && result.status !== 'not_configured',
      required: definition.required,
      status: result.status,
      tested_at: now,
      metadata: {
        last_test_status: result.status,
        last_test_detail: result.detail,
        voice_id: resultAny.voiceId || null,
        model_id: resultAny.modelId || null,
        voice_name: resultAny.voiceName || null,
        tested_from: 'future_book_admin',
        tested_by: admin.label
      }
    }
  }).catch(() => null);
  await auditFutureBookAdmin(req, admin, 'adminTestProvider', 'future_book_provider_setting', provider, {
    provider,
    result_status: result.status,
    result_detail: result.detail,
    voice_id: resultAny.voiceId || null,
    model_id: resultAny.modelId || null,
    voice_name: resultAny.voiceName || null
  });
  const status = await providerStatus();
  const selected = status.find((item) => item.provider === provider) || {
    provider,
    displayName: definition.displayName,
    configured: result.ok,
    status: result.status
  };
  return {
    ok: true,
    provider: {
      ...selected,
      testedAt: now,
      testResult: result.detail,
      liveProbeOk: result.ok,
      voiceId: resultAny.voiceId || null,
      modelId: resultAny.modelId || null,
      voiceName: resultAny.voiceName || null
    }
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return jsonResponse(req, { ok: true });
  if (req.method !== 'POST') return jsonResponse(req, { error: 'Method not allowed' }, 405);
  if (!hasServiceConfig()) return jsonResponse(req, { error: 'Backend not configured' }, 503);

  try {
    const payload = await req.json().catch(() => ({}));
    const action = safeText(payload.action, 'createSession', 40);

    if (action === 'createSession') {
      return jsonResponse(req, await createSession(req, payload));
    }

    if (action === 'accessStatus') {
      return jsonResponse(req, await accessStatus(req, payload));
    }

    if (action === 'joinWaitlist') {
      return jsonResponse(req, await joinWaitlist(req, payload));
    }

    if (action === 'requestViralInvite') {
      return jsonResponse(req, await requestViralInvite(payload));
    }

    if (action === 'getSession') {
      return jsonResponse(req, await getSession(payload));
    }

    if (action === 'recordConsent') {
      return jsonResponse(req, await recordConsent(payload));
    }

    if (action === 'startSimulatedPayment') {
      return jsonResponse(req, await startSimulatedPayment(req, payload));
    }

    if (action === 'approveSimulatedPayment') {
      return jsonResponse(req, await approveSimulatedPayment(req, payload));
    }

    if (action === 'startInterview') {
      return jsonResponse(req, await startInterview(payload));
    }

    if (action === 'getCurrentQuestion') {
      return jsonResponse(req, await getCurrentQuestion(payload));
    }

    if (action === 'recordInterviewHeartbeat') {
      return jsonResponse(req, await recordInterviewHeartbeat(payload));
    }

    if (action === 'requestFollowUp') {
      return jsonResponse(req, await requestFollowUp(payload));
    }

    if (action === 'synthesizeQuestion') {
      return jsonResponse(req, await synthesizeQuestion(req, payload));
    }

    if (action === 'saveAnswer') {
      return jsonResponse(req, await saveAnswer(req, payload));
    }

    if (action === 'generateBook') {
      return jsonResponse(req, await generateBook(req, payload));
    }

    if (action === 'getBookStatus') {
      return jsonResponse(req, await getBookStatus(payload));
    }

    if (action === 'generatePdf') {
      return jsonResponse(req, await generatePdf(req, payload));
    }

    if (action === 'getPdfStatus') {
      return jsonResponse(req, await getPdfStatus(payload));
    }

    if (action === 'downloadReleasedPdf') {
      return jsonResponse(req, await downloadReleasedPdf(req, payload));
    }

    if (action === 'exportPrivacyData') {
      return jsonResponse(req, await exportPrivacyData(req, payload));
    }

    if (action === 'requestPrivacyErasure') {
      return jsonResponse(req, await requestPrivacyErasure(req, payload));
    }

    if (action === 'runAutonomousMonitor') {
      await requireFutureBookMonitorCaller(req, payload);
      return jsonResponse(req, await runAutonomousMonitor());
    }

    if (action === 'runSyntheticMonitor') {
      await requireFutureBookMonitorCaller(req, payload);
      return jsonResponse(req, { ok: true, run: await runSyntheticMonitor('job_light_flow') });
    }

    if (action === 'adminDashboard') {
      return jsonResponse(req, await adminDashboard(req, payload));
    }

    if (action === 'adminMonitor') {
      return jsonResponse(req, await adminMonitor(req, payload));
    }

    if (action === 'adminToggleAccess') {
      return jsonResponse(req, await adminToggleAccess(req, payload));
    }

    if (action === 'adminDeleteSessionData') {
      return jsonResponse(req, await adminDeleteSessionData(req, payload));
    }

    if (action === 'adminPdf') {
      return jsonResponse(req, await adminPdf(req, payload));
    }

    if (action === 'adminSessionDetail') {
      return jsonResponse(req, await adminSessionDetail(req, payload));
    }

    if (action === 'adminPatchSessionStatus') {
      return jsonResponse(req, await adminPatchSessionStatus(req, payload));
    }

    if (action === 'adminRunRetention') {
      return jsonResponse(req, await adminRunRetention(req, payload));
    }

    if (action === 'adminRunSyntheticMonitor') {
      return jsonResponse(req, await adminRunSyntheticMonitor(req, payload));
    }

    if (action === 'adminRunAutonomousMonitor') {
      return jsonResponse(req, await adminRunAutonomousMonitor(req, payload));
    }

    if (action === 'adminRetryDeadLetter') {
      return jsonResponse(req, await retryDeadLetter(req, payload));
    }

    if (action === 'adminResolveDeadLetter') {
      return jsonResponse(req, await resolveDeadLetter(req, payload));
    }

    if (action === 'adminCreateAccessCampaign') {
      return jsonResponse(req, await adminCreateAccessCampaign(req, payload));
    }

    if (action === 'adminUpdateAccessCampaign') {
      return jsonResponse(req, await adminUpdateAccessCampaign(req, payload));
    }

    if (action === 'adminUpdateAccessPolicy') {
      return jsonResponse(req, await adminUpdateAccessPolicy(req, payload));
    }

    if (action === 'adminCreateAccessInvites') {
      return jsonResponse(req, await adminCreateAccessInvites(req, payload));
    }

    if (action === 'adminRevokeAccessInvite') {
      return jsonResponse(req, await adminRevokeAccessInvite(req, payload));
    }

    if (action === 'adminPrivacyExport') {
      return jsonResponse(req, await adminPrivacyExport(req, payload));
    }

    if (action === 'adminPrivacyErase') {
      return jsonResponse(req, await adminPrivacyErase(req, payload));
    }

    if (action === 'adminApprovePdf') {
      return jsonResponse(req, await patchPdfReview(req, payload, 'approved'));
    }

    if (action === 'adminRejectPdf') {
      return jsonResponse(req, await patchPdfReview(req, payload, 'rejected'));
    }

    if (action === 'adminRequestRegeneration') {
      return jsonResponse(req, await patchPdfReview(req, payload, 'regeneration_requested'));
    }

    if (action === 'adminRegeneratePdf') {
      return jsonResponse(req, await adminRegeneratePdf(req, payload));
    }

    if (action === 'adminReleasePdf') {
      return jsonResponse(req, await patchPdfReview(req, payload, 'released_to_customer'));
    }

    if (action === 'adminSaveProviderKey') {
      return jsonResponse(req, await adminSaveProviderKey(req, payload));
    }

    if (action === 'adminTestProvider') {
      return jsonResponse(req, await adminTestProvider(req, payload));
    }

    return jsonResponse(req, { error: 'Unknown action' }, 400);
  } catch (error) {
    return jsonResponse(req, { error: error instanceof Error ? error.message : 'Unexpected error' }, 400);
  }
});
