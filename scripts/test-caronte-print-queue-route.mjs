import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {readFile} from 'node:fs/promises';
import {stripTypeScriptTypes} from 'node:module';
import vm from 'node:vm';
import {PDFDocument} from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import {createPrintStages} from '../supabase/functions/_shared/caronte-print.mjs';
import {loadPrintFonts} from '../supabase/functions/_shared/caronte-print-fonts.mjs';
import {createPrintEngine,printJobFingerprint} from '../supabase/functions/_shared/caronte-print-engine.mjs';
import {createPrintStageArchive} from '../supabase/functions/_shared/caronte-print-storage.mjs';
import {createLuluCredentialStore} from '../supabase/functions/_shared/caronte-lulu-credentials.mjs';
import {printManuscript} from './fixtures/print-manuscript.mjs';
import {wakePrintQueue} from './wake-caronte-print-queue.mjs';

const sid='11111111-1111-4111-8111-111111111111',mid='33333333-3333-4333-8333-333333333333';
const jid='22222222-2222-4222-8222-222222222222',pid='44444444-4444-4444-8444-444444444444';
const root='https://synthetic-print.supabase.co',service='synthetic-service-key',monitor='synthetic-monitor-key';
const worker='synthetic-print-worker-secret';
const tag='a'.repeat(64),sku='0583X0827.BW.STD.PB.060UC444.MXX';
const stages=createPrintStages({PDFDocument,fontkit,fonts:await loadPrintFonts(readFile)});
const executable=path=>stripTypeScriptTypes(readFileSync(path,'utf8').replace(/^import .*;\n/gm,'').replace(/^export /gm,''),{mode:'strip'});
const source=['supabase/functions/_shared/service.ts','supabase/functions/_shared/cors.ts',
 'supabase/functions/future-book-session/index.ts'].map(executable).join('\n');

// Execute actual service/auth/CORS/route/coordinator/stage implementations.
// Only the HTTP DB and remote providers are synthetic. This does not execute SQL.
function fixture({enabled=true,missingCredentials=false,degraded=false,claimFailure=false,claimLimit=Infinity,role=null,controlLost=false,controlUnconfirmed=false,printWorkerSecret=''}={}){
 const env={APP_ENV:'production',SUPABASE_URL:root,SUPABASE_SERVICE_ROLE_KEY:service,
  SUPABASE_ANON_KEY:'synthetic-anon',FUTURE_BOOK_MONITOR_SECRET:monitor,FUTURE_BOOK_ADMIN_TOKEN:'synthetic-admin-token',
  CARONTE_PRINT_WORKER_SECRET:printWorkerSecret,
  CARONTE_PRINT_QUEUE_ENABLED:enabled?'true':'false',FUTURE_BOOK_RATE_LIMIT_DISABLED:'true',
  LULU_ENVIRONMENT:'sandbox',LULU_CLIENT_KEY:missingCredentials?'':'synthetic-client',
  LULU_CLIENT_SECRET:missingCredentials?'':'synthetic-secret'};
 const session={id:sid,public_token:'synthetic-session-token',status:'book_ready',book_status:'ready'};
 const manuscript={id:mid,session_id:sid,status:'ready',updated_at:'2026-10-12T00:00:00.000Z',
  manuscript:printManuscript(),provider_chain:{degraded},quality_report:{editorial_gate:'pass'}};
 let handler,job=null;const steps=[],pdfs=[],requests=[],logs=[];let stageLoads=0;
 const copy=value=>structuredClone(value);
 const fetchImpl=async(input,options={})=>{
  const url=new URL(String(input));assert.equal(url.origin,root,'No real provider call');
  const headers=new Headers(options.headers),body=options.body?JSON.parse(options.body):null;
  requests.push({url,headers,body,method:options.method||'GET'});
  if(url.pathname==='/auth/v1/user')return role?Response.json({id:mid,email:'operator@example.test'}):Response.json({message:'Invalid synthetic session'},{status:401});
  const name=url.pathname.replace('/rest/v1/','');
  assert.equal(headers.get('authorization'),`Bearer ${service}`);
  if(name==='future_book_admin_users')return Response.json(role?[{id:mid,role,status:'active'}]:[]);
  if(name==='future_book_sessions'){
   const id=url.searchParams.get('id'),token=url.searchParams.get('public_token');
   if(id!==`eq.${sid}`||(token&&token!==`eq.${session.public_token}`))return Response.json([]);
   return Response.json([session]);
  }
  if(name==='future_book_manuscripts')return Response.json(url.searchParams.get('session_id')===`eq.${sid}`?[manuscript]:[]);
  if(name==='future_book_provider_settings')return Response.json([]);
  if(name==='rpc/caronte_enqueue_print'){
   if(!job){job={id:jid,pdf_id:pid,session_id:sid,manuscript_id:mid,version:1,
    source_snapshot:body.p_source,source_sha256:body.p_source_sha256,input_hash:body.p_input_hash,
    stages_version:body.p_stages_version,lulu_environment:body.p_environment,lulu_configuration_tag:body.p_configuration_tag,
    pod_package_id:body.p_pod_package_id,created_at:'2026-10-12T00:00:00.000Z',status:'queued',stage:'plan'};
    job.updated_at=job.created_at;session.status='pdf_generating';}
   if(job.input_hash!==body.p_input_hash)return Response.json({message:'active_print_source_changed'},{status:409});
   return Response.json(job);
  }
  if(name==='rpc/caronte_claim_print_job'){
   if(claimFailure)throw Error('private transport detail with interview and key');
   if(!job||!['queued','running'].includes(job.status)||steps.filter(s=>s.status==='completed').length>=claimLimit)return Response.json(null);
   job.status='running';job.lease_token='synthetic-lease';return Response.json(job);
  }
  if(name==='rpc/caronte_checkpoint_print_job'){
   const at=steps.findIndex(s=>s.step_key===body.p_step.step_key);
   if(at<0)steps.push(copy(body.p_step));else steps[at]=copy(body.p_step);
   job.status=body.p_state;job.stage=body.p_step.stage;
   if(body.p_state!=='running')job.lease_token=null;
   return Response.json(true);
  }
  if(name==='future_book_print_jobs')return Response.json(job?[job]:[]);
  if(name==='rpc/caronte_control_print_job'){
   if(controlUnconfirmed)throw Error('private response unknown');
   if(job.status!=='blocked'||body.p_expected_revision!==job.updated_at)return Response.json({message:'print_control_conflict'},{status:409});
   job.status=body.p_action==='resume'?'queued':'cancelled';job.updated_at='2026-10-12T00:01:00.000Z';
   job.control_history=[{action:body.p_action,previousRevision:body.p_expected_revision,at:job.updated_at,reason:body.p_reason,actor:body.p_actor}];
   if(controlLost)throw Error('private lost control response');
   return Response.json(job);
  }
  if(name==='future_book_print_steps'){
   const key=url.searchParams.get('step_key');
   let selected=key?.startsWith('eq.')?steps.filter(s=>`eq.${s.step_key}`===key):
    key?.startsWith('in.(')?steps.filter(s=>key.slice(4,-1).split(',').includes(s.step_key)):steps;
   if(url.searchParams.get('stage')==='neq.plan')selected=selected.filter(s=>s.stage!=='plan');
   const fields=url.searchParams.get('select');
   return Response.json(fields&&fields!=='*'?selected.map(s=>Object.fromEntries(fields.split(',').map(k=>
    k==='plan_format:output->>format'?['plan_format',s.output?.format]:[k,s[k]]))):selected);
  }
  if(name==='future_book_pdfs')return Response.json(pdfs);
  assert.fail(`Unexpected synthetic HTTP path: ${url.pathname}`);
 };
 const context=vm.createContext({createPrintEngine,createPrintStageArchive,createLuluCredentialStore,
  loadPrintStages:async()=>{stageLoads++;return stages;},renderPrintBundle:()=>assert.fail('Never inline-render literary v2'),
  createLuluPrintClient:()=>assert.fail('No Lulu call before cover'),LULU_A5_PAPERBACK_SKU:sku,
  fetch:fetchImpl,Request,Response,Headers,URL,AbortSignal,AbortController,TextEncoder,TextDecoder,
  Uint8Array,crypto:globalThis.crypto,btoa,atob,setTimeout,clearTimeout,
  console:{error:value=>logs.push(value)},EdgeRuntime:{waitUntil:()=>assert.fail('No recursive/background queue chain')},
  Deno:{env:{get:name=>env[name]||''},serve:value=>{handler=value;}}});
 vm.runInContext(source,context);vm.runInContext(`luluConfigurationTag = async () => '${tag}';`,context);
 const dispatch=async(payload,authorization,secret,customHeaders={})=>{
  const response=await handler(new Request(`${root}/functions/v1/future-book-session`,{method:'POST',
   headers:{...Object.fromEntries(new Headers(customHeaders)),'content-type':'application/json',...(authorization?{authorization}:{}),...(secret?{'x-future-book-monitor-secret':secret}:{})},
   body:JSON.stringify(payload)}));return{status:response.status,data:await response.json()};
 };
 const credentials={sessionId:sid,publicToken:session.public_token};
 return{context,dispatch,requests,logs,session,steps,pdfs,env,stageLoads:()=>stageLoads,get job(){return job;},
  generate:extra=>dispatch({action:'generatePdf',...credentials,...extra}),status:extra=>dispatch({action:'getPdfStatus',...credentials,...extra}),
  async finishReceipt(){
   const interior={storage_verified:true,sha256:'b'.repeat(64),pageCount:194},cover={storage_verified:true,sha256:'c'.repeat(64)};
   steps.push({step_key:'interior',stage:'interior',status:'completed',output:interior,output_hash:await printJobFingerprint(interior)},
    {step_key:'cover',stage:'cover',status:'completed',output:cover,output_hash:await printJobFingerprint(cover)});
   const prefix=`${sid}/v01/${jid}`;
   pdfs.push({id:pid,print_job_id:jid,session_id:sid,manuscript_id:mid,version:1,status:'generated',review_status:'pending_review',
    storage_path:`${prefix}/interior.pdf`,page_count:194,print_validation:{source_sha256:job.source_sha256,interior_sha256:interior.sha256,cover_sha256:cover.sha256},
    lulu_metadata:{interior_sha256:interior.sha256,cover_sha256:cover.sha256,interior_pdf_storage_path:`${prefix}/interior.pdf`,
     cover_pdf_storage_path:`${prefix}/cover.pdf`,environment:'sandbox',pod_package_id:sku,ready_for_print:false},
    metadata:{print_job_id:jid,lulu_credential_tag:tag,print_quote:{private:'synthetic-address'},print_order:{state:'approved',private:'synthetic-address'}}});
   job.status='ready';session.status='pending_review';
  }};
}

test('print administration authenticates, enforces read-only roles and never loads fonts',async()=>{
 const app=fixture({role:'viewer'});await app.generate();
 const list=await app.dispatch({action:'adminPrintJobs',limit:20,offset:0},'Bearer synthetic-user');
 assert.equal(list.status,200);assert.equal(list.data.items[0].id,jid);assert.equal(list.data.hasMore,false);
 app.job.status='blocked';app.job.error_code='print_archive_timeout';
 app.steps.push({step_key:'part:1:10',stage:'part',status:'failed',attempt:3,error_code:'print_archive_timeout',output:{private:'INICIO1P1'}});
 const detail=await app.dispatch({action:'adminPrintJob',jobId:jid},'Bearer synthetic-user');
 assert.equal(detail.status,200);assert.equal(detail.data.canResume,false);assert.equal(detail.data.canCancel,false);
 assert.doesNotMatch(JSON.stringify(detail.data),/source_snapshot|INICIO1P1|synthetic-secret|lease_token/);
 const write=await app.dispatch({action:'adminResumePrint',jobId:jid,reason:'Archivo revisado',expectedRevision:app.job.updated_at},'Bearer synthetic-user');
 assert.equal(write.status,400);assert.match(write.data.error,/permissions/);assert.equal(app.job.status,'blocked');
 assert.equal(app.stageLoads(),0);
});
test('print controls send a conditional operator decision, reconcile lost acceptance and expose no private source',async()=>{
 const app=fixture({role:'ops',controlLost:true});await app.generate();app.job.status='blocked';app.job.error_code='print_archive_timeout';
 app.steps.push({step_key:'plan:0:12',stage:'plan',status:'completed',attempt:1,output:{private:'INICIO1P1'}},
 {step_key:'part:1:10',stage:'part',status:'failed',attempt:3,error_code:'print_archive_timeout'});
 const before=await app.dispatch({action:'adminPrintJob',jobId:jid},'Bearer synthetic-user');
 assert.equal(before.data.canResume,true);assert.equal(before.data.canCancel,true);
 const result=await app.dispatch({action:'adminResumePrint',jobId:jid,reason:'Almacenamiento corregido',expectedRevision:app.job.updated_at},'Bearer synthetic-user');
 assert.equal(result.status,200);assert.equal(result.data.job.status,'queued');
 assert.equal(result.data.lastControl.action,'resume');assert.equal(app.steps[0].status,'completed');
 assert.equal(app.requests.filter(r=>r.url.pathname.endsWith('caronte_control_print_job')).length,1);
 assert.doesNotMatch(JSON.stringify(result.data),/INICIO1P1|source_snapshot|operator@example|Almacenamiento corregido/);
});
test('print controls reject unsafe source/receipts, active jobs, invalid revisions, IDs, reasons and pagination before mutation',async()=>{
 const app=fixture({role:'ops'});await app.generate();
 const auth='Bearer synthetic-user';
 for(const payload of [{action:'adminPrintJobs',limit:0},{action:'adminPrintJobs',offset:-1},{action:'adminPrintJob',jobId:{}},
  {action:'adminCancelPrint',jobId:jid,reason:'x',expectedRevision:app.job.updated_at},
  {action:'adminResumePrint',jobId:jid,reason:'Archivo revisado',expectedRevision:'not-a-date'}]){
  assert.equal((await app.dispatch(payload,auth)).status,400);
 }
 app.steps.push({step_key:'part:1:10',stage:'part',status:'failed',attempt:3,error_code:'print_archive_timeout'});
 for(const status of ['queued','running','ready','cancelled']){
  app.job.status=status;app.job.error_code='print_archive_timeout';
  assert.equal((await app.dispatch({action:'adminCancelPrint',jobId:jid,reason:'Cancelar sin borrar',expectedRevision:app.job.updated_at},auth)).status,400);
 }
 for(const error of ['print_source_changed','print_step_receipt_corrupt','print_lulu_configuration_changed','print_retry_limit']){
  app.job.status='blocked';app.job.error_code=error;
  assert.equal((await app.dispatch({action:'adminResumePrint',jobId:jid,reason:'Archivo revisado',expectedRevision:app.job.updated_at},auth)).status,400);
 }
 assert.equal(app.requests.filter(r=>r.url.pathname.endsWith('caronte_control_print_job')).length,0);
});
test('disabled print administration is unavailable, not an empty queue, and unauthenticated reads are rejected',async()=>{
 const app=fixture({enabled:false});
 const result=await app.dispatch({action:'adminPrintJobs',adminToken:'synthetic-admin-token'});
 assert.equal(result.status,200);assert.equal(result.data.available,false);assert.equal(result.data.items,null);
 const denied=await app.dispatch({action:'adminPrintJob',jobId:jid});
 assert.equal(denied.status,400);assert.match(denied.data.error,/Invalid admin token/);
});
test('print cancellation is verified with the exact revision and does not mutate completed steps or submit an order',async()=>{
 const app=fixture({role:'ops'});await app.generate();app.job.status='blocked';app.job.error_code='print_source_changed';
 app.steps.push({step_key:'plan:0:12',stage:'plan',status:'completed',attempt:1,output_hash:'b'.repeat(64)});
 const completed=structuredClone(app.steps[0]);const payload={action:'adminCancelPrint',jobId:jid,reason:'El operador cancela conservando archivos',expectedRevision:app.job.updated_at};
 const conflict=await app.dispatch({...payload,expectedRevision:'2026-10-11T00:00:00.000Z'},'Bearer synthetic-user');
 assert.equal(conflict.status,400);assert.equal(conflict.data.error,'print_control_conflict');
 const result=await app.dispatch(payload,'Bearer synthetic-user');
 assert.equal(result.status,200);assert.equal(result.data.job.status,'cancelled');assert.deepEqual(app.steps[0],completed);
 assert.equal(app.requests.filter(r=>r.url.pathname.endsWith('caronte_control_print_job')).length,1);
 assert.equal(app.stageLoads(),0);
});
test('unknown print-control outcome stays unconfirmed and never resubmits within the route',async()=>{
 const app=fixture({role:'ops',controlUnconfirmed:true});await app.generate();app.job.status='blocked';app.job.error_code='print_archive_timeout';
 app.steps.push({step_key:'part:1:10',stage:'part',status:'failed',attempt:3,error_code:'print_archive_timeout'});
 const result=await app.dispatch({action:'adminResumePrint',jobId:jid,reason:'Archivo revisado y corregido',expectedRevision:app.job.updated_at},'Bearer synthetic-user');
 assert.equal(result.status,400);assert.equal(result.data.error,'print_control_unconfirmed');
 assert.equal(app.requests.filter(r=>r.url.pathname.endsWith('caronte_control_print_job')).length,1);
 assert.equal(app.job.status,'blocked');assert.doesNotMatch(JSON.stringify(result.data),/private response|revisado/);
});

test('literary v2 is default-off and cannot silently use the monolithic renderer',async()=>{
 const app=fixture({enabled:false}),result=await app.generate();
 assert.equal(result.status,400);assert.equal(result.data.error,'print_queue_disabled');
 assert.equal(app.job,null);assert.equal(app.stageLoads(),0);
 assert.equal(app.requests.some(r=>r.method==='POST'),false);
});
test('the original generate/status actions reserve one job and expose progress, not a premature PDF',async()=>{
 const app=fixture(),first=await app.generate(),again=await app.generate(),observed=await app.status();
 assert.equal(first.status,200);assert.equal(first.data.job.status,'queued');assert.equal(first.data.pdf,null);
 assert.equal(again.data.job.id,first.data.job.id);assert.equal(observed.data.job.id,first.data.job.id);
 assert.equal(first.data.session.status,'pdf_generating');assert.equal(app.job.version,1);
 assert.equal(app.stageLoads(),0);assert.equal(app.steps.length,0);
 assert.doesNotMatch(JSON.stringify(observed.data),/INICIO1P1|source_snapshot|synthetic-client|synthetic-secret/);
});
test('session credentials are checked before querying or mutating the print queue',async()=>{
 const app=fixture();
 for(const action of ['generatePdf','getPdfStatus']){
  const result=await app.dispatch({action,sessionId:sid,publicToken:'foreign-token'});
  assert.equal(result.status,400);assert.equal(result.data.error,'Session not found');
 }
 assert.equal(app.job,null);assert.equal(app.requests.length,2);
});
test('missing Lulu credentials and degraded source cannot enqueue work',async()=>{
 for(const options of [{missingCredentials:true},{degraded:true}]){
  const app=fixture(options),result=await app.generate();
  assert.equal(result.status,400);assert.match(result.data.error,/print_(lulu_credentials_required|manuscript_not_approved)/);
  assert.equal(app.job,null);assert.equal(app.requests.some(r=>r.url.pathname.endsWith('caronte_enqueue_print')),false);
 }
});
test('worker authentication and strict UUID validation precede claim and rendering',async()=>{
 const app=fixture();
 for(const authorization of [undefined,'Bearer foreign-token']){
  const result=await app.dispatch({action:'advancePrint',jobId:jid},authorization);
  assert.equal(result.status,400);assert.equal(result.data.error,'Invalid admin token');
 }
 for(const jobId of ['',{},123,`${jid} suffix`]){
  const result=await app.dispatch({action:'advancePrint',jobId},`Bearer ${service}`);
  assert.equal(result.status,400);assert.equal(result.data.error,'invalid_print_job_id');
 }
 assert.equal(app.requests.some(r=>r.url.pathname.endsWith('caronte_claim_print_job')),false);assert.equal(app.stageLoads(),0);
});
test('independent service and monitor requests each complete exactly one real planning stage',async()=>{
 const app=fixture();await app.generate();
 for(const [authorization,secret] of [[`Bearer ${service}`,null],[null,monitor]]){
  const result=await app.dispatch({action:'advancePrint',jobId:jid},authorization,secret);
  assert.equal(result.status,200);assert.deepEqual(result.data,{ok:true,status:'queued',jobId:jid});
 }
 assert.equal(app.steps.length,2);assert.ok(app.steps.every(step=>step.status==='completed'&&step.stage==='plan'));
 assert.equal(app.stageLoads(),2);assert.equal(app.pdfs.length,0);
 const status=await app.status();assert.equal(status.data.job.completedSteps,2);assert.equal(status.data.pdf,null);
 assert.equal(app.requests.some(r=>r.url.pathname.startsWith('/functions/')),false);
});
test('the dedicated print-worker header authorizes exactly one real planning stage without generic credentials',async()=>{
 const app=fixture({printWorkerSecret:worker});await app.generate();
 const result=await app.dispatch({action:'advancePrint',jobId:jid},null,null,{'x-caronte-print-worker-secret':worker});
 assert.deepEqual(result,{status:200,data:{ok:true,status:'queued',jobId:jid}});
 assert.equal(app.steps.length,1);assert.equal(app.steps[0].status,'completed');assert.equal(app.steps[0].stage,'plan');
 assert.equal(app.stageLoads(),1);assert.equal(app.pdfs.length,0);
 assert.equal(app.requests.filter(r=>r.url.pathname.endsWith('caronte_claim_print_job')).length,1);
 assert.equal(app.requests.some(r=>r.url.pathname.startsWith('/functions/')),false);
});
test('missing, wrong or unconfigured print-worker credentials reject before claim and rendering',async()=>{
 for(const [configured,provided] of [[worker,undefined],[worker,'foreign-worker-secret'],['',worker]]){
  const app=fixture({printWorkerSecret:configured});await app.generate();const before=app.requests.length;
  const result=await app.dispatch({action:'advancePrint',jobId:jid},null,null,
   provided?{'x-caronte-print-worker-secret':provided}:{});
  assert.equal(result.status,400);assert.equal(result.data.error,'Invalid admin token');
  assert.equal(app.requests.length,before);assert.equal(app.stageLoads(),0);assert.equal(app.steps.length,0);
 }
});
test('the print-only secret cannot authorize book, monitor, administration or Lulu-order routes through any carrier',async()=>{
 const actions=['advanceBook','runAutonomousMonitor','runSyntheticMonitor','adminDashboard','adminMonitor','adminPrintJobs',
  'adminPrintOrder','adminApprovePrintOrder','adminSubmitPrintOrder','adminSyncPrintOrder','adminReconcilePrintOrder'];
 for(const action of actions){
  for(const carrier of ['print-header','monitor-header','job-secret','admin-token']){
   const app=fixture({printWorkerSecret:worker});
   const payload={action,jobId:jid,pdfId:pid,...(carrier==='job-secret'?{jobSecret:worker}:{}),
    ...(carrier==='admin-token'?{adminToken:worker}:{})};
   const result=await app.dispatch(payload,null,carrier==='monitor-header'?worker:null,
    carrier==='print-header'?{'x-caronte-print-worker-secret':worker}:{});
   assert.equal(result.status,400,`${action} rejects ${carrier}`);
   assert.equal(result.data.error,'Invalid admin token',`${action} has not passed authentication with ${carrier}`);
   assert.equal(app.requests.length,0);assert.equal(app.stageLoads(),0);assert.equal(app.job,null);
  }
 }
});
test('a print-only secret in generic monitor or payload fields cannot authorize even a print claim',async()=>{
 for(const carrier of ['monitor-header','job-secret','admin-token']){
  const app=fixture({printWorkerSecret:worker});await app.generate();const before=app.requests.length;
  const payload={action:'advancePrint',jobId:jid,...(carrier==='job-secret'?{jobSecret:worker}:{}),
   ...(carrier==='admin-token'?{adminToken:worker}:{})};
  const result=await app.dispatch(payload,null,carrier==='monitor-header'?worker:null);
  assert.equal(result.status,400);assert.equal(result.data.error,'Invalid admin token');
  assert.equal(app.requests.length,before);assert.equal(app.stageLoads(),0);assert.equal(app.steps.length,0);
 }
});
test('the dedicated print-worker configuration preserves existing admin-token advancement',async()=>{
 const app=fixture({printWorkerSecret:worker});await app.generate();
 const result=await app.dispatch({action:'advancePrint',jobId:jid,adminToken:'synthetic-admin-token'});
 assert.deepEqual(result,{status:200,data:{ok:true,status:'queued',jobId:jid}});
 assert.equal(app.steps.length,1);assert.equal(app.steps[0].status,'completed');assert.equal(app.steps[0].stage,'plan');
});
test('a disabled worker performs no claim, and an empty enabled queue returns synchronous idle',async()=>{
 const off=fixture({enabled:false}),blocked=await off.dispatch({action:'advancePrint'},`Bearer ${service}`);
 assert.equal(blocked.status,400);assert.equal(blocked.data.error,'print_queue_disabled');assert.equal(off.requests.length,0);
 const on=fixture(),idle=await on.dispatch({action:'advancePrint'},`Bearer ${service}`);
 assert.deepEqual(idle,{status:200,data:{ok:true,status:'idle'}});assert.equal(on.requests.length,1);assert.equal(on.stageLoads(),0);
});
test('ready status exposes only the verified pair and removes private quotation/order/configuration data',async()=>{
 const app=fixture();await app.generate();await app.finishReceipt();const result=await app.status();
 assert.equal(result.status,200);assert.equal(result.data.job.status,'ready');assert.equal(result.data.pdf.id,pid);
 assert.equal(result.data.pdf.luluMetadata.ready_for_print,false);assert.equal(result.data.session.status,'pending_review');
 assert.doesNotMatch(JSON.stringify(result.data),/synthetic-address|lulu_credential_tag|source_snapshot|print_quote/);
 assert.equal(result.data.pdf.printOrder.hasIntent,true);
 app.pdfs[0].lulu_metadata.cover_sha256='d'.repeat(64);
 const invalid=await app.status();assert.equal(invalid.status,400);assert.equal(invalid.data.error,'print_bundle_persistence_unverified');
});
test('worker database failure returns only a safe diagnostic and never retries the claim in the request',async()=>{
 const app=fixture({claimFailure:true}),result=await app.dispatch({action:'advancePrint'},`Bearer ${service}`);
 assert.equal(result.status,400);assert.equal(result.data.error,'print_storage_unavailable');
 assert.equal(app.requests.length,1);assert.doesNotMatch(JSON.stringify({result,logs:app.logs}),/private transport|interview and key/);
});
test('the independent executable connects to the actual authenticated route and coordinator, not an acceptance stub',async()=>{
 const app=fixture({claimLimit:2,printWorkerSecret:worker});await app.generate();
 const result=await wakePrintQueue({enabled:true,projectUrl:root,functionsBaseUrl:`${root}/functions/v1`,workerSecret:worker,
  fetchImpl:async(url,options)=>{
   assert.equal(url,`${root}/functions/v1/future-book-session`);
   const response=await app.dispatch(JSON.parse(options.body),null,null,new Headers(options.headers));
   return Response.json(response.data,{status:response.status});
  }});
 assert.deepEqual(result,{status:'idle',advancedSteps:2,completedBundles:0,completionVerified:false});
 assert.equal(app.steps.length,2);assert.ok(app.steps.every(s=>s.status==='completed'));assert.equal(app.pdfs.length,0);
});
test('the print-only recovery executable reaches the actual route using only its dedicated worker header',async()=>{
 const app=fixture({claimLimit:2,printWorkerSecret:worker});await app.generate();
 const result=await wakePrintQueue({enabled:true,projectUrl:root,functionsBaseUrl:`${root}/functions/v1`,workerSecret:worker,
  fetchImpl:async(url,options)=>{
   assert.equal(url,`${root}/functions/v1/future-book-session`);const headers=new Headers(options.headers);
   assert.equal(headers.get('x-caronte-print-worker-secret'),worker);assert.equal(headers.get('x-future-book-monitor-secret'),null);
   assert.equal(headers.get('authorization'),null);assert.deepEqual(JSON.parse(options.body),{action:'advancePrint'});
   const response=await app.dispatch(JSON.parse(options.body),null,null,headers);
   return Response.json(response.data,{status:response.status});
  }});
 assert.deepEqual(result,{status:'idle',advancedSteps:2,completedBundles:0,completionVerified:false});
 assert.equal(app.steps.length,2);assert.ok(app.steps.every(s=>s.status==='completed'));assert.equal(app.pdfs.length,0);
});
