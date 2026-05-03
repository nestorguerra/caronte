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
const js = await file('src/scripts/future-book.js');
const fn = await file('supabase/functions/future-book-session/index.ts');
const sprint = await file('docs/SPRINT_3_LIBRO_FUTURO_IMPLEMENTATION.md');
const pkg = await file('package.json');

includes(page, [
  'questionLabel',
  'completeStage',
  'interview_completed',
  'resetCompletedButton'
], 'Future book Sprint 3 page');

includes(js, [
  'future_book_sprint3_session',
  'interviewQuestions',
  'Cuéntame tu biografía profesional',
  'Cuéntame tu biografía personal',
  '¿Qué pregunta no te he hecho',
  'followUpFor',
  'needsFollowUp',
  'showComplete',
  'result.nextQuestion',
  'q_${String(index).padStart'
], 'Future book Sprint 3 frontend');

includes(fn, [
  'interviewQuestions',
  'questionFor',
  'Cuéntame tu biografía profesional',
  'Cuéntame tu biografía personal',
  'followUpFor',
  'wordCount',
  'question_followup_requested',
  'interview_completed',
  'nextQuestion',
  'requestFollowUp'
], 'Future book Sprint 3 backend');

includes(sprint, [
  'PB-C04',
  'PB-C05',
  'PB-B04',
  '21 preguntas',
  'question_followup_requested',
  'interview_completed'
], 'Future book Sprint 3 doc');

includes(pkg, [
  'test-future-book-sprint3.mjs'
], 'Package test script');

console.log('Future book Sprint 3 checks OK');
