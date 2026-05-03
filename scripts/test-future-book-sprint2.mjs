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

const page = await file('src/futuro.html');
const css = await file('src/styles/future-book.css');
const js = await file('src/scripts/future-book.js');
const fn = await file('supabase/functions/future-book-session/index.ts');
const migration = await file('supabase/migrations/202604210002_future_book_sprint2_voice.sql');
const sprint = await file('docs/SPRINT_2_LIBRO_FUTURO_IMPLEMENTATION.md');
const env = await file('.env.example');
const pkg = await file('package.json');

includes(page, [
  'beginInterviewButton',
  'interviewStage',
  'playQuestionButton',
  'recordAnswerButton',
  'stopRecordingButton',
  'saveAnswerButton',
  'liveTranscript'
], 'Future book Sprint 2 page');

includes(css, [
  '.interview-stage',
  '.voice-orb',
  '.voice-controls',
  '.transcript-panel',
  '@keyframes pulse-voice'
], 'Future book Sprint 2 CSS');

includes(js, [
  'navigator.mediaDevices.getUserMedia',
  'MediaRecorder',
  'elevenlabs_audio_missing',
  'audio_provider=elevenlabs_error',
  'SpeechRecognition',
  'webkitSpeechRecognition',
  'startInterview',
  'synthesizeQuestion',
  'saveAnswer'
], 'Future book Sprint 2 frontend');

includes(fn, [
  'startInterview',
  'getCurrentQuestion',
  'synthesizeQuestion',
  'saveAnswer',
  'ELEVENLABS_API_KEY',
  'future_book_answers',
  'future_book_artifacts',
  'question_answered'
], 'Future book Sprint 2 backend');

includes(migration, [
  'create table if not exists public.future_book_answers',
  'create table if not exists public.future_book_artifacts',
  'alter table public.future_book_answers enable row level security',
  'artifact_type text not null'
], 'Future book Sprint 2 migration');

includes(sprint, [
  'PB-C01',
  'PB-C02',
  'PB-C03',
  'PB-B03',
  'ELEVENLABS_API_KEY',
  'SpeechRecognition',
  'future_book_answers'
], 'Future book Sprint 2 doc');

includes(env, [
  'ELEVENLABS_API_KEY=',
  'ELEVENLABS_VOICE_ID=',
  'ELEVENLABS_MODEL_ID=eleven_multilingual_v2'
], 'Environment example');

includes(pkg, [
  'test-future-book-sprint2.mjs'
], 'Package test script');

console.log('Future book Sprint 2 checks OK');
