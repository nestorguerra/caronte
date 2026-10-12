// Local synthetic profile of the actual HTTP route + coordinator. No remote
// fetch, SQL execution, provider, credential saving, deployment or print order.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {readFileSync} from 'node:fs';
import {join,isAbsolute,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {stripTypeScriptTypes} from 'node:module';
import vm from 'node:vm';
import {createHash} from 'node:crypto';
import {PDFDocument} from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import {createPrintStages,prototypeCoverDimensions} from '../supabase/functions/_shared/caronte-print.mjs';
import {loadPrintFonts} from '../supabase/functions/_shared/caronte-print-fonts.mjs';
import {createPrintEngine} from '../supabase/functions/_shared/caronte-print-engine.mjs';
import {createPrintStageArchive} from '../supabase/functions/_shared/caronte-print-storage.mjs';
import {createLuluCredentialStore} from '../supabase/functions/_shared/caronte-lulu-credentials.mjs';
import {createLuluPrintClient,LULU_A5_PAPERBACK_SKU} from '../supabase/functions/_shared/lulu-print.mjs';
import {printManuscript} from './fixtures/print-manuscript.mjs';

export function summarizePrintWorkerProfile(rows,receipt){
 const pages=receipt?.pageCount,claims=25+1+Math.ceil(pages/10)+2+1;
 if(!Number.isSafeInteger(pages)||pages<180||pages>200||pages%2||receipt.status!=='ready'||receipt.pdfs!==1||
  receipt.objects!==Math.ceil(pages/10)+2||receipt.readyForPrint!==false||rows.length!==claims||
  rows.at(-1)?.state!=='ready'||rows.slice(0,-1).some(r=>r.state!=='queued')||rows.some((r,i)=>r.index!==i||
   ['requestCpuMs','processCpuMs','maxRssMiB','requestJsonBytes','responseJsonBytes','restResponseBytes','externalRequests']
    .some(key=>!Number.isFinite(r[key])||r[key]<0)||r.externalRequests!==0))throw Error('print_worker_profile_unverified');
 return{fixtureOnly:true,hostedRuntimeVerified:false,readyForPrint:false,externalRequests:0,claims,pages,
  maximumRequestCpuMs:Math.max(...rows.map(r=>r.requestCpuMs)),maximumProcessCpuMs:Math.max(...rows.map(r=>r.processCpuMs)),
  maximumRssMiB:Math.max(...rows.map(r=>r.maxRssMiB)),requestCpuOverruns:rows.filter(r=>r.requestCpuMs>2000).length,
  rssOverruns:rows.filter(r=>r.maxRssMiB>256).length,totalRequestCpuMs:rows.reduce((n,r)=>n+r.requestCpuMs,0),
  maximumRestResponseBytes:Math.max(...rows.map(r=>r.restResponseBytes))};
}
const sid='11111111-1111-4111-8111-111111111111',mid='33333333-3333-4333-8333-333333333333';
const jid='22222222-2222-4222-8222-222222222222',pid='44444444-4444-4444-8444-444444444444';
const root='https://synthetic-profile.supabase.co',service='synthetic-service-key',monitor='synthetic-monitor-key';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const json=(name,folder)=>JSON.parse(readFileSync(join(folder,name),'utf8'));
const save=(name,folder,data,flag='wx')=>writeFile(join(folder,name),JSON.stringify(data),{flag});

async function runClaim(folder,index){
 // State hydration + transpilation are benchmark setup, not a hosted handler.
 // Whole-process CPU/RSS additionally include those costs and module imports.
 const db=json('database.json',folder);if(db.fixtureOnly!==true)throw Error('print_worker_profile_scope');
 let handler,stages;const metrics={restCalls:0,restRequestBytes:0,restResponseBytes:0,storageCalls:0,storageReadBytes:0,providerBoundaryCalls:0};
 const objects=new Map(db.objects.map(([path,name])=>[path,join(folder,name)]));
 const persisted=async()=>save('database.json',folder,{...db,objects:[...objects].map(([path,name])=>[path,name.slice(folder.length+1)])},'w');
 const fetchImpl=async(input,options={})=>{
  const url=new URL(String(input));
  if(url.origin==='https://api.sandbox.lulu.com'){
   metrics.providerBoundaryCalls++;
   if(url.pathname==='/auth/realms/glasstree/protocol/openid-connect/token')return Response.json({access_token:'synthetic-oauth',expires_in:300});
   if(url.pathname==='/cover-dimensions/'){
    const body=JSON.parse(options.body);if(body.interior_page_count!==194||body.pod_package_id!==LULU_A5_PAPERBACK_SKU||body.unit!=='pt')throw Error('print_worker_profile_cover_contract');
    const size=prototypeCoverDimensions(body.interior_page_count);return Response.json({width:String(size.width),height:String(size.height),unit:'pt'});
   }
   throw Error('print_worker_profile_provider_scope');
  }
  if(url.origin!==root||new Headers(options.headers).get('authorization')!==`Bearer ${service}`)throw Error('print_worker_profile_transport_scope');
  if(url.pathname.startsWith('/storage/v1/object/future-book-pdfs/')){
   metrics.storageCalls++;const path=url.pathname.slice('/storage/v1/object/future-book-pdfs/'.length);
   if(!/^11111111-1111-4111-8111-111111111111\/v01\/22222222-2222-4222-8222-222222222222\/(?:parts\/\d+-\d+|interior|cover)\.pdf$/.test(path))throw Error('print_worker_profile_object_scope');
   if(options.method==='POST'){
    if(objects.has(path))return new Response('',{status:409});
    if(new Headers(options.headers).get('x-upsert')!=='false'||!db.steps.some(s=>s.status==='started'&&s.output?.path===path))throw Error('print_worker_profile_missing_intent');
    const file=join(folder,path.split('/').slice(-2).join('-'));await writeFile(file,new Uint8Array(options.body),{flag:'wx'});
    objects.set(path,file);return Response.json({});
   }
   if(!objects.has(path))return new Response('',{status:404});
   const bytes=await readFile(objects.get(path));metrics.storageReadBytes+=bytes.length;return new Response(bytes);
  }
  if(!url.pathname.startsWith('/rest/v1/'))throw Error('print_worker_profile_transport_scope');
  metrics.restCalls++;metrics.restRequestBytes+=Buffer.byteLength(options.body||'');
  const name=url.pathname.slice('/rest/v1/'.length),body=options.body?JSON.parse(options.body):null;let result;
  if(name==='rpc/caronte_enqueue_print'){
   if(db.job)throw Error('print_worker_profile_duplicate_enqueue');
   db.job={id:jid,pdf_id:pid,session_id:sid,manuscript_id:mid,version:1,manuscript_revision:body.p_manuscript_revision,
    source_snapshot:body.p_source,source_sha256:body.p_source_sha256,input_hash:body.p_input_hash,stages_version:body.p_stages_version,
    lulu_environment:body.p_environment,lulu_configuration_tag:body.p_configuration_tag,pod_package_id:body.p_pod_package_id,
    status:'queued',stage:'plan',created_at:'2026-10-12T00:00:00.000Z',lease_token:null};result=db.job;
  }else if(name==='rpc/caronte_claim_print_job'){
   if(!db.job||!['queued','running'].includes(db.job.status)||db.job.lease_token)result=null;
   else{db.job.status='running';db.job.lease_token=`synthetic-lease-${index}`;result=db.job;}
  }else if(name==='rpc/caronte_checkpoint_print_job'||name==='rpc/caronte_finish_print_job'){
   if(db.job.status!=='running'||db.job.lease_token!==body.p_lease_token)throw Error('lease_lost');
   if(name.endsWith('finish_print_job')){db.pdfs.push(body.p_pdf);db.job.status='ready';db.job.stage='finish';db.job.lease_token=null;result=pid;}
   else{
    const at=db.steps.findIndex(s=>s.step_key===body.p_step.step_key);
    if(at>=0&&db.steps[at].status==='completed')throw Error('completed_step_is_immutable');
    if(at<0)db.steps.push(body.p_step);else db.steps[at]=body.p_step;
    db.job.status=body.p_state;db.job.stage=body.p_step.stage;if(body.p_state!=='running')db.job.lease_token=null;result=true;
   }
  }else if(name==='future_book_print_jobs')result=db.job?[db.job]:[];
  else if(name==='future_book_print_steps'){
   const filter=url.searchParams.get('step_key');result=filter?db.steps.filter(s=>`eq.${s.step_key}`===filter):db.steps;
  }else if(name==='future_book_pdfs')result=db.pdfs;
  else if(name==='future_book_provider_settings')result=[];
  else throw Error('print_worker_profile_unknown_rpc');
  const response=Response.json(result);metrics.restResponseBytes+=Buffer.byteLength(JSON.stringify(result));return response;
 };
 const env={APP_ENV:'production',SUPABASE_URL:root,SUPABASE_SERVICE_ROLE_KEY:service,SUPABASE_ANON_KEY:'synthetic-anon',
  FUTURE_BOOK_MONITOR_SECRET:monitor,CARONTE_PRINT_QUEUE_ENABLED:'true',LULU_ENVIRONMENT:'sandbox',
  LULU_CLIENT_KEY:'synthetic-client',LULU_CLIENT_SECRET:'synthetic-secret'};
 const context=vm.createContext({createPrintEngine,createPrintStageArchive,createLuluCredentialStore,LULU_A5_PAPERBACK_SKU,
  createLuluPrintClient:options=>createLuluPrintClient({...options,fetch:fetchImpl}),
  loadPrintStages:async()=>stages||(stages=createPrintStages({PDFDocument,fontkit,fonts:await loadPrintFonts(readFile)})),
  fetch:fetchImpl,Request,Response,Headers,URL,AbortSignal,AbortController,TextEncoder,TextDecoder,Uint8Array,
  crypto:globalThis.crypto,btoa,atob,setTimeout,clearTimeout,console:{error(){}},
  EdgeRuntime:{waitUntil(){throw Error('No recursive wake');}},Deno:{env:{get:key=>env[key]||''},serve:fn=>{handler=fn;}}});
 const paths=['supabase/functions/_shared/service.ts','supabase/functions/_shared/cors.ts','supabase/functions/future-book-session/index.ts'];
 vm.runInContext(paths.map(path=>stripTypeScriptTypes(readFileSync(path,'utf8').replace(/^import .*;\n/gm,'').replace(/^export /gm,''),{mode:'strip'})).join('\n'),context);
 if(!db.job){context.sourceRow=db.row;await vm.runInContext(`printEngine().enqueue('${sid}',sourceRow)`,context);await persisted();}
 for(const key of Object.keys(metrics))metrics[key]=0;
 const before=process.cpuUsage(),wall=performance.now(),payload=JSON.stringify({action:'advancePrint'});
 const response=await handler(new Request(`${root}/functions/v1/future-book-session`,{method:'POST',
  headers:{'content-type':'application/json','x-future-book-monitor-secret':monitor},body:payload}));
 const raw=await response.text(),receipt=JSON.parse(raw);const requestCpu=process.cpuUsage(before);
 const measurement={index,stage:db.job.stage,state:receipt.status,fixtureOnly:true,externalRequests:0,
  requestCpuMs:Math.round((requestCpu.user+requestCpu.system)/1000),requestWallMs:Math.round(performance.now()-wall),
  requestJsonBytes:Buffer.byteLength(payload),responseJsonBytes:Buffer.byteLength(raw),...metrics};
 if(response.status!==200||receipt.ok!==true||!['queued','ready'].includes(receipt.status))throw Error(`print_worker_profile_claim_failed:${index}:${receipt.error||receipt.errorCode||'receipt'}`);
 await persisted();const cpu=process.cpuUsage();
 measurement.processCpuMs=Math.round((cpu.user+cpu.system)/1000);measurement.maxRssMiB=Math.round(process.resourceUsage().maxRSS/1024);
 return measurement;
}

async function main(){
 const args=process.argv.slice(2),folderArg=args.find(s=>s.startsWith('--output-dir=')),stepArg=args.find(s=>s.startsWith('--claim='));
 if(!folderArg||args.length!==(stepArg?2:1)||!isAbsolute(folderArg.slice(13))||args.some(s=>s!==folderArg&&s!==stepArg)||
  (stepArg&&!/^--claim=(?:[0-9]|[1-4][0-9])$/.test(stepArg)))throw Error('print_worker_profile_arguments');
 const folder=resolve(folderArg.slice(13));
 if(stepArg){console.log(JSON.stringify(await runClaim(folder,Number(stepArg.slice(8)))));return;}
 await mkdir(folder,{recursive:true});const summaries=[];
 for(let sample=1;sample<=3;sample++){
  const target=join(folder,`sample-${sample}`);await mkdir(target,{recursive:true});
  const source=printManuscript();let seed=20261012;
  for(const c of source.sections)for(let p=0;p<c.paragraphs.length;p++){
   const words=c.paragraphs[p].split(' ');for(let i=words.length-1;i>0;i--){seed=(Math.imul(seed,1664525)+1013904223)>>>0;const at=Math.floor(seed/2**32*(i+1));[words[i],words[at]]=[words[at],words[i]];}c.paragraphs[p]=words.join(' ');
  }
  await save('database.json',target,{fixtureOnly:true,job:null,steps:[],pdfs:[],objects:[],row:{id:mid,session_id:sid,
   status:'ready',updated_at:'2026-10-12T00:00:00.000Z',manuscript:source,quality_report:{editorial_gate:'pass'},provider_chain:{degraded:false}}});
  const measurements=[];
  for(let index=0;index<49;index++){
   const run=spawnSync(process.execPath,[fileURLToPath(import.meta.url),`--output-dir=${target}`,`--claim=${index}`],{encoding:'utf8'});
   if(run.status!==0)throw Error(`print_worker_profile_process_failed:${sample}:${index}:${run.stderr.slice(-1200)}`);
   const measurement=JSON.parse(run.stdout);measurements.push(measurement);console.log(JSON.stringify({sample,...measurement}));
  }
  const db=json('database.json',target),pdf=db.pdfs[0],files=new Map(db.objects);
  const interior=await readFile(join(target,files.get(pdf.storage_path))),cover=await readFile(join(target,files.get(pdf.lulu_metadata.cover_pdf_storage_path)));
  const layout=db.steps.find(s=>s.step_key==='compose').output.layout;
  if(sha(JSON.stringify(layout))!=='7f3e02233706bf3f1d67b8232c22d8f2bd8ec77ba60f190ab347bb4ab57c391c'||
   layout.pages.flatMap(p=>p.lines.filter(l=>l.kind==='body').map(l=>l.text)).join(' ')!==source.sections.flatMap(c=>c.paragraphs).join(' ')||
   sha(interior)!==pdf.print_validation.interior_sha256||sha(cover)!==pdf.print_validation.cover_sha256||
   (await PDFDocument.load(interior)).getPageCount()!==194||(await PDFDocument.load(cover)).getPageCount()!==1)throw Error('print_worker_profile_pair_unverified');
  const summary=summarizePrintWorkerProfile(measurements,{status:db.job.status,pageCount:pdf.page_count,pdfs:db.pdfs.length,
   objects:db.objects.length,readyForPrint:pdf.print_validation.ready_for_print});
  summaries.push(summary);await save('measurements.json',target,{measurements,summary});console.log(JSON.stringify({sample,summary}));
 }
 await save('summary.json',folder,summaries);
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))await main();
