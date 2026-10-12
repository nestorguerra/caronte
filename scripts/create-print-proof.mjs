import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {isAbsolute, join} from 'node:path';
import {PDFDocument} from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import {createPrintRenderer} from '../supabase/functions/_shared/caronte-print.mjs';
import {loadPrintFonts} from '../supabase/functions/_shared/caronte-print-fonts.mjs';
import {printManuscript} from './fixtures/print-manuscript.mjs';

const source = printManuscript();
const args = process.argv.slice(2);
if (args.some(arg => arg !== '--fixture=varied' && !arg.startsWith('--output-dir=')) ||
    args.filter(arg => arg.startsWith('--output-dir=')).length > 1 ||
    args.filter(arg => arg === '--fixture=varied').length > 1) throw new Error('print_proof_arguments');
const requestedFolder = args.find(arg => arg.startsWith('--output-dir='))?.slice('--output-dir='.length);
if (requestedFolder !== undefined && (!requestedFolder || !isAbsolute(requestedFolder))) throw new Error('print_proof_output_directory');
const folder = requestedFolder || 'output/pdf';
if (args.includes('--fixture=varied')) {
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
}
const fonts = await loadPrintFonts(readFile);
const render = createPrintRenderer({PDFDocument, fontkit, fonts});
const start = performance.now();
const proof = await render(source, {proof: true});
await mkdir(folder, {recursive: true});
await writeFile(join(folder, 'caronte-prueba-tecnica-interior.pdf'), proof.interior.bytes);
await writeFile(join(folder, 'caronte-prueba-tecnica-cubierta.pdf'), proof.cover.bytes);
// Private verification artifacts. None are included in the frontend build.
await writeFile(join(folder, 'caronte-prueba-tecnica-fuente.json'), JSON.stringify(source));
await writeFile(join(folder, 'caronte-prueba-tecnica-informe.json'), JSON.stringify({
  pageCount: proof.interior.pageCount, wordCount: proof.wordCount,
  paragraphCount: proof.interior.paragraphCount, sourceSha256: proof.sourceSha256,
  interiorSha256: proof.interior.sha256, coverSha256: proof.cover.sha256,
  size: proof.layout.size, leading: proof.layout.leading, margins: proof.layout.margins,
  chapterStarts: proof.layout.chapterStarts, coverDimensions: proof.cover.dimensions,
  proof: true, ready_for_print: false, pending: proof.pending,
  fixture: args.includes('--fixture=varied') ? 'varied-lines' : 'repeated-lines',
  durationMs: Math.round(performance.now() - start)
}, null, 2));
console.log(JSON.stringify({pageCount: proof.interior.pageCount, wordCount: proof.wordCount,
  interiorBytes: proof.interior.byteSize, coverBytes: proof.cover.byteSize,
  fontSize: proof.layout.size, readyForPrint: false,
  durationMs: Math.round(performance.now() - start)}));
