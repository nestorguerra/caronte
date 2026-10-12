import {pathToFileURL} from 'node:url';

const codes=new Set(['book_recovery_configuration_invalid','book_recovery_http_error',
  'book_recovery_receipt_invalid','book_recovery_timeout','book_recovery_transport_failed']);
const fail=code=>{throw Object.assign(new Error(code),{code});};
const receipt=status=>({status,completionVerified:false});

export function recoveryEndpoint(projectValue,functionsValue) {
  try {
    if(typeof projectValue!=='string'||typeof functionsValue!=='string')throw new Error();
    const project=new URL(projectValue),functions=new URL(functionsValue);
    for(const value of [project,functions]){
      if(value.protocol!=='https:'||value.username||value.password||value.search||value.hash||value.port)throw new Error();
    }
    if(!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.supabase\.co$/i.test(project.hostname)
      ||project.pathname!=='/'||functions.origin!==project.origin
      ||!['/functions/v1','/functions/v1/'].includes(functions.pathname))throw new Error();
    return `${project.origin}/functions/v1/future-book-session`;
  }catch{fail('book_recovery_configuration_invalid');}
}

// This is a single recovery signal, not a submission loop or a completion proof.
// Claim/lease eligibility and uncertain-provider handling belong to the server.
export async function wakeBookQueue({enabled=false,projectUrl,functionsBaseUrl,monitorSecret,
  fetchImpl=globalThis.fetch,timeoutMs=15000}={}) {
  if(enabled!==true)return receipt('disabled');
  const url=recoveryEndpoint(projectUrl,functionsBaseUrl);
  if(typeof monitorSecret!=='string'||!monitorSecret||monitorSecret.length>4096||/\s/u.test(monitorSecret)
    ||typeof fetchImpl!=='function'||!Number.isInteger(timeoutMs)||timeoutMs<1||timeoutMs>30000){
    fail('book_recovery_configuration_invalid');
  }
  const controller=new AbortController();let timer,response;
  const deadline=new Promise((_resolve,reject)=>{
    timer=setTimeout(()=>{controller.abort();reject(Object.assign(new Error('book_recovery_timeout'),{code:'book_recovery_timeout'}));},timeoutMs);
  });
  const operation=(async()=>{
    response=await fetchImpl(url,{method:'POST',redirect:'error',signal:controller.signal,
      headers:{'content-type':'application/json','x-future-book-monitor-secret':monitorSecret},
      body:JSON.stringify({action:'advanceBook'})});
    if(!response.ok){void response.body?.cancel().catch(()=>{});fail('book_recovery_http_error');}
    let result;
    try{result=await response.json();}catch{fail('book_recovery_receipt_invalid');}
    if(!result||typeof result!=='object'||Array.isArray(result)||result.ok!==true)fail('book_recovery_receipt_invalid');
    const keys=Object.keys(result),exact=fields=>keys.length===fields.length&&keys.every(key=>fields.includes(key));
    if(exact(['ok','accepted','jobId'])&&result.accepted===true&&result.jobId===null)return receipt('accepted');
    if(exact(['ok','status'])&&result.status==='idle')return receipt('idle');
    fail('book_recovery_receipt_invalid');
  })();
  try{return await Promise.race([operation,deadline]);}
  catch(error){fail(controller.signal.aborted?'book_recovery_timeout':codes.has(error?.code)?error.code:'book_recovery_transport_failed');}
  finally{clearTimeout(timer);}
}

export async function runBookRecovery({env=process.env,fetchImpl=globalThis.fetch,
  write=value=>process.stdout.write(`${value}\n`)}={}) {
  try{
    const enabled=env.CARONTE_BOOK_RECOVERY_ENABLED==='true';
    const result=enabled?await wakeBookQueue({enabled,
      projectUrl:env.SUPABASE_URL,functionsBaseUrl:env.FUNCTIONS_BASE_URL,
      monitorSecret:env.FUTURE_BOOK_MONITOR_SECRET,fetchImpl}):receipt('disabled');
    write(JSON.stringify({event:'caronte_book_recovery',...result}));return 0;
  }catch(error){
    write(JSON.stringify({event:'caronte_book_recovery',...receipt('failed'),
      errorCode:codes.has(error?.code)?error.code:'book_recovery_failed'}));return 1;
  }
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  process.exitCode=await runBookRecovery();
}
