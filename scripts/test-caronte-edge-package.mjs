import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFile} from 'node:fs/promises';
import {packageCaronteEdge} from './package-caronte-edge.mjs';
import {FONT_ASSETS, loadPrintFonts} from '../supabase/functions/_shared/caronte-print-fonts.mjs';

test('deployable package contains the entrypoint and every relative import, but no private files', async () => {
  const result = await packageCaronteEdge();
  const files = new Map(result.files.map(file => [file.name, file.content]));
  assert.equal(result.entrypoint_path, 'functions/future-book-session/index.ts');
  assert.ok(files.get(result.entrypoint_path) === await readFile('supabase/functions/future-book-session/index.ts', 'utf8'), 'entrypoint bytes are unchanged');
  assert.ok(files.has('functions/_shared/service.ts'));
  assert.ok(files.has('functions/_shared/caronte-print-engine.mjs'));
  assert.equal(files.size, result.files.length);
  assert.ok(result.files.every(file => /^functions\/(?:_shared\/[^/]+\.(?:mjs|ts)|future-book-session\/index\.ts)$/.test(file.name)));
  assert.ok(JSON.stringify(result).length < 2 * 1024 * 1024);
  const runtime = files.get('functions/_shared/caronte-print-runtime.mjs');
  assert.match(runtime, /loadPrintFonts\(readBundledPrintFont\)/);
  assert.doesNotMatch(runtime, /Deno\.readFile|import fs from/);
});

test('text-only upload decodes all three original font binaries and includes their OFL license', async () => {
  const result = await packageCaronteEdge();
  const data = result.files.find(file => file.name === 'functions/_shared/caronte-print-font-data.mjs');
  assert.ok(data);
  const assetModule = await import(`data:text/javascript;base64,${Buffer.from(data.content).toString('base64')}`);
  assert.equal(assetModule.FONT_LICENSE, await readFile('supabase/functions/future-book-session/fonts/OFL.txt', 'utf8'));
  const fonts = await loadPrintFonts(assetModule.readBundledPrintFont);
  for (const [name, asset] of Object.entries(FONT_ASSETS)) {
    assert.deepEqual(Buffer.from(fonts[name]), await readFile(`supabase/functions/future-book-session/fonts/${asset.file}`));
  }
  await assert.rejects(assetModule.readBundledPrintFont(new URL('file:///unknown.ttf')), /print_font_asset_missing/);
});

test('packaging rejects damaged fonts rather than publishing different bytes', async () => {
  await assert.rejects(packageCaronteEdge({read: async (path, encoding) =>
    path.endsWith('CrimsonText-Regular.ttf') ? new Uint8Array([1, 2, 3]) : readFile(path, encoding)}), /print_font_asset_mismatch/);
});

test('a source import cannot cause private environment files to enter the deployment', async () => {
  await assert.rejects(packageCaronteEdge({read: async (path, encoding) => {
    const content = await readFile(path, encoding);
    return path.endsWith('future-book-session/index.ts') ? `${content}\nimport '../../.env.production.local';` : content;
  }}), /caronte_package_import_outside_scope/);
});
