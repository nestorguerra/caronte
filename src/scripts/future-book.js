import { callFunction } from './api-client.js?v=20260903-production-recovery';
import { createCaptureStore, legacyCaptureId, validateCaptureReceipt } from './caronte-capture-store.js';
import { hasBackendConfig } from './config.js';

const STORAGE_KEY = 'future_book_sprint3_session';
const ANSWERS_KEY = 'future_book_sprint3_answers';
const MANUSCRIPT_KEY = 'future_book_sprint4_manuscript';
const PDF_KEY = 'future_book_sprint5_pdf';
const PENDING_ANSWERS_KEY = 'future_book_sprint8_pending_answers';
const ENTRY_STAGE_KEY = 'future_book_entry_stage';
const RITUAL_LOG_KEY = 'future_book_ritual_log';
const ACCESS_TOKEN_KEY = 'future_book_access_token';
const UI_VERSION_KEY = 'future_book_minimal_console_v8';
const NAME_KEY = 'future_book_name';
const CLIENT_BOOT_DELAY_MS = 10000;
const CLIENT_STARTED_AT = Date.now();
const MAX_CLIENT_AUDIO_BYTES = 24 * 1024 * 1024;
const ANSWER_SAVE_TIMEOUT_MS = 180000;
const INTERVIEW_HEARTBEAT_MS = 45000;
const PAYMENT_COUNTDOWN_MS = 5 * 60 * 1000;
const INTRO_AUDIO_TIMEOUT_MS = 200000;
const ENTRY_REQUEST_TIMEOUT_MS = 12000;
const ACTION_REQUEST_TIMEOUT_MS = 30000;
const IS_LOCAL_PREVIEW = window.location.protocol === 'file:'
  || ['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname);
const PAYMENT_DEADLINE_KEY = 'future_book_payment_deadline';
const AUTONOMOUS_NOTICE = 'system_notice: escritura=GPT-6.1 Sol (xhigh); revisión=Claude Opus 5.5; voz=ElevenLabs; impresión=Lulu.';
const CLIENT_BOOT_LINES = [
  'Last login: Wed Apr 22 11:22:14 on ttys000',
  'resolve ephemeral_url',
  AUTONOMOUS_NOTICE,
  'La entrevista y la escritura funcionan automáticamente. Los operadores autorizados pueden revisar el proceso y aprobar los archivos de impresión.',
  'La revisión automática no sustituye la aprobación de los archivos de impresión por un operador autorizado.',
  'La escritura usa GPT-6.1 Sol con xhigh; la revisión, Claude Opus 5.5; la voz, ElevenLabs; y la impresión, Lulu.',
  'validate access_token',
  'create private session',
  'payment_gateway=eur_bypass_beta',
  'await transaction'
];
function paymentGateLines(remaining = '5:00') {
  return [
  'BIENVENIDO.',
  '',
  'TIENE USTED 5 MINUTOS PARA COMPLETAR LA TRANSACCION POR PAYPAL O TARJETA BANCARIA.',
  '',
  'PRECIO: 49,95 EUR.',
  '',
  'PASARELA: EUR_GATEWAY_PENDING_INTEGRATION.',
  'PULSE ENTER PARA VERIFICAR TRANSACCION.',
    `TIEMPO RESTANTE: ${remaining}`
  ];
}
const VERIFIED_LINES = [
  '',
  'TRANSACCION VERIFICADA.',
  'PREPARANDO INTERFAZ...',
  '',
  'POR FAVOR, ASEGURESE DE:',
  '- ESTAR EN UN LUGAR PRIVADO',
  '- TENER AURICULARES O ALTAVOCES EN SU DISPOSITIVO',
  '- DISPONER DE 30-50 MINUTOS SIN INTERRUPCIONES',
  '- TENER SU CONEXION A INTERNET ESTABLE'
];
const VOICE_INTRO_DISPLAY_TEXT = [
  'Bienvenido. Esto es Caronte. Un modelo entrenado para una sola función: construir a partir de tus respuestas un mapa psicológico coherente de ti. Con ese mapa y con simulaciones escribiré el texto que has pagado por recibir. Un libro escrito por tu yo del futuro a tu yo del presente.',
  'No soy un terapeuta, ni un test de personalidad, ni un asistente. Soy un instrumento. Trátame como tal.',
  'Tres reglas.',
  'Uno. La sesión dura de treinta a cincuenta minutos. La duración depende de la densidad de tus respuestas.',
  'Dos. Mantén la web abierta en todo momento y no la cierres durante la entrevista o se perderá todo.',
  'Tres. Responde con la honestidad que quieras. Piensa que cada respuesta es un vector que sitúo en un espacio latente. Las respuestas se agrupan con coherencia. Las incoherencias introducen ruido.',
  'Eres la única persona con algo en juego aquí. La entrevista y la escritura funcionan automáticamente. Los operadores autorizados pueden revisar el proceso y aprobar los archivos de impresión. Los datos y archivos se conservan de forma privada conforme a la política de privacidad del servicio.',
  'Escribe acepto para comenzar.'
].join('\n');
const VOICE_INTRO_SPEECH_TEXT = [
  '[calm, low voice]',
  'Bienvenido.',
  '',
  '[short pause]',
  '',
  'Esto es Caronte.',
  '',
  '[slowly]',
  'Un modelo entrenado para una sola función: construir, a partir de tus respuestas, un mapa psicológico coherente de ti.',
  '',
  '[short pause]',
  '',
  'Con ese mapa... y con simulaciones... escribiré el texto que has pagado por recibir.',
  '',
  '[lower voice]',
  'Un libro escrito por tu yo del futuro a tu yo del presente.',
  '',
  '[long pause]',
  '',
  '[firm]',
  'No soy un terapeuta.',
  'Ni un test de personalidad.',
  'Ni un asistente.',
  '',
  '[short pause]',
  '',
  'Soy un instrumento.',
  '',
  '[slightly colder]',
  'Trátame como tal.',
  '',
  '[long pause]',
  '',
  'Tres reglas.',
  '',
  '[firm, measured]',
  'Uno. La sesión dura de treinta a cincuenta minutos.',
  'La duración depende de la densidad de tus respuestas.',
  '',
  '[short pause]',
  '',
  'Dos. Mantén la web abierta en todo momento.',
  'No la cierres durante la entrevista... o se perderá todo.',
  '',
  '[short pause]',
  '',
  'Tres. Responde con la honestidad que quieras.',
  '',
  '[slowly, precise]',
  'Piensa que cada respuesta es un vector que sitúo en un espacio latente.',
  '',
  '[short pause]',
  '',
  'Las respuestas se agrupan con coherencia.',
  '',
  '[lower voice]',
  'Las incoherencias introducen ruido.',
  '',
  '[long pause]',
  '',
  '[calm]',
  'Eres la única persona con algo en juego aquí.',
  '',
  '[short pause]',
  '',
  'La entrevista y la escritura funcionan automáticamente.',
  'Los operadores autorizados pueden revisar el proceso y aprobar los archivos de impresión.',
  '',
  '[lower voice]',
  'Los datos y archivos se conservan de forma privada conforme a la política de privacidad del servicio.',
  '',
  '[long pause]',
  '',
  '[firm]',
  'Escribe acepto para comenzar.'
].join('\n');
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
const LOCAL_VOICE_INTRO_URL = './caronte-voice-intro.m4a';
const LOCAL_VOICE_FOLLOW_UP_URL = './caronte-voice-followup.m4a';

function localQuestionVoiceUrl(index) {
  const safeIndex = Math.max(1, Math.min(interviewQuestions.length, Number(index) || 1));
  return `./caronte-voice-q${String(safeIndex).padStart(2, '0')}.m4a`;
}

const firstQuestion = interviewQuestions[0];
const futureBoot = document.querySelector('#futureBoot');
const futureIntro = document.querySelector('#futureIntro');
const futureIntroLog = document.querySelector('#futureIntroLog');
const futurePersistentLog = document.querySelector('#futurePersistentLog');
const ritualLog = document.querySelector('#ritualLog');
const nameGate = document.querySelector('#nameGate');
const namePromptLabel = document.querySelector('#namePromptLabel');
const nameInput = document.querySelector('#nameInput');
const form = document.querySelector('#futureAccessForm');
const paymentStage = document.querySelector('#paymentStage');
const readyStage = document.querySelector('#readyStage');
const interviewStage = document.querySelector('#interviewStage');
const completeStage = document.querySelector('#completeStage');
const bookStage = document.querySelector('#bookStage');
const technicalNote = document.querySelector('#technicalNote');
const sessionStatus = document.querySelector('#sessionStatus');
const stepLabel = document.querySelector('#stepLabel');
const consoleTitle = document.querySelector('#consoleTitle');
const progressBar = document.querySelector('#progressBar');
const resetButton = document.querySelector('#resetFlowButton');
const resetCompletedButton = document.querySelector('#resetCompletedButton');
const resetBookButton = document.querySelector('#resetBookButton');
const beginInterviewButton = document.querySelector('#beginInterviewButton');
const startPaymentButton = document.querySelector('#startPaymentButton');
const generateBookButton = document.querySelector('#generateBookButton');
const generatePdfButton = document.querySelector('#generatePdfButton');
const downloadPdfButton = document.querySelector('#downloadPdfButton');
const playQuestionButton = document.querySelector('#playQuestionButton');
const recordAnswerButton = document.querySelector('#recordAnswerButton');
const stopRecordingButton = document.querySelector('#stopRecordingButton');
const saveAnswerButton = document.querySelector('#saveAnswerButton');
const questionText = document.querySelector('#questionText');
const questionLabel = document.querySelector('#questionLabel');
const liveTranscript = document.querySelector('#liveTranscript');
const answerMeta = document.querySelector('#answerMeta');
const bookTitle = document.querySelector('#bookTitle');
const bookQuality = document.querySelector('#bookQuality');
const bookSections = document.querySelector('#bookSections');
const pdfStatus = document.querySelector('#pdfStatus');
const voiceOrb = document.querySelector('#voiceOrb');
const paymentLines = [...document.querySelectorAll('[data-payment-line]')];

let currentSession = null;
let currentQuestion = { index: 1, total: 21, text: firstQuestion };
let currentFollowUp = false;
let mediaRecorder = null;
let audioChunks = [];
let recordingStartedAt = 0;
let lastDurationSeconds = 0;
let currentTranscript = '';
let currentTranscriptFinal = false;
let currentCaptureId = '';
let currentCaptureSessionId = '';
let currentAnswerPayload = null;
let answerSavePending = false;
let recordingStartPending = false;
let recordingRequestId = '';
const captureStore = createCaptureStore();
let pendingMigrationPromise = null;
let recognition = null;
let browserSpeechSupported = false;
let audioCaptured = false;
let currentAudioMimeType = '';
let enteredName = sessionStorage.getItem(NAME_KEY) || '';
let entryStage = sessionStorage.getItem(ENTRY_STAGE_KEY) || 'payment';
let bookStatusTimer = null;
let pdfStatusTimer = null;
let heartbeatTimer = null;
let paymentCountdownTimer = null;
let cachedClientFingerprint = '';
let audioUnlockContext = null;
let sharedVoiceAudio = null;
let silentAudioUrl = '';
let pendingAudioReplay = null;
let preparedQuestionAudio = null;
let preparingQuestionAudio = null;
let currentBrowserUtterance = null;

async function sha256Hex(value) {
  if (!window.crypto?.subtle) return btoa(value).replace(/=+$/g, '').slice(0, 64);
  const bytes = await window.crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function utcDay() {
  return new Date().toISOString().slice(0, 10);
}

async function clientFingerprint() {
  if (cachedClientFingerprint) return cachedClientFingerprint;
  const signals = [
    navigator.userAgent || '',
    navigator.language || '',
    Intl.DateTimeFormat().resolvedOptions().timeZone || '',
    String(screen.width || 0),
    String(screen.height || 0),
    String(window.devicePixelRatio || 1),
    String(navigator.hardwareConcurrency || 0),
    String(navigator.maxTouchPoints || 0)
  ].join('|');
  cachedClientFingerprint = await sha256Hex(`future-book-client:${signals}`);
  return cachedClientFingerprint;
}

async function clientSecurityPayload() {
  const fingerprint = await clientFingerprint();
  return {
    clientFingerprint: fingerprint,
    abuseProof: await sha256Hex(`caronte-proof:${fingerprint}:${utcDay()}`),
    clientRuntimeMs: Date.now() - CLIENT_STARTED_AT
  };
}

function clearFutureBookSessionState() {
  resetCaptureState();
  sessionStorage.removeItem(STORAGE_KEY);
  sessionStorage.removeItem(ANSWERS_KEY);
  sessionStorage.removeItem(MANUSCRIPT_KEY);
  sessionStorage.removeItem(PDF_KEY);
  sessionStorage.removeItem(NAME_KEY);
  sessionStorage.removeItem(ENTRY_STAGE_KEY);
  sessionStorage.removeItem(RITUAL_LOG_KEY);
  sessionStorage.removeItem(ACCESS_TOKEN_KEY);
  sessionStorage.removeItem(PAYMENT_DEADLINE_KEY);
  currentSession = null;
  enteredName = '';
  entryStage = 'payment';
}

function accessTokenFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return String(params.get('k') || params.get('invite') || params.get('token') || '').trim();
}

function syncAccessToken() {
  const token = accessTokenFromUrl();
  const stored = sessionStorage.getItem(ACCESS_TOKEN_KEY) || '';
  if (token && stored && stored !== token) {
    clearFutureBookSessionState();
  }
  if (token) sessionStorage.setItem(ACCESS_TOKEN_KEY, token);
  return token || sessionStorage.getItem(ACCESS_TOKEN_KEY) || '';
}

function formatPaymentRemaining(ms) {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function ensurePaymentDeadline() {
  const saved = Number(sessionStorage.getItem(PAYMENT_DEADLINE_KEY) || 0);
  if (saved > Date.now()) return saved;
  const deadline = Date.now() + PAYMENT_COUNTDOWN_MS;
  sessionStorage.setItem(PAYMENT_DEADLINE_KEY, String(deadline));
  return deadline;
}

function paymentRemainingMs() {
  const deadline = Number(sessionStorage.getItem(PAYMENT_DEADLINE_KEY) || 0);
  return Math.max(0, deadline - Date.now());
}

function setPaymentGateLog() {
  setRitualLog(paymentGateLines(formatPaymentRemaining(paymentRemainingMs())));
}

function stopPaymentCountdown() {
  if (paymentCountdownTimer) window.clearInterval(paymentCountdownTimer);
  paymentCountdownTimer = null;
}

function expirePaymentCountdown() {
  stopPaymentCountdown();
  persistEntryStage('expired');
  sessionStorage.removeItem(STORAGE_KEY);
  currentSession = null;
  setNameGateBusy(true);
  setRitualLog([
    ...paymentGateLines('0:00'),
    '',
    'TIEMPO AGOTADO.',
    'ENLACE ROTO.',
    'SESSION_TERMINATED.'
  ]);
  setStep('stage 00/05', 'link_expired', '0%');
  setText(sessionStatus, 'Sesion terminada');
  note('payment_timer_expired');
}

function startPaymentCountdown() {
  if (entryStage !== 'payment') {
    stopPaymentCountdown();
    return;
  }
  const existingDeadline = Number(sessionStorage.getItem(PAYMENT_DEADLINE_KEY) || 0);
  if (existingDeadline > 0 && existingDeadline <= Date.now()) {
    expirePaymentCountdown();
    return;
  }
  ensurePaymentDeadline();
  setPaymentGateLog();
  stopPaymentCountdown();
  paymentCountdownTimer = window.setInterval(() => {
    if (entryStage !== 'payment') {
      stopPaymentCountdown();
      return;
    }
    if (paymentRemainingMs() <= 0) {
      expirePaymentCountdown();
      return;
    }
    setPaymentGateLog();
  }, 1000);
}

function isAccessError(error) {
  const message = error instanceof Error ? error.message : String(error || '');
  return /access_denied|invite_|campaign_|access_link|Future book access/i.test(message);
}

function entryErrorMessage(error) {
  const message = error instanceof Error ? error.message : String(error || '');
  if (isBackendUnavailableError(error)) {
    return 'session_recovery_failed / retry';
  }
  return message || 'entry_failed';
}

function isBackendUnavailableError(error) {
  const message = error instanceof Error ? error.message : String(error || '');
  return /timeout|Failed to fetch|fetch failed|Load failed|NetworkError|ERR_NAME_NOT_RESOLVED|Backend not configured|HTTP (502|503|504)/i.test(message);
}

function migrateUiMode() {
  if (sessionStorage.getItem(UI_VERSION_KEY)) return;
  clearFutureBookSessionState();
  sessionStorage.setItem(UI_VERSION_KEY, '1');
}

function setText(node, text) {
  if (node) node.textContent = text;
}

function setStep(step, title, width) {
  setText(stepLabel, step);
  setText(consoleTitle, title);
  if (progressBar) progressBar.style.width = width;
}

function note(text) {
  setText(technicalNote, text);
}

function voiceStatusMessage(error) {
  if (error === 'elevenlabs_api_key_missing' || error === 'backend_config_missing') {
    return 'voice_provider=missing / text_mode_active';
  }
  return error || 'elevenlabs_audio_missing';
}

function setRitualLog(lines) {
  const text = Array.isArray(lines) ? `${lines.join('\n')}\n` : String(lines || '');
  if (ritualLog) ritualLog.textContent = text;
  sessionStorage.setItem(RITUAL_LOG_KEY, text);
}

function appendRitualLine(line = '') {
  const previous = ritualLog?.textContent || sessionStorage.getItem(RITUAL_LOG_KEY) || '';
  const next = `${previous}${line}\n`;
  if (ritualLog) ritualLog.textContent = next;
  sessionStorage.setItem(RITUAL_LOG_KEY, next);
}

function replaceRitualLastLine(line = '') {
  const previous = ritualLog?.textContent || sessionStorage.getItem(RITUAL_LOG_KEY) || '';
  const normalized = previous.endsWith('\n') ? previous.slice(0, -1) : previous;
  const lines = normalized ? normalized.split('\n') : [];
  if (!lines.length) lines.push(line);
  else lines[lines.length - 1] = line;
  const next = `${lines.join('\n')}\n`;
  if (ritualLog) ritualLog.textContent = next;
  sessionStorage.setItem(RITUAL_LOG_KEY, next);
}

async function typeRitualLines(lines, delay = 380) {
  for (const line of lines) {
    appendRitualLine(line);
    await wait(delay);
  }
}

function setEntryPrompt(label, placeholder = '') {
  setText(namePromptLabel, label);
  if (nameInput) {
    nameInput.placeholder = placeholder;
    nameInput.value = '';
  }
}

function setNameGateBusy(isBusy) {
  if (nameInput) nameInput.disabled = isBusy;
  const button = nameGate?.querySelector('button[type="submit"]');
  if (button) button.disabled = isBusy;
}

function persistEntryStage(stage) {
  entryStage = stage;
  sessionStorage.setItem(ENTRY_STAGE_KEY, stage);
}

function cleanParticipantName(value) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, 40);
}

function questionFor(index, name = '') {
  const base = interviewQuestions[index - 1] || interviewQuestions[interviewQuestions.length - 1];
  const participant = cleanParticipantName(name);
  if (!participant) return base;
  if (index === 1) {
    return `Hola ${participant}. Vamos a realizar ahora la entrevista. Tus respuestas pueden condicionar las siguientes preguntas. Empezamos: ¿qué edad tienes, qué momento vital dirías que estás atravesando y qué versión de ti está entrando ahora en esta experiencia?`;
  }
  return `${participant}. ${base}`;
}

function questionCode(index) {
  return `q_${String(index).padStart(2, '0')}`;
}

function wordCount(text) {
  return String(text || '').split(/\s+/).map((word) => word.trim()).filter(Boolean).length;
}

async function migrateLegacyPendingAnswers() {
  if (!pendingMigrationPromise) pendingMigrationPromise = (async () => {
    const before = localStorage.getItem(PENDING_ANSWERS_KEY);
    const rows = JSON.parse(before || '[]');
    if (!Array.isArray(rows)) throw new Error('pending_queue_invalid');
    const remaining = [];
    for (const item of rows) {
      if (!item?.sessionId || !Number.isInteger(item.questionIndex) || item.questionIndex < 1) { remaining.push(item); continue; }
      const captureId = item.captureId || await legacyCaptureId(item);
      await captureStore.put({ ...item, captureId });
    }
    // A crash or quota failure before this write retains the old source. Stable
    // capture IDs make a later migration safe. Never erase another tab's update.
    if (remaining.length !== rows.length && localStorage.getItem(PENDING_ANSWERS_KEY) === before) {
      localStorage.setItem(PENDING_ANSWERS_KEY, JSON.stringify(remaining));
    }
  })();
  try { await pendingMigrationPromise; } finally { pendingMigrationPromise = null; }
}

async function readPendingAnswers(allSessions = false, sessionId = currentSession?.id) {
  await migrateLegacyPendingAnswers();
  return captureStore.list(allSessions ? null : sessionId || '');
}

async function queuePendingAnswer(payload) {
  const sessionId = payload.sessionId || currentSession?.id;
  if (!sessionId) throw new Error('pending_answer_session_missing');
  return captureStore.put({ ...payload, sessionId, captureId: payload.captureId || crypto.randomUUID() });
}

async function removePendingAnswer(_questionIndex, sessionId = currentSession?.id, captureId = '') {
  await captureStore.acknowledge(sessionId, captureId);
}

async function answerForTransport(payload) {
  const { audioBlob, queuedAt: _queuedAt, ...answer } = payload;
  if (audioBlob) {
    if (audioBlob.size > MAX_CLIENT_AUDIO_BYTES) throw new Error('audio_too_large');
    answer.audioBase64 = await blobToBase64(audioBlob);
    answer.audioByteLength = audioBlob.size;
  }
  return answer;
}

function preferredAudioMimeType() {
  const types = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'];
  return types.find((type) => window.MediaRecorder?.isTypeSupported?.(type)) || '';
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const value = String(reader.result || '');
      resolve(value.includes(',') ? value.split(',').pop() : value);
    };
    reader.onerror = () => reject(reader.error || new Error('audio_read_failed'));
    reader.readAsDataURL(blob);
  });
}

async function currentAudioPayload() {
  if (!audioChunks.length) return { audioBase64: null, audioByteLength: 0 };
  const blob = new Blob(audioChunks, { type: currentAudioMimeType || 'audio/webm' });
  if (blob.size > MAX_CLIENT_AUDIO_BYTES) {
    setText(answerMeta, 'audio_too_large / retry_shorter.');
    throw new Error('audio_too_large');
  }
  return {
    audioBlob: blob,
    audioByteLength: blob.size
  };
}

function followUpFor(index) {
  return `Respuesta demasiado corta. Vuelve a ${questionCode(index)}. Dame una escena, una razon concreta o algo que no sea obvio.`;
}

function saveSession(session, mode = 'backend') {
  currentSession = { ...session, mode };
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(currentSession));
  const backendSuffix = mode === 'backend' ? ' / backend' : '';
  setText(sessionStatus, `Sesion ${String(session.id || '').slice(0, 8)}${backendSuffix}`);
}

function renderEntryStage() {
  const storedLog = sessionStorage.getItem(RITUAL_LOG_KEY);
  if (entryStage === 'payment') {
    persistEntryStage('payment');
    setStep('stage 01/05', 'transaction_required', '12%');
    setEntryPrompt('future@autonomous-system ~ %', '');
    note('press_enter_to_verify_payment');
    startPaymentCountdown();
    return;
  }

  stopPaymentCountdown();
  if (storedLog) {
    if (ritualLog) ritualLog.textContent = storedLog;
  } else {
    setRitualLog(paymentGateLines('5:00'));
  }

  if (entryStage === 'expired') {
    setNameGateBusy(true);
    setStep('stage 00/05', 'link_expired', '0%');
    setEntryPrompt('future@autonomous-system ~ %', '');
    note('payment_timer_expired');
    return;
  }

  if (entryStage === 'accept') {
    setStep('stage 01/05', 'voice_rules', '22%');
    setEntryPrompt('future@autonomous-system ~ %', 'acepto');
    note('await_accept');
    return;
  }

  if (entryStage === 'name') {
    setStep('stage 01/05', 'identity_prompt', '28%');
    setEntryPrompt('future@autonomous-system ~ %', 'nombre');
    note('await_name');
    return;
  }
}

function showNameGate() {
  hideAllStages();
  if (nameGate) nameGate.hidden = false;
  renderEntryStage();
  setText(sessionStatus, 'session idle');
  requestAnimationFrame(() => nameInput?.focus());
}

function showAccessDenied(access = {}, waitlist = null) {
  hideAllStages();
  const reason = access.reason || 'invite_required';
  const campaign = access.campaign?.code || 'none';
  const lines = [
    'ACCESS LINK CHECK FAILED.',
    `reason=${reason}`,
    `campaign=${campaign}`,
    'fixed_url=false',
    'session_created=false',
    waitlist?.opaqueCode ? `waitlist=${waitlist.opaqueCode}` : 'waitlist=opaque'
  ];
  setRitualLog(lines);
  setStep('stage 00/05', 'link_dead', '4%');
  setText(sessionStatus, 'Enlace caducado o cerrado');
  note('access_denied / no_session');
}

async function registerOpaqueWaitlist(access) {
  if (!hasBackendConfig() || access?.waitlistEnabled === false) return null;
  const security = await clientSecurityPayload();
  const result = await callFunction('future-book-session', {
    action: 'joinWaitlist',
    inviteToken: syncAccessToken(),
    source: 'futuro_front',
    entrypoint: window.location.pathname,
    reason: access?.reason || 'access_denied',
    ...security
  }, { timeoutMs: ENTRY_REQUEST_TIMEOUT_MS }).catch(() => null);
  return result?.waitlist || null;
}

function readStoredSession() {
  try {
    return JSON.parse(sessionStorage.getItem(STORAGE_KEY) || 'null');
  } catch {
    return null;
  }
}

function readLocalAnswers() {
  try {
    return JSON.parse(sessionStorage.getItem(ANSWERS_KEY) || '[]');
  } catch {
    return [];
  }
}

function writeLocalAnswer(answer) {
  const answers = readLocalAnswers().filter((item) => item.question_index !== answer.question_index);
  answers.push(answer);
  sessionStorage.setItem(ANSWERS_KEY, JSON.stringify(answers));
}

function readLocalManuscript() {
  try {
    return JSON.parse(sessionStorage.getItem(MANUSCRIPT_KEY) || 'null');
  } catch {
    return null;
  }
}

function writeLocalManuscript(manuscript) {
  sessionStorage.setItem(MANUSCRIPT_KEY, JSON.stringify(manuscript));
}

function readLocalPdf() {
  try {
    return JSON.parse(sessionStorage.getItem(PDF_KEY) || 'null');
  } catch {
    return null;
  }
}

function localAccessDisabled() {
  try {
    const flag = JSON.parse(localStorage.getItem('future_book_sprint6_access') || 'null');
    return flag?.disabled === true;
  } catch {
    return false;
  }
}

function writeLocalPdf(pdf) {
  sessionStorage.setItem(PDF_KEY, JSON.stringify(pdf));
}

function excerpt(value, fallback, limit = 170) {
  const text = String(value || fallback || '').replace(/\s+/g, ' ').trim();
  if (text.length <= limit) return text;
  return `${text.slice(0, limit).trim()}...`;
}

function localAnswerText(answers, questionIndex, fallback) {
  const answer = answers.find((item) => Number(item.question_index) === questionIndex);
  return excerpt(answer?.transcript, fallback, 190);
}

function localSection(id, title, kind, paragraphs) {
  return { id, title, kind, paragraphs };
}

function estimateLocalPages(sections) {
  const words = sections.reduce((total, section) => total + section.paragraphs.join(' ').split(/\s+/).filter(Boolean).length, 0);
  return Math.max(8, Math.round(words / 330));
}

function generateLocalManuscript(answers) {
  const title = 'Futuro Anterior: instrucciones desde una vida posible';
  const sections = [
    localSection('cover', title, 'cover', [
      `Ejemplar unico generado para la sesion ${String(currentSession?.id || '').slice(0, 8)}.`,
      'No contiene una prediccion. Contiene una forma de escucharte desde una distancia que todavia no existe.'
    ]),
    localSection('loose_page', 'hoja suelta antes de leer', 'instructions', [
      'Leelo como una conversacion incomoda con una version tuya que ya pago varios precios.',
      'Marca lo que te enfade. Lo que te enfada suele ser una puerta con mala iluminacion.'
    ]),
    localSection('future_note', 'nota de quien aun no eres', 'future_note', [
      `Entraste asi: "${localAnswerText(answers, 1, 'sin descripcion clara')}".`,
      `Tu momento vital sonaba asi: "${localAnswerText(answers, 2, 'una transicion sin nombre')}".`
    ]),
    localSection('prologue', 'prologo: los futuros no avisan', 'prologue', [
      `Lo que evitabas mirar era esto: "${localAnswerText(answers, 4, 'algo todavia no dicho')}".`,
      `El posible arrepentimiento aparecio aqui: "${localAnswerText(answers, 5, 'seguir igual demasiado tiempo')}".`
    ]),
    localSection('chapter_1', 'capitulo 1: lo que funcionaba no bastaba', 'chapter', [
      `No todo estaba roto. Por eso era peligroso. Lo que funcionaba podia servir como coartada.`,
      `La vida que parecia razonable tambien estaba dejando este coste: "${localAnswerText(answers, 12, 'un precio no reconocido')}".`
    ]),
    localSection('chapter_2', 'capitulo 2: deseo y miedo firmaron el mismo contrato', 'chapter', [
      `El deseo escondido fue: "${localAnswerText(answers, 6, 'un deseo dificil de decir')}".`,
      `El miedo que decidia por debajo fue: "${localAnswerText(answers, 7, 'un miedo persistente')}".`
    ]),
    localSection('chapter_3', 'capitulo 3: relaciones que piden presencia', 'chapter', [
      `Habia una relacion a cuidar: "${localAnswerText(answers, 9, 'alguien importante')}".`,
      `Y habia una relacion o patron que transformar: "${localAnswerText(answers, 10, 'algo que soltar')}".`
    ]),
    localSection('chapter_4', 'capitulo 4: trabajo y ambicion', 'chapter', [
      `La ambicion seguia llamando asi: "${localAnswerText(answers, 11, 'una ambicion aplazada')}".`,
      `La parte viva del trabajo era "${localAnswerText(answers, 13, 'energia real')}", y la parte que apagaba era "${localAnswerText(answers, 14, 'desgaste')}".`
    ]),
    localSection('chapter_5', 'capitulo 5: dinero, estatus, libertad', 'chapter', [
      `Tu respuesta sobre dinero, estatus y libertad dejo esto: "${localAnswerText(answers, 15, 'una tension no resuelta')}".`,
      'No se trata de despreciar el dinero ni romantizar la renuncia. Se trata de saber quien manda cuando nadie mira.'
    ]),
    localSection('chapter_6', 'capitulo 6: la historia que te contabas', 'chapter', [
      `La historia que podia no ser verdad era: "${localAnswerText(answers, 16, 'una narrativa antigua')}".`,
      `El habito pequeno era: "${localAnswerText(answers, 17, 'una palanca diaria')}".`
    ]),
    localSection('chapter_7', 'capitulo 7: amor, mirada y peticion final', 'chapter', [
      `Querias que se entendiera esto: "${localAnswerText(answers, 18, 'algo dificil de explicar')}".`,
      `Amar mejor sonaba asi: "${localAnswerText(answers, 19, 'una forma honesta de amar')}". La peticion final fue: "${localAnswerText(answers, 20, 'no te abandones')}".`
    ]),
    localSection('final_letter', 'carta final: no lo conviertas en decoracion', 'letter', [
      'Si este libro solo se ensena, se vuelve teatro. Si se trabaja, puede convertirse en herramienta.',
      `La pregunta que faltaba fue: "${localAnswerText(answers, 21, 'la pregunta que no aparecio')}". Vuelve a ella cuando el ruido baje.`
    ]),
    localSection('practical_epilogue', 'epilogo practico: siete gestos en treinta dias', 'epilogue', [
      'Escribe una decision aplazada. Pide una conversacion pendiente. Elimina una obligacion que solo protege tu imagen.',
      'Protege dos horas semanales para la ambicion negada. Cambia el habito pequeno. Revisa cada domingo el precio que pagas.'
    ]),
    localSection('ai_notice', 'aviso de IA y limites', 'notice', [
      'Este manuscrito usa entrevista, patrones narrativos y plausibilidad. No predice hechos, no diagnostica y no sustituye ayuda profesional.',
      'Su valor esta en provocar preguntas mejores y decisiones que vuelven a estar en tus manos.'
    ])
  ];
  const words = answers.reduce((total, answer) => total + wordCount(answer.transcript), 0);
  const qualityScore = Math.round((0.68 + Math.min(0.18, words / 5000) + Math.min(0.12, answers.length / 21 * 0.12)) * 100) / 100;
  return {
    id: crypto.randomUUID(),
    status: 'ready',
    title,
    qualityScore,
    promptVersion: 'future-book-sprint4-local-v1',
    providerChain: {
      drafting: 'deterministic_local',
      reviewer: 'local_rules',
      prompt_version: 'future-book-sprint4-v1'
    },
    manuscript: {
      title,
      subtitle: 'Un libro escrito desde futuros plausibles, no desde certezas.',
      target_pages: { min: 35, max: 60, estimated_current_pages: estimateLocalPages(sections) },
      sections,
      editorial_notes: 'Borrador local Sprint 4. En produccion se genera server-side y queda listo para maquetacion PDF.'
    },
    qualityReport: {
      score: qualityScore,
      status: qualityScore >= 0.78 ? 'ready_for_human_review' : 'needs_editorial_expansion',
      page_target: { min: 35, max: 60, estimated_current_pages: estimateLocalPages(sections) },
      checks: [
        { code: 'no_prediction_claim', status: 'pass', detail: 'futuros plausibles, no prediccion.' },
        { code: 'no_clinical_or_legal_advice', status: 'pass', detail: 'incluye limites y aviso IA.' },
        { code: 'personalization', status: answers.length >= 21 ? 'pass' : 'warning', detail: `${answers.length}/21 respuestas.` },
        { code: 'pdf_readiness', status: 'warning', detail: 'falta maquetacion PDF sprint siguiente.' }
      ],
      generated_at: new Date().toISOString()
    },
    createdAt: new Date().toISOString()
  };
}

function pdfClean(value, limit = 1200) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x20-\x7E]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, limit);
}

function pdfEscape(value) {
  return value.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

function makeLocalPdf(manuscriptPayload) {
  const manuscript = manuscriptPayload?.manuscript || manuscriptPayload || {};
  const title = pdfClean(manuscript.title || manuscriptPayload?.title || 'Futuro Anterior', 160) || 'Futuro Anterior';
  const sections = Array.isArray(manuscript.sections) ? manuscript.sections : [];
  const pageWidth = 420;
  const pageHeight = 595;
  const margin = 46;
  const pages = [[]];
  let y = pageHeight - margin;

  function page() {
    return pages[pages.length - 1];
  }

  function addPage() {
    pages.push([]);
    y = pageHeight - margin;
  }

  function line(text, size = 10, font = 'F1') {
    if (y < margin + 40) addPage();
    page().push({ text: pdfClean(text, 900), size, font, x: margin, y });
    y -= size + 4;
  }

  function paragraph(text, size = 10, font = 'F1') {
    const words = pdfClean(text, 2200).split(/\s+/).filter(Boolean);
    const max = Math.max(34, Math.floor((pageWidth - margin * 2) / (size * 0.47)));
    let current = '';
    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      if (candidate.length > max && current) {
        line(current, size, font);
        current = word;
      } else {
        current = candidate;
      }
    }
    if (current) line(current, size, font);
    y -= 8;
  }

  line(title.toUpperCase(), 22, 'F2');
  y -= 14;
  paragraph('PDF local de revision. En produccion se genera desde backend y queda bloqueado hasta aprobacion.', 10, 'F1');
  addPage();
  for (const section of sections) {
    line(section.title || section.id || 'seccion', 15, 'F2');
    y -= 8;
    for (const item of (section.paragraphs || [])) paragraph(item, 10, 'F1');
  }
  pages.forEach((item, index) => {
    item.push({ text: `${title} / ${index + 1}`, size: 8, font: 'F1', x: margin, y: 28 });
  });

  const objects = [];
  objects[1] = '<< /Type /Catalog /Pages 2 0 R >>';
  objects[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Times-Roman >>';
  objects[4] = '<< /Type /Font /Subtype /Type1 /BaseFont /Times-Bold >>';
  const kids = [];
  pages.forEach((item, index) => {
    const pageObject = 5 + index * 2;
    const contentObject = pageObject + 1;
    kids.push(`${pageObject} 0 R`);
    const content = item.map((entry) => `BT /${entry.font} ${entry.size} Tf ${entry.x.toFixed(2)} ${entry.y.toFixed(2)} Td (${pdfEscape(entry.text)}) Tj ET`).join('\n');
    objects[pageObject] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentObject} 0 R >>`;
    objects[contentObject] = `<< /Length ${content.length} >>\nstream\n${content}\nendstream`;
  });
  objects[2] = `<< /Type /Pages /Kids [${kids.join(' ')}] /Count ${pages.length} >>`;

  const maxObject = 4 + pages.length * 2;
  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  for (let index = 1; index <= maxObject; index += 1) {
    offsets[index] = pdf.length;
    pdf += `${index} 0 obj\n${objects[index]}\nendobj\n`;
  }
  const xref = pdf.length;
  pdf += `xref\n0 ${maxObject + 1}\n0000000000 65535 f \n`;
  for (let index = 1; index <= maxObject; index += 1) {
    pdf += `${String(offsets[index]).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${maxObject + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;

  return {
    id: crypto.randomUUID(),
    sessionId: currentSession?.id,
    manuscriptId: manuscriptPayload?.id || null,
    version: 1,
    status: 'generated',
    reviewStatus: 'pending_review',
    fileName: `futuro-anterior-${String(currentSession?.id || 'local').slice(0, 8)}-v01.pdf`,
    mimeType: 'application/pdf',
    pdfBase64: btoa(pdf),
    pageCount: pages.length,
    pageSize: 'A5',
    qualityReport: {
      byte_size: pdf.length,
      opens_as_pdf: true,
      template: 'future-book-a5-sprint5-local-v1'
    },
    luluMetadata: {
      ready_for_print: true,
      ready_for_print_status: 'ready_for_print',
      send_to_lulu: false,
      trim_size: 'A5',
      language: 'es'
    },
    createdAt: new Date().toISOString()
  };
}

function resetCaptureState(message = 'habla. si el navegador falla, quedara audio pendiente.') {
  currentCaptureId = '';
  currentCaptureSessionId = '';
  recordingRequestId = '';
  recordingStartPending = false;
  const oldRecognition = recognition;
  const oldRecorder = mediaRecorder;
  recognition = null;
  mediaRecorder = null;
  try { oldRecognition?.abort(); } catch { /* Capture callbacks are already invalidated. */ }
  try { if (oldRecorder?.state === 'recording') oldRecorder.stop(); } catch { /* Always release tracks below. */ }
  oldRecorder?.stream?.getTracks().forEach(track => track.stop());
  voiceOrb?.classList.remove('is-recording');
  clearQuestionAudioCache();
  currentTranscript = '';
  currentTranscriptFinal = false;
  currentCaptureId = '';
  currentCaptureSessionId = '';
  currentAnswerPayload = null;
  audioChunks = [];
  audioCaptured = false;
  lastDurationSeconds = 0;
  currentAudioMimeType = '';
  currentFollowUp = false;
  setText(liveTranscript, message);
  setText(answerMeta, 'mic pendiente.');
  if (recordAnswerButton) { recordAnswerButton.hidden = false; recordAnswerButton.disabled = false; }
  if (stopRecordingButton) stopRecordingButton.hidden = true;
  if (saveAnswerButton) saveAnswerButton.disabled = true;
}

async function recordInterviewHeartbeat(stage = 'active') {
  if (!currentSession?.id || !hasBackendConfig() || currentSession.mode === 'local') return;
  if (!['interview_ready', 'interview_active', 'interview_completed'].includes(currentSession.status)) return;
  await futureAction('recordInterviewHeartbeat', {
    stage,
    currentQuestionIndex: currentQuestion?.index || null,
    pendingAnswerQueueSize: (await readPendingAnswers()).length
  }).catch(() => null);
}

function startInterviewHeartbeat() {
  if (heartbeatTimer) return;
  heartbeatTimer = window.setInterval(() => {
    recordInterviewHeartbeat(document.hidden ? 'hidden' : 'active');
  }, INTERVIEW_HEARTBEAT_MS);
}

async function flushPendingAnswerQueue() {
  if (answerSavePending || !currentSession?.id || !hasBackendConfig() || currentSession.mode === 'local') return null;
  const sessionId = currentSession.id;
  let lastResult = null;
  answerSavePending = true;
  try {
    const queue = await readPendingAnswers(false, sessionId);
    for (const item of queue) {
      if (currentSession?.id !== sessionId) return null;
      const answer = await answerForTransport(item);
      if (currentSession?.id !== sessionId) return null;
      const result = await futureAction('saveAnswer', {
        ...answer,
        sessionId,
        retryFromQueue: true,
        localPatch: { status: 'interview_active' }
      });
      if (currentSession?.id !== sessionId) return null;
      const acknowledged = await validateCaptureReceipt(result, item);
      if (currentSession?.id !== sessionId) return null;
      if (acknowledged) await removePendingAnswer(item.questionIndex, sessionId, item.captureId);
      if (currentSession?.id !== sessionId) return null;
      lastResult = result;
      if (result.saved !== true) break;
    }
  } finally {
    answerSavePending = false;
  }
  return lastResult;
}

function localSession() {
  return {
    id: crypto.randomUUID(),
    publicToken: crypto.randomUUID().replaceAll('-', ''),
    productCode: 'futuro_anterior',
    status: 'created',
    paymentStatus: 'not_started',
    bookStatus: 'not_started',
    pdfReviewStatus: 'not_generated',
    price: { amount: 49.95, cents: 4995, currency: 'EUR' },
    questionCount: 21,
    locale: 'es-ES',
    timezone: 'Europe/Madrid',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

async function localAction(action, payload = {}) {
  const patched = { ...currentSession, ...payload.localPatch, updatedAt: new Date().toISOString() };
  const answers = readLocalAnswers();
  const answered = answers.length;
  const total = currentSession?.questionCount || 21;
  const nextIndex = Math.min(total, answered + 1);

  if (action === 'startInterview' || action === 'getCurrentQuestion') {
    patched.status = 'interview_active';
    patched.interviewStartedAt = patched.interviewStartedAt || new Date().toISOString();
    patched.participantName = payload.participantName || patched.participantName || enteredName || '';
    return {
      ok: true,
      session: patched,
      question: { index: nextIndex, total, text: questionFor(nextIndex, patched.participantName) }
    };
  }
  if (action === 'synthesizeQuestion') {
    const text = payload.questionText || questionFor(nextIndex, currentSession?.participantName || enteredName);
    const questionIndex = Number(payload.questionIndex || 0);
    const isFollowUp = /^Respuesta demasiado corta\./i.test(text);
    return {
      ok: true,
      voice: {
        provider: 'local_audio',
        text,
        audioUrl: questionIndex === 0
          ? LOCAL_VOICE_INTRO_URL
          : isFollowUp
            ? LOCAL_VOICE_FOLLOW_UP_URL
            : localQuestionVoiceUrl(questionIndex),
        audioBase64: null,
        mimeType: 'audio/mp4',
        fallback: true
      }
    };
  }
  if (action === 'requestFollowUp') {
    return {
      ok: true,
      question: {
        index: payload.questionIndex || nextIndex,
        total,
        text: followUpFor(payload.questionIndex || nextIndex),
        followUp: true
      }
    };
  }
  if (action === 'getBookStatus') {
    return {
      ok: true,
      session: patched,
      manuscript: readLocalManuscript()
    };
  }
  if (action === 'generateBook') {
    const existing = readLocalManuscript();
    const manuscript = existing || generateLocalManuscript(answers);
    writeLocalManuscript(manuscript);
    return {
      ok: true,
      reused: Boolean(existing),
      session: { ...patched, status: 'book_ready', bookStatus: 'ready', bookGenerationCompletedAt: new Date().toISOString() },
      manuscript
    };
  }
  if (action === 'getPdfStatus') {
    return {
      ok: true,
      session: patched,
      pdf: readLocalPdf()
    };
  }
  if (action === 'generatePdf') {
    const existing = readLocalPdf();
    const manuscript = readLocalManuscript();
    const pdf = existing || makeLocalPdf(manuscript);
    writeLocalPdf(pdf);
    return {
      ok: true,
      session: {
        ...patched,
        status: 'pending_review',
        pdfReviewStatus: 'pending_review',
        pdfReadyAt: new Date().toISOString()
      },
      pdf
    };
  }
  if (action === 'downloadReleasedPdf') {
    const pdf = readLocalPdf();
    if (!pdf || pdf.reviewStatus !== 'released_to_customer') {
      throw new Error('pdf_not_released');
    }
    return { ok: true, session: patched, pdf };
  }
  if (action === 'saveAnswer') {
    const pending = String(payload.transcript || '').startsWith('[Audio capturado:');
    const tooShort = !pending && payload.followUpAttempt !== true && wordCount(payload.transcript) < 12;
    if (tooShort) {
      return {
        ok: true,
        saved: false,
        needsFollowUp: true,
        session: patched,
        question: {
          index: payload.questionIndex,
          total,
          text: followUpFor(payload.questionIndex),
          followUp: true
        }
      };
    }
    const answer = {
      id: crypto.randomUUID(),
      session_id: currentSession.id,
      question_index: payload.questionIndex,
      question_text: payload.questionText,
      transcript: payload.transcript || null,
      transcript_source: payload.transcriptSource || 'pending',
      duration_seconds: payload.durationSeconds || 0,
      created_at: new Date().toISOString()
    };
    writeLocalAnswer(answer);
    const totalAnswered = readLocalAnswers().length;
    const completed = totalAnswered >= total;
    const updated = {
      ...patched,
      status: completed ? 'interview_completed' : 'interview_active',
      interviewCompletedAt: completed ? new Date().toISOString() : patched.interviewCompletedAt
    };
    const index = Math.min(total, payload.questionIndex + 1);
    return {
      ok: true,
      saved: true,
      completed,
      session: updated,
      answer,
      nextQuestion: completed ? null : { index, total, text: questionFor(index, updated.participantName || enteredName) }
    };
  }
  return { ok: true, session: patched };
}

async function futureAction(action, payload = {}) {
  if (!hasBackendConfig()) {
    if (!IS_LOCAL_PREVIEW) throw new Error('backend_config_missing');
    return localAction(action, payload);
  }
  if (currentSession?.mode === 'local') throw new Error('session_recovery_required / recarga la pagina');
  const security = await clientSecurityPayload();
  const entryActions = ['recordConsent', 'startSimulatedPayment', 'approveSimulatedPayment', 'startInterview'];
  const timeoutMs = action === 'synthesizeQuestion' && Number(payload.questionIndex) === 0
    ? INTRO_AUDIO_TIMEOUT_MS
    : action === 'synthesizeQuestion' ? 75000
    : action === 'saveAnswer' ? ANSWER_SAVE_TIMEOUT_MS
    : action === 'generateBook' ? ACTION_REQUEST_TIMEOUT_MS
    : entryActions.includes(action) ? ENTRY_REQUEST_TIMEOUT_MS : ACTION_REQUEST_TIMEOUT_MS;
  return callFunction('future-book-session', {
    action,
    sessionId: currentSession?.id,
    publicToken: currentSession?.publicToken,
    ...security,
    ...payload
  }, { timeoutMs });
}

async function recoverBackendSession(stored) {
  if (!hasBackendConfig() || stored?.mode !== 'local') return stored;
  // Do not switch away from material captured during an outage without
  // reconciling it first, even if an older copy of the session exists remotely.
  if (readLocalAnswers().length || (await readPendingAnswers(false, stored.id)).length || readLocalManuscript()) {
    throw new Error('La sesion guardada es local. Tus respuestas se conservan; no se han enviado al servidor.');
  }
  try {
    const result = await callFunction('future-book-session', {
      action: 'getSession', sessionId: stored.id, publicToken: stored.publicToken
    }, { timeoutMs: ENTRY_REQUEST_TIMEOUT_MS });
    saveSession(result.session, 'backend');
    return currentSession;
  } catch (error) {
    if (!/Session not found/.test(error instanceof Error ? error.message : String(error))) throw error;
    sessionStorage.removeItem(PAYMENT_DEADLINE_KEY);
    persistEntryStage('payment');
    return null;
  }
}

async function ensureSession() {
  if (!hasBackendConfig() && !IS_LOCAL_PREVIEW) throw new Error('backend_config_missing');
  const inviteToken = syncAccessToken();
  let stored = await recoverBackendSession(readStoredSession());
  if (stored?.id && stored?.publicToken) {
    currentSession = stored;
    setText(sessionStatus, `Sesion ${String(stored.id).slice(0, 8)}`);
    note('session_recovered');
    const recoveredAnswer = await flushPendingAnswerQueue().catch(() => null);
    if (recoveredAnswer?.session?.id === stored.id) {
      saveSession(recoveredAnswer.session, stored.mode || 'backend');
      stored = currentSession;
    }
    if (['book_generating', 'blocked'].includes(stored.status)) {
      const result = await futureAction('getBookStatus');
      if (result.job && result.job.status !== 'ready') {
        saveSession(result.session || stored, stored.mode || 'backend');
        displayBookResult(result);
        return;
      }
      if (!result.manuscript) {
        showComplete();
        note(stored.status === 'blocked' ? 'book_engine / review_required' : 'book_engine / recovery_required');
        return;
      }
    }
    if (['pdf_generating', 'pending_review', 'approved', 'released_to_customer', 'blocked'].includes(stored.status) || stored.pdfReviewStatus === 'pending_review') {
      const bookResult = await futureAction('getBookStatus');
      const pdfResult = await futureAction('getPdfStatus');
      saveSession(pdfResult.session || bookResult.session || stored, stored.mode || 'backend');
      displayPdfResult(pdfResult, bookResult.manuscript || readLocalManuscript());
      return;
    }
    if (stored.status === 'book_ready' || stored.bookStatus === 'ready') {
      const result = await futureAction('getBookStatus');
      saveSession(result.session || stored, stored.mode || 'backend');
      const pdfResult = await futureAction('getPdfStatus').catch(() => ({ pdf: null }));
      if (result.manuscript) displayPdfResult(pdfResult, result.manuscript);
      else showComplete();
      return;
    }
    if (stored.status === 'interview_completed') {
      showComplete();
      return;
    }
    if (stored.status === 'interview_ready' && ['accept', 'name'].includes(entryStage)) {
      showNameGate();
      return;
    }
    if (stored.status === 'interview_ready') {
      showReady(stored);
      return;
    }
    if (stored.status === 'interview_active') {
      const result = await futureAction('getCurrentQuestion');
      if (result.session) saveSession(result.session, stored.mode || 'backend');
      if (result.completed) { showComplete(); return; }
      currentQuestion = result.question || currentQuestion;
      currentFollowUp = currentQuestion.followUp === true;
      showInterview();
      startInterviewHeartbeat();
      return;
    }
    showNameGate();
    return;
  }

  if (!hasBackendConfig()) {
    if (localAccessDisabled()) {
      hideAllStages();
      note('access_disabled / incident_flag');
      setText(sessionStatus, 'Acceso cerrado temporalmente');
      return;
    }
    saveSession(localSession(), 'local');
    showNameGate();
    return;
  }

  const security = await clientSecurityPayload();
  const accessStatus = await callFunction('future-book-session', {
    action: 'accessStatus',
    inviteToken,
    source: inviteToken ? 'ephemeral_url' : 'fixed_beta',
    entrypoint: window.location.pathname,
    ...security
  }, { timeoutMs: ENTRY_REQUEST_TIMEOUT_MS });
  if (accessStatus.access?.granted !== true) {
    const waitlist = await registerOpaqueWaitlist(accessStatus.access);
    showAccessDenied(accessStatus.access, waitlist);
    return;
  }
  const result = await callFunction('future-book-session', {
    action: 'createSession',
    source: inviteToken ? 'ephemeral_url' : 'fixed_beta',
    inviteToken,
    entrypoint: window.location.pathname,
    locale: navigator.language || 'es-ES',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Madrid',
    ...security
  }, { timeoutMs: ENTRY_REQUEST_TIMEOUT_MS });
  saveSession(result.session, 'backend');
  note('session_created / waiting_accept');
  showNameGate();
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function writeAscii(view, offset, value) {
  for (let index = 0; index < value.length; index += 1) {
    view.setUint8(offset + index, value.charCodeAt(index));
  }
}

function createSilentAudioUrl() {
  if (silentAudioUrl) return silentAudioUrl;
  const sampleRate = 8000;
  const sampleCount = 800;
  const bytesPerSample = 2;
  const dataSize = sampleCount * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);
  writeAscii(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeAscii(view, 8, 'WAVE');
  writeAscii(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * bytesPerSample, true);
  view.setUint16(32, bytesPerSample, true);
  view.setUint16(34, 16, true);
  writeAscii(view, 36, 'data');
  view.setUint32(40, dataSize, true);
  silentAudioUrl = URL.createObjectURL(new Blob([buffer], { type: 'audio/wav' }));
  return silentAudioUrl;
}

function configureVoiceAudioElement(audio) {
  audio.preload = 'auto';
  audio.playsInline = true;
  audio.setAttribute('playsinline', '');
  audio.setAttribute('webkit-playsinline', '');
  return audio;
}

function getSharedVoiceAudio() {
  if (!sharedVoiceAudio) {
    sharedVoiceAudio = configureVoiceAudioElement(new Audio());
  }
  return sharedVoiceAudio;
}

function isLikelyIOS() {
  const ua = navigator.userAgent || '';
  return /iP(hone|ad|od)/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

function questionAudioKey(question = currentQuestion) {
  return `${question?.index || 0}:${question?.text || ''}`;
}

function clearQuestionAudioCache() {
  preparedQuestionAudio = null;
  preparingQuestionAudio = null;
}

function setVoiceAudioSource(audioBase64, mimeType) {
  const audio = getSharedVoiceAudio();
  try {
    audio.pause();
  } catch {}
  audio.muted = false;
  audio.volume = 1;
  audio.src = `data:${mimeType};base64,${audioBase64}`;
  try {
    audio.load();
  } catch {}
  return audio;
}

function setVoiceAudioUrl(url) {
  const audio = getSharedVoiceAudio();
  try {
    audio.pause();
  } catch {}
  audio.muted = false;
  audio.volume = 1;
  audio.src = url;
  try {
    audio.load();
  } catch {}
  return audio;
}

function unlockAudioPlayback() {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  const htmlAudio = getSharedVoiceAudio();
  if (!pendingAudioReplay) {
    try {
      htmlAudio.muted = true;
      htmlAudio.volume = 0;
      htmlAudio.src = createSilentAudioUrl();
      htmlAudio.load();
      const unlockSrc = htmlAudio.src;
      const unlockAttempt = htmlAudio.play();
      if (unlockAttempt?.then) {
        unlockAttempt
          .then(() => {
            if (htmlAudio.src === unlockSrc) {
              htmlAudio.pause();
              htmlAudio.currentTime = 0;
              htmlAudio.muted = false;
              htmlAudio.volume = 1;
            }
          })
          .catch(() => {
            if (htmlAudio.src === unlockSrc) {
              htmlAudio.muted = false;
              htmlAudio.volume = 1;
            }
          });
      }
    } catch {}
  }
  if (!AudioContextClass) return;
  try {
    if (!audioUnlockContext) {
      audioUnlockContext = new AudioContextClass();
    }
    if (audioUnlockContext.state === 'suspended') {
      audioUnlockContext.resume().catch(() => null);
    }
    const oscillator = audioUnlockContext.createOscillator();
    const gain = audioUnlockContext.createGain();
    gain.gain.value = 0;
    oscillator.connect(gain);
    gain.connect(audioUnlockContext.destination);
    oscillator.start();
    oscillator.stop(audioUnlockContext.currentTime + 0.02);
  } catch {
    // Some browsers reject audio priming until a stricter gesture; normal playback will still try.
  }
}

async function replayPendingAudio() {
  if (!pendingAudioReplay?.audio) return false;
  const pending = pendingAudioReplay;
  pendingAudioReplay = null;
  note('ios_audio_replay');
  const played = await playAudioElement(pending.audio, pending.kind || 'voice');
  if (pending.kind === 'intro') {
    setEntryPrompt('future@autonomous-system ~ %', 'acepto');
  }
  return played;
}

async function runClientBootSequence() {
  document.body.classList.add('is-booting');
  await wait(CLIENT_BOOT_DELAY_MS);
  if (futureBoot) futureBoot.hidden = true;
  document.body.classList.remove('is-booting');
  document.body.classList.add('is-typing');
  let visibleLog = '';
  if (futureIntro && futureIntroLog) {
    futureIntro.hidden = false;
    futureIntroLog.textContent = '';
    for (const line of CLIENT_BOOT_LINES) {
      visibleLog += `${line}\n`;
      futureIntroLog.textContent = visibleLog;
      await wait(380);
    }
    await wait(520);
    futureIntro.hidden = true;
  }
  if (futurePersistentLog) {
    futurePersistentLog.hidden = false;
    futurePersistentLog.textContent = visibleLog || `${CLIENT_BOOT_LINES.join('\n')}\n`;
  }
  document.body.classList.remove('is-typing');
  document.body.classList.add('is-ready');
  requestAnimationFrame(() => nameInput?.focus());
}

async function runPaymentAnimation() {
  for (let index = 0; index < paymentLines.length; index += 1) {
    paymentLines.forEach((line) => line.classList.remove('is-active'));
    paymentLines[index].classList.add('is-active');
    await wait(index === paymentLines.length - 1 ? 700 : 850);
  }
}

function trackPromise(promise) {
  let done = false;
  const tracked = promise.finally(() => {
    done = true;
  });
  return {
    promise: tracked,
    isDone: () => done
  };
}

function prepareNarrationWithTimeout(text, timeoutMs = INTRO_AUDIO_TIMEOUT_MS) {
  return Promise.race([
    prepareNarration(text),
    wait(timeoutMs).then(() => ({
      provider: 'elevenlabs',
      text,
      error: 'intro_audio_timeout'
    }))
  ]);
}

async function runTerminalSystemLoader(durationMs = 10000, readiness = null) {
  const frames = ['|', '/', '-', '\\'];
  appendRitualLine('');
  appendRitualLine('>_ | loading voice_interface');
  const startedAt = Date.now();
  let frameIndex = 0;
  while (Date.now() - startedAt < durationMs || (readiness && !readiness.isDone())) {
    replaceRitualLastLine(`>_ ${frames[frameIndex % frames.length]} loading voice_interface`);
    frameIndex += 1;
    await wait(120);
  }
  replaceRitualLastLine('>_ ok voice_interface_loaded');
  await wait(360);
}

async function acceptPaymentPrelude() {
  if (entryStage === 'payment' && !sessionStorage.getItem(PAYMENT_DEADLINE_KEY)) {
    ensurePaymentDeadline();
  }
  if (entryStage === 'payment' && paymentRemainingMs() <= 0) {
    expirePaymentCountdown();
    return;
  }
  if (!currentSession) {
    await ensureSession();
    if (!currentSession) return;
  }

  stopPaymentCountdown();
  setNameGateBusy(true);
  setRitualLog(paymentGateLines(formatPaymentRemaining(paymentRemainingMs())));
  setStep('stage 01/05', 'transaction_verification', '18%');
  note('payment_enter_received');

  const consent = await futureAction('recordConsent', {
    accepted: true,
    termsVersion: 'future-book-novel-entry-v1',
    aiNoticeVersion: 'future-book-novel-entry-v1',
    localPatch: { status: 'payment_pending', privacyConsentAt: new Date().toISOString() }
  });
  saveSession(consent.session, currentSession.mode || 'backend');

  const started = await futureAction('startSimulatedPayment', {
    localPatch: { status: 'payment_pending', paymentStatus: 'simulated_pending' }
  });
  saveSession(started.session, currentSession.mode || 'backend');

  const approved = await futureAction('approveSimulatedPayment', {
    localPatch: { status: 'interview_ready', paymentStatus: 'simulated_approved' }
  });
  saveSession(approved.session, currentSession.mode || 'backend');

  const introVoice = trackPromise(prepareNarrationWithTimeout(VOICE_INTRO_SPEECH_TEXT));
  await typeRitualLines(VERIFIED_LINES, 420);
  await runTerminalSystemLoader(10000, introVoice);
  const preparedIntro = await introVoice.promise.catch(() => null);

  appendRitualLine('');
  appendRitualLine(VOICE_INTRO_DISPLAY_TEXT);
  persistEntryStage('accept');
  setEntryPrompt('future@autonomous-system ~ %', 'acepto');
  setStep('stage 02/05', 'rules_acceptance', '32%');
  note('voice_intro');

  await playPreparedNarration(preparedIntro, VOICE_INTRO_SPEECH_TEXT).catch((error) => {
    note(error instanceof Error ? error.message : 'intro_audio_failed');
  });

  setNameGateBusy(false);
  requestAnimationFrame(() => nameInput?.focus());
}

function hideAllStages() {
  if (nameGate) nameGate.hidden = true;
  if (form) form.hidden = true;
  if (paymentStage) paymentStage.hidden = true;
  if (readyStage) readyStage.hidden = true;
  if (interviewStage) interviewStage.hidden = true;
  if (completeStage) completeStage.hidden = true;
  if (bookStage) bookStage.hidden = true;
}

function showReady(session) {
  hideAllStages();
  if (readyStage) readyStage.hidden = false;
  setStep('stage 03/05', 'voice gate', '60%');
  note(`pay=${session.paymentStatus || 'simulated_approved'} / q=${session.questionCount || 21}`);
}

function showInterview() {
  hideAllStages();
  if (interviewStage) interviewStage.hidden = false;
  const total = currentQuestion.total || currentSession?.questionCount || 21;
  const progress = Math.round(((currentQuestion.index - 1) / total) * 100);
  setStep('stage 04/05', 'voice channel', `${Math.max(66, Math.min(86, progress))}%`);
  setText(questionLabel, `${questionCode(currentQuestion.index)} / ${total}`);
  setText(questionText, currentQuestion.text);
  note(`${questionCode(currentQuestion.index)}_active / rec_available`);
}

function showComplete() {
  hideAllStages();
  if (completeStage) completeStage.hidden = false;
  setStep('stage 04/05', 'interview_complete', '88%');
  note('interview_completed / waiting_book_engine');
  if (generateBookButton) generateBookButton.disabled = false;
}

function renderBookSections(manuscriptPayload) {
  const manuscript = manuscriptPayload?.manuscript || manuscriptPayload || {};
  const sections = Array.isArray(manuscript.sections) ? manuscript.sections : [];
  if (!bookSections) return;
  bookSections.innerHTML = '';
  for (const item of sections) {
    const row = document.createElement('li');
    const title = document.createElement('span');
    const meta = document.createElement('small');
    title.textContent = item.title || item.id || 'seccion';
    meta.textContent = `${item.kind || 'section'} / ${(item.paragraphs || []).length} blocks`;
    row.append(title, meta);
    bookSections.append(row);
  }
}

function renderPdfState(pdf) {
  if (!pdfStatus) return;
  if (!pdf) {
    setText(pdfStatus, 'pdf_status=not_generated / lulu_ready=false');
    if (generatePdfButton) generatePdfButton.hidden = false;
    if (downloadPdfButton) downloadPdfButton.hidden = true;
    return;
  }
  const status = pdf.reviewStatus || pdf.review_status || 'pending_review';
  const lulu = pdf.luluMetadata || pdf.lulu_metadata || {};
  setText(
    pdfStatus,
    `pdf_status=${status} / pages=${pdf.pageCount || pdf.page_count || 'n/a'} / lulu_ready=${lulu.ready_for_print === true} / storage=${pdf.storagePath || pdf.storage_path ? 'private' : 'inline'}`
  );
  if (generatePdfButton) generatePdfButton.hidden = status === 'pending_review' || status === 'approved' || status === 'released_to_customer';
  if (downloadPdfButton) {
    downloadPdfButton.hidden = status !== 'released_to_customer';
    downloadPdfButton.disabled = status !== 'released_to_customer';
  }
}

function showBook(manuscriptPayload, pdf = null) {
  hideAllStages();
  if (bookStage) bookStage.hidden = false;
  setStep('stage 05/05', 'book_engine', '100%');
  const manuscript = manuscriptPayload?.manuscript || manuscriptPayload || {};
  const report = manuscriptPayload?.qualityReport || manuscriptPayload?.quality_report || {};
  const pageTarget = manuscript.target_pages || report.page_target || {};
  setText(bookTitle, manuscriptPayload?.title || manuscript.title || 'manuscrito generado');
  setText(
    bookQuality,
    `score=${manuscriptPayload?.qualityScore || report.score || 'n/a'} / pages=${pageTarget.estimated_current_pages || 'n/a'} target_${pageTarget.min || 180}_${pageTarget.max || 200} / ${manuscriptPayload?.providerChain?.drafting || 'n/a'}`
  );
  renderBookSections(manuscriptPayload);
  renderPdfState(pdf);
  note(pdf ? `pdf_${pdf.reviewStatus || pdf.review_status || 'pending_review'}` : 'manuscript_ready / pdf_pending');
}

async function handleSubmit(event) {
  event.preventDefault();
  if (!currentSession) return;

  startPaymentButton.disabled = true;
  note('writing_consent_flag');
  setStep('stage 02/05', 'payment jump', '40%');

  const consent = await futureAction('recordConsent', {
    accepted: true,
    termsVersion: 'future-book-sprint1',
    aiNoticeVersion: 'future-book-sprint1',
    localPatch: { status: 'payment_pending', privacyConsentAt: new Date().toISOString() }
  });
  saveSession(consent.session, currentSession.mode || 'backend');

  const started = await futureAction('startSimulatedPayment', {
    localPatch: { status: 'payment_pending', paymentStatus: 'simulated_pending' }
  });
  saveSession(started.session, currentSession.mode || 'backend');

  hideAllStages();
  if (paymentStage) paymentStage.hidden = false;
  note('gateway_stub / auto_approve_beta');
  await runPaymentAnimation();

  const approved = await futureAction('approveSimulatedPayment', {
    localPatch: { status: 'interview_ready', paymentStatus: 'simulated_approved' }
  });
  saveSession(approved.session, currentSession.mode || 'backend');
  showReady(approved.session);
}

async function handleEntrySubmit(event) {
  event.preventDefault();
  unlockAudioPlayback();
  const value = String(new FormData(nameGate).get('name') || '').trim();

  if (pendingAudioReplay && !value) {
    await replayPendingAudio();
    requestAnimationFrame(() => nameInput?.focus());
    return;
  }

  if (entryStage === 'expired') {
    note('session_terminated');
    return;
  }

  if (entryStage === 'payment') {
    await acceptPaymentPrelude();
    return;
  }

  if (entryStage === 'accept') {
    if (value.toLowerCase() !== 'acepto') {
      note('write_exactly_acepto');
      nameInput?.focus();
      return;
    }
    persistEntryStage('name');
    appendRitualLine('');
    appendRitualLine('CONDICIONES ACEPTADAS.');
    appendRitualLine('AWAIT NAME');
    setEntryPrompt('future@autonomous-system ~ %', 'nombre');
    setStep('stage 02/05', 'identity_prompt', '38%');
    note('await_name');
    requestAnimationFrame(() => nameInput?.focus());
    return;
  }

  await openVoiceFromName(event);
}

async function openVoiceFromName(event) {
  event?.preventDefault();
  const name = String(new FormData(nameGate).get('name') || '').trim();
  if (name.length < 2) {
    note('name_required');
    nameInput?.focus();
    return;
  }
  if (!currentSession) {
    await ensureSession();
    if (!currentSession) return;
  }
  enteredName = name.slice(0, 80);
  sessionStorage.setItem(NAME_KEY, enteredName);
  if (nameGate) nameGate.hidden = true;
  note('booting_voice');
  setText(sessionStatus, `user=${enteredName}`);

  const paymentReady = currentSession?.paymentStatus === 'simulated_approved'
    || ['interview_ready', 'interview_active', 'interview_completed'].includes(currentSession?.status);

  if (!paymentReady) {
    const consent = await futureAction('recordConsent', {
      accepted: true,
      termsVersion: 'future-book-novel-entry-v1',
      aiNoticeVersion: 'future-book-novel-entry-v1',
      localPatch: { status: 'payment_pending', privacyConsentAt: new Date().toISOString() }
    });
    saveSession(consent.session, currentSession.mode || 'backend');

    const started = await futureAction('startSimulatedPayment', {
      localPatch: { status: 'payment_pending', paymentStatus: 'simulated_pending' }
    });
    saveSession(started.session, currentSession.mode || 'backend');

    const approved = await futureAction('approveSimulatedPayment', {
      localPatch: { status: 'interview_ready', paymentStatus: 'simulated_approved' }
    });
    saveSession(approved.session, currentSession.mode || 'backend');
  }

  const interview = await futureAction('startInterview', {
    participantName: enteredName,
    localPatch: { status: 'interview_active', interviewStartedAt: new Date().toISOString() }
  });
  saveSession(interview.session, currentSession.mode || 'backend');
  currentQuestion = interview.question || { index: 1, total: currentSession?.questionCount || 21, text: questionFor(1, enteredName) };
  currentFollowUp = false;
  resetCaptureState();
  showInterview();
  startInterviewHeartbeat();
  await startQuestionAudioFlow();
}

async function playNarration(text) {
  return playPreparedNarration(await prepareNarration(text), text);
}

function browserNarrationChunks(text) {
  const cleaned = String(text || '')
    .replace(/\[[^\]]+\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) return [];
  const sentences = cleaned.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [cleaned];
  const chunks = [];
  let current = '';
  sentences.forEach((sentence) => {
    const next = `${current} ${sentence.trim()}`.trim();
    if (current && next.length > 260) {
      chunks.push(current);
      current = sentence.trim();
    } else {
      current = next;
    }
  });
  if (current) chunks.push(current);
  return chunks;
}

function preferredBrowserNarrator() {
  const voices = window.speechSynthesis?.getVoices?.() || [];
  const spanish = voices.filter((voice) => /^es([-_]|$)/i.test(voice.lang || ''));
  const preferred = ['Reed', 'Jorge', 'Eddy', 'Grandpa', 'Diego', 'Pablo'];
  return preferred
    .map((name) => spanish.find((voice) => voice.name.includes(name) && /^es[-_]ES/i.test(voice.lang || '')))
    .find(Boolean)
    || spanish.find((voice) => /^es[-_]ES/i.test(voice.lang || ''))
    || spanish[0]
    || null;
}

function playBrowserNarration(text, kind = 'voice') {
  const synth = window.speechSynthesis;
  if (!synth || typeof window.SpeechSynthesisUtterance !== 'function') return false;
  const chunks = browserNarrationChunks(text);
  if (!chunks.length) return false;
  const voice = preferredBrowserNarrator();
  let index = 0;

  synth.cancel();
  voiceOrb?.classList.add('is-speaking');

  const finish = () => {
    currentBrowserUtterance = null;
    voiceOrb?.classList.remove('is-speaking');
  };
  const speakNext = () => {
    if (index >= chunks.length) {
      finish();
      return;
    }
    const utterance = new SpeechSynthesisUtterance(chunks[index]);
    currentBrowserUtterance = utterance;
    utterance.lang = voice?.lang || 'es-ES';
    if (voice) utterance.voice = voice;
    utterance.rate = kind === 'intro' ? 0.84 : 0.9;
    utterance.pitch = kind === 'intro' ? 0.76 : 0.82;
    utterance.volume = 1;
    utterance.onend = () => {
      index += 1;
      speakNext();
    };
    utterance.onerror = finish;
    synth.speak(utterance);
  };

  speakNext();
  note(kind === 'intro' ? 'intro_voice_ready' : 'voice_ready');
  return true;
}

async function prepareNarration(text) {
  const voice = await futureAction('synthesizeQuestion', {
    questionIndex: 0,
    questionText: text,
    voiceMode: 'expressive_intro'
  }).catch((error) => {
    if (hasBackendConfig()) {
      return {
        voice: {
          provider: 'elevenlabs',
          error: error instanceof Error ? error.message : 'elevenlabs_audio_failed'
        }
      };
    }
    throw error;
  });
  const payload = voice.voice || {};
  if (payload.audioUrl) {
    const audio = setVoiceAudioUrl(payload.audioUrl);
    return {
      provider: payload.provider || 'local_audio',
      audio,
      text: payload.text || text,
      voiceId: payload.voiceId,
      modelId: payload.modelId
    };
  }
  if (payload.audioBase64 && payload.mimeType) {
    const audio = setVoiceAudioSource(payload.audioBase64, payload.mimeType);
    return { provider: 'elevenlabs', audio, text, voiceId: payload.voiceId, modelId: payload.modelId };
  }
  if (payload.provider === 'browser' || payload.fallback === true) {
    return { provider: 'browser', text: payload.text || text };
  }
  return { provider: 'elevenlabs', text, error: payload.error || 'elevenlabs_audio_missing' };
}

async function playAudioElement(audio, kind = 'voice') {
  voiceOrb?.classList.add('is-speaking');
  audio.onended = () => voiceOrb?.classList.remove('is-speaking');
  audio.onerror = () => voiceOrb?.classList.remove('is-speaking');
  audio.muted = false;
  audio.volume = 1;
  try {
    audio.currentTime = 0;
  } catch {}
  const played = await audio.play().then(() => true).catch(() => {
    voiceOrb?.classList.remove('is-speaking');
    if (kind === 'intro') {
      pendingAudioReplay = { audio, kind };
      appendRitualLine('');
      appendRitualLine('IOS_AUDIO_GATE: PULSE ENTER SIN TEXTO PARA REPRODUCIR LA VOZ.');
      setEntryPrompt('future@autonomous-system ~ %', 'enter_audio');
      note('intro_voice_playback_blocked_ios');
      return false;
    }
    if (kind === 'question') {
      setText(answerMeta, 'voice_playback_blocked / pulsa repetir.');
      note('voice_playback_blocked_ios');
      return false;
    }
    note('voice_playback_blocked_ios');
    return false;
  });
  if (played) {
    note(kind === 'intro' ? 'intro_audio_provider=elevenlabs' : 'audio_provider=elevenlabs');
  }
  return played;
}

async function playPreparedNarration(prepared, text) {
  if (prepared?.audio) {
    await playAudioElement(prepared.audio, 'intro');
    return;
  }
  if (prepared?.provider === 'browser' && playBrowserNarration(prepared.text || text, 'intro')) return;
  note(voiceStatusMessage(prepared?.error || 'intro_audio_provider=elevenlabs_missing'));
}

async function prepareQuestionAudio({ force = false } = {}) {
  const key = questionAudioKey();
  if (!force && preparedQuestionAudio?.key === key) return preparedQuestionAudio;
  if (!force && preparingQuestionAudio?.key === key) return preparingQuestionAudio.promise;
  const promise = futureAction('synthesizeQuestion', {
    questionIndex: currentQuestion.index,
    questionText: currentQuestion.text
  }).then((voice) => {
    const payload = voice.voice || {};
    if (payload.audioUrl) {
      preparedQuestionAudio = {
        key,
        provider: payload.provider || 'local_audio',
        audioUrl: payload.audioUrl,
        mimeType: payload.mimeType || 'audio/mp4',
        text: payload.text || currentQuestion.text
      };
      return preparedQuestionAudio;
    }
    if (payload.audioBase64 && payload.mimeType) {
      preparedQuestionAudio = {
        key,
        audioBase64: payload.audioBase64,
        mimeType: payload.mimeType,
        voiceId: payload.voiceId,
        modelId: payload.modelId
      };
      return preparedQuestionAudio;
    }
    if (payload.provider === 'browser' || payload.fallback === true) {
      preparedQuestionAudio = {
        key,
        provider: 'browser',
        text: payload.text || currentQuestion.text
      };
      return preparedQuestionAudio;
    }
    const message = voiceStatusMessage(payload.error || 'elevenlabs_audio_missing');
    setText(answerMeta, `${message}.`);
    note(message);
    return null;
  }).catch((error) => {
    if (hasBackendConfig()) {
      const message = voiceStatusMessage(error instanceof Error ? error.message : 'elevenlabs_audio_failed');
      setText(answerMeta, `${message}.`);
      note(message);
      return null;
    }
    throw error;
  });
  preparingQuestionAudio = { key, promise };
  try {
    return await promise;
  } finally {
    if (preparingQuestionAudio?.key === key) preparingQuestionAudio = null;
  }
}

async function startQuestionAudioFlow() {
  if (isLikelyIOS()) {
    setText(answerMeta, 'audio_loading / espera.');
    const prepared = await prepareQuestionAudio();
    if (prepared) setText(answerMeta, 'audio_ready / pulsa repetir.');
    return;
  }
  await playQuestion();
}

async function playQuestion() {
  const key = questionAudioKey();
  if (isLikelyIOS() && preparedQuestionAudio?.key !== key) {
    setText(answerMeta, 'audio_loading / espera.');
    const prepared = await prepareQuestionAudio();
    if (prepared) setText(answerMeta, 'audio_ready / pulsa repetir.');
    return;
  }
  setText(answerMeta, 'audio_out.');
  const prepared = await prepareQuestionAudio();
  if (!prepared) return;
  if (prepared.provider === 'browser') {
    if (playBrowserNarration(prepared.text || currentQuestion.text, 'question')) {
      setText(answerMeta, 'voice_ready.');
    }
    return;
  }
  const audio = prepared.audioUrl
    ? setVoiceAudioUrl(prepared.audioUrl)
    : setVoiceAudioSource(prepared.audioBase64, prepared.mimeType);
  const played = await playAudioElement(audio, 'question');
  if (!played) return;
  setText(answerMeta, 'audio_provider=elevenlabs.');
}

function setupRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    browserSpeechSupported = false;
    return null;
  }
  browserSpeechSupported = true;
  const instance = new SpeechRecognition();
  instance.lang = 'es-ES';
  instance.interimResults = true;
  instance.continuous = true;
  const captureId = currentCaptureId;
  const sessionId = currentCaptureSessionId;
  const questionIndex = currentQuestion.index;
  const ownsCapture = () => captureId && currentCaptureId === captureId && currentSession?.id === sessionId && currentQuestion.index === questionIndex;
  instance.onresult = (event) => {
    if (!ownsCapture()) return;
    const transcript = [...event.results]
      .map((result) => result[0]?.transcript || '')
      .join(' ')
      .trim();
    currentTranscript = transcript;
    currentTranscriptFinal = Boolean(transcript && [...event.results].every(result => result.isFinal === true));
    setText(liveTranscript, transcript || 'listening...');
  };
  instance.onerror = () => {
    if (!ownsCapture()) return;
    currentTranscriptFinal = false;
    setText(answerMeta, 'transcript_fail / audio_pending.');
  };
  return instance;
}

async function startRecording() {
  if (recordingStartPending || answerSavePending || mediaRecorder?.state === 'recording') return;
  if (!navigator.mediaDevices?.getUserMedia) {
    setText(answerMeta, 'browser_denied_mic.');
    return;
  }

  const sessionId = currentSession?.id;
  const questionIndex = currentQuestion.index;
  const requestId = crypto.randomUUID();
  recordingRequestId = requestId;
  recordingStartPending = true;
  recordAnswerButton.disabled = true;
  let stream;
  let started = false;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    if (recordingRequestId !== requestId || currentSession?.id !== sessionId || currentQuestion.index !== questionIndex) return;
    const mimeType = preferredAudioMimeType();
    const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    const chunks = [];
    const startedAt = Date.now();
    const ownsCapture = () => currentCaptureId === requestId && currentSession?.id === sessionId && currentQuestion.index === questionIndex;
    recorder.ondataavailable = (event) => {
      if (ownsCapture() && event.data?.size) chunks.push(event.data);
    };
    recorder.onstop = () => {
      stream.getTracks().forEach(track => track.stop());
      if (!ownsCapture()) return;
      audioCaptured = chunks.length > 0;
      lastDurationSeconds = Math.max(1, Math.round((Date.now() - startedAt) / 1000));
      voiceOrb?.classList.remove('is-recording');
      recordAnswerButton.hidden = false;
      stopRecordingButton.hidden = true;
      saveAnswerButton.disabled = !(audioCaptured || (currentTranscriptFinal && currentTranscript));
      if (!currentTranscript && audioCaptured) {
        currentTranscript = `[Audio capturado: ${lastDurationSeconds} segundos. Transcripcion pendiente en backend.]`;
        setText(liveTranscript, currentTranscript);
      }
      setText(answerMeta, `captured / ${lastDurationSeconds}s.`);
    };
    recorder.start();
    started = true;
    try { recognition?.abort(); } catch { /* The new capture owns subsequent callbacks. */ }
    currentCaptureId = requestId;
    currentCaptureSessionId = sessionId;
    currentTranscript = '';
    currentTranscriptFinal = false;
    currentAnswerPayload = null;
    currentAudioMimeType = mimeType;
    audioChunks = chunks;
    audioCaptured = false;
    lastDurationSeconds = 0;
    recordingStartedAt = startedAt;
    mediaRecorder = recorder;
    setText(liveTranscript, 'listening...');
    saveAnswerButton.disabled = true;
    try {
      recognition = setupRecognition();
      recognition?.start();
    } catch {
      recognition = null;
      browserSpeechSupported = false;
    }
    voiceOrb?.classList.add('is-recording');
    recordAnswerButton.hidden = true;
    stopRecordingButton.hidden = false;
    setText(answerMeta, browserSpeechSupported ? 'rec / transcript_live.' : 'rec / transcript_pending.');
  } finally {
    if (!started) stream?.getTracks().forEach(track => track.stop());
    if (recordingRequestId === requestId) {
      recordingStartPending = false;
      recordAnswerButton.disabled = false;
    }
  }
}

function stopRecording() {
  try {
    recognition?.stop();
  } catch {
    recognition = null;
  }
  if (mediaRecorder?.state === 'recording') mediaRecorder.stop();
}

async function saveAnswer() {
  if (answerSavePending) return;
  const sessionId = currentCaptureSessionId || currentSession?.id;
  if (!sessionId || currentSession?.id !== sessionId) throw new Error('capture_session_changed');
  const questionIndex = currentQuestion.index;
  const captureId = currentCaptureId || crypto.randomUUID();
  currentCaptureId = captureId;
  currentCaptureSessionId = sessionId;
  answerSavePending = true;
  saveAnswerButton.disabled = true;
  try {
    if (!currentAnswerPayload || currentAnswerPayload.captureId !== captureId) {
      const audioPayload = await currentAudioPayload();
      if (currentSession?.id !== sessionId || currentQuestion.index !== questionIndex || currentCaptureId !== captureId) return;
      const transcriptIsPending = currentTranscript.startsWith('[Audio capturado:') || !currentTranscriptFinal;
      currentAnswerPayload = {
        sessionId, captureId, questionIndex, questionText: currentQuestion.text,
        transcript: currentTranscript, transcriptSource: transcriptIsPending ? 'pending' : 'browser',
        durationSeconds: lastDurationSeconds, audioMimeType: currentAudioMimeType || 'audio/webm',
        ...(audioPayload.audioBlob ? { audioBlob: audioPayload.audioBlob } : { audioBase64: audioPayload.audioBase64 }), audioByteLength: audioPayload.audioByteLength,
        audioCaptured, browserSpeechSupported, transcriptionFinal: !transcriptIsPending,
        followUpAttempt: currentFollowUp, qualityScore: transcriptIsPending ? 0.15 : 0.62,
        localPatch: { status: 'interview_active' }
      };
    }
    const answerPayload = currentAnswerPayload;
    let queued = false;
    try { queued = (await queuePendingAnswer(answerPayload))?.acknowledged !== true; } catch { /* Audio remains in memory, not falsely in a durable queue. */ }
    if (currentSession?.id !== sessionId || currentCaptureId !== captureId) return;
    let result;
    try {
      const answer = await answerForTransport(answerPayload);
      if (currentSession?.id !== sessionId || currentCaptureId !== captureId) return;
      result = await futureAction('saveAnswer', answer);
    } catch (error) {
      if (currentSession?.id !== sessionId || currentCaptureId !== captureId) return;
      saveAnswerButton.disabled = false;
      setText(answerMeta, queued ? 'network_fail / answer_queued_retry.' : 'Respuesta solo en memoria. No cierre ni recargue la página; vuelva a guardar.');
      note(error instanceof Error ? `save_failed / ${error.message}` : 'save_failed');
      return;
    }
    if (currentSession?.id !== sessionId || currentCaptureId !== captureId) return;
    const acknowledged = await validateCaptureReceipt(result, answerPayload);
    if (currentSession?.id !== sessionId || currentCaptureId !== captureId) return;
    if (!acknowledged) {
      saveAnswerButton.disabled = false;
      setText(answerMeta, queued ? `answer_not_saved / ${result.errorCode || 'confirmation_pending'} / retry.` : 'Respuesta solo en memoria. No cierre ni recargue la página; vuelva a guardar.');
      return;
    }
    if (queued) await removePendingAnswer(questionIndex, sessionId, captureId);
    if (currentSession?.id !== sessionId || currentCaptureId !== captureId) return;
    await applyAnswerReceipt(result);
  } catch (error) {
    if (currentSession?.id !== sessionId || currentCaptureId !== captureId) return;
    saveAnswerButton.disabled = false;
    setText(answerMeta, 'Guardado sin confirmar. La respuesta se conserva; vuelva a guardar.');
    note(error instanceof Error ? error.message : 'answer_receipt_unconfirmed');
  } finally {
    answerSavePending = false;
  }
}

async function applyAnswerReceipt(result) {
  if (result?.session?.id !== currentSession?.id) throw new Error('answer_receipt_session_mismatch');
  if (result.answer?.transcript) {
    currentTranscript = result.answer.transcript;
    setText(liveTranscript, currentTranscript);
  }
  if (result.answer?.transcript_source === 'backend') {
    setText(answerMeta, `backend_transcribed / ${lastDurationSeconds}s.`);
  }

  if (result.needsFollowUp && result.question) {
    currentQuestion = result.question;
    saveSession(result.session || currentSession, currentSession.mode || 'backend');
    resetCaptureState('followup_required / answer_too_short');
    currentFollowUp = true;
    showInterview();
    await startQuestionAudioFlow();
    return;
  }

  if (result.saved !== true) {
    saveAnswerButton.disabled = false;
    setText(answerMeta, `answer_not_saved / ${result.errorCode || 'confirmation_pending'} / retry.`);
    return;
  }

  saveSession(result.session || currentSession, currentSession.mode || 'backend');

  if (result.completed) {
    showComplete();
    return;
  }

  if (result.nextQuestion) {
    currentQuestion = result.nextQuestion;
    resetCaptureState();
    currentFollowUp = currentQuestion.followUp === true;
    showInterview();
    await startQuestionAudioFlow();
    return;
  }

  setText(answerMeta, 'saved / no_next_question.');
}

async function beginInterview() {
  beginInterviewButton.disabled = true;
  const result = await futureAction('startInterview', {
    participantName: enteredName || sessionStorage.getItem(NAME_KEY) || '',
    localPatch: { status: 'interview_active', interviewStartedAt: new Date().toISOString() }
  });
  saveSession(result.session, currentSession.mode || 'backend');
  if (result.completed) { showComplete(); return; }
  currentQuestion = result.question || currentQuestion;
  resetCaptureState();
  currentFollowUp = currentQuestion.followUp === true;
  showInterview();
  startInterviewHeartbeat();
  await startQuestionAudioFlow();
}

async function generateBook() {
  if (!generateBookButton) return;
  const sessionId = currentSession?.id;
  generateBookButton.disabled = true;
  note('book_engine / drafting');
  setStep('stage 05/05', 'book_engine', '94%');
  const result = await futureAction('generateBook', {
    localPatch: { status: 'book_generating', bookStatus: 'generating' }
  });
  if (currentSession?.id !== sessionId) return;
  saveSession(result.session || currentSession, currentSession.mode || 'backend');
  displayBookResult(result);
}

function scheduleBookStatus(sessionId, delay = 10000) {
  if (bookStatusTimer) window.clearTimeout(bookStatusTimer);
  bookStatusTimer = window.setTimeout(() => pollBookStatus(sessionId), delay);
}

function displayBookResult(result) {
  if (bookStatusTimer) window.clearTimeout(bookStatusTimer);
  bookStatusTimer = null;
  if (result.manuscript && (!result.job || result.job.status === 'ready')) {
    showBook(result.manuscript, null);
    return;
  }
  showComplete();
  const job = result.job;
  if (!job || job.status === 'ready') {
    note('book_engine / manuscript_not_available');
    return;
  }
  if (generateBookButton) generateBookButton.disabled = true;
  if (job.status === 'blocked' || job.status === 'cancelled') {
    note(`book_engine / ${job.errorCode || job.status}`);
    return;
  }
  const progress = Math.max(0, Math.min(95, Number(job.progress) || 0));
  setStep('stage 05/05', 'book_engine', `${88 + progress * 0.11}%`);
  note(`book_engine / ${job.stage || 'queued'} / ${progress}%`);
  scheduleBookStatus(currentSession.id);
}

async function pollBookStatus(sessionId) {
  if (currentSession?.id !== sessionId) return;
  try {
    const result = await futureAction('getBookStatus');
    if (currentSession?.id !== sessionId) return;
    saveSession(result.session || currentSession, currentSession.mode || 'backend');
    displayBookResult(result);
  } catch {
    if (currentSession?.id !== sessionId) return;
    note('book_engine / reconnecting');
    scheduleBookStatus(sessionId, 20000);
  }
}

async function generatePdf() {
  if (!generatePdfButton) return;
  const sessionId = currentSession?.id;
  generatePdfButton.disabled = true;
  note('pdf_engine / layout');
  const result = await futureAction('generatePdf', {
    localPatch: { status: 'pdf_generating', pdfReviewStatus: 'not_generated' }
  });
  if (currentSession?.id !== sessionId) return;
  if (result.session?.id && result.session.id !== sessionId) throw new Error('pdf_receipt_scope');
  saveSession(result.session || currentSession, currentSession.mode || 'backend');
  const bookResult = await futureAction('getBookStatus').catch(() => ({ manuscript: readLocalManuscript() }));
  if (currentSession?.id !== sessionId) return;
  displayPdfResult(result, bookResult.manuscript || readLocalManuscript());
}

function schedulePdfStatus(sessionId, manuscriptPayload, delay = 10000) {
  if (pdfStatusTimer) window.clearTimeout(pdfStatusTimer);
  pdfStatusTimer = window.setTimeout(() => pollPdfStatus(sessionId, manuscriptPayload), delay);
}

function displayPdfResult(result, manuscriptPayload) {
  if (pdfStatusTimer) window.clearTimeout(pdfStatusTimer);
  pdfStatusTimer = null;
  const sessionId = currentSession?.id;
  if ((result.session?.id && result.session.id !== sessionId) ||
      (result.pdf?.sessionId && result.pdf.sessionId !== sessionId)) throw new Error('pdf_receipt_scope');
  if (manuscriptPayload) showBook(manuscriptPayload, result.pdf);
  else renderPdfState(result.pdf);
  const job = result.job;
  if (!job) {
    if (generatePdfButton) generatePdfButton.disabled = false;
    return;
  }
  if (generatePdfButton) generatePdfButton.disabled = true;
  if (job.status === 'ready') {
    note(result.pdf ? `pdf_${result.pdf.reviewStatus || 'pending_review'}` : 'pdf_engine / bundle_not_available');
    return;
  }
  if (['blocked','cancelled'].includes(job.status)) {
    note(`pdf_engine / ${job.errorCode || job.status}`);
    return;
  }
  if (!['queued','running'].includes(job.status)) {
    note('pdf_engine / status_unknown');
    return;
  }
  const progress = Math.max(0, Math.min(98, Number(job.progress) || 0));
  setStep('stage 05/05', 'pdf_engine', `${progress}%`);
  note(`pdf_engine / ${job.stage || 'queued'} / ${progress}%`);
  schedulePdfStatus(sessionId, manuscriptPayload);
}

async function pollPdfStatus(sessionId, manuscriptPayload) {
  if (currentSession?.id !== sessionId) return;
  try {
    const result = await futureAction('getPdfStatus');
    if (currentSession?.id !== sessionId) return;
    if (result.session?.id && result.session.id !== sessionId) throw new Error('pdf_receipt_scope');
    saveSession(result.session || currentSession, currentSession.mode || 'backend');
    displayPdfResult(result, manuscriptPayload);
  } catch {
    if (currentSession?.id !== sessionId) return;
    note('pdf_engine / reconnecting');
    schedulePdfStatus(sessionId, manuscriptPayload, 20000);
  }
}

function downloadBase64Pdf(pdf) {
  const link = document.createElement('a');
  link.href = `data:${pdf.mimeType || 'application/pdf'};base64,${pdf.pdfBase64}`;
  link.download = pdf.fileName || 'futuro-anterior.pdf';
  document.body.append(link);
  link.click();
  link.remove();
}

async function downloadReleasedPdf() {
  const result = await futureAction('downloadReleasedPdf');
  if (result.pdf?.pdfBase64) {
    downloadBase64Pdf(result.pdf);
    return;
  }
  if (result.pdf?.signedUrl) {
    const link = document.createElement('a');
    link.href = result.pdf.signedUrl;
    link.download = result.pdf.fileName || 'futuro-anterior.pdf';
    document.body.append(link);
    link.click();
    link.remove();
  }
}

function resetFlow() {
  clearFutureBookSessionState();
  window.location.reload();
}

form?.addEventListener('submit', (event) => {
  handleSubmit(event).catch((error) => {
    startPaymentButton.disabled = false;
    if (form) form.hidden = false;
    if (paymentStage) paymentStage.hidden = true;
    note(error instanceof Error ? error.message : 'access_failed');
  });
});

nameGate?.addEventListener('submit', (event) => {
  handleEntrySubmit(event).catch((error) => {
    const message = entryErrorMessage(error);
    setNameGateBusy(false);
    if (/Session not found|Missing session credentials/i.test(message)) {
      clearFutureBookSessionState();
      showNameGate();
      note('session_expired / retry_name');
      return;
    }
    if (nameGate) nameGate.hidden = false;
    note(message);
  });
});

beginInterviewButton?.addEventListener('click', () => {
  unlockAudioPlayback();
  beginInterview().catch((error) => {
    beginInterviewButton.disabled = false;
    note(error instanceof Error ? error.message : 'interview_start_failed');
  });
});

playQuestionButton?.addEventListener('click', () => {
  unlockAudioPlayback();
  playQuestion().catch((error) => note(error instanceof Error ? error.message : 'audio_failed'));
});

recordAnswerButton?.addEventListener('click', () => {
  startRecording().catch((error) => setText(answerMeta, error instanceof Error ? error.message : 'rec_failed'));
});

stopRecordingButton?.addEventListener('click', stopRecording);

saveAnswerButton?.addEventListener('click', () => {
  saveAnswer().catch((error) => {
    saveAnswerButton.disabled = false;
    note(error instanceof Error ? error.message : 'save_failed');
  });
});

generateBookButton?.addEventListener('click', () => {
  generateBook().catch((error) => {
    generateBookButton.disabled = false;
    note(error instanceof Error ? error.message : 'book_failed');
  });
});

generatePdfButton?.addEventListener('click', () => {
  generatePdf().catch((error) => {
    generatePdfButton.disabled = false;
    note(error instanceof Error ? error.message : 'pdf_failed');
  });
});

downloadPdfButton?.addEventListener('click', () => {
  downloadReleasedPdf().catch((error) => note(error instanceof Error ? error.message : 'download_failed'));
});

resetButton?.addEventListener('click', resetFlow);
resetCompletedButton?.addEventListener('click', resetFlow);
resetBookButton?.addEventListener('click', resetFlow);

window.addEventListener('online', () => {
  flushPendingAnswerQueue()
    .then(async (result) => {
      if (result?.session?.id === currentSession?.id) await applyAnswerReceipt(result);
    })
    .catch(() => null);
});

document.addEventListener('visibilitychange', () => {
  recordInterviewHeartbeat(document.hidden ? 'hidden' : 'visible').catch(() => null);
});

window.addEventListener('beforeunload', () => {
  recordInterviewHeartbeat('unload').catch(() => null);
});

migrateUiMode();
runClientBootSequence().catch(() => {
  if (futureBoot) futureBoot.hidden = true;
  if (futureIntro) futureIntro.hidden = true;
  if (futurePersistentLog) {
    futurePersistentLog.hidden = false;
    futurePersistentLog.textContent = `${CLIENT_BOOT_LINES.join('\n')}\n`;
  }
  document.body.classList.remove('is-booting', 'is-typing');
  document.body.classList.add('is-ready');
});
ensureSession().catch((error) => {
  if (isAccessError(error)) {
    showAccessDenied({ reason: error instanceof Error ? error.message : 'access_denied' });
    return;
  }
  if (hasBackendConfig() || !IS_LOCAL_PREVIEW) {
    showNameGate();
    note(error instanceof Error ? error.message : 'session_unavailable');
    return;
  }
  saveSession(localSession(), 'local');
  showNameGate();
});
