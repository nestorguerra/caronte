import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {test} from 'node:test';
import {PDFDocument} from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import {createPrintStages, compactPrintChapterPlan} from '../supabase/functions/_shared/caronte-print.mjs';
import {fingerprintArtifact} from '../supabase/functions/_shared/caronte-literary.mjs';
import {loadPrintFonts} from '../supabase/functions/_shared/caronte-print-fonts.mjs';
import {printManuscript} from './fixtures/print-manuscript.mjs';

const fonts=await loadPrintFonts(readFile);
const fresh=()=>createPrintStages({PDFDocument,fontkit,fonts});
const source=printManuscript();
// Unequal paragraphs and genuine Unicode exercise page-boundary continuation.
for(const chapter of source.sections){
  const words=chapter.paragraphs.flatMap(paragraph=>paragraph.split(' '));
  const paragraphs=[];let cursor=0;
  while(cursor<words.length){
    const length=[37,83,191,419][paragraphs.length%4];
    paragraphs.push(words.slice(cursor,cursor+length).join(' '));cursor+=length;
  }
  chapter.paragraphs=paragraphs;
}
const frozen=structuredClone(source);
const restore=value=>JSON.parse(JSON.stringify(value));
test('layout selection validates compact counts without measuring or composing any chapter',async()=>{
  const seed=await fresh().planChapter(source,0,{size:12,compact:true});
  const plans=[];
  for(let index=0;index<5;index++)for(const size of [12,12.5,13,13.5,14]){
    const record={...seed,chapterIndex:index,candidates:[{size,leading:size*1.4,pageCount:38,
      paragraphCount:source.sections[index].paragraphs.length}]};delete record.sha256;
    plans.push({...record,sha256:await fingerprintArtifact(record)});
  }
  const assembly=createPrintStages({PDFDocument:{async create(){throw Error('selection_remeasured');}},fontkit,fonts});
  const choice=await assembly.selectLayoutSize(source,plans);
  assert.equal(choice.format,'layout-selection-v1');assert.equal(choice.size,12);assert.equal(choice.pageCount,194);
  assert.deepEqual(await assembly.selectLayoutSize(source,[...plans].reverse()),choice);
  assert.equal(choice.sha256,await fingerprintArtifact(Object.fromEntries(Object.entries(choice).filter(([key])=>key!=='sha256'))));
  await assert.rejects(assembly.selectLayoutSize(source,plans.slice(1)),/print_chapter_plans_required/);
  const changed=restore(plans);changed[0].sourceFingerprint='0'.repeat(64);
  await assert.rejects(assembly.selectLayoutSize(source,changed),/print_chapter_plan_identity/);
});
async function sliced(chapter,size,mode,maxParagraphs=7,maxCharacters=4000){
  const slices=[];
  do{
    const slice=await fresh().planChapterSlice(source,chapter,{size,mode,
      maxParagraphs,maxCharacters,previous:restore(slices.at(-1)??null)});
    assert.ok(slice.endParagraph>slice.startParagraph);
    assert.ok(slice.endParagraph-slice.startParagraph<=maxParagraphs);
    assert.ok(source.sections[chapter].paragraphs.slice(slice.startParagraph,slice.endParagraph)
      .reduce((sum,text)=>sum+text.length,0)<=maxCharacters);
    slices.push(restore(slice));
  }while(!slices.at(-1).done);
  return slices;
}

test('bounded geometry and counts retain the exact original chapter hash for every legacy size',async()=>{
  for(const size of [12,12.5,13,13.5,14]){
    const original=await fresh().planChapter(source,0,{size});
    const geometry=await sliced(0,size,'geometry');
    const full=await fresh().finishChapterSlices(source,0,geometry,{size});
    assert.deepEqual(full,original);
    const counts=await sliced(0,size,'counts',3,3100);
    assert.ok(counts.every(slice=>slice.pages===undefined));
    assert.ok(counts.every(slice=>JSON.stringify(slice).length<1500));
    const compact=await fresh().finishChapterSlices(source,0,counts,{size,compact:true});
    assert.deepEqual(compact,await compactPrintChapterPlan(original));
  }
  assert.deepEqual(source,frozen);
});

test('a lost response resumes from persisted cursor with byte-identical receipt, no whole-chapter work',async()=>{
  const first=await fresh().planChapterSlice(source,1,{size:13,mode:'geometry',maxParagraphs:2,maxCharacters:4000});
  const options={size:13,mode:'geometry',maxParagraphs:2,maxCharacters:4000,previous:restore(first)};
  const once=await fresh().planChapterSlice(source,1,options);
  const recovered=await fresh().planChapterSlice(source,1,restore(options));
  assert.deepEqual(recovered,once);
  assert.equal(recovered.startParagraph,first.endParagraph);
  assert.equal(recovered.previousSha256,first.sha256);
});

test('slice assembly rejects missing, reordered, duplicate and mixed-identity chains',async()=>{
  const receipts=await sliced(0,12,'geometry');
  const finish=values=>fresh().finishChapterSlices(source,0,values,{size:12});
  for(const values of [receipts.slice(1),receipts.slice(0,-1),[receipts[0],...receipts],
    [...receipts].reverse(),[...receipts.slice(0,2),...receipts.slice(3)]]){
    await assert.rejects(finish(values),/print_slice_chain/);
  }
  const changed=restore(receipts);changed[1].state.y+=1;
  await assert.rejects(finish(changed),/print_slice_corrupt/);
  const foreign=restore(receipts);foreign[1].sourceFingerprint='0'.repeat(64);
  await assert.rejects(finish(foreign),/print_slice_identity/);
  await assert.rejects(fresh().planChapterSlice(source,1,{size:12,mode:'geometry',previous:receipts[0]}),/print_slice_identity/);
  await assert.rejects(fresh().planChapterSlice(source,0,{size:12,mode:'geometry',previous:receipts.at(-1)}),/print_slice_chain/);
});

test('budgets and an overlong paragraph fail closed rather than silently processing the whole chapter',async()=>{
  for(const options of [{maxParagraphs:0},{maxParagraphs:25},{maxCharacters:0},{maxCharacters:16001},
    {size:12.1},{mode:'unbounded'}]){
    await assert.rejects(fresh().planChapterSlice(source,0,{size:12,mode:'counts',...options}),/print_slice_scope/);
  }
  await assert.rejects(fresh().planChapterSlice(source,0,{size:12,mode:'counts',maxCharacters:50}),/print_slice_paragraph_limit/);
});

test('compact composition consumes five selected geometry plans without remeasuring the book',async()=>{
  const originals=[];
  for(let chapter=0;chapter<5;chapter++)for(const size of [12,12.5,13,13.5,14]){
    originals.push(await fresh().planChapter(source,chapter,{size}));
  }
  const options={proof:true,createdAt:'2026-10-12T00:00:00.000Z'};
  const original=await fresh().composeLayout(source,originals,options);
  const compact=await Promise.all(originals.map(compactPrintChapterPlan));
  const geometryPlans=originals.filter(plan=>plan.candidates[0].size===original.layout.size);
  const noRemeasure={async create(){throw Error('whole_book_remeasured');}};
  const assembly=createPrintStages({PDFDocument:noRemeasure,fontkit,fonts});
  const recovered=await assembly.composeLayout(source,compact,{...options,geometryPlans});
  assert.deepEqual(recovered,original);
  await assert.rejects(assembly.composeLayout(source,compact,{...options,geometryPlans:geometryPlans.slice(1)}),/print_geometry_plans_required/);
  const altered=restore(geometryPlans);altered[0].candidates[0].pages[1].lines.pop();
  altered[0].sha256=await fingerprintArtifact(Object.fromEntries(Object.entries(altered[0]).filter(([key])=>key!=='sha256')));
  await assert.rejects(assembly.composeLayout(source,compact,{...options,geometryPlans:altered}),/print_layout_manifest_corrupt/);
});
