import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {PDFDocument} from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import {createPrintRenderer} from '../supabase/functions/_shared/caronte-print.mjs';
import {printManuscript} from './fixtures/print-manuscript.mjs';

// This is deliberately non-literary QA text, not an interview or a customer's
// book. Permuting each paragraph preserves its vocabulary, words and characters
// but prevents repeated prose from concealing prefix-measurement work in a cache.
function variedManuscript() {
  const source = structuredClone(printManuscript());
  let seed = 20261012;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 2 ** 32;
  };
  for (const chapter of source.sections) for (let p = 0; p < chapter.paragraphs.length; p++) {
    const words = chapter.paragraphs[p].split(' ');
    for (let i = words.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [words[i], words[j]] = [words[j], words[i]];
    }
    chapter.paragraphs[p] = words.join(' ');
  }
  return source;
}

function instrumentFontMeasurements(work) {
  // Only wrap the public dependency boundary. Fonts and PDF documents remain
  // real pdf-lib/fontkit objects; private embedder state is never replaced.
  return {
    async create(...args) {
      const doc = await PDFDocument.create(...args);
      const embedFont = doc.embedFont.bind(doc);
      doc.embedFont = async (...fontArgs) => {
        const font = await embedFont(...fontArgs);
        const widthOfTextAtSize = font.widthOfTextAtSize.bind(font);
        font.widthOfTextAtSize = (text, size) => {
          work.calls++;
          work.characters += text.length;
          return widthOfTextAtSize(text, size);
        };
        return font;
      };
      return doc;
    },
    load: PDFDocument.load.bind(PDFDocument)
  };
}

test('full-length varied prose retains all text without excessive font measurement work', async t => {
  const source = variedManuscript();
  const before = structuredClone(source);
  const repeated = printManuscript();
  const sourceTexts = [source.title, source.subtitle,
    ...source.sections.flatMap(chapter => [chapter.title, ...chapter.paragraphs])];
  const sourceCharacters = sourceTexts.reduce((total, text) => total + text.length, 0);
  for (const [c, chapter] of source.sections.entries()) {
    for (const [p, paragraph] of chapter.paragraphs.entries()) {
      assert.deepEqual(paragraph.split(' ').sort(), repeated.sections[c].paragraphs[p].split(' ').sort());
      assert.equal(paragraph.length, repeated.sections[c].paragraphs[p].length);
    }
  }
  const fonts = Object.fromEntries(await Promise.all(['Regular', 'Bold', 'Italic'].map(async name =>
    [name.toLowerCase(), await readFile(new URL(
      `../supabase/functions/future-book-session/fonts/CrimsonText-${name}.ttf`, import.meta.url))])));
  const work = {calls: 0, characters: 0};
  const renderer = createPrintRenderer({PDFDocument: instrumentFontMeasurements(work), fontkit, fonts});
  const proof = await renderer(source, {proof: true});

  const interior = await PDFDocument.load(proof.interior.bytes);
  const cover = await PDFDocument.load(proof.cover.bytes);
  assert.ok(interior.getPageCount() >= 180 && interior.getPageCount() <= 200);
  assert.equal(proof.interior.pageCount, interior.getPageCount());
  assert.equal(cover.getPageCount(), 1);
  assert.equal(proof.wordCount, 48300);
  assert.equal(proof.interior.paragraphCount, 150);
  const actual = proof.layout.pages.flatMap(page => page.lines
    .filter(line => line.kind === 'body').map(line => line.text)).join(' ');
  const expected = source.sections.flatMap(chapter => chapter.paragraphs).join(' ');
  assert.equal(actual, expected);
  assert.deepEqual(source, before, 'rendering must not mutate the input manuscript');

  // A work bound, not a machine-speed assertion. There are five font-size
  // candidates. Measuring each word and each emitted line consumes at most
  // roughly two source-lengths per candidate, plus small headings/decorations.
  // Twelve source-lengths permit that linear word-boundary strategy and some
  // extra boundary checks; measuring every growing whole-line prefix does not.
  // Cache hits need not be counted because they do not enter the real font API.
  const characterBudget = sourceCharacters * 12;
  const layoutSha256 = createHash('sha256').update(JSON.stringify(proof.layout)).digest('hex');
  // Recorded before optimization with the original renderer. Includes every
  // line, exact measured width, font size, page, position and chapter start.
  assert.equal(layoutSha256, '7f3e02233706bf3f1d67b8232c22d8f2bd8ec77ba60f190ab347bb4ab57c391c');
  t.diagnostic(JSON.stringify({sourceCharacters, measuredCharacters: work.characters,
    measurementCalls: work.calls, characterBudget, pageCount: interior.getPageCount(), layoutSha256}));
  assert.ok(work.characters <= characterBudget,
    `font measurement work exceeded ${characterBudget} characters: ` +
    `${work.characters} characters across ${work.calls} public width calls`);
});
