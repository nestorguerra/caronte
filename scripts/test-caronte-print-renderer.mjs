import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFile} from 'node:fs/promises';
import {PDFDocument} from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import {createPrintRenderer, prototypeCoverDimensions} from '../supabase/functions/_shared/caronte-print.mjs';
import {printManuscript} from './fixtures/print-manuscript.mjs';
import {loadPrintFonts} from '../supabase/functions/_shared/caronte-print-fonts.mjs';

const fonts = Object.fromEntries(await Promise.all(['Regular', 'Bold', 'Italic'].map(async name =>
  [name.toLowerCase(), await readFile(`supabase/functions/future-book-session/fonts/CrimsonText-${name}.ttf`)])));
const renderer = createPrintRenderer({PDFDocument, fontkit, fonts});
const source = printManuscript();
const proofPromise = renderer(source, {proof: true});

test('actual embedded-font interior has 180-200 pages and a separate full-spread cover', async () => {
  const proof = await proofPromise;
  const interior = await PDFDocument.load(proof.interior.bytes);
  const cover = await PDFDocument.load(proof.cover.bytes);
  assert.ok(interior.getPageCount() >= 180 && interior.getPageCount() <= 200);
  assert.equal(proof.interior.pageCount, interior.getPageCount());
  assert.equal(cover.getPageCount(), 1);
  assert.deepEqual(interior.getPage(0).getSize(), {width: 419.76, height: 595.44});
  assert.ok(new TextDecoder('latin1').decode(proof.interior.bytes).includes('/FontFile2'));
  assert.ok(new TextDecoder('latin1').decode(proof.cover.bytes).includes('/FontFile2'));
  assert.equal(proof.ready_for_print, false);
  assert.equal(proof.cover.dimensions.source, 'lulu-guide-prototype');
});
test('every paragraph is retained in order, including accented characters and final markers', async () => {
  const proof = await proofPromise;
  assert.equal(proof.interior.paragraphCount, 150);
  const actual = proof.layout.pages.flatMap(page => page.lines.filter(line => line.kind === 'body').map(line => line.text)).join(' ');
  const expected = source.sections.flatMap(section => section.paragraphs).join(' ');
  assert.equal(actual.replace(/\s+/g, ' '), expected.replace(/\s+/g, ' '));
  assert.ok(actual.includes('¿qué'));
  assert.ok(actual.includes('FIN5P30'));
  for (const page of proof.layout.pages) for (const line of page.lines) {
    if (line.kind !== 'body') continue;
    const inner = page.number % 2 ? line.x : 419.76 - line.x - line.width;
    assert.ok(inner >= 72 - 0.01);
    assert.ok(line.y >= 54);
    assert.ok(line.width <= proof.layout.textWidth + 0.01);
  }
  assert.equal(proof.layout.pages.some(page => page.kind === 'notes'), false);
});
test('unsupported glyphs are rejected instead of silently disappearing', async () => {
  const bad = structuredClone(source);
  bad.sections[0].paragraphs[0] += ' 🦄';
  await assert.rejects(renderer(bad, {proof: true}), /print_font_missing_glyph/);
});
test('wrong chapter count, short source, mismatched age and unverified production cover are blocked', async () => {
  await assert.rejects(renderer({...source, sections: source.sections.slice(0, 4)}, {proof: true}), /print_five_chapters_required/);
  const short = structuredClone(source);
  short.sections.forEach(section => { section.paragraphs = ['No es un libro completo.']; });
  await assert.rejects(renderer(short, {proof: true}), /print_manuscript_word_count/);
  await assert.rejects(renderer({...source, future_age: 91}, {proof: true}), /print_age_horizon_mismatch/);
  await assert.rejects(renderer(source), /print_lulu_dimensions_required/);
});
test('prototype spine calculation is bound to the real physical page count', () => {
  const geometry = prototypeCoverDimensions(190);
  assert.equal(geometry.height, 613.44);
  assert.equal(geometry.spine, (190 / 444 + 0.06) * 72);
  assert.equal(geometry.width, 2 * 419.76 + geometry.spine + 18);
});
test('production cover callback receives the measured count, and wrong-page dimensions cannot pass', async () => {
  const proof = await proofPromise;
  const dimensions = {...prototypeCoverDimensions(proof.interior.pageCount), source: 'lulu-api', podPackageId: '0583X0827.BW.STD.PB.060UC444.MXX'};
  let received;
  const production = await renderer(source, {coverDimensions: async count => {received = count; return dimensions;}});
  assert.equal(received, proof.interior.pageCount);
  assert.equal(production.cover.dimensions.pageCount, received);
  assert.equal(production.ready_for_print, false);
  await assert.rejects(renderer(source, {coverDimensions: {...dimensions, pageCount: received + 2}}), /print_lulu_dimensions_mismatch/);
});
test('damaged bundled fonts cannot silently fall back to unembedded standard fonts', async () => {
  await assert.rejects(loadPrintFonts(async () => new Uint8Array([1, 2, 3])), /print_font_asset_mismatch/);
});
