// One renderer for Node verification and the server. No network or paid action.
import {countWords,resolveLiteraryContract} from './caronte-literary.mjs';
import {createPrintWidthMeasure as measure, wrapPrintText as wrap} from './caronte-print-wrap.mjs';
import {FONT_ASSETS} from './caronte-print-fonts.mjs';

export const PRINT_TEMPLATE = 'caronte-a5-embedded-v2';
export function printSizesFor(source){
  return source?.prompt_version==='caronte-literary-v3'
    ?Array.from({length:21},(_,i)=>Math.round((12+i/10)*10)/10):[12,12.5,13,13.5,14];
}
const W = 419.76, H = 595.44, INNER = 72, OUTER = 36, BOTTOM = 54;
const TEXT_WIDTH = W - INNER - OUTER;
const fail = code => { throw new Error(code); };
const normal = text => text.normalize('NFC').replace(/\s+/gu, ' ').trim();

export function prototypeCoverDimensions(pageCount) {
  if (!Number.isSafeInteger(pageCount) || !(pageCount>=180&&pageCount<=200||pageCount>=216&&pageCount<=224)) fail('print_page_count');
  const spine = (pageCount / 444 + 0.06) * 72;
  return {width: 2 * W + spine + 18, height: H + 18, spine, bleed: 9,
    pageCount, source: 'lulu-guide-prototype'};
}

function validateSource(manuscript) {
  const source = structuredClone(manuscript);
  const contract=resolveLiteraryContract(source?.prompt_version);
  if (!source || !Array.isArray(source.sections) || source.sections.length !== 5 ||
      source.sections.some(section => section.kind !== 'chapter')) fail('print_five_chapters_required');
  if (!Number.isSafeInteger(source.current_age) || source.current_age < 1 || source.current_age > 120 ||
      source.future_age !== source.current_age + contract.horizonYears) fail('print_age_horizon_mismatch');
  if (typeof source.title !== 'string' || !normal(source.title) ||
      typeof source.subtitle !== 'string' || !normal(source.subtitle)) fail('print_title_required');
  for (const chapter of source.sections) {
    if (typeof chapter.title !== 'string' || !normal(chapter.title) ||
        !Array.isArray(chapter.paragraphs) || !chapter.paragraphs.length ||
        chapter.paragraphs.some(text => typeof text !== 'string' || !normal(text))) fail('print_paragraph_required');
  }
  const words = countWords(source.sections.flatMap(chapter => chapter.paragraphs).join('\n\n'));
  if (words < contract.manuscriptWords.min || words > contract.manuscriptWords.max) fail('print_manuscript_word_count');
  return {source, words};
}

function supported(font, texts) {
  const characters = new Set(font.getCharacterSet());
  for (const text of texts) for (const char of normal(text)) {
    if (!characters.has(char.codePointAt(0))) fail('print_font_missing_glyph');
  }
}

export function createPrintRenderer({PDFDocument, fontkit, fonts}) {
  return async (manuscript, options = {}) => {
    const {source, words} = validateSource(manuscript);
    const doc = await PDFDocument.create();
    doc.registerFontkit(fontkit);
    const embedded = Object.fromEntries(await Promise.all(Object.entries(fonts).map(async ([key, bytes]) =>
      [key, await doc.embedFont(bytes, {subset: true})])));
    const allText = [source.title, source.subtitle, ...source.sections.flatMap(chapter => [chapter.title, ...chapter.paragraphs])];
    supported(embedded.regular, allText);
    supported(embedded.bold, [source.title, ...source.sections.map(chapter => chapter.title)]);
    supported(embedded.italic, [source.subtitle]);
    if (!options.proof && !options.coverDimensions) fail('print_lulu_dimensions_required');
    return renderBundle(doc, embedded, source, words, options, PDFDocument, fontkit, fonts);
  };
}

function planBook(source, size, leading, widths, chapterOffset = 0) {
  const pages = [
    {number: 1, kind: 'title', lines: []}, {number: 2, kind: 'edition', lines: []},
    {number: 3, kind: 'contents', lines: []}, {number: 4, kind: 'recto_blank', lines: []}
  ];
  const chapterStarts = [];
  let page, y, paragraphCount = 0;
  const newPage = kind => {
    page = {number: pages.length + 1, kind, lines: []};
    pages.push(page); y = H - 72;
  };
  const add = (line, kind, font, fontSize) => {
    if (line.width > TEXT_WIDTH + 0.01) fail('print_line_overflow');
    page.lines.push({...line, x: page.number % 2 ? INNER : OUTER, y, kind, font, size: fontSize});
  };
  for (const [chapterIndex, chapter] of source.sections.entries()) {
    if (pages.length % 2) newPage('recto_blank');
    newPage('chapter');
    chapterStarts.push({title: chapter.title, page: page.number});
    y = H - 104;
    const label = `CAPÍTULO ${chapterIndex + chapterOffset + 1}`;
    add({text: label, width: widths.regular(label, 10)}, 'heading', 'regular', 10);
    y -= 40;
    const titleLines = wrap(chapter.title, TEXT_WIDTH, 25, widths.bold);
    if (titleLines.length > 4) fail('print_heading_too_long');
    for (const line of titleLines) { add(line, 'heading', 'bold', 25); y -= 31; }
    y -= 26;
    for (const paragraph of chapter.paragraphs) {
      paragraphCount++;
      const lines = wrap(paragraph, TEXT_WIDTH, size, widths.regular);
      let index = 0;
      while (index < lines.length) {
        let capacity = Math.floor((y - BOTTOM) / leading) + 1;
        const remaining = lines.length - index;
        if (capacity < Math.min(2, remaining)) { newPage('body'); continue; }
        let take = Math.min(capacity, remaining);
        if (remaining > take && remaining - take === 1 && take > 2) take--;
        for (let n = 0; n < take; n++) { add(lines[index++], 'body', 'regular', size); y -= leading; }
        if (index < lines.length) newPage('body');
      }
      y -= leading * 0.35;
    }
  }
  if (pages.length % 2) newPage('binding_blank');
  return {pages, chapterStarts, paragraphCount, textWidth: TEXT_WIDTH, size, leading,
    margins: {inside: INNER, outside: OUTER, bottom: BOTTOM}, mirroredMargins: true};
}

function chooseLayout(source, fonts) {
  const pages=resolveLiteraryContract(source.prompt_version).physicalPages;
  const widths = Object.fromEntries(Object.entries(fonts).map(([key, font]) => [key, measure(font)]));
  const candidates = [];
  for (const size of printSizesFor(source)) {
    const layout = planBook(source, size, size * 1.4, widths);
    if (layout.pages.length >= pages.min && layout.pages.length <= pages.max) candidates.push(layout);
  }
  if (!candidates.length) fail('print_pagination_needs_revision');
  const target=pages.target??(pages.min+pages.max)/2;
  return candidates.sort((a, b) => Math.abs(a.pages.length - target) - Math.abs(b.pages.length - target))[0];
}

function drawWrapped(page, text, font, size, x, top, width, leading, color) {
  const lines = wrap(text, width, size, measure(font));
  for (const [index, line] of lines.entries()) {
    page.drawText(line.text, {x, y: top - index * leading, font, size, ...(color ? {color} : {})});
  }
  return top - lines.length * leading;
}

function decorateFrontMatter(doc, fonts, source, layout, proof) {
  const title = doc.getPage(0), edition = doc.getPage(1), contents = doc.getPage(2);
  drawWrapped(title, 'CARONTE', fonts.regular, 12, INNER, H - 100, TEXT_WIDTH, 17);
  const titleBottom = drawWrapped(title, source.title, fonts.bold, 28, INNER, H - 210, TEXT_WIDTH, 34);
  if (titleBottom < 220) fail('print_title_too_long');
  drawWrapped(title, source.subtitle, fonts.italic, 13, INNER, titleBottom - 30, TEXT_WIDTH, 18);
  drawWrapped(title, `De mis ${source.future_age} años a mis ${source.current_age}.`, fonts.regular, 12, INNER, 100, TEXT_WIDTH, 17);
  const notice = proof ? 'PRUEBA TÉCNICA - TEXTO SINTÉTICO. No es un libro de cliente ni una obra generada por el modelo.' :
    'Ficción futura basada en una entrevista personal. No es una predicción ni una garantía sobre hechos futuros.';
  drawWrapped(edition, notice, fonts.regular, 11, OUTER, H - 110, TEXT_WIDTH, 16);
  drawWrapped(edition, 'Caronte. Edición privada. Composición en Crimson Text, con licencia SIL Open Font License.', fonts.regular, 10, OUTER, 125, TEXT_WIDTH, 15);
  drawWrapped(contents, 'Índice', fonts.bold, 24, INNER, H - 100, TEXT_WIDTH, 30);
  let top = H - 170;
  for (const chapter of layout.chapterStarts) {
    top = drawWrapped(contents, `${chapter.title} · ${chapter.page}`, fonts.regular, 13, INNER, top, TEXT_WIDTH, 19) - 15;
    if (top < 72) fail('print_contents_overflow');
  }
}

function decoratePlanPage(page, fonts, plan) {
  for (const line of plan.lines) page.drawText(line.text, {x: line.x, y: line.y, size: line.size, font: fonts[line.font]});
  if (['body', 'chapter'].includes(plan.kind)) {
    const number = String(plan.number), width = fonts.regular.widthOfTextAtSize(number, 10);
    page.drawText(number, {x: (W - width) / 2, y: 39, font: fonts.regular, size: 10});
  }
}

function decorateInterior(doc, fonts, source, layout, proof) {
  decorateFrontMatter(doc, fonts, source, layout, proof);
  for (const plan of layout.pages) decoratePlanPage(doc.getPage(plan.number - 1), fonts, plan);
}

function coverGeometry(value, pageCount, proof) {
  if (!value && proof) return prototypeCoverDimensions(pageCount);
  if (!value || value.source !== 'lulu-api' || value.pageCount !== pageCount ||
      !value.podPackageId || !Number.isFinite(value.width) || !Number.isFinite(value.height) ||
      Math.abs(value.height - (H + 18)) > 0.5) fail('print_lulu_dimensions_mismatch');
  const spine = value.width - W * 2 - 18;
  if (spine < 20 || spine > 70) fail('print_lulu_spine_dimensions');
  return {...value, spine, bleed: 9};
}

async function renderCover(source, geometry, proof, PDFDocument, fontkit, fontBytes, createdAt) {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const regular = await doc.embedFont(fontBytes.regular, {subset: true});
  const bold = await doc.embedFont(fontBytes.bold, {subset: true});
  const page = doc.addPage([geometry.width, geometry.height]);
  page.setTrimBox(9, 9, geometry.width - 18, geometry.height - 18);
  page.setBleedBox(0, 0, geometry.width, geometry.height);
  const white = {type: 'Grayscale', gray: 0.96};
  page.drawRectangle({x: 0, y: 0, width: geometry.width, height: geometry.height,
    color: {type: 'Grayscale', gray: 0.08}});
  const frontX = 9 + W + geometry.spine + 36;
  const backX = 45, safeWidth = W - 72;
  drawWrapped(page, 'CARONTE', regular, 14, frontX, geometry.height - 105, safeWidth, 20, white);
  const bottom = drawWrapped(page, source.title, bold, 31, frontX, geometry.height - 220, safeWidth, 38, white);
  if (bottom < 180) fail('print_cover_title_too_long');
  const subtitleBottom = drawWrapped(page, source.subtitle, regular, 13, frontX, bottom - 25, safeWidth, 19, white);
  if (subtitleBottom < 110) fail('print_cover_subtitle_too_long');
  drawWrapped(page, `De mis ${source.future_age} años a mis ${source.current_age}.`, regular, 13,
    frontX, 90, safeWidth, 19, white);
  const horizon=resolveLiteraryContract(source.prompt_version).horizonYears===30?'treinta':'cuarenta';
  const back = `Un libro escrito por tu yo de dentro de ${horizon} años. Una ficción personal sobre lo que aprendiste, lo que elegiste y lo que todavía puedes cambiar.`;
  drawWrapped(page, back, regular, 16, backX, geometry.height - 170, safeWidth, 23, white);
  drawWrapped(page, proof ? 'PRUEBA TÉCNICA\nTexto sintético. No enviar a impresión.' :
    'Edición privada. Ficción futura basada en una entrevista personal. No es una predicción.', regular, 11,
    backX, 145, safeWidth, 16, white);
  const spineText = source.title;
  const spineSize = Math.min(11, geometry.spine - 18);
  const spineLength = regular.widthOfTextAtSize(spineText, spineSize);
  if (spineLength > H - 72 || spineSize < 9) fail('print_spine_text_overflow');
  page.drawText(spineText, {x: 9 + W + geometry.spine / 2 + spineSize / 3,
    y: (geometry.height - spineLength) / 2, font: regular, size: spineSize,
    rotate: {type: 'degrees', angle: 90}, color: white});
  doc.setTitle(`${source.title} - cubierta${proof ? ' - prueba técnica' : ''}`);
  doc.setCreator(PRINT_TEMPLATE);
  if (createdAt) {
    doc.setCreationDate(new Date(createdAt));
    doc.setModificationDate(new Date(createdAt));
  }
  const bytes = await doc.save({useObjectStreams: false});
  const reopened = await PDFDocument.load(bytes);
  if (reopened.getPageCount() !== 1) fail('print_cover_page_count');
  return {bytes, byteSize: bytes.length, pageCount: 1, dimensions: geometry,
    fontsEmbedded: true, template: PRINT_TEMPLATE};
}

async function sha256(bytes) {
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)),
    byte => byte.toString(16).padStart(2, '0')).join('');
}

const PRINT_SIZES = Object.freeze(Array.from({length:21},(_,i)=>Math.round((12+i/10)*10)/10));
const STAGES_VERSION = 'caronte-a5-chunks-v1';
const clone = value => structuredClone(value);
const json = value => Array.isArray(value) ? `[${value.map(json).join(',')}]` :
  value && typeof value === 'object' ? `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${json(value[key])}`).join(',')}}` : JSON.stringify(value);
const jsonHash = value => sha256(new TextEncoder().encode(json(value)));
const without = (value, key) => Object.fromEntries(Object.entries(value).filter(([name]) => name !== key));

// Existing immutable full receipts can be consumed a few at a time. Validate
// their original identity before discarding repeated prose. Never rewrite them.
export async function compactPrintChapterPlan(plan) {
  if(!plan || !Array.isArray(plan.candidates) || plan.candidates.length!==1 ||
    plan.sha256!==await jsonHash(without(plan,'sha256')))fail('print_chapter_plan_corrupt');
  if(plan.format==='chapter-counts-v1')return clone(plan);
  if(plan.format!==undefined || !Array.isArray(plan.candidates[0].pages))fail('print_chapter_plan_corrupt');
  const record={...without(plan,'sha256'),format:'chapter-counts-v1',
    candidates:plan.candidates.map(({pages,...candidate})=>({...candidate,pageCount:pages.length}))};
  return {...record,sha256:await jsonHash(record)};
}

// Stateless primitives for a private durable worker. This does not start a job,
// expose a public endpoint or assert that the hosted runtime has been verified.
export function createPrintStages({PDFDocument, fontkit, fonts}) {
  const bytes = Object.fromEntries(Object.keys(FONT_ASSETS).map(name => {
    if (!(fonts[name] instanceof Uint8Array) || !fonts[name].length) fail('print_font_asset_mismatch');
    return [name, new Uint8Array(fonts[name])];
  }));
  let fontIdentity;
  const fontFingerprint = async () => {
    if (!fontIdentity) fontIdentity = (async () => {
      const hashes = {};
      for (const [name, asset] of Object.entries(FONT_ASSETS)) {
        hashes[name] = await sha256(bytes[name]);
        if (hashes[name] !== asset.sha256) fail('print_font_asset_mismatch');
      }
      return jsonHash(hashes);
    })();
    return fontIdentity;
  };
  const identity = async manuscript => {
    const {source, words} = validateSource(manuscript);
    return {source, words, sourceFingerprint: await jsonHash(source), fontFingerprint: await fontFingerprint()};
  };
  const document = async source => {
    const doc = await PDFDocument.create();
    doc.registerFontkit(fontkit);
    const embedded = Object.fromEntries(await Promise.all(Object.entries(bytes).map(async ([name, data]) =>
      [name, await doc.embedFont(data, {subset: true})])));
    supported(embedded.regular, [source.title, source.subtitle, ...source.sections.flatMap(chapter => [chapter.title, ...chapter.paragraphs])]);
    supported(embedded.bold, [source.title, ...source.sections.map(chapter => chapter.title)]);
    supported(embedded.italic, [source.subtitle]);
    return {doc, embedded};
  };
  const validateManifest = async (manuscript, input) => {
    const current = await identity(manuscript), manifest = clone(input);
    const pages=resolveLiteraryContract(current.source.prompt_version).physicalPages;
    if (!manifest || manifest.template !== PRINT_TEMPLATE || manifest.stagesVersion !== STAGES_VERSION || manifest.sourceFingerprint !== current.sourceFingerprint ||
        manifest.fontFingerprint !== current.fontFingerprint || manifest.wordCount !== current.words) fail('print_layout_identity');
    if (manifest.manifestHash !== await jsonHash(without(manifest, 'manifestHash')) ||
        manifest.layoutHash !== await jsonHash(manifest.layout)) fail('print_layout_manifest_corrupt');
    const layout = manifest.layout;
    if (typeof manifest.createdAt !== 'string' || !Number.isFinite(Date.parse(manifest.createdAt)) ||
        new Date(manifest.createdAt).toISOString() !== manifest.createdAt || typeof manifest.proof !== 'boolean' ||
        !printSizesFor(current.source).includes(layout?.size) || layout.leading !== layout.size * 1.4 ||
        layout.textWidth !== TEXT_WIDTH || !layout.mirroredMargins || layout.margins?.inside !== INNER ||
        layout.margins?.outside !== OUTER || layout.margins?.bottom !== BOTTOM || !Array.isArray(layout.pages) ||
        layout.pages.length < pages.min || layout.pages.length > pages.max || layout.pages.length % 2 ||
        layout.paragraphCount !== current.source.sections.reduce((count, chapter) => count + chapter.paragraphs.length, 0)) fail('print_layout_manifest_corrupt');
    for (const [index, page] of layout.pages.entries()) {
      if (page.number !== index + 1 || !Array.isArray(page.lines) ||
          !['title','edition','contents','recto_blank','chapter','body','binding_blank'].includes(page.kind)) fail('print_layout_manifest_corrupt');
      for (const line of page.lines) {
        if (typeof line.text !== 'string' || !normal(line.text) || !['heading','body'].includes(line.kind) ||
            !['regular','bold'].includes(line.font) || !Number.isFinite(line.size) || line.size < 10 || line.size > 25 ||
            line.x !== (page.number % 2 ? INNER : OUTER) || !Number.isFinite(line.y) || line.y < BOTTOM || line.y > H - 72 ||
            !Number.isFinite(line.width) || line.width < 0 || line.width > TEXT_WIDTH + 0.01) fail('print_layout_manifest_corrupt');
      }
    }
    const text = layout.pages.flatMap(page => page.lines.filter(line => line.kind === 'body').map(line => line.text)).join(' ');
    if (text !== normal(current.source.sections.flatMap(chapter => chapter.paragraphs).join(' ')) ||
        !Array.isArray(layout.chapterStarts) || layout.chapterStarts.length !== 5 ||
        layout.chapterStarts.some((chapter, index) => chapter.title !== current.source.sections[index].title ||
          !Number.isSafeInteger(chapter.page) || chapter.page % 2 !== 1 || layout.pages[chapter.page - 1]?.kind !== 'chapter')) fail('print_layout_manifest_corrupt');
    return {...current, manifest};
  };
  const partIdentity = (part, manifest) => {
    if (part.template !== PRINT_TEMPLATE || part.stagesVersion !== STAGES_VERSION || part.sourceFingerprint !== manifest.sourceFingerprint ||
        part.fontFingerprint !== manifest.fontFingerprint || part.layoutHash !== manifest.layoutHash ||
        part.manifestHash !== manifest.manifestHash || part.proof !== manifest.proof) fail('print_part_identity');
  };
  const checkPdf = async (file, expected, code) => {
    if (!(file.bytes instanceof Uint8Array) || file.bytes.length < 8 || file.bytes.length > 20_000_000 ||
        file.byteSize !== file.bytes.length || file.sha256 !== await sha256(file.bytes)) fail(code);
    let doc;
    try {doc = await PDFDocument.load(file.bytes, {throwOnInvalidObject: true, updateMetadata: false});}
    catch {fail(code);}
    if (doc.getPageCount() !== expected || doc.getPages().some(page => {
      const size = page.getSize(); return size.width !== W || size.height !== H;
    })) fail(code);
    return doc;
  };
  return Object.freeze({
    async planChapter(manuscript, chapterIndex, options = {}) {
      if (!Number.isSafeInteger(chapterIndex) || chapterIndex < 0 || chapterIndex > 4 ||
          !PRINT_SIZES.includes(options.size)) fail('print_chapter_plan_scope');
      const current = await identity(manuscript), {embedded} = await document(current.source);
      if(!printSizesFor(current.source).includes(options.size))fail('print_chapter_plan_scope');
      const widths = Object.fromEntries(Object.entries(embedded).map(([name, font]) => [name, measure(font)]));
      const candidates = [options.size].map(size => {
        const layout = planBook({...current.source, sections: [current.source.sections[chapterIndex]]}, size, size * 1.4, widths, chapterIndex);
        return {size, leading: layout.leading, pages: layout.pages.slice(4), paragraphCount: layout.paragraphCount};
      });
      const record = {template: PRINT_TEMPLATE, stagesVersion: STAGES_VERSION, sourceFingerprint: current.sourceFingerprint,
        fontFingerprint: current.fontFingerprint, chapterIndex, candidates};
      const complete={...record,sha256:await jsonHash(record)};
      return options.compact===true?compactPrintChapterPlan(complete):complete;
    },
    async composeLayout(manuscript, input, options = {}) {
      const current = await identity(manuscript), chapters = clone(input);
      const sizes=printSizesFor(current.source),expected=5*sizes.length;
      if (!Array.isArray(chapters) || chapters.length !== expected ||
          chapters.some(chapter => !Number.isSafeInteger(chapter?.chapterIndex) || chapter.chapterIndex < 0 || chapter.chapterIndex > 4)) fail('print_chapter_plans_required');
      chapters.sort((a, b) => a.chapterIndex - b.chapterIndex);
      for (const chapter of chapters) {
        if (chapter.template !== PRINT_TEMPLATE || chapter.stagesVersion !== STAGES_VERSION || chapter.sourceFingerprint !== current.sourceFingerprint ||
            chapter.fontFingerprint !== current.fontFingerprint) fail('print_chapter_plan_identity');
        if (chapter.sha256 !== await jsonHash(without(chapter, 'sha256')) || !Array.isArray(chapter.candidates) ||
            chapter.candidates.length !== 1 ||
            chapter.candidates.some(candidate => !sizes.includes(candidate.size))) fail('print_chapter_plan_corrupt');
      }
      const matrix = new Map();
      for (const chapter of chapters) for (const candidate of chapter.candidates) {
        const key = `${chapter.chapterIndex}:${candidate.size}`;
        if (matrix.has(key)) fail('print_chapter_plans_required');
        matrix.set(key, candidate);
      }
      if (matrix.size !== expected) fail('print_chapter_plans_required');
      const compact=chapters.some(chapter=>chapter.format==='chapter-counts-v1');
      if(chapters.some(chapter=>chapter.format!==undefined&&chapter.format!=='chapter-counts-v1'))fail('print_chapter_plan_corrupt');
      if(compact){
        const counts=sizes.map(size=>{
          let count=4;
          for(let chapterIndex=0;chapterIndex<5;chapterIndex++){
            const candidate=matrix.get(`${chapterIndex}:${size}`),pages=candidate.pageCount??candidate.pages?.length;
            if(!Number.isSafeInteger(pages)||pages<2||pages%2||candidate.leading!==size*1.4||
              candidate.paragraphCount!==current.source.sections[chapterIndex].paragraphs.length)fail('print_chapter_plan_corrupt');
            count+=pages;
          }
          return {size,count};
        });
        const policy=resolveLiteraryContract(current.source.prompt_version).physicalPages,target=policy.target??(policy.min+policy.max)/2;
        const chosen=counts.filter(item=>item.count>=policy.min&&item.count<=policy.max)
          .sort((a,b)=>Math.abs(a.count-target)-Math.abs(b.count-target))[0];
        if(!chosen)fail('print_pagination_needs_revision');
        const {embedded}=await document(current.source);
        const widths=Object.fromEntries(Object.entries(embedded).map(([name,font])=>[name,measure(font)]));
        const layout=planBook(current.source,chosen.size,chosen.size*1.4,widths);
        if(layout.pages.length!==chosen.count)fail('print_chapter_plan_corrupt');
        for(let index=0;index<5;index++){
          const end=index===4?layout.pages.length+1:layout.chapterStarts[index+1].page;
          const candidate=matrix.get(`${index}:${chosen.size}`);
          if(end-layout.chapterStarts[index].page!==(candidate.pageCount??candidate.pages.length))fail('print_chapter_plan_corrupt');
        }
        const timestamp=options.createdAt??new Date().toISOString();
        if(typeof timestamp!=='string'||!Number.isFinite(Date.parse(timestamp)))fail('print_job_timestamp_required');
        const manifest={template:PRINT_TEMPLATE,stagesVersion:STAGES_VERSION,createdAt:new Date(timestamp).toISOString(),
          sourceFingerprint:current.sourceFingerprint,fontFingerprint:current.fontFingerprint,wordCount:current.words,
          proof:options.proof===true,layout,layoutHash:await jsonHash(layout)};
        manifest.manifestHash=await jsonHash(manifest);
        await validateManifest(current.source,manifest);return manifest;
      }
      const candidates = sizes.map(size => {
        const pages = [{number: 1, kind: 'title', lines: []}, {number: 2, kind: 'edition', lines: []},
          {number: 3, kind: 'contents', lines: []}, {number: 4, kind: 'recto_blank', lines: []}];
        const chapterStarts = []; let paragraphCount = 0;
        for (let chapterIndex = 0; chapterIndex < 5; chapterIndex++) {
          const candidate = matrix.get(`${chapterIndex}:${size}`);
          if (!Array.isArray(candidate.pages) || !candidate.pages.length || candidate.pages.length % 2 ||
              candidate.leading !== size * 1.4 || candidate.paragraphCount !== current.source.sections[chapterIndex].paragraphs.length) fail('print_chapter_plan_corrupt');
          chapterStarts.push({title: current.source.sections[chapterIndex].title, page: pages.length + 1});
          paragraphCount += candidate.paragraphCount;
          for (const [index, page] of candidate.pages.entries()) {
            if (page.number !== index + 5) fail('print_chapter_plan_corrupt');
            pages.push({...page, number: pages.length + 1,
              kind: page.kind === 'binding_blank' && chapterIndex < 4 ? 'recto_blank' : page.kind});
          }
        }
        return {pages, chapterStarts, paragraphCount, textWidth: TEXT_WIDTH, size, leading: size * 1.4,
          margins: {inside: INNER, outside: OUTER, bottom: BOTTOM}, mirroredMargins: true};
      }).filter(layout => {
        const pages=resolveLiteraryContract(current.source.prompt_version).physicalPages;
        return layout.pages.length>=pages.min&&layout.pages.length<=pages.max;
      });
      if (!candidates.length) fail('print_pagination_needs_revision');
      const pageTarget=resolveLiteraryContract(current.source.prompt_version).physicalPages;
      const target=pageTarget.target??(pageTarget.min+pageTarget.max)/2;
      const layout = candidates.sort((a, b) => Math.abs(a.pages.length - target) - Math.abs(b.pages.length - target))[0];
      const timestamp = options.createdAt ?? new Date().toISOString();
      if (typeof timestamp !== 'string' || !Number.isFinite(Date.parse(timestamp))) fail('print_job_timestamp_required');
      const manifest = {template: PRINT_TEMPLATE, stagesVersion: STAGES_VERSION,
        createdAt: new Date(timestamp).toISOString(), sourceFingerprint: current.sourceFingerprint,
        fontFingerprint: current.fontFingerprint, wordCount: current.words, proof: options.proof === true,
        layout, layoutHash: await jsonHash(layout)};
      manifest.manifestHash = await jsonHash(manifest);
      await validateManifest(current.source, manifest);
      return manifest;
    },
    async renderInteriorPart(manuscript, input, {firstPage, lastPage}) {
      const {source, manifest} = await validateManifest(manuscript, input);
      if (!Number.isSafeInteger(firstPage) || !Number.isSafeInteger(lastPage) || firstPage < 1 ||
          (firstPage - 1) % 10 || lastPage !== Math.min(firstPage + 9, manifest.layout.pages.length) ||
          lastPage < firstPage) fail('print_part_scope');
      const {doc, embedded} = await document(source);
      const plans = manifest.layout.pages.slice(firstPage - 1, lastPage);
      for (const plan of plans) doc.addPage([W, H]).setTrimBox(0, 0, W, H);
      if (firstPage === 1) decorateFrontMatter(doc, embedded, source, manifest.layout, manifest.proof);
      for (const [index, plan] of plans.entries()) decoratePlanPage(doc.getPage(index), embedded, plan);
      doc.setCreationDate(new Date(manifest.createdAt)); doc.setModificationDate(new Date(manifest.createdAt));
      const data = await doc.save({useObjectStreams: false});
      const file = {bytes: data, byteSize: data.length, sha256: await sha256(data)};
      await checkPdf(file, plans.length, 'print_part_corrupt');
      return {...file, template: PRINT_TEMPLATE, stagesVersion: STAGES_VERSION, sourceFingerprint: manifest.sourceFingerprint,
        fontFingerprint: manifest.fontFingerprint, layoutHash: manifest.layoutHash,
        manifestHash: manifest.manifestHash, proof: manifest.proof, firstPage, lastPage, pageCount: plans.length};
    },
    async mergeInterior(manuscript, input, values) {
      const {source, manifest} = await validateManifest(manuscript, input);
      const maxParts=Math.ceil(resolveLiteraryContract(source.prompt_version).physicalPages.max/10);
      if (!Array.isArray(values) || !values.length || values.length > maxParts) fail('print_parts_incomplete');
      if (values.some(part => !(part?.bytes instanceof Uint8Array)) ||
          values.reduce((sum, part) => sum + part.bytes.length, 0) > 20_000_000) fail('print_parts_size');
      const parts = [...values].sort((a, b) => a.firstPage - b.firstPage);
      let next = 1;
      for (const part of parts) {
        partIdentity(part, manifest);
        if (!Number.isSafeInteger(part.firstPage) || !Number.isSafeInteger(part.lastPage) || part.firstPage !== next ||
            part.lastPage !== Math.min(part.firstPage + 9, manifest.layout.pages.length) ||
            part.pageCount !== part.lastPage - part.firstPage + 1) fail('print_parts_incomplete');
        next = part.lastPage + 1;
      }
      if (next !== manifest.layout.pages.length + 1) fail('print_parts_incomplete');
      const doc = await PDFDocument.create();
      for (const part of parts) {
        const opened = await checkPdf(part, part.pageCount, 'print_part_corrupt');
        for (const page of await doc.copyPages(opened, opened.getPageIndices())) doc.addPage(page);
      }
      doc.setTitle(`${source.title}${manifest.proof ? ' - prueba técnica de texto sintético' : ''}`);
      doc.setLanguage('es-ES'); doc.setCreator(PRINT_TEMPLATE);
      doc.setCreationDate(new Date(manifest.createdAt)); doc.setModificationDate(new Date(manifest.createdAt));
      const data = await doc.save({useObjectStreams: false});
      const file = {bytes: data, byteSize: data.length, sha256: await sha256(data)};
      await checkPdf(file, manifest.layout.pages.length, 'print_interior_identity');
      return {...file, template: PRINT_TEMPLATE, stagesVersion: STAGES_VERSION, sourceFingerprint: manifest.sourceFingerprint,
        fontFingerprint: manifest.fontFingerprint, layoutHash: manifest.layoutHash, manifestHash: manifest.manifestHash,
        proof: manifest.proof, pageCount: manifest.layout.pages.length, paragraphCount: manifest.layout.paragraphCount,
        pageSize: 'A5', width: W, height: H, fontsEmbedded: true, ready_for_print: false};
    },
    async renderCover(manuscript, input, interior, options = {}) {
      const {source, manifest} = await validateManifest(manuscript, input);
      if (!interior || interior.template !== PRINT_TEMPLATE || interior.stagesVersion !== STAGES_VERSION || interior.sourceFingerprint !== manifest.sourceFingerprint ||
          interior.fontFingerprint !== manifest.fontFingerprint || interior.layoutHash !== manifest.layoutHash ||
          interior.manifestHash !== manifest.manifestHash || interior.proof !== manifest.proof ||
          interior.pageCount !== manifest.layout.pages.length) fail('print_interior_identity');
      const opened = await checkPdf(interior, manifest.layout.pages.length, 'print_interior_identity');
      const pageCount = opened.getPageCount();
      const dimensions = typeof options.coverDimensions === 'function' ? await options.coverDimensions(pageCount) : options.coverDimensions;
      const geometry = coverGeometry(dimensions, pageCount, manifest.proof);
      const cover = await renderCover(source, geometry, manifest.proof, PDFDocument, fontkit, bytes, manifest.createdAt);
      return {...cover, sha256: await sha256(cover.bytes), sourceFingerprint: manifest.sourceFingerprint,
        fontFingerprint: manifest.fontFingerprint, layoutHash: manifest.layoutHash, manifestHash: manifest.manifestHash,
        proof: manifest.proof, interiorSha256: interior.sha256, ready_for_print: false};
    }
  });
}

async function renderBundle(doc, fonts, source, words, options, PDFDocument, fontkit, fontBytes) {
  const layout = chooseLayout(source, fonts);
  for (const plan of layout.pages) {
    const page = doc.addPage([W, H]);
    page.setTrimBox(0, 0, W, H);
  }
  decorateInterior(doc, fonts, source, layout, options.proof === true);
  doc.setTitle(`${source.title}${options.proof ? ' - prueba técnica de texto sintético' : ''}`);
  doc.setLanguage('es-ES');
  doc.setCreator(PRINT_TEMPLATE);
  const bytes = await doc.save({useObjectStreams: false});
  const reopened = await PDFDocument.load(bytes);
  const pageCount = reopened.getPageCount();
  const physicalPages=resolveLiteraryContract(source.prompt_version).physicalPages;
  if (pageCount !== layout.pages.length || pageCount < physicalPages.min || pageCount > physicalPages.max) fail('print_page_count');
  // Resolve production dimensions only after the actual interior page count exists.
  const dimensions = typeof options.coverDimensions === 'function'
    ? await options.coverDimensions(pageCount) : options.coverDimensions;
  const geometry = coverGeometry(dimensions, pageCount, options.proof === true);
  const cover = await renderCover(source, geometry, options.proof === true, PDFDocument, fontkit, fontBytes);
  const interior = {bytes, byteSize: bytes.length, pageCount, paragraphCount: layout.paragraphCount,
    pageSize: 'A5', width: W, height: H, fontsEmbedded: true, template: PRINT_TEMPLATE};
  interior.sha256 = await sha256(bytes);
  cover.sha256 = await sha256(cover.bytes);
  return {interior, cover, layout, title: source.title, wordCount: words,
    sourceSha256: await sha256(new TextEncoder().encode(JSON.stringify(source))),
    ready_for_print: false, proof: options.proof === true,
    pending: ['human_editorial_review', 'lulu_interior_preflight', 'lulu_cover_preflight']};
}
