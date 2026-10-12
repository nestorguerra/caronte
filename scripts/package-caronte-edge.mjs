import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {dirname, resolve, posix} from 'node:path';
import {fileURLToPath} from 'node:url';
import {FONT_ASSETS} from '../supabase/functions/_shared/caronte-print-fonts.mjs';

const repository = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const entrypoint = 'functions/future-book-session/index.ts';
const fontModule = 'functions/_shared/caronte-print-font-data.mjs';
const sourcePath = name => resolve(repository, 'supabase', name);

// The official text-only deployment API cannot carry binary static files.
// Package the licensed, hash-checked originals as a module, not as remote URLs.
// This is an artifact transformation: source and ordinary CLI assets stay intact.
export async function packageCaronteEdge({read = readFile} = {}) {
  const assets = {};
  for (const asset of Object.values(FONT_ASSETS)) {
    const bytes = await read(sourcePath(`functions/future-book-session/fonts/${asset.file}`));
    if (createHash('sha256').update(bytes).digest('hex') !== asset.sha256) {
      throw new Error('print_font_asset_mismatch');
    }
    assets[asset.file] = Buffer.from(bytes).toString('base64');
  }
  const license = await read(sourcePath('functions/future-book-session/fonts/OFL.txt'), 'utf8');
  const assetSource = `// Generated from the original licensed Crimson Text assets.\n` +
    `export const FONT_LICENSE = ${JSON.stringify(license)};\n` +
    `const assets = Object.freeze(${JSON.stringify(assets)});\n` +
    `export async function readBundledPrintFont(url) {\n` +
    `  const name = new URL(url).pathname.split('/').pop();\n` +
    `  if (!Object.hasOwn(assets, name)) throw new Error('print_font_asset_missing');\n` +
    `  return Uint8Array.from(atob(assets[name]), character => character.charCodeAt(0));\n` +
    `}\n`;
  const files = new Map([[fontModule, assetSource]]);
  async function include(name) {
    if (files.has(name)) return;
    if (name !== entrypoint && !/^functions\/_shared\/[a-zA-Z0-9_-]+\.(?:mjs|ts)$/.test(name)) {
      throw new Error('caronte_package_import_outside_scope');
    }
    let content = await read(sourcePath(name), 'utf8');
    if (name === 'functions/_shared/caronte-print-runtime.mjs') {
      const reader = 'loadPrintFonts(url => Deno.readFile(url))';
      if (content.split(reader).length !== 2 || !content.includes("import fs from 'node:fs';")) {
        throw new Error('caronte_package_font_adapter_changed');
      }
      content = content.replace('// Load node:fs first, as required by the Supabase static-file runtime.',
        '// Fonts are included in this deployment artifact; no external asset fetch.');
      content = content.replace("import fs from 'node:fs';",
        "import {readBundledPrintFont} from './caronte-print-font-data.mjs';");
      content = content.replace(reader, 'loadPrintFonts(readBundledPrintFont)');
    }
    files.set(name, content);
    for (const match of content.matchAll(/\b(?:from\s*|import\s*)['"](\.[^'"]+)['"]/g)) {
      await include(posix.normalize(posix.join(posix.dirname(name), match[1])));
    }
  }
  await include(entrypoint);
  return {entrypoint_path: entrypoint, files: [...files].sort(([a], [b]) => a.localeCompare(b))
    .map(([name, content]) => ({name, content}))};
}
