import assert from 'node:assert/strict';
import {test} from 'node:test';
import {spawnSync} from 'node:child_process';
import {runPrintRecovery,wakePrintQueue} from './wake-caronte-print-queue.mjs';

const projectUrl='https://synthetic-print.supabase.co',functionsBaseUrl=`${projectUrl}/functions/v1`;
const monitorSecret='synthetic-print-monitor-secret';
const workerSecret='synthetic-print-worker-secret';
const jid='22222222-2222-4222-8222-222222222222',pid='44444444-4444-4444-8444-444444444444';
const settings={enabled:true,projectUrl,functionsBaseUrl,workerSecret};
const env={CARONTE_PRINT_RECOVERY_ENABLED:'true',SUPABASE_URL:projectUrl,FUNCTIONS_BASE_URL:functionsBaseUrl,CARONTE_PRINT_WORKER_SECRET:workerSecret};

test('the print recovery runner is inert by default and does not read a disabled secret',async()=>{
 for(const enabled of [undefined,false,'true',1])assert.deepEqual(await wakePrintQueue({enabled,fetchImpl:()=>assert.fail('Disabled transport')}),
  {status:'disabled',advancedSteps:0,completedBundles:0,completionVerified:false});
 const lines=[];assert.equal(await runPrintRecovery({env:{CARONTE_PRINT_RECOVERY_ENABLED:'false',
  get CARONTE_PRINT_WORKER_SECRET(){assert.fail('Disabled print-worker secret');},
  get CARONTE_PRINT_WORKER_SECRET(){assert.fail('Disabled secret');}},write:v=>lines.push(v)}),0);
 assert.equal(JSON.parse(lines[0]).status,'disabled');
});
test('the print-only runner sends its dedicated header without monitor, bearer or payload secrets',async()=>{
 const requests=[];const result=await wakePrintQueue({enabled:true,projectUrl,functionsBaseUrl,workerSecret,
  fetchImpl:async(url,options)=>{
   requests.push({url,options});return Response.json({ok:true,status:'idle'});
  }});
 assert.deepEqual(result,{status:'idle',advancedSteps:0,completedBundles:0,completionVerified:false});assert.equal(requests.length,1);
 const {url,options}=requests[0];assert.equal(url,`${functionsBaseUrl}/future-book-session`);assert.equal(options.redirect,'error');
 const headers=new Headers(options.headers);assert.equal(headers.get('x-caronte-print-worker-secret'),workerSecret);
 assert.equal(headers.get('x-future-book-monitor-secret'),null);assert.equal(headers.get('authorization'),null);
 assert.equal(headers.get('traceparent'),null);assert.deepEqual(JSON.parse(options.body),{action:'advancePrint'});
});
test('the recovery CLI reads only CARONTE_PRINT_WORKER_SECRET and never consults the generic monitor credential',async()=>{
 const lines=[],requests=[];
 const exitCode=await runPrintRecovery({env:{CARONTE_PRINT_RECOVERY_ENABLED:'true',SUPABASE_URL:projectUrl,
  FUNCTIONS_BASE_URL:functionsBaseUrl,CARONTE_PRINT_WORKER_SECRET:workerSecret,
  get FUTURE_BOOK_MONITOR_SECRET(){assert.fail('Print recovery must not read a generic monitor credential');}},
  write:value=>lines.push(value),fetchImpl:async(_url,options)=>{
   requests.push(options);return Response.json({ok:true,status:'idle'});
  }});
 assert.equal(exitCode,0);assert.equal(requests.length,1);assert.equal(lines.length,1);
 assert.equal(new Headers(requests[0].headers).get('x-caronte-print-worker-secret'),workerSecret);
 assert.equal(JSON.parse(lines[0]).status,'idle');assert.doesNotMatch(lines[0],/synthetic-print|secret/);
});
test('invalid or absent dedicated credentials cannot fall back to a valid generic monitor credential',async()=>{
 for(const invalid of [undefined,'','secret\n',123]){
  let calls=0;
  await assert.rejects(wakePrintQueue({enabled:true,projectUrl,functionsBaseUrl,workerSecret:invalid,monitorSecret,
   fetchImpl:async()=>{calls++;return Response.json({ok:true,status:'idle'});}}),{message:'print_recovery_configuration_invalid'});
  assert.equal(calls,0);
 }
});
test('independent authenticated HTTP claims advance a complete 49-stage bundle without recursion or client data',async()=>{
 const requests=[];
 const result=await wakePrintQueue({...settings,fetchImpl:async(url,options)=>{
  requests.push({url,options});const n=requests.length;
  return Response.json(n<=48?{ok:true,status:'queued',jobId:jid}:n===49?{ok:true,status:'ready',jobId:jid,pdfId:pid}:{ok:true,status:'idle'});
 }});
 assert.deepEqual(result,{status:'idle',advancedSteps:49,completedBundles:1,completionVerified:false});assert.equal(requests.length,50);
 for(const {url,options} of requests){
  assert.equal(url,`${functionsBaseUrl}/future-book-session`);assert.equal(options.redirect,'error');
  assert.deepEqual(JSON.parse(options.body),{action:'advancePrint'});
  const headers=new Headers(options.headers);assert.equal(headers.get('x-caronte-print-worker-secret'),workerSecret);
  assert.equal(headers.get('x-future-book-monitor-secret'),null);
  assert.equal(headers.get('authorization'),null);assert.equal(headers.get('traceparent'),null);
 }
});
test('a blocked job stops the batch and is not resubmitted or reported as complete',async()=>{
 let calls=0;const result=await wakePrintQueue({...settings,fetchImpl:async()=>{
  calls++;return Response.json({ok:true,status:'blocked',jobId:jid,errorCode:'print_retry_limit'});
 }});
 assert.equal(calls,1);assert.equal(result.status,'blocked');assert.equal(result.completedBundles,0);assert.equal(result.completionVerified,false);
});
test('step and total-time bounds end the batch while leaving durable work to a later independent wake',async()=>{
 let calls=0;const fetchImpl=async()=>{calls++;return Response.json({ok:true,status:'queued',jobId:jid});};
 const bounded=await wakePrintQueue({...settings,maxSteps:2,fetchImpl});assert.equal(calls,2);assert.equal(bounded.status,'bounded');
 let clock=0;calls=0;
 const timed=await wakePrintQueue({...settings,totalTimeoutMs:10,now:()=>clock,fetchImpl:async()=>{
  calls++;clock=11;return Response.json({ok:true,status:'queued',jobId:jid});
 }});
 assert.equal(calls,1);assert.equal(timed.status,'bounded');assert.equal(timed.advancedSteps,1);
});
test('foreign targets, malformed credentials and unsafe bounds never dispatch',async()=>{
 for(const variant of [{functionsBaseUrl:'https://foreign.supabase.co/functions/v1'},
  {projectUrl:'http://synthetic-print.supabase.co'},{functionsBaseUrl:`${functionsBaseUrl}?secret=private`},
  {workerSecret:''},{workerSecret:'secret\n'},{workerSecret:123},
  {maxSteps:0},{maxSteps:61},{maxSteps:'50'},{timeoutMs:120001},{totalTimeoutMs:300001}]){
  await assert.rejects(wakePrintQueue({...settings,...variant,fetchImpl:()=>assert.fail('Invalid configuration')}),{message:'print_recovery_configuration_invalid'});
 }
});
test('ambiguous timeout, HTTP rejection and transport failure stop without retrying the POST or leaking details',async()=>{
 for(const failure of ['transport','http','timeout','body']){
  let calls=0,signal;
  await assert.rejects(wakePrintQueue({...settings,timeoutMs:5,fetchImpl:async(_url,options)=>{
   calls++;signal=options.signal;
   if(failure==='transport')throw Error(`${monitorSecret} private biography`);
   if(failure==='http')return new Response(`${monitorSecret} private biography`,{status:503});
   if(failure==='timeout')return new Promise(()=>{});
   return{ok:true,json:()=>new Promise(()=>{})};
  }}),error=>/^print_recovery_(transport_failed|http_error|timeout)$/.test(error.message)&&!error.message.includes(monitorSecret));
  assert.equal(calls,1);if(['timeout','body'].includes(failure))assert.equal(signal.aborted,true);
 }
});
test('only exact safe progress receipts are accepted; acceptance alone is not a completed print stage',async()=>{
 for(const value of [{ok:true,accepted:true,jobId:null},{ok:true,status:'ready',jobId:jid},
  {ok:true,status:'queued',jobId:'foreign'},{ok:true,status:'idle',private:monitorSecret},
  {ok:true,status:'blocked',jobId:jid,errorCode:monitorSecret},{ok:false,error:monitorSecret}]){
  let calls=0;await assert.rejects(wakePrintQueue({...settings,fetchImpl:async()=>{calls++;return Response.json(value);}}),{message:'print_recovery_receipt_invalid'});
  assert.equal(calls,1);
 }
});
test('CLI reports only safe counts and diagnostics, and the actual process defaults to disabled',async()=>{
 const lines=[];assert.equal(await runPrintRecovery({env,write:v=>lines.push(v),fetchImpl:async()=>Response.json({ok:true,status:'idle'})}),0);
 assert.equal(JSON.parse(lines[0]).advancedSteps,0);assert.doesNotMatch(lines[0],/synthetic-print|secret/);
 const failed=[];assert.equal(await runPrintRecovery({env,write:v=>failed.push(v),fetchImpl:async()=>{throw Error(monitorSecret);}}),1);
 assert.doesNotMatch(failed[0],/synthetic-print-monitor-secret/);
 const processResult=spawnSync(process.execPath,['scripts/wake-caronte-print-queue.mjs'],{encoding:'utf8',env:{PATH:process.env.PATH}});
 assert.equal(processResult.status,0);assert.equal(JSON.parse(processResult.stdout).status,'disabled');
});
