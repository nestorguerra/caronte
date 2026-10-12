// Load node:fs first, as required by the Supabase static-file runtime.
import fs from 'node:fs';
import {PDFDocument} from 'npm:pdf-lib@1.17.1';
import fontkit from 'npm:@pdf-lib/fontkit@1.1.1';
import {createPrintRenderer,createPrintStages} from './caronte-print.mjs';
import {loadPrintFonts} from './caronte-print-fonts.mjs';

let renderer,stages,fonts;
async function printFonts() {
  if (!fonts) fonts = await loadPrintFonts(url => Deno.readFile(url));
  return fonts;
}
export async function loadPrintStages() {
  if (!stages) stages = createPrintStages({PDFDocument,fontkit,fonts:await printFonts()});
  return stages;
}
export async function renderPrintBundle(manuscript, options) {
  // Failed asset loading is not cached, and can never produce a substitute font.
  if (!renderer) {
    renderer = createPrintRenderer({PDFDocument, fontkit, fonts:await printFonts()});
  }
  return renderer(manuscript, options);
}
