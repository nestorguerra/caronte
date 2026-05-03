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
  'sessionStorage',
  'showReady'
], 'Future book Sprint 1 frontend');

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
