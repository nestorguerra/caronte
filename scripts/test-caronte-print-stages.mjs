import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {test} from 'node:test';
import {PDFDocument} from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import {createPrintStages, prototypeCoverDimensions} from '../supabase/functions/_shared/caronte-print.mjs';
import {loadPrintFonts} from '../supabase/functions/_shared/caronte-print-fonts.mjs';
import {printManuscript} from './fixtures/print-manuscript.mjs';

const fonts = await loadPrintFonts(readFile);
const fresh = () => createPrintStages({PDFDocument, fontkit, fonts});
const source = printManuscript();
let seed = 20261012;
for (const chapter of source.sections) for (let p = 0; p < chapter.paragraphs.length; p++) {
  const words = chapter.paragraphs[p].split(' ');
  for (let i = words.length - 1; i > 0; i--) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const j = Math.floor((seed / 2 ** 32) * (i + 1));
    [words[i], words[j]] = [words[j], words[i]];
  }
  chapter.paragraphs[p] = words.join(' ');
}
const original = structuredClone(source);
const restore = value => JSON.parse(JSON.stringify(value));
const chaptersPromise = (async () => {
  const records = [];
  for (let index = 0; index < 5; index++) for (const size of [12,12.5,13,13.5,14]) {
    records.push(restore(await fresh().planChapter(source, index, {size})));
  }
  return records;
})();
const manifestPromise = chaptersPromise.then(chapters => fresh().composeLayout(source, chapters, {proof: true}));
const partsPromise = manifestPromise.then(async manifest => {
  const parts = [];
  for (let firstPage = 1; firstPage <= manifest.layout.pages.length; firstPage += 10) {
    const part = await fresh().renderInteriorPart(source, restore(manifest),
      {firstPage, lastPage: Math.min(firstPage + 9, manifest.layout.pages.length)});
    // Simulate process loss: retain only JSON receipt and exact binary bytes.
    parts.push({...restore({...part, bytes: undefined}), bytes: new Uint8Array(part.bytes)});
  }
  return parts;
});
const interiorPromise = Promise.all([manifestPromise, partsPromise]).then(([manifest, parts]) =>
  fresh().mergeInterior(source, restore(manifest), parts));

test('independent chapter-size plans reconstruct the exact previous 194-page layout', async () => {
  const manifest = await manifestPromise;
  assert.equal(manifest.layout.pages.length, 194);
  assert.equal(manifest.wordCount, 48300);
  assert.equal(manifest.layout.paragraphCount, 150);
  assert.equal(createHash('sha256').update(JSON.stringify(manifest.layout)).digest('hex'),
    '7f3e02233706bf3f1d67b8232c22d8f2bd8ec77ba60f190ab347bb4ab57c391c');
  const actual = manifest.layout.pages.flatMap(page => page.lines.filter(line => line.kind === 'body')
    .map(line => line.text)).join(' ');
  assert.equal(actual, source.sections.flatMap(chapter => chapter.paragraphs).join(' '));
  assert.deepEqual(source, original);
});

test('planning rejects missing, duplicate, stale and corrupt chapter receipts', async () => {
  const chapters = await chaptersPromise;
  await assert.rejects(fresh().composeLayout(source, chapters.slice(0, 4)), /print_chapter_plans_required/);
  await assert.rejects(fresh().composeLayout(source, [chapters[0], ...chapters.slice(0, 4)]), /print_chapter_plans_required/);
  const stale = restore(chapters); stale[0].sourceFingerprint = '0'.repeat(64);
  await assert.rejects(fresh().composeLayout(source, stale), /print_chapter_plan_identity/);
  const corrupt = restore(chapters); corrupt[0].candidates[0].pages[0].lines[0].text = 'Changed chapter';
  await assert.rejects(fresh().composeLayout(source, corrupt), /print_chapter_plan_corrupt/);
});

test('twenty-five independent single-size plans require a complete non-duplicated matrix', async () => {
  const plans = await chaptersPromise;
  for (const [index, plan] of plans.entries()) {
    assert.equal(plan.candidates.length, 1);
    assert.equal(plan.chapterIndex, Math.floor(index / 5));
    assert.equal(plan.candidates[0].size, [12,12.5,13,13.5,14][index % 5]);
  }
  const manifest = await fresh().composeLayout(source, plans, {proof: true});
  assert.deepEqual(manifest.layout, (await manifestPromise).layout);
  await assert.rejects(fresh().composeLayout(source, plans.slice(1)), /print_chapter_plans_required/);
  await assert.rejects(fresh().composeLayout(source, [...plans, plans[0]]), /print_chapter_plans_required/);
  await assert.rejects(fresh().composeLayout(source, [plans[0], ...plans.slice(0, -1)]), /print_chapter_plans_required/);
  await assert.rejects(fresh().planChapter(source, 0, {size: 11}), /print_chapter_plan_scope/);
});

test('planning never defaults silently to all five sizes in one request', async () => {
  await assert.rejects(fresh().planChapter(source, 0), /print_chapter_plan_scope/);
});

test('compact plans retain only bounded geometry and reconstruct the identical body layout', async () => {
  const plans=[];
  for(let chapter=0;chapter<5;chapter++)for(const size of [12,12.5,13,13.5,14]){
    const plan=await fresh().planChapter(source,chapter,{size,compact:true});
    assert.ok(JSON.stringify(plan).length<1500,'a plan must not duplicate the chapter prose');
    assert.equal(plan.candidates[0].pages,undefined);
    assert.ok(Number.isSafeInteger(plan.candidates[0].pageCount));
    plans.push(plan);
  }
  const result=await fresh().composeLayout(source,plans,{proof:true,createdAt:(await manifestPromise).createdAt});
  assert.deepEqual(result.layout,(await manifestPromise).layout);
  assert.equal(result.layoutHash,(await manifestPromise).layoutHash);
});

test('JSON object order may change on persistence without changing source or plan identity', async () => {
  const reorder = value => Array.isArray(value) ? value.map(reorder) : value && typeof value === 'object'
    ? Object.fromEntries(Object.entries(value).reverse().map(([key, item]) => [key, reorder(item)])) : value;
  const chapters = await chaptersPromise;
  const originalManifest = await manifestPromise;
  const recovered = await fresh().composeLayout(reorder(source), reorder([...chapters].reverse()), {proof: true});
  assert.equal(recovered.sourceFingerprint, originalManifest.sourceFingerprint);
  assert.equal(recovered.layoutHash, originalManifest.layoutHash);
  assert.deepEqual(recovered.layout, originalManifest.layout);
});

test('part work is bounded and cannot use a changed manuscript or corrupt manifest', async () => {
  const manifest = await manifestPromise;
  for (const range of [{firstPage: 0, lastPage: 9}, {firstPage: 1, lastPage: 11}, {firstPage: 1, lastPage: 3},
    {firstPage: 2, lastPage: 10},
    {firstPage: 194, lastPage: 195}, {firstPage: 10, lastPage: 9}]) {
    await assert.rejects(fresh().renderInteriorPart(source, manifest, range), /print_part_scope/);
  }
  const changed = structuredClone(source); changed.sections[0].paragraphs[0] += ' Cambio.';
  await assert.rejects(fresh().renderInteriorPart(changed, manifest, {firstPage: 1, lastPage: 10}), /print_layout_identity/);
  const corrupt = restore(manifest); corrupt.layout.pages[4].lines[0].y = 900;
  await assert.rejects(fresh().renderInteriorPart(source, corrupt, {firstPage: 1, lastPage: 10}), /print_layout_manifest_corrupt/);
});

test('restored bounded parts merge to a real A5 PDF with embedded fonts, never print-ready', async () => {
  const interior = await interiorPromise;
  const doc = await PDFDocument.load(interior.bytes);
  assert.equal(doc.getPageCount(), 194);
  for (const page of doc.getPages()) assert.deepEqual(page.getSize(), {width: 419.76, height: 595.44});
  const raw = new TextDecoder('latin1').decode(interior.bytes);
  assert.ok(raw.includes('/FontFile2'));
  assert.ok(raw.includes('/ToUnicode'));
  assert.equal(interior.sha256, createHash('sha256').update(interior.bytes).digest('hex'));
  assert.equal(interior.ready_for_print, false);
});

test('a recovered render uses the frozen job timestamp, not the clock of each attempt', async () => {
  const manifest = await fresh().composeLayout(source, await chaptersPromise,
    {proof: true, createdAt: '2026-10-12T00:00:00.000Z'});
  let attempt = 0;
  const dependency = {load: PDFDocument.load.bind(PDFDocument), async create(...args) {
    const doc = await PDFDocument.create(...args);
    const clock = new Date(attempt++ ? '2026-10-13T12:00:00Z' : '2026-10-12T12:00:00Z');
    doc.setCreationDate(clock); doc.setModificationDate(clock);
    return doc;
  }};
  const stages = () => createPrintStages({PDFDocument: dependency, fontkit, fonts});
  const first = await stages().renderInteriorPart(source, manifest, {firstPage: 11, lastPage: 20});
  const recovered = await stages().renderInteriorPart(source, restore(manifest), {firstPage: 11, lastPage: 20});
  assert.equal(first.sha256, recovered.sha256);
  assert.deepEqual(first.bytes, recovered.bytes);
  assert.equal((await PDFDocument.load(recovered.bytes)).getCreationDate().toISOString(), manifest.createdAt);
});

test('merge rejects missing, overlapping, foreign and byte-corrupted parts', async () => {
  const [manifest, parts] = await Promise.all([manifestPromise, partsPromise]);
  await assert.rejects(fresh().mergeInterior(source, manifest, parts.slice(1)), /print_parts_incomplete/);
  await assert.rejects(fresh().mergeInterior(source, manifest, [parts[0], ...parts]), /print_parts_incomplete/);
  const foreign = parts.map(part => ({...part})); foreign[1].sourceFingerprint = '0'.repeat(64);
  await assert.rejects(fresh().mergeInterior(source, manifest, foreign), /print_part_identity/);
  const corrupt = parts.map(part => ({...part})); corrupt[1].bytes = new Uint8Array(corrupt[1].bytes);
  corrupt[1].bytes[15] ^= 1;
  await assert.rejects(fresh().mergeInterior(source, manifest, corrupt), /print_part_corrupt/);
});

test('merge rejects oversized aggregate data before hashing or parsing all parts', async () => {
  const [manifest, parts] = await Promise.all([manifestPromise, partsPromise]);
  const large = new Uint8Array(1_050_000);
  await assert.rejects(fresh().mergeInterior(source, manifest,
    parts.map(part => ({...part, bytes: large, byteSize: large.length}))), /print_parts_size/);
});

test('malformed but checksum-matched PDF bytes yield a stable code, not parser details', async () => {
  const [manifest, parts] = await Promise.all([manifestPromise, partsPromise]);
  const data = new TextEncoder().encode('PRIVATE_SYNTHETIC_MARKER_WITHOUT_PDF_HEADER');
  const invalid = parts.map(part => ({...part}));
  invalid[0] = {...invalid[0], bytes: data, byteSize: data.length,
    sha256: createHash('sha256').update(data).digest('hex')};
  await assert.rejects(fresh().mergeInterior(source, manifest, invalid), {message: 'print_part_corrupt'});
});

test('cover receives reopened physical count and remains separate and bound to the merged interior', async () => {
  const [manifest, interior] = await Promise.all([manifestPromise, interiorPromise]);
  const productionManifest = await fresh().composeLayout(source, await chaptersPromise);
  const first = await fresh().renderInteriorPart(source, productionManifest, {firstPage: 1, lastPage: 10});
  const productionParts = [first, ...(await partsPromise).slice(1).map(part => ({...part, proof: false}))];
  // The proof and production manifest share body layout, but identity includes
  // the notice: a proof part cannot simply be relabeled for production.
  await assert.rejects(fresh().mergeInterior(source, productionManifest, productionParts), /print_part_identity/);
  let received;
  const dimensions = count => ({...prototypeCoverDimensions(count), source: 'lulu-api',
    podPackageId: '0583X0827.BW.STD.PB.060UC444.MXX', pageCount: count});
  const cover = await fresh().renderCover(source, manifest, interior, {coverDimensions: async count => {
    received = count; return dimensions(count);
  }});
  assert.equal(received, 194);
  assert.equal((await PDFDocument.load(cover.bytes)).getPageCount(), 1);
  assert.equal(cover.dimensions.pageCount, 194);
  assert.equal(cover.ready_for_print, false);
  await assert.rejects(fresh().renderCover(source, manifest, {...interior, pageCount: 190}), /print_interior_identity/);
});

test('chapter planning preserves original age, word count and unsupported-glyph gates', async () => {
  await assert.rejects(fresh().planChapter({...source, future_age: 91}, 0, {size: 12}), /print_age_horizon_mismatch/);
  await assert.rejects(fresh().planChapter(source, 5, {size: 12}), /print_chapter_plan_scope/);
  const unsupported = structuredClone(source); unsupported.sections[4].paragraphs[0] += ' 🦄';
  await assert.rejects(fresh().planChapter(unsupported, 0, {size: 12}), /print_font_missing_glyph/);
});
