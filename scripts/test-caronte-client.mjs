import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';

const source = readFileSync('src/scripts/future-book.js', 'utf8');
const fragment = source.slice(source.indexOf('async function generateBook()'), source.indexOf('async function generatePdf()'));
function client(initialResult) {
  const shown = []; const notes = []; const scheduled = [];
  const context = vm.createContext({
    currentSession: { id: 's1', mode: 'backend', status: 'interview_completed' },
    generateBookButton: { disabled: false }, bookStatusTimer: null,
    window: { setTimeout: fn => { scheduled.push(fn); return scheduled.length; }, clearTimeout() {} },
    futureAction: async () => initialResult,
    saveSession: (session, mode) => { context.currentSession = { ...session, mode }; },
    showBook: book => shown.push(book), showComplete() {},
    note: text => notes.push(text), setStep() {},
    Number, Math, Error
  });
  vm.runInContext(fragment, context);
  return { context, shown, notes, scheduled };
}

function bootMessages() {
  const start = source.indexOf('const AUTONOMOUS_NOTICE =');
  const end = source.indexOf('function paymentGateLines(', start);
  assert.ok(start >= 0 && end > start, 'public boot messages must exist');
  return JSON.parse(vm.runInNewContext(`${source.slice(start, end)}\nJSON.stringify({ notice: AUTONOMOUS_NOTICE, lines: CLIENT_BOOT_LINES });`));
}

test('public boot messages identify the configured writer, reviewer, voice and print providers', () => {
  const { notice, lines } = bootMessages();
  assert.match(notice, /escritura=GPT-6\.1 Sol \(xhigh\)/);
  assert.match(notice, /revisión=Claude Opus 5\.5/);
  assert.match(notice, /voz=ElevenLabs/);
  assert.match(notice, /impresión=Lulu/);
  assert.ok(lines.includes(notice));
  assert.doesNotMatch(lines.join('\n'), /GPT-5\.5|Claude Opus 4\.8/);
});

test('public boot messages disclose authorized operator review instead of promising no human access', () => {
  const { lines } = bootMessages();
  assert.ok(lines.includes('La entrevista y la escritura funcionan automáticamente. Los operadores autorizados pueden revisar el proceso y aprobar los archivos de impresión.'));
  assert.doesNotMatch(lines.join('\n'), /human_operator=false|No hay personas detrás|nadie lo opera|nadie accede|sin intervención humana/);
});

test('queued generation displays progress, not an empty ready book', async () => {
  const c = client({ session: { id: 's1', status: 'book_generating' }, job: { id: 'j1', status: 'queued', stage: 'biography', progress: 0 }, manuscript: null });
  await c.context.generateBook();
  assert.equal(c.shown.length, 0);
  assert.equal(c.context.generateBookButton.disabled, true);
  assert.equal(c.scheduled.length, 1);
  assert.match(c.notes.at(-1), /book_engine.*biography/);
});

test('polling resumes until a real manuscript exists and then stops', async () => {
  const c = client({ session: { id: 's1', status: 'book_ready' }, job: { id: 'j1', status: 'ready' }, manuscript: { id: 'book-real' } });
  assert.equal(typeof c.context.pollBookStatus, 'function');
  await c.context.pollBookStatus('s1');
  assert.equal(c.shown[0].id, 'book-real');
  assert.equal(c.scheduled.length, 0);
});

test('blocked job and missing manuscript do not masquerade as completion', async () => {
  const c = client({ session: { id: 's1', status: 'blocked' }, job: { status: 'blocked', errorCode: 'age_confirmation_required' }, manuscript: null });
  await c.context.generateBook();
  assert.equal(c.shown.length, 0);
  assert.match(c.notes.at(-1), /age_confirmation_required/);
  assert.equal(c.scheduled.length, 0);
});

test('temporary polling failure preserves job and does not submit generation again', async () => {
  const c = client(null); const calls = [];
  c.context.futureAction = async action => { calls.push(action); throw new Error('timeout'); };
  assert.equal(typeof c.context.pollBookStatus, 'function');
  await c.context.pollBookStatus('s1');
  assert.deepEqual(calls, ['getBookStatus']);
  assert.equal(c.shown.length, 0);
  assert.equal(c.scheduled.length, 1);
  assert.match(c.notes.at(-1), /reconnecting/);
});

test('a late response from a different session cannot replace the current book', async () => {
  const c = client(null);
  c.context.futureAction = async () => {
    c.context.currentSession = { id: 's2', mode: 'backend' };
    return { session: { id: 's1' }, manuscript: { id: 'foreign' } };
  };
  assert.equal(typeof c.context.pollBookStatus, 'function');
  await c.context.pollBookStatus('s1');
  assert.equal(c.shown.length, 0);
  assert.equal(c.context.currentSession.id, 's2');
});
