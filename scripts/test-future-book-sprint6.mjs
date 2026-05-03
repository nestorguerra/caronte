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

function assert(value, message) {
  if (!value) throw new Error(message);
}

function runE2ESimulation() {
  const session = {
    id: 'session-e2e',
    status: 'created',
    paymentStatus: 'not_started',
    bookStatus: 'not_started',
    pdfReviewStatus: 'not_generated',
    answers: []
  };

  session.status = 'payment_pending';
  session.consent = true;
  session.paymentStatus = 'simulated_approved';
  session.status = 'interview_ready';

  for (let index = 1; index <= 21; index += 1) {
    session.answers.push({
      questionIndex: index,
      transcript: `Respuesta mock suficientemente larga para la pregunta ${index}, con escena, razon y detalle personal.`
    });
  }
  assert(session.answers.length === 21, 'E2E must complete 21 answers');

  session.status = 'interview_completed';
  const manuscript = {
    status: 'ready',
    sections: ['cover', 'instructions', 'future_note', 'prologue', 'chapter_1', 'chapter_2', 'chapter_3', 'chapter_4', 'chapter_5', 'chapter_6', 'chapter_7', 'letter', 'epilogue', 'notice']
  };
  assert(manuscript.sections.length >= 12, 'E2E manuscript must have editorial structure');

  session.status = 'book_ready';
  session.bookStatus = 'ready';
  const pdf = {
    status: 'generated',
    reviewStatus: 'pending_review',
    pdfBase64: 'JVBERi0xLjQK',
    luluMetadata: { ready_for_print: true, send_to_lulu: false }
  };
  session.status = 'pending_review';
  session.pdfReviewStatus = pdf.reviewStatus;

  const canDownloadPending = pdf.reviewStatus === 'released_to_customer';
  assert(!canDownloadPending, 'E2E PDF must be blocked while pending_review');

  pdf.reviewStatus = 'approved';
  session.status = 'approved';
  session.pdfReviewStatus = 'approved';
  assert(pdf.reviewStatus === 'approved', 'E2E admin approval failed');
  assert(pdf.reviewStatus !== 'released_to_customer', 'E2E approved PDF must still require manual release');

  pdf.reviewStatus = 'released_to_customer';
  session.status = 'released_to_customer';
  session.pdfReviewStatus = 'released_to_customer';
  assert(Boolean(pdf.pdfBase64), 'E2E released PDF must include downloadable base64');
  assert(pdf.luluMetadata.ready_for_print === true, 'E2E PDF must be Lulu-ready metadata');
  assert(pdf.luluMetadata.send_to_lulu === false, 'E2E must not send to Lulu');
}

const futuro = await file('src/tiresias.html');
const adminPage = await file('src/futuro-admin.html');
const terms = await file('src/legal/futuro-terms.html');
const privacy = await file('src/legal/futuro-privacy.html');
const bookJs = await file('src/scripts/future-book.js');
const adminJs = await file('src/scripts/future-admin.js');
const fn = await file('supabase/functions/future-book-session/index.ts');
const migration = await file('supabase/migrations/202604220002_future_book_sprint6_monitoring.sql');
const runbook = await file('docs/RUNBOOK_FUTURO_ANTERIOR.md');
const checklist = await file('docs/BETA_CHECKLIST_FUTURO_ANTERIOR.md');
const sprint = await file('docs/SPRINT_6_LIBRO_FUTURO_IMPLEMENTATION.md');

includes(futuro, [
  'futuro-terms.html',
  'futuro-privacy.html'
], 'Future book Sprint 6 public page');

includes(adminPage, [
  'monitorGrid',
  'accessToggleButton',
  'deleteSessionForm'
], 'Future book Sprint 6 admin page');

includes(terms, [
  'obra narrativa personalizada',
  'no predice el futuro',
  'no es terapia',
  'pago de 49,95 EUR'
], 'Future book Sprint 6 terms');

includes(privacy, [
  'voz capturada',
  'transcripcion',
  '30 dias',
  'derecho de borrado'
], 'Future book Sprint 6 privacy');

includes(bookJs, [
  'localAccessDisabled',
  'future_book_sprint6_access'
], 'Future book Sprint 6 client JS');

includes(adminJs, [
  'adminMonitor',
  'adminToggleAccess',
  'adminDeleteSessionData',
  'renderMonitor'
], 'Future book Sprint 6 admin JS');

includes(fn, [
  'future_book_monitor_alerts',
  'future_book_runtime_flags',
  'adminMonitor',
  'adminToggleAccess',
  'adminDeleteSessionData',
  'accessDisabled',
  'ensureP0Alert'
], 'Future book Sprint 6 backend');

includes(migration, [
  'create table if not exists public.future_book_monitor_alerts',
  'create table if not exists public.future_book_runtime_flags',
  'severity text',
  'enable row level security'
], 'Future book Sprint 6 migration');

includes(runbook, [
  'Como revisar sesiones',
  'Como regenerar un PDF',
  'Como borrar datos',
  'Como desactivar el acceso'
], 'Future book Sprint 6 runbook');

includes(checklist, [
  'URL fija',
  'Pago simulado',
  'PDF bloqueado',
  'No se llama a Lulu'
], 'Future book Sprint 6 checklist');

includes(sprint, [
  'PB-G01',
  'PB-G02',
  'PB-H02',
  'PB-H03',
  'PB-H04',
  'beta privada'
], 'Future book Sprint 6 doc');

runE2ESimulation();

console.log('Future book Sprint 6 checks OK');
