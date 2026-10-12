import {pathToFileURL} from 'node:url';
import {recoveryEndpoint} from './wake-caronte-book-queue.mjs';

const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const codes=new Set(['print_recovery_configuration_invalid','print_recovery_http_error',
 'print_recovery_receipt_invalid','print_recovery_timeout','print_recovery_transport_failed']);
const fail=code=>{throw Object.assign(new Error(code),{code});};
const receipt=(status,advancedSteps=0,completedBundles=0)=>({status,advancedSteps,completedBundles,completionVerified:false});

// Independent top-level HTTP requests, not Edge self-wakes. Each request claims
// one durable step; a timeout stops this invocation without repeating its POST.
export async function wakePrintQueue({enabled=false,projectUrl,functionsBaseUrl,monitorSecret,
 fetchImpl=globalThis.fetch,maxSteps=50,timeoutMs=120000,totalTimeoutMs=240000,now=Date.now}={}){
 if(enabled!==true)return receipt('disabled');
 let url;
 try{url=recoveryEndpoint(projectUrl,functionsBaseUrl);}catch{fail('print_recovery_configuration_invalid');}
 if(typeof monitorSecret!=='string'||!monitorSecret||monitorSecret.length>4096||/\s/u.test(monitorSecret)||
  typeof fetchImpl!=='function'||typeof now!=='function'||!Number.isInteger(maxSteps)||maxSteps<1||maxSteps>60||
  !Number.isInteger(timeoutMs)||timeoutMs<1||timeoutMs>120000||
  !Number.isInteger(totalTimeoutMs)||totalTimeoutMs<1||totalTimeoutMs>300000)fail('print_recovery_configuration_invalid');
 const started=now();let advanced=0,bundles=0;
 for(let index=0;index<maxSteps;index++){
  const remaining=totalTimeoutMs-(now()-started);if(remaining<=0)return receipt('bounded',advanced,bundles);
  const controller=new AbortController();let timer,response;
  const deadline=new Promise((_resolve,reject)=>{
   timer=setTimeout(()=>{controller.abort();reject(Object.assign(new Error('print_recovery_timeout'),{code:'print_recovery_timeout'}));},Math.min(timeoutMs,remaining));
  });
  const operation=(async()=>{
   response=await fetchImpl(url,{method:'POST',redirect:'error',signal:controller.signal,
    headers:{'content-type':'application/json','x-future-book-monitor-secret':monitorSecret},body:JSON.stringify({action:'advancePrint'})});
   if(!response.ok){void response.body?.cancel().catch(()=>{});fail('print_recovery_http_error');}
   let result;try{result=await response.json();}catch{fail('print_recovery_receipt_invalid');}
   if(!result||typeof result!=='object'||Array.isArray(result)||result.ok!==true)fail('print_recovery_receipt_invalid');
   const keys=Object.keys(result),exact=allowed=>keys.length===allowed.length&&keys.every(k=>allowed.includes(k));
   if(result.status==='idle'&&exact(['ok','status']))return result;
   if(!uuid.test(result.jobId||''))fail('print_recovery_receipt_invalid');
   if(result.status==='ready'&&uuid.test(result.pdfId||'')&&exact(['ok','status','jobId','pdfId']))return result;
   if(['queued','blocked'].includes(result.status)){
    const fields=result.errorCode==null?['ok','status','jobId']:['ok','status','jobId','errorCode'];
    if(exact(fields)&&(result.errorCode==null||/^print_[a-z_]{1,70}$/.test(result.errorCode))&&
     (result.status!=='blocked'||result.errorCode))return result;
   }
   fail('print_recovery_receipt_invalid');
  })();
  let result;
  try{result=await Promise.race([operation,deadline]);}
  catch(error){fail(controller.signal.aborted?'print_recovery_timeout':codes.has(error?.code)?error.code:'print_recovery_transport_failed');}
  finally{clearTimeout(timer);}
  if(result.status==='idle')return receipt('idle',advanced,bundles);
  advanced++;if(result.status==='ready')bundles++;
  if(result.status==='blocked')return receipt('blocked',advanced,bundles);
 }
 return receipt('bounded',advanced,bundles);
}

export async function runPrintRecovery({env=process.env,fetchImpl=globalThis.fetch,
 write=value=>process.stdout.write(`${value}\n`)}={}){
 try{
  const result=env.CARONTE_PRINT_RECOVERY_ENABLED==='true'?await wakePrintQueue({enabled:true,
   projectUrl:env.SUPABASE_URL,functionsBaseUrl:env.FUNCTIONS_BASE_URL,monitorSecret:env.FUTURE_BOOK_MONITOR_SECRET,fetchImpl}):receipt('disabled');
  write(JSON.stringify({event:'caronte_print_recovery',...result}));return result.status==='blocked'?1:0;
 }catch(error){write(JSON.stringify({event:'caronte_print_recovery',...receipt('failed'),
  errorCode:codes.has(error?.code)?error.code:'print_recovery_failed'}));return 1;}
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)process.exitCode=await runPrintRecovery();
