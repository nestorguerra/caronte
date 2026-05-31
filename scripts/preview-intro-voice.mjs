#!/usr/bin/env node
// Genera muestras de audio del intro de Caronte con Eleven v3 para afinar el perfil de voz
// (grave, seria, profunda y expresiva) SIN desplegar la Edge Function.
//
// La API key NUNCA se imprime ni se commitea. Se lee de:
//   1) la variable de entorno ELEVENLABS_API_KEY, o
//   2) la linea ELEVENLABS_API_KEY=... de .env.production.local (gitignored).
//
// Uso:
//   ELEVENLABS_API_KEY=sk_... node scripts/preview-intro-voice.mjs
//   (o añade ELEVENLABS_API_KEY=...  a .env.production.local y ejecuta:  node scripts/preview-intro-voice.mjs)
//
// Opcionales:
//   ELEVENLABS_VOICE_ID=...        voz base (default: la de Caronte)
//   ELEVENLABS_INTRO_MODEL_ID=...  modelo (default: eleven_v3)

import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const OUT_DIR = join(HERE, 'voice-previews');
const DEFAULT_VOICE_ID = 'PToUZ7lhIUiz1SP94rGo';
const MODEL_ID = (process.env.ELEVENLABS_INTRO_MODEL_ID || 'eleven_v3').trim();

async function loadApiKey() {
  if (process.env.ELEVENLABS_API_KEY) return process.env.ELEVENLABS_API_KEY.trim();
  const envPath = join(ROOT, '.env.production.local');
  if (existsSync(envPath)) {
    const raw = await readFile(envPath, 'utf8');
    const line = raw.split('\n').find((l) => l.trim().startsWith('ELEVENLABS_API_KEY='));
    if (line) {
      const val = line.slice(line.indexOf('=') + 1).trim().replace(/^["']|["']$/g, '');
      if (val) return val;
    }
  }
  return null;
}

// Fragmento representativo del intro con los audio tags que Eleven v3 debe interpretar.
const INTRO_FRAGMENT = [
  '[calm, low voice]',
  'Hola.',
  '',
  '[serious]',
  'Bienvenido.',
  '',
  'Esto es Caronte.',
  '',
  '[slowly]',
  'Un modelo entrenado para una sola funcion: construir, a partir de tus respuestas, un mapa psicologico coherente de ti.',
  '',
  '[lower voice]',
  'Un libro escrito por tu yo del futuro a tu yo del presente.',
  '',
  '[firm]',
  'No soy un terapeuta. No soy un amigo. No soy un test de personalidad.',
  '',
  'Soy un instrumento.',
  '',
  '[slightly colder]',
  'Tratame como tal.'
].join('\n');

// Tres perfiles para comparar por oido. El A es el default que queda en la Edge Function.
const PROFILES = [
  { id: 'A_grave_equilibrada', label: 'A - Grave equilibrada (default propuesto)', settings: { stability: 0.30, similarity_boost: 0.85, style: 0.35, speed: 0.90, use_speaker_boost: true } },
  { id: 'B_grave_solemne',     label: 'B - Mas grave y solemne (mas lenta)',       settings: { stability: 0.25, similarity_boost: 0.90, style: 0.30, speed: 0.86, use_speaker_boost: true } },
  { id: 'C_expresiva',         label: 'C - Mas expresiva / dramatica',             settings: { stability: 0.35, similarity_boost: 0.80, style: 0.45, speed: 0.92, use_speaker_boost: true } }
];

async function synth(apiKey, voiceId, settings) {
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}`, {
    method: 'POST',
    headers: { 'xi-api-key': apiKey, Accept: 'audio/mpeg', 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: INTRO_FRAGMENT, model_id: MODEL_ID, voice_settings: settings })
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status} ${res.statusText} :: ${body.slice(0, 500)}`);
  }
  return Buffer.from(await res.arrayBuffer());
}

async function main() {
  const apiKey = await loadApiKey();
  if (!apiKey) {
    console.error([
      '',
      'Falta ELEVENLABS_API_KEY.',
      '  Opcion 1:  ELEVENLABS_API_KEY=sk_... node scripts/preview-intro-voice.mjs',
      '  Opcion 2:  añade  ELEVENLABS_API_KEY=sk_...  a .env.production.local (gitignored) y reejecuta.',
      ''
    ].join('\n'));
    process.exit(1);
  }
  const voiceId = (process.env.ELEVENLABS_VOICE_ID || DEFAULT_VOICE_ID).trim();
  await mkdir(OUT_DIR, { recursive: true });
  console.log(`\nGenerando muestras del intro  (model_id=${MODEL_ID}, voice_id=${voiceId})\n`);
  const generated = [];
  for (const profile of PROFILES) {
    process.stdout.write(`  - ${profile.label} ... `);
    try {
      const audio = await synth(apiKey, voiceId, profile.settings);
      const file = join(OUT_DIR, `intro_${profile.id}.mp3`);
      await writeFile(file, audio);
      generated.push(file);
      console.log(`ok (${(audio.length / 1024).toFixed(0)} KB)`);
    } catch (err) {
      console.log('ERROR');
      console.log(`      ${err.message}`);
    }
  }
  if (!generated.length) {
    console.error('\nNo se genero ninguna muestra. Revisa la API key y que la cuenta tenga acceso a Eleven v3.\n');
    process.exit(1);
  }
  console.log(`\nListo: ${generated.length} muestra(s) en  ${OUT_DIR}`);
  console.log('Escuchalas y dime cual prefieres, o que ajuste (mas grave, mas lenta, mas expresiva...).\n');
  if (process.platform === 'darwin') {
    spawn('open', [OUT_DIR], { stdio: 'ignore', detached: true }).unref();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
