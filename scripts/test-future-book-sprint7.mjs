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

const fn = await file('supabase/functions/future-book-session/index.ts');
const ai = await file('supabase/functions/_shared/ai.ts');
const adminJs = await file('src/scripts/future-admin.js');
const sprint = await file('docs/SPRINT_7_LIBRO_FUTURO_IMPLEMENTATION.md');
const backlog = await file('docs/PRODUCT_BACKLOG_FUTURO_ANTERIOR_PRODUCCION_AUTONOMA.md');
const pkg = await file('package.json');

includes(fn, [
  'strictAiProvidersRequired',
  'providerSecret',
  'missingRequiredProviders',
  'blockBookGenerationForMissingProviders',
  'required_ai_provider_missing',
  'book_generation_blocked',
  'degraded_provider_fallback',
  'manuscriptIsDegraded',
  'degraded_not_ready_for_print',
  'testProviderConnectivity',
  'openai_http_',
  'anthropic_http_',
  'elevenlabs_voice_http_'
], 'Future book Sprint 7 backend');

includes(ai, [
  'apiKey?: string',
  'input.apiKey'
], 'Future book Sprint 7 shared AI');

includes(adminJs, [
  'probe=',
  'testStatus'
], 'Future book Sprint 7 admin UI');

includes(sprint, [
  'PB-A01',
  'PB-A02',
  'PB-A04',
  'PB-A05',
  'FUTURE_BOOK_REQUIRE_AI_PROVIDERS',
  'ready_for_print=false',
  'Smoke productivo'
], 'Future book Sprint 7 doc');

includes(backlog, [
  'Sprint 7 - Activar IA real y cerrar modo degradado',
  'OpenAI',
  'Anthropic',
  'fallback degradado'
], 'Future book production backlog');

includes(pkg, [
  'test-future-book-sprint7.mjs'
], 'Package test script');

console.log('Future book Sprint 7 checks OK');
