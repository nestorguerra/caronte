import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {test} from 'node:test';
import {PDFDocument} from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import {createPrintStages, compactPrintChapterPlan} from '../supabase/functions/_shared/caronte-print.mjs';
import {loadPrintFonts} from '../supabase/functions/_shared/caronte-print-fonts.mjs';
import {printManuscript} from './fixtures/print-manuscript.mjs';

// Synthetic prose only. Vary word order so repeated lines cannot conceal work.
const source = printManuscript();
let seed = 20261012;
for (const chapter of source.sections) for (let p = 0; p < chapter.paragraphs.length; p++) {
  const words = chapter.paragraphs[p].split(' ');
  for (let i = words.length - 1; i > 0; i--) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const j = Math.floor(seed / 2 ** 32 * (i + 1));
    [words[i], words[j]] = [words[j], words[i]];
  }
  chapter.paragraphs[p] = words.join(' ');
}
const unchanged = structuredClone(source);
const fonts = await loadPrintFonts(readFile);
const fresh = dependency => createPrintStages({PDFDocument: dependency ?? PDFDocument, fontkit, fonts});
const restore = value => JSON.parse(JSON.stringify(value));
const canonical = value => Array.isArray(value) ? `[${value.map(canonical).join(',')}]` :
  value && typeof value === 'object' ? `{${Object.keys(value).sort().map(key =>
    `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}` : JSON.stringify(value);
const reseal = receipt => {
  const copy = restore(receipt); delete copy.sha256;
  return {...copy, sha256: createHash('sha256').update(canonical(copy)).digest('hex')};
};
const printError = error => error instanceof Error && /^print_/.test(error.message);
const assertAPI = stages => {
  assert.equal(typeof stages.planChapterSlice, 'function', 'bounded chapter planning must exist');
  assert.equal(typeof stages.finishChapterSlices, 'function', 'durable slices must assemble without reflow');
};

async function slices(chapterIndex, mode, {size = 12, maxParagraphs = 4, maxCharacters = 8000} = {}) {
  const records = []; let previous = null;
  do {
    const receipt = await fresh().planChapterSlice(source, chapterIndex,
      {size, mode, previous, maxParagraphs, maxCharacters});
    assert.ok(records.length < source.sections[chapterIndex].paragraphs.length, 'each slice must advance');
    assert.equal(receipt.format, 'chapter-slice-v1');
    assert.equal(receipt.startParagraph, previous?.endParagraph ?? 0);
    assert.equal(receipt.previousSha256, previous?.sha256 ?? null);
    assert.ok(receipt.endParagraph > receipt.startParagraph);
    assert.ok(receipt.endParagraph - receipt.startParagraph <= maxParagraphs);
    const interval = source.sections[chapterIndex].paragraphs.slice(receipt.startParagraph, receipt.endParagraph);
    assert.ok(interval.reduce((total, paragraph) => total + paragraph.length, 0) <= maxCharacters);
    records.push(restore(receipt)); previous = restore(receipt);
  } while (!previous.done);
  assert.equal(previous.endParagraph, source.sections[chapterIndex].paragraphs.length);
  return records;
}

function measuredPDF(work) {
  // Instrument only the public API; retain actual pdf-lib/fontkit objects.
  return {load: PDFDocument.load.bind(PDFDocument), async create(...args) {
    const doc = await PDFDocument.create(...args), embed = doc.embedFont.bind(doc);
    doc.embedFont = async (...fontArgs) => {
      const font = await embed(...fontArgs), width = font.widthOfTextAtSize.bind(font);
      font.widthOfTextAtSize = (text, size) => {
        work.calls++; work.characters += text.length; return width(text, size);
      };
      return font;
    };
    return doc;
  }};
}

test('independent geometry slices preserve every line, widow decision, recto and binding blank', async () => {
  assertAPI(fresh());
  const plans = [];
  for (let chapter = 0; chapter < 5; chapter++) for (const size of [12, 12.5, 13, 13.5, 14]) {
    plans.push(await fresh().planChapter(source, chapter, {size}));
  }
  const options = {proof: true, createdAt: '2026-10-12T00:00:00.000Z'};
  const original = await fresh().composeLayout(source, plans, options);
  assert.equal(original.layout.pages.length, 194);
  const geometryPlans = [];
  for (let chapter = 0; chapter < 5; chapter++) {
    const chain = await slices(chapter, 'geometry', {size: original.layout.size});
    const assembled = await fresh().finishChapterSlices(source, chapter, chain,
      {size: original.layout.size, compact: false});
    const reference = plans.find(plan => plan.chapterIndex === chapter && plan.candidates[0].size === original.layout.size);
    assert.deepEqual(assembled, reference, 'receipt hash includes unchanged text, widths, positions and blanks');
    geometryPlans.push(assembled);
  }
  const compact = await Promise.all(plans.map(compactPrintChapterPlan));
  const work = {calls: 0, characters: 0};
  const composed = await fresh(measuredPDF(work)).composeLayout(source, compact, {...options, geometryPlans});
  assert.deepEqual(composed, original);
  assert.equal(work.calls, 0, 'selected geometry must not trigger whole-book font measurement');
  assert.deepEqual(source, unchanged);
});

test('count slices retain no prose and finish with the exact existing compact receipt hash', async () => {
  assertAPI(fresh());
  const records = await slices(0, 'counts');
  for (const receipt of records) {
    assert.equal(receipt.pages, undefined);
    assert.ok(JSON.stringify(receipt).length < 2000, 'count receipts must stay bounded');
    assert.equal(receipt.totalParagraphs, 30);
  }
  const assembled = await fresh().finishChapterSlices(source, 0, records, {size: 12, compact: true});
  const reference = await fresh().planChapter(source, 0, {size: 12, compact: true});
  assert.deepEqual(assembled, reference);
});

test('durable slices reject tampering, omitted intervals and resealed cross-chapter chains', async () => {
  assertAPI(fresh());
  const records = await slices(0, 'geometry');
  const corrupt = restore(records); corrupt[1].state.y += 1;
  await assert.rejects(fresh().finishChapterSlices(source, 0, corrupt, {size: 12, compact: false}), printError);
  await assert.rejects(fresh().finishChapterSlices(source, 0, [...records.slice(0, 1), ...records.slice(2)],
    {size: 12, compact: false}), printError);
  const gap = restore(records); gap[1] = reseal({...gap[1], startParagraph: gap[1].startParagraph + 1});
  await assert.rejects(fresh().finishChapterSlices(source, 0, gap, {size: 12, compact: false}), printError);
  const otherChapter = reseal({...records[0], chapterIndex: 1});
  await assert.rejects(fresh().planChapterSlice(source, 0,
    {size: 12, mode: 'geometry', previous: otherChapter, maxParagraphs: 4, maxCharacters: 8000}), printError);
  const wrongPredecessor = restore(records); wrongPredecessor[1] = reseal({...wrongPredecessor[1], previousSha256: '0'.repeat(64)});
  await assert.rejects(fresh().finishChapterSlices(source, 0, wrongPredecessor,
    {size: 12, compact: false}), printError);
});

test('a single count slice measures only its bounded interval, even after a persisted cursor', async t => {
  assertAPI(fresh());
  let previous = null;
  for (let interval = 0; interval < 2; interval++) {
    const work = {calls: 0, characters: 0};
    const receipt = await fresh(measuredPDF(work)).planChapterSlice(source, 0,
      {size: 12, mode: 'counts', previous, maxParagraphs: 2, maxCharacters: 5000});
    assert.equal(receipt.startParagraph, interval * 2);
    assert.equal(receipt.endParagraph, (interval + 1) * 2);
    assert.equal(receipt.done, false);
    const characters = source.sections[0].paragraphs.slice(receipt.startParagraph, receipt.endParagraph)
      .reduce((count, paragraph) => count + paragraph.length, 0);
    assert.ok(work.calls > 0, 'real font API must actually be exercised');
    assert.ok(work.characters <= characters * 4 + 2000,
      `a ${characters}-character interval measured ${work.characters} characters`);
    t.diagnostic(JSON.stringify({interval, characters, measuredCharacters: work.characters, widthCalls: work.calls}));
    previous = restore(receipt);
  }
  await assert.rejects(fresh().planChapterSlice(source, 0,
    {size: 12, mode: 'counts', maxParagraphs: 25, maxCharacters: 16000}), printError);
  await assert.rejects(fresh().planChapterSlice(source, 0,
    {size: 12, mode: 'counts', maxParagraphs: 24, maxCharacters: 16001}), printError);
});

test('an indivisible paragraph over the character budget rejects instead of truncating or skipping', async () => {
  assertAPI(fresh());
  assert.ok(source.sections[0].paragraphs[0].length > 1600);
  await assert.rejects(fresh().planChapterSlice(source, 0,
    {size: 12, mode: 'geometry', previous: null, maxParagraphs: 24, maxCharacters: 1600}),
  {message: 'print_slice_paragraph_limit'});
  assert.deepEqual(source, unchanged);
});
