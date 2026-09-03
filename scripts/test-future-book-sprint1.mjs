import { readFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();

async function file(relativePath) {
  return readFile(path.join(root, relativePath), 'utf8');
}

function includes(text, snippets, label) {
  for (const snippet of snippets) {
    if (!text.includes(snippet)) {
      throw new Error(`${label} missing ${snippet}`);
    }
  }
}

const page = await file('src/tiresias.html');
const css = await file('src/styles/future-book.css');
const js = await file('src/scripts/future-book.js');
const apiClient = await file('src/scripts/api-client.js');
const fn = await file('supabase/functions/future-book-session/index.ts');
const sprint = await file('docs/SPRINT_1_LIBRO_FUTURO_IMPLEMENTATION.md');
const pkg = await file('package.json');

includes(page, [
  'Futuro Anterior',
  '49,95 EUR',
  'futureAccessForm',
  'paymentStage',
  'readyStage',
  'acceptIntensity',
  './scripts/future-book.js'
], 'Future book Sprint 1 page');

for (const forbidden of ['quickDemoButton', 'data-demo-voice', 'cargar_demo_libro', 'oir_muestra_voz', 'MODO DEMO']) {
  if (page.includes(forbidden) || js.includes(forbidden)) {
    throw new Error(`Production page contains demo marker ${forbidden}`);
  }
}

includes(css, [
  '.future-shell',
  '.future-console',
  '.payment-stage',
  '.ready-stage',
  '@media (max-width: 980px)',
  'NODE//49',
  'repeating-linear-gradient',
  'Courier New'
], 'Future book Sprint 1 CSS');

includes(js, [
  'recordConsent',
  'startSimulatedPayment',
  'approveSimulatedPayment',
  'hasBackendConfig',
  "currentSession?.mode === 'local'",
  'ENTRY_REQUEST_TIMEOUT_MS',
  'ACTION_REQUEST_TIMEOUT_MS',
  'LOCAL_VOICE_INTRO_URL',
  'LOCAL_VOICE_FOLLOW_UP_URL',
  'localQuestionVoiceUrl',
  "provider: 'local_audio'",
  'setVoiceAudioUrl',
  'playBrowserNarration',
  'SpeechSynthesisUtterance',
  'sessionStorage',
  'showReady'
], 'Future book Sprint 1 frontend');

for (const voiceFile of [
  'src/caronte-voice-intro.m4a',
  'src/caronte-voice-followup.m4a',
  ...Array.from({ length: 21 }, (_, index) => `src/caronte-voice-q${String(index + 1).padStart(2, '0')}.m4a`)
]) {
  const audio = await readFile(path.join(root, voiceFile));
  if (audio.length < 1_000) throw new Error(`Voice fallback is empty: ${voiceFile}`);
}

includes(apiClient, [
  'timeoutMs = 0',
  'new AbortController()',
  'controller.abort()',
  "throw new Error(`${name}_timeout`)"
], 'Future book Sprint 1 network resilience');

if (js.includes("note('ios_audio_unlock")) {
  throw new Error('Audio unlock state must not overwrite entry errors');
}

includes(fn, [
  'recordConsent',
  'startSimulatedPayment',
  'approveSimulatedPayment',
  'privacy_consent_accepted',
  'payment_started',
  'payment_simulated_approved',
  "status: 'interview_ready'"
], 'Future book Sprint 1 backend');

includes(sprint, [
  '/tiresias.html',
  'PB-A02',
  'PB-A03',
  'PB-A04',
  'PB-B02',
  'PB-G03',
  'interview_ready'
], 'Future book Sprint 1 implementation doc');

includes(pkg, [
  'test-future-book-sprint1.mjs'
], 'Package test script');

console.log('Future book Sprint 1 checks OK');
