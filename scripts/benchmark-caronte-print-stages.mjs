// Cold-process synthetic QA. This is not a deployed scheduler or a Lulu call.
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {isAbsolute, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {PDFDocument} from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import {createPrintStages} from '../supabase/functions/_shared/caronte-print.mjs';
import {loadPrintFonts} from '../supabase/functions/_shared/caronte-print-fonts.mjs';
import {printManuscript} from './fixtures/print-manuscript.mjs';

const args = process.argv.slice(2);
const folderArg = args.find(arg => arg.startsWith('--output-dir='));
const stepArg = args.find(arg => arg.startsWith('--step='));
if (!folderArg || args.some(arg => !arg.startsWith('--output-dir=') && !arg.startsWith('--step=')) ||
    args.filter(arg => arg.startsWith('--output-dir=')).length !== 1 ||
    args.filter(arg => arg.startsWith('--step=')).length > 1) throw new Error('print_stage_benchmark_arguments');
const folder = folderArg.slice('--output-dir='.length), step = stepArg?.slice('--step='.length);
if (!isAbsolute(folder)) throw new Error('print_stage_benchmark_directory');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const readJson = async name => JSON.parse(await readFile(join(folder, name), 'utf8'));
const writeJson = (name, value) => writeFile(join(folder, name), JSON.stringify(value), {flag: 'wx'});

if (!step) {
  const source = printManuscript(); let seed = 20261012;
  for (const chapter of source.sections) for (let p = 0; p < chapter.paragraphs.length; p++) {
    const words = chapter.paragraphs[p].split(' ');
    for (let i = words.length - 1; i > 0; i--) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      const j = Math.floor((seed / 2 ** 32) * (i + 1));
      [words[i], words[j]] = [words[j], words[i]];
    }
    chapter.paragraphs[p] = words.join(' ');
  }
  await mkdir(folder, {recursive: true});
  const summaries = [];
  for (let sample = 1; sample <= 3; sample++) {
    const sampleFolder = join(folder, `sample-${sample}`);
    await mkdir(sampleFolder, {recursive: true});
    await writeFile(join(sampleFolder, 'caronte-prueba-tecnica-fuente.json'), JSON.stringify(source), {flag: 'wx'});
    const measurements = [];
    const run = name => {
      const result = spawnSync(process.execPath, [fileURLToPath(import.meta.url),
        `--output-dir=${sampleFolder}`, `--step=${name}`], {encoding: 'utf8'});
      if (result.status !== 0) throw new Error(`print_stage_benchmark_failed:${name}:${result.stderr.slice(-1000)}`);
      const measurement = JSON.parse(result.stdout); measurements.push(measurement);
      console.log(JSON.stringify({sample, ...measurement}));
    };
    for (let index = 0; index < 5; index++) for (const size of [12,12.5,13,13.5,14]) run(`plan-${index}-${size}`);
    run('compose');
    const manifest = JSON.parse(await readFile(join(sampleFolder, 'layout.json'), 'utf8'));
    for (let index = 0; index < Math.ceil(manifest.layout.pages.length / 10); index++) run(`part-${index}`);
    run('merge'); run('cover');
    const summary = {sample, fixtureOnly: true, externalRequests: 0, pages: manifest.layout.pages.length,
      steps: measurements.length, maximumCpuMs: Math.max(...measurements.map(value => value.cpuMs)),
      maximumRssMiB: Math.max(...measurements.map(value => value.maxRssMiB)),
      totalCpuMs: measurements.reduce((sum, value) => sum + value.cpuMs, 0), readyForPrint: false};
    summaries.push(summary);
    await writeFile(join(sampleFolder, 'measurements.json'), JSON.stringify({measurements, summary}), {flag: 'wx'});
    console.log(JSON.stringify({summary}));
  }
  await writeFile(join(folder, 'summary.json'), JSON.stringify(summaries), {flag: 'wx'});
} else {
  if (!/^(plan-[0-4]-(?:12(?:\.5)?|13(?:\.5)?|14)|compose|part-(?:[0-9]|1[0-9])|merge|cover)$/.test(step)) throw new Error('print_stage_benchmark_step');
  // Imports excluded. Source/receipt JSON reads, font hashes and output writes
  // included. Each invocation gets a fresh process, PDF objects and font caches.
  const cpuStart = process.cpuUsage(), wallStart = performance.now();
  const source = await readJson('caronte-prueba-tecnica-fuente.json');
  const fonts = await loadPrintFonts(readFile), stages = createPrintStages({PDFDocument, fontkit, fonts});
  if (step.startsWith('plan-')) {
    const [, index, size] = step.split('-').map(value => Number(value));
    await writeJson(`chapter-${index}-${size}.json`, await stages.planChapter(source, index, {size}));
  } else if (step === 'compose') {
    const plans = await Promise.all(Array.from({length: 5}, (_, index) =>
      [12,12.5,13,13.5,14].map(size => readJson(`chapter-${index}-${size}.json`))).flat());
    await writeJson('layout.json', await stages.composeLayout(source, plans,
      {proof: true, createdAt: '2026-10-12T00:00:00.000Z'}));
  } else {
    const manifest = await readJson('layout.json');
    if (step.startsWith('part-')) {
      const index = Number(step.slice(5)), firstPage = index * 10 + 1;
      const part = await stages.renderInteriorPart(source, manifest,
        {firstPage, lastPage: Math.min(firstPage + 9, manifest.layout.pages.length)});
      const receipt = {...part}; delete receipt.bytes;
      // Intent before object; exact bytes reread before completion. These files
      // are local QA receipts, not a substitute for a leased database worker.
      await writeJson(`part-${index}-intent.json`, receipt);
      await writeFile(join(folder, `part-${index}.pdf`), part.bytes, {flag: 'wx'});
      if (sha(await readFile(join(folder, `part-${index}.pdf`))) !== receipt.sha256) throw new Error('print_stage_file_unverified');
      await writeJson(`part-${index}.json`, receipt);
    } else if (step === 'merge') {
      const parts = await Promise.all(Array.from({length: Math.ceil(manifest.layout.pages.length / 10)}, async (_, index) =>
        ({...await readJson(`part-${index}.json`), bytes: new Uint8Array(await readFile(join(folder, `part-${index}.pdf`)))})));
      const interior = await stages.mergeInterior(source, manifest, parts), receipt = {...interior}; delete receipt.bytes;
      await writeJson('interior-intent.json', receipt);
      await writeFile(join(folder, 'caronte-prueba-tecnica-interior.pdf'), interior.bytes, {flag: 'wx'});
      if (sha(await readFile(join(folder, 'caronte-prueba-tecnica-interior.pdf'))) !== receipt.sha256) throw new Error('print_stage_file_unverified');
      await writeJson('interior.json', receipt);
    } else {
      const interior = {...await readJson('interior.json'), bytes: new Uint8Array(await readFile(join(folder, 'caronte-prueba-tecnica-interior.pdf')))};
      const cover = await stages.renderCover(source, manifest, interior), receipt = {...cover}; delete receipt.bytes;
      await writeJson('cover-intent.json', receipt);
      await writeFile(join(folder, 'caronte-prueba-tecnica-cubierta.pdf'), cover.bytes, {flag: 'wx'});
      if (sha(await readFile(join(folder, 'caronte-prueba-tecnica-cubierta.pdf'))) !== receipt.sha256) throw new Error('print_stage_file_unverified');
      await writeJson('cover.json', receipt);
      await writeJson('caronte-prueba-tecnica-informe.json', {pageCount: interior.pageCount,
        wordCount: manifest.wordCount, paragraphCount: interior.paragraphCount,
        sourceSha256: sha(await readFile(join(folder, 'caronte-prueba-tecnica-fuente.json'))),
        interiorSha256: interior.sha256, coverSha256: cover.sha256, size: manifest.layout.size,
        leading: manifest.layout.leading, margins: manifest.layout.margins,
        chapterStarts: manifest.layout.chapterStarts, coverDimensions: cover.dimensions,
        proof: true, ready_for_print: false, pending: ['human_editorial_review','lulu_interior_preflight','lulu_cover_preflight']});
    }
  }
  const cpu = process.cpuUsage(cpuStart);
  console.log(JSON.stringify({step, fixtureOnly: true, externalRequests: 0,
    cpuMs: Math.round((cpu.user + cpu.system) / 1000), wallMs: Math.round(performance.now() - wallStart),
    maxRssMiB: Math.round(process.resourceUsage().maxRSS / 1024)}));
}
