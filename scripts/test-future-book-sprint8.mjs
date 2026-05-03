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

const bookJs = await file('src/scripts/future-book.js');
const fn = await file('supabase/functions/future-book-session/index.ts');
const migration = await file('supabase/migrations/202604220003_future_book_sprint8_audio_storage.sql');
const sprint = await file('docs/SPRINT_8_LIBRO_FUTURO_IMPLEMENTATION.md');
const readme = await file('README.md');
const env = await file('.env.example');
const pkg = await file('package.json');

includes(bookJs, [
  'future_book_sprint8_pending_answers',
  'blobToBase64',
  'audioBase64',
  'audioByteLength',
  'queuePendingAnswer',
  'flushPendingAnswerQueue',
  'recordInterviewHeartbeat',
  'backend_transcribed',
  'preferredAudioMimeType',
  'INTRO_AUDIO_TIMEOUT_MS',
  'unlockAudioPlayback',
  'prepareNarrationWithTimeout',
  'isLikelyIOS',
  'prepareQuestionAudio',
  'startQuestionAudioFlow',
  'audio_ready / pulsa repetir'
], 'Future book Sprint 8 client');

includes(fn, [
  'transcribeAnswerAudio',
  'FUTURE_BOOK_TRANSCRIPTION_MODEL',
  'gpt-4o-mini-transcribe',
  'https://api.openai.com/v1/audio/transcriptions',
  'answer_transcription_started',
  'answer_transcription_completed',
  'answer_transcription_failed',
  'uploadPrivateAudioArtifact',
  'future-book-audio',
  'recordInterviewHeartbeat',
  'interview_client_interrupted',
  'narrativeDensityScore',
  'density_band',
  'openai_models_endpoint_ok_for_transcription',
  'audioBase64'
], 'Future book Sprint 8 backend');

includes(migration, [
  'storage.buckets',
  'future-book-audio',
  'public = false',
  'file_size_limit',
  'audio_storage_path'
], 'Future book Sprint 8 migration');

includes(sprint, [
  'PB-B01',
  'PB-B02',
  'PB-B03',
  'PB-B04',
  'PB-B07',
  'FUTURE_BOOK_STORE_AUDIO',
  'gpt-4o-mini-transcribe',
  'No se guarda `audioBase64`'
], 'Future book Sprint 8 doc');

includes(readme, [
  'Modulo Futuro Anterior Sprint 8',
  'future-book-audio',
  'FUTURE_BOOK_TRANSCRIPTION_MODEL',
  'FUTURE_BOOK_STORE_AUDIO'
], 'Future book Sprint 8 README');

includes(env, [
  'FUTURE_BOOK_TRANSCRIPTION_MODEL=gpt-4o-mini-transcribe',
  'FUTURE_BOOK_STORE_AUDIO=true',
  'FUTURE_BOOK_MAX_AUDIO_BYTES=25165824'
], 'Future book Sprint 8 env');

includes(pkg, [
  'test-future-book-sprint8.mjs'
], 'Package test script');

console.log('Future book Sprint 8 checks OK');
