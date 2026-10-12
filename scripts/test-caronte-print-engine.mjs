import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createHash} from 'node:crypto';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {isAbsolute,join} from 'node:path';
import {PDFDocument} from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import {createPrintStages,prototypeCoverDimensions} from '../supabase/functions/_shared/caronte-print.mjs';
import {loadPrintFonts} from '../supabase/functions/_shared/caronte-print-fonts.mjs';
import {createPrintEngine} from '../supabase/functions/_shared/caronte-print-engine.mjs';
import {createPrintStageArchive} from '../supabase/functions/_shared/caronte-print-storage.mjs';
import {printManuscript} from './fixtures/print-manuscript.mjs';

const sid='11111111-1111-4111-8111-111111111111',mid='33333333-3333-4333-8333-333333333333';
const jid='22222222-2222-4222-8222-222222222222',pid='44444444-4444-4444-8444-444444444444';
const canonical=v=>Array.isArray(v)?`[${v.map(canonical).join(',')}]`:v&&typeof v==='object'
 ?`{${Object.keys(v).sort().map(k=>`${JSON.stringify(k)}:${canonical(v[k])}`).join(',')}}`:JSON.stringify(v);
const sha=v=>createHash('sha256').update(typeof v==='string'||v instanceof Uint8Array?v:canonical(v)).digest('hex');
const settings=async()=>({environment:'sandbox',configurationTag:'a'.repeat(64),podPackageId:'0583X0827.BW.STD.PB.060UC444.MXX'});
const manuscript=()=>({id:mid,session_id:sid,status:'ready',updated_at:'2026-10-12T00:00:00.000Z',
 manuscript:printManuscript(),provider_chain:{degraded:false},quality_report:{editorial_gate:'pass'}});

// Stateful RPC/Storage boundary with deterministic lease time. This does not
// claim to execute PostgreSQL or contact Supabase. No fake renderer in the
// separate real-PDF integration test.
export function printDatabase(){
 let clock=0,leaseNumber=0;let job=null;const steps=[],pdfs=[],calls=[];
 let loseComplete=false,loseFinish=false,rejectCheckpointReceipt=false,alterIntentRead=false;
 const copy=v=>structuredClone(v);
 const rest=async(path,options={})=>{
  calls.push(path);const p=options.body;
  if(path==='rpc/caronte_enqueue_print'){
   if(job){if(job.input_hash!==p.p_input_hash)throw Error('active_print_source_changed');return copy(job);}
   job={id:jid,pdf_id:pid,session_id:p.p_session_id,manuscript_id:p.p_manuscript_id,version:1,
    source_snapshot:p.p_source,source_sha256:p.p_source_sha256,input_hash:p.p_input_hash,
    stages_version:p.p_stages_version,lulu_environment:p.p_environment,lulu_configuration_tag:p.p_configuration_tag,
    pod_package_id:p.p_pod_package_id,created_at:'2026-10-12T00:00:00.000Z',status:'queued',stage:'plan',lease_until:null};
   return copy(job);
  }
  if(path==='rpc/caronte_claim_print_job'){
   if(!job||!['queued','running'].includes(job.status)||job.lease_until>clock)return null;
   job.status='running';job.lease_until=clock+140;job.lease_token=`lease-${++leaseNumber}`;return copy(job);
  }
  if(path==='rpc/caronte_checkpoint_print_job'||path==='rpc/caronte_finish_print_job'){
   if(!job||job.status!=='running'||job.lease_token!==p.p_lease_token||job.lease_until<=clock)throw Error('lease_lost');
   if(path==='rpc/caronte_finish_print_job'){
    pdfs.push(copy(p.p_pdf));job.status='ready';job.lease_until=null;job.lease_token=null;
    if(loseFinish){loseFinish=false;throw Error('acceptance lost');}return pid;
   }
   const at=steps.findIndex(step=>step.step_key===p.p_step.step_key);
   if(at>=0&&steps[at].status==='completed')throw Error('completed_step_is_immutable');
   if(loseComplete&&p.p_step.status==='completed'&&p.p_step.step_key.startsWith('part:')){loseComplete=false;throw Error('completion did not arrive');}
   if(at<0)steps.push(copy(p.p_step));else steps[at]=copy(p.p_step);
   job.status=p.p_state;job.error_code=p.p_step.error_code||null;job.stage=p.p_step.stage;
   if(p.p_state!=='running'){job.lease_until=null;job.lease_token=null;}
   if(rejectCheckpointReceipt){rejectCheckpointReceipt=false;return false;}return true;
  }
  if(path.startsWith('future_book_print_jobs?'))return job?[copy(job)]:[];
  if(path.startsWith('future_book_print_steps?')){
   const filter=new URLSearchParams(path.split('?')[1]).get('step_key');
   const result=copy(filter?steps.filter(s=>s.step_key===filter.slice(3)):steps);
   if(alterIntentRead&&result.some(s=>s.output?.path)){
    alterIntentRead=false;result.at(-1).output_hash='0'.repeat(64);
   }
   return result;
  }
  if(path.startsWith('future_book_pdfs?'))return copy(pdfs);
  throw Error(`Unhandled synthetic RPC ${path}`);
 };
 return{rest,steps,pdfs,calls,get job(){return job;},tick:n=>{clock+=n;},
  losePartCompletion:()=>{loseComplete=true;},loseFinishAcceptance:()=>{loseFinish=true;},
  rejectCheckpointReceipt:()=>{rejectCheckpointReceipt=true;},alterIntentRead:()=>{alterIntentRead=true;}};
}
function fixture(){
 const db=printDatabase(),objects=new Map(),requests=[];let renders=0,unavailable=false;
 const bytes=new TextEncoder().encode('%PDF-1.7\nsynthetic coordinator boundary');
 const archive=createPrintStageArchive({url:'https://storage.test',serviceKey:'synthetic-key',fetch:async(url,init)=>{
  requests.push({url,method:init.method});
  if(init.method==='GET'&&unavailable)return new Response('',{status:503});
  if(init.method==='POST'){
   assert.ok(db.steps.some(s=>s.status==='started'&&s.output?.path&&url.endsWith(s.output.path)),'intent exists before object');
   if(objects.has(url))return new Response('',{status:409});objects.set(url,new Uint8Array(init.body));return new Response('{}');
  }
  return objects.has(url)?new Response(objects.get(url)):new Response('',{status:404});
 }});
 const stages={
  planChapter:async(source,index,{size})=>({chapterIndex:index,size,sourceFingerprint:sha(source)}),
  composeLayout:async(source,plans,{createdAt})=>({sourceFingerprint:sha(source),createdAt,wordCount:48300,proof:false,
   layoutHash:'b'.repeat(64),manifestHash:'c'.repeat(64),layout:{pages:Array(194).fill({}),paragraphCount:150,size:13,leading:18.2,margins:{},chapterStarts:[]}}),
  renderInteriorPart:async(source,manifest,{firstPage,lastPage})=>{renders++;return{bytes,byteSize:bytes.length,sha256:sha(bytes),
   sourceFingerprint:sha(source),firstPage,lastPage,pageCount:lastPage-firstPage+1};},
  mergeInterior:async(source,manifest,parts)=>({bytes,byteSize:bytes.length,sha256:sha(bytes),pageCount:194,paragraphCount:150,
   sourceFingerprint:sha(source),width:419.76,height:595.44,template:'caronte-a5-embedded-v2'}),
  renderCover:async(source,manifest,interior,options)=>({bytes,byteSize:bytes.length,sha256:sha(bytes),pageCount:1,
   sourceFingerprint:sha(source),dimensions:await options.coverDimensions(interior.pageCount)})
 };
 const engine=(overrides={})=>createPrintEngine({rest:db.rest,archive,stages,settings,coverDimensions:async(job,count)=>({
  source:'lulu-api',environment:job.lulu_environment,podPackageId:job.pod_package_id,pageCount:count,width:888,height:613.44}),...overrides});
 const warm=async()=>{await engine().enqueue(sid,manuscript());for(let i=0;i<26;i++)await engine().advance();};
 return{db,objects,requests,archive,stages,engine,warm,renders:()=>renders,unavailableReads:value=>{unavailable=value;}};
}
test('enqueue reserves one stable job/PDF/version and hides the manuscript from public progress',async()=>{
 const app=fixture(),first=await app.engine().enqueue(sid,manuscript()),again=await app.engine().enqueue(sid,manuscript());
 assert.equal(first.job.id,again.job.id);assert.equal(app.db.job.version,1);assert.equal(app.db.job.pdf_id,pid);
 assert.equal(app.db.job.source_snapshot.sections[4].paragraphs[29],printManuscript().sections[4].paragraphs[29]);
 assert.equal(JSON.stringify(first).includes('INICIO1P1'),false);assert.equal(first.pdf,null);
});
test('changed source, degraded manuscript or absent editorial gate cannot start another active print',async()=>{
 const app=fixture();await app.engine().enqueue(sid,manuscript());
 const changed=manuscript();changed.manuscript.sections[0].paragraphs[0]+=' Cambio.';
 await assert.rejects(app.engine().enqueue(sid,changed),/active_print_source_changed/);
 for(const row of [{...manuscript(),quality_report:{}},{...manuscript(),provider_chain:{degraded:true}},
  {...manuscript(),provider_chain:{drafting:'deterministic'}},
  {...manuscript(),quality_report:{editorial_gate:'pass',status:'blocked_safety'}}]){
  await assert.rejects(app.engine().enqueue(sid,row),/print_manuscript_not_approved/);
 }
 assert.equal(app.db.job.version,1);
});
test('an interrupted part resumes from private exact bytes without rendering, upload or version duplication',async()=>{
 const app=fixture();await app.warm();app.db.losePartCompletion();
 await assert.rejects(app.engine().advance(),/print_storage_unavailable/);
 assert.equal(app.db.steps.at(-1).status,'started');assert.equal(app.objects.size,1);
 const uploads=app.requests.filter(r=>r.method==='POST').length;
 app.db.tick(141);
 const recovered=await app.engine().advance();
 assert.equal(recovered.status,'queued');assert.equal(app.db.steps.at(-1).status,'completed');
 assert.equal(app.renders(),1);assert.equal(app.requests.filter(r=>r.method==='POST').length,uploads);
 assert.equal(app.db.job.version,1);assert.equal(app.db.job.pdf_id,pid);
});
test('a different object at the reserved path blocks rather than overwrites or marks completion',async()=>{
 const app=fixture();await app.warm();app.db.losePartCompletion();await assert.rejects(app.engine().advance());
 for(const key of app.objects.keys())app.objects.set(key,new Uint8Array(app.objects.get(key).length));
 app.db.tick(141);const result=await app.engine().advance();
 assert.equal(result.status,'blocked');assert.equal(result.errorCode,'print_archive_mismatch');
 assert.equal(app.requests.filter(r=>r.method==='POST').length,1);assert.equal(app.db.pdfs.length,0);
});
test('another claim cannot run the same live stage',async()=>{
 const app=fixture();await app.warm();let release;const pause=new Promise(resolve=>{release=resolve;});
 const original=app.stages.renderInteriorPart;let entered;const enteredPromise=new Promise(resolve=>{entered=resolve;});
 app.stages.renderInteriorPart=async(...args)=>{entered();await pause;return original(...args);};
 const running=app.engine().advance();await enteredPromise;
 assert.equal((await app.engine().advance()).status,'idle');release();await running;
 assert.equal(app.renders(),1);
});
test('an expired worker cannot persist intent or upload after a replacement completes its stage',async()=>{
 const app=fixture();await app.warm();let release,entered;const pause=new Promise(resolve=>{release=resolve;});
 const enteredPromise=new Promise(resolve=>{entered=resolve;}),original=app.stages.renderInteriorPart;
 let first=true;app.stages.renderInteriorPart=async(...args)=>{if(first){first=false;entered();await pause;}return original(...args);};
 const old=app.engine().advance();await enteredPromise;app.db.tick(141);await app.engine().advance();
 release();await assert.rejects(old,/lease_lost/);
 assert.equal(app.requests.filter(r=>r.method==='POST').length,1);assert.equal(app.db.steps.at(-1).status,'completed');
});
test('accepted final DB commit is reconciled by rereading the reserved row, never inserting a second PDF',async()=>{
 const app=fixture();await app.warm();for(let i=0;i<22;i++)await app.engine().advance();
 app.db.loseFinishAcceptance();const result=await app.engine().advance();
 assert.equal(result.status,'ready');assert.equal(app.db.pdfs.length,1);
 const status=await app.engine().status(sid);assert.equal(status.pdf.id,pid);assert.equal(status.job.progress,100);
 assert.equal(status.pdf.print_validation.ready_for_print,false);
 assert.equal((await app.engine().advance()).status,'idle');
});
test('recovery read failures consume a bounded persisted attempt budget, rather than retry forever',async()=>{
 const app=fixture();await app.warm();app.unavailableReads(true);
 const first=await app.engine().advance();assert.equal(first.status,'queued');
 for(let attempt=0;attempt<3;attempt++)await app.engine().advance();
 assert.equal(app.db.job.status,'blocked');assert.equal(app.db.steps.at(-1).attempt,3);
 assert.equal(app.requests.filter(r=>r.method==='POST').length,0);
});
test('final verification also has a bounded persisted retry budget',async()=>{
 const app=fixture();await app.warm();for(let i=0;i<22;i++)await app.engine().advance();
 app.unavailableReads(true);
 for(let attempt=0;attempt<4;attempt++)await app.engine().advance();
 assert.equal(app.db.job.status,'blocked');assert.equal(app.db.steps.at(-1).attempt,3);assert.equal(app.db.pdfs.length,0);
});
test('a rotated Lulu configuration blocks cover generation without mixing environments or receipts',async()=>{
 const app=fixture();await app.warm();for(let i=0;i<21;i++)await app.engine().advance();let calls=0;
 const result=await app.engine({settings:async()=>({...await settings(),configurationTag:'b'.repeat(64)}),
  coverDimensions:async()=>{calls++;throw Error('must not contact provider');}}).advance();
 assert.equal(result.status,'blocked');assert.equal(result.errorCode,'print_lulu_configuration_changed');assert.equal(calls,0);
 assert.equal(app.db.pdfs.length,0);
});
test('ready progress never returns a mismatched cover receipt from the final row',async()=>{
 const app=fixture();await app.warm();for(let i=0;i<23;i++)await app.engine().advance();
 app.db.pdfs[0].lulu_metadata.cover_sha256='0'.repeat(64);
 await assert.rejects(app.engine().status(sid),/print_bundle_persistence_unverified/);
});
test('unconfirmed intent acceptance or mismatched readback cannot authorize any object upload',async()=>{
 for(const mutation of ['rejectCheckpointReceipt','alterIntentRead']){
  const app=fixture();await app.warm();app.db[mutation]();
  await assert.rejects(app.engine().advance(),/print_storage_unavailable/);
  assert.equal(app.objects.size,0);assert.equal(app.requests.filter(r=>r.method==='POST').length,0);
 }
});
test('real staged PDFs survive a worker instance replacement through the coordinator and retain the complete frozen layout',async()=>{
 const db=printDatabase(),objects=new Map();let uploads=0;
 const archive=createPrintStageArchive({url:'https://storage.test',serviceKey:'synthetic-key',fetch:async(url,init)=>{
  if(init.method==='POST'){
   uploads++;if(objects.has(url))return new Response('',{status:409});
   objects.set(url,new Uint8Array(init.body));return new Response('{}');
  }
  return objects.has(url)?new Response(objects.get(url)):new Response('',{status:404});
 }});
 const fonts=await loadPrintFonts(readFile),row=manuscript();let seed=20261012;
 for(const chapter of row.manuscript.sections)for(let p=0;p<chapter.paragraphs.length;p++){
  const words=chapter.paragraphs[p].split(' ');
  for(let i=words.length-1;i>0;i--){seed=(Math.imul(seed,1664525)+1013904223)>>>0;
   const at=Math.floor(seed/2**32*(i+1));[words[i],words[at]]=[words[at],words[i]];}
  chapter.paragraphs[p]=words.join(' ');
 }
 const engine=()=>createPrintEngine({rest:db.rest,archive,settings,
  stages:createPrintStages({PDFDocument,fontkit,fonts}),coverDimensions:async(job,count)=>({
   ...prototypeCoverDimensions(count),source:'lulu-api',environment:job.lulu_environment,
   podPackageId:job.pod_package_id,pageCount:count})});
 await engine().enqueue(sid,row);
 for(let i=0;i<26;i++)await engine().advance();
 db.losePartCompletion();await assert.rejects(engine().advance(),/print_storage_unavailable/);
 assert.equal(uploads,1);db.tick(141);await engine().advance();assert.equal(uploads,1);
 for(let i=0;i<22;i++)await engine().advance();
 assert.equal(db.job.status,'ready');assert.equal(db.pdfs.length,1);assert.equal(uploads,22);
 const pdf=db.pdfs[0],manifest=db.steps.find(s=>s.step_key==='compose').output;
 const interior=objects.get(`https://storage.test/storage/v1/object/future-book-pdfs/${pdf.storage_path}`);
 const cover=objects.get(`https://storage.test/storage/v1/object/future-book-pdfs/${pdf.lulu_metadata.cover_pdf_storage_path}`);
 assert.equal((await PDFDocument.load(interior)).getPageCount(),194);
 assert.equal((await PDFDocument.load(cover)).getPageCount(),1);
 assert.equal(sha(JSON.stringify(manifest.layout)),'7f3e02233706bf3f1d67b8232c22d8f2bd8ec77ba60f190ab347bb4ab57c391c');
 assert.equal(manifest.layout.pages.flatMap(p=>p.lines.filter(l=>l.kind==='body').map(l=>l.text)).join(' '),
  row.manuscript.sections.flatMap(c=>c.paragraphs).join(' '));
 assert.equal(pdf.print_validation.ready_for_print,false);
 assert.equal(pdf.print_validation.interior_sha256,sha(interior));
 assert.equal(pdf.print_validation.cover_sha256,sha(cover));
 // Optional, private synthetic QA export. Never a customer artifact or a Lulu
 // print-ready claim; no files are written during ordinary suite execution.
 const folder=process.env.CARONTE_PRINT_ENGINE_PROOF_DIR;
 if(folder){
  assert.ok(isAbsolute(folder));await mkdir(folder,{recursive:true});
  const sourceBytes=JSON.stringify(row.manuscript);
  const report={pageCount:194,wordCount:48300,paragraphCount:150,sourceSha256:sha(sourceBytes),
   interiorSha256:sha(interior),coverSha256:sha(cover),size:manifest.layout.size,leading:manifest.layout.leading,
   margins:manifest.layout.margins,chapterStarts:manifest.layout.chapterStarts,
   coverDimensions:pdf.lulu_metadata.cover_dimensions,proof:false,fixtureOnly:true,ready_for_print:false};
  for(const [name,data] of [['fuente.json',sourceBytes],['informe.json',JSON.stringify(report)],
   ['interior.pdf',interior],['cubierta.pdf',cover]]){
   await writeFile(join(folder,`caronte-prueba-tecnica-${name}`),data,{flag:'wx'});
  }
 }
});
