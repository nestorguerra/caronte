import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFile} from 'node:fs/promises';
import {PDFDocument} from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import {createPrintWidthMeasure, wrapPrintText} from '../supabase/functions/_shared/caronte-print-wrap.mjs';
import {printManuscript} from './fixtures/print-manuscript.mjs';

// Frozen reference of the previous line breaker, not the optimized algorithm.
function reference(text, width, size, widthOf) {
  const lines = [];
  let line = '', measured = 0;
  const flush = () => {if (line) lines.push({text: line, width: widthOf(line, size)}); line = ''; measured = 0;};
  for (const word of text.normalize('NFC').replace(/\s+/gu, ' ').trim().split(' ')) {
    const wordWidth = widthOf(word, size);
    if (wordWidth > width + 0.01) throw new Error('print_unbreakable_token');
    if (line && measured + widthOf(' ', size) + wordWidth > width) flush();
    line = line ? `${line} ${word}` : word;
    measured = widthOf(line, size);
  }
  flush();
  return lines;
}

test('word-boundary layout preserves the previous Crimson Text line breaks and exact widths', async () => {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const source = printManuscript();
  const paragraphs = source.sections.flatMap(chapter => [chapter.title, ...chapter.paragraphs.slice(0, 2)]);
  paragraphs.push(...paragraphs.filter(text => text.length > 200).slice(0, 3).map(text => text.split(' ').reverse().join(' ')));
  const extra = '¿Qué elegí? Acción, café, oficina, difícil, justicia; «mañana» y alegría.\n\tEvolucio\u0301n   todavía.';
  for (const name of ['Regular', 'Bold', 'Italic']) {
    const font = await doc.embedFont(await readFile(new URL(
      `../supabase/functions/future-book-session/fonts/CrimsonText-${name}.ttf`, import.meta.url)), {subset: true});
    const measure = createPrintWidthMeasure(font);
    for (const size of [12, 12.5, 13, 13.5, 14, 25, 31]) {
      for (const text of [...paragraphs, extra]) {
        assert.deepEqual(wrapPrintText(text, 311.76, size, measure), reference(text, 311.76, size, measure));
      }
    }
  }
});

test('exact boundary, floating-point accumulation and normalized whitespace retain their decisions', () => {
  const measure = (text, size) => [...text].reduce((sum, char) => sum + (char === ' ' ? 0.17 : 0.13), 0) * size;
  for (const text of ['', 'á', 'a b c d e', '  café\n\tárbol  último ', 'e\u0301 e\u0301 e\u0301']) {
    for (const size of [1, 12.5]) for (const boundary of [measure('a b', size), measure('a b c', size)]) {
      for (const offset of [-1e-10, 0, 1e-10]) {
        let expected;
        try {expected = reference(text, boundary + offset, size, measure);} catch (error) {
          assert.throws(() => wrapPrintText(text, boundary + offset, size, measure), {message: error.message});
          continue;
        }
        assert.deepEqual(wrapPrintText(text, boundary + offset, size, measure), expected);
      }
    }
  }
});

test('non-additive shaping falls back without changing the established line-break behavior', () => {
  for (const correction of [-0.6, 0.6]) {
    for (const context of ['aa bb', 'aa bb cc']) {
      const measure = (text, size) => (text.length + (text.includes(context) ? correction : 0)) * size;
      for (const text of ['aa bb cc dd ee', 'xx aa bb cc dd ee aa bb', 'aa bb aa bb']) {
        for (const width of [5, 8, 11, 14]) {
          assert.deepEqual(wrapPrintText(text, width, 1, measure), reference(text, width, 1, measure));
        }
      }
    }
  }
});

test('unbreakable words are rejected and width caches do not leak across fonts/renders', () => {
  const first = createPrintWidthMeasure({widthOfTextAtSize: text => text.length});
  const second = createPrintWidthMeasure({widthOfTextAtSize: text => text.length * 2});
  assert.equal(first('abc', 12), 36);
  assert.equal(second('abc', 12), 72);
  assert.throws(() => wrapPrintText('longword', 3, 1, first), /print_unbreakable_token/);
});

test('a render cannot retain more than 16,384 width-cache entries', () => {
  let calls = 0;
  const measure = createPrintWidthMeasure({widthOfTextAtSize: text => {calls++; return text.length;}});
  const expected = measure('old-entry', 12);
  for (let index = 0; index < 16384; index++) measure(`word-${index}`, 12);
  const before = calls;
  assert.equal(measure('old-entry', 12), expected);
  assert.equal(calls, before + 1, 'an evicted entry must be measured again, not retained indefinitely');
});

test('cache characters are bounded even with fewer entries, and oversized keys are not retained', () => {
  let calls = 0;
  const measure = createPrintWidthMeasure({widthOfTextAtSize: text => {calls++; return text.length;}});
  const oldest = 'x'.repeat(220) + '-oldest';
  const expected = measure(oldest, 12);
  for (let index = 0; index < 5000; index++) measure('x'.repeat(220) + index, 12);
  let before = calls;
  assert.equal(measure(oldest, 12), expected);
  assert.equal(calls, before + 1, 'the one-million-character budget must evict old keys');
  const oversized = 'x'.repeat(1048577);
  assert.equal(measure(oversized, 2), oversized.length * 2);
  before = calls;
  assert.equal(measure(oversized, 3), oversized.length * 3);
  assert.equal(calls, before + 1, 'a single oversized key must not occupy the cache');
});
