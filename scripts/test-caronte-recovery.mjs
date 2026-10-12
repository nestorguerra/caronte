import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {wakeBookQueue,runBookRecovery} from './wake-caronte-book-queue.mjs';

const projectUrl='https://synthetic-caronte.supabase.co';
const baseUrl=`${projectUrl}/functions/v1`;
const monitorSecret='synthetic-monitor-secret-do-not-log';
const configured={enabled:true,projectUrl,functionsBaseUrl:baseUrl,monitorSecret};
const env={CARONTE_BOOK_RECOVERY_ENABLED:'true',SUPABASE_URL:projectUrl,FUNCTIONS_BASE_URL:baseUrl,FUTURE_BOOK_MONITOR_SECRET:monitorSecret};
const privateDetail=`${monitorSecret} private interview https://private.test/?token=secret`;

test('recovery is default-off and cannot contact a server without explicit opt-in',async()=>{
  for(const enabled of [undefined,false,'true',1]){
    const result=await wakeBookQueue({enabled,fetchImpl:()=>assert.fail('Disabled recovery must be inert')});
    assert.deepEqual(result,{status:'disabled',completionVerified:false});
  }
});
test('one recovery request uses the matching project endpoint and only the monitor credential',async()=>{
  const requests=[];
  const result=await wakeBookQueue({...configured,functionsBaseUrl:`${baseUrl}/`,fetchImpl:async(url,options)=>{
    requests.push({url,options});return Response.json({ok:true,accepted:true,jobId:null});
  }});
  assert.deepEqual(result,{status:'accepted',completionVerified:false});assert.equal(requests.length,1);
  const [{url,options}]=requests;
  assert.equal(url,`${baseUrl}/future-book-session`);assert.equal(options.method,'POST');
  assert.equal(options.redirect,'error');assert.equal(options.signal.aborted,false);
  const headers=new Headers(options.headers);
  assert.equal(headers.get('x-future-book-monitor-secret'),monitorSecret);
  assert.equal(headers.get('authorization'),null);assert.equal(headers.get('apikey'),null);
  assert.equal(headers.get('content-type'),'application/json');
  assert.deepEqual(JSON.parse(options.body),{action:'advanceBook'});
});
test('mismatched, insecure or credential-bearing targets fail before exposing the monitor secret',async()=>{
  const variants=[
    {functionsBaseUrl:'http://synthetic-caronte.supabase.co/functions/v1'},
    {functionsBaseUrl:'https://another-project.supabase.co/functions/v1'},
    {functionsBaseUrl:`${baseUrl}?token=private`},{functionsBaseUrl:`${baseUrl}#private`},
    {functionsBaseUrl:`${projectUrl}/rest/v1`},
    {functionsBaseUrl:'https://user:private@synthetic-caronte.supabase.co/functions/v1'},
    {projectUrl:'https://synthetic-caronte.supabase.co:444'},
    {projectUrl:'https://synthetic-caronte.supabase.co/not-a-project'},
    {projectUrl:'https://not-supabase.example.test',functionsBaseUrl:'https://not-supabase.example.test/functions/v1'},
    {projectUrl:'not-a-url'},{functionsBaseUrl:''}
  ];
  for(const variant of variants)await assert.rejects(wakeBookQueue({...configured,...variant,
    fetchImpl:()=>assert.fail('Invalid targets must not dispatch')}),{message:'book_recovery_configuration_invalid'});
});
test('missing or malformed monitor credentials cannot dispatch',async()=>{
  for(const value of [undefined,'',' ',`${monitorSecret}\n`,123])await assert.rejects(wakeBookQueue({...configured,monitorSecret:value,
    fetchImpl:()=>assert.fail('Invalid credentials must not dispatch')}),{message:'book_recovery_configuration_invalid'});
});
test('an idle synchronous receipt is valid but does not claim book completion',async()=>{
  const result=await wakeBookQueue({...configured,fetchImpl:async()=>Response.json({ok:true,status:'idle'})});
  assert.deepEqual(result,{status:'idle',completionVerified:false});
});
test('HTTP errors are sanitized and never retried in the same recovery invocation',async()=>{
  for(const status of [401,429,500]){
    let attempts=0;
    await assert.rejects(wakeBookQueue({...configured,fetchImpl:async()=>{
      attempts++;return new Response(privateDetail,{status});
    }}),{message:'book_recovery_http_error'});
    assert.equal(attempts,1);
  }
});
test('network and redirect failures expose no upstream message and never repeat the POST',async()=>{
  let attempts=0;
  await assert.rejects(wakeBookQueue({...configured,fetchImpl:async()=>{attempts++;throw new Error(privateDetail);}}),
    {message:'book_recovery_transport_failed'});
  assert.equal(attempts,1);
});
test('malformed or failed receipts cannot masquerade as accepted or completed work',async()=>{
  for(const value of [null,[],{ok:false,error:privateDetail},{ok:true,accepted:true,jobId:'foreign-id'},
    {ok:true,accepted:true,jobId:null,status:'failed'},{ok:true,accepted:true,jobId:null,error:privateDetail},
    {ok:true,status:'ready'},{ok:true,status:'failed',errorCode:privateDetail}]){
    await assert.rejects(wakeBookQueue({...configured,fetchImpl:async()=>Response.json(value)}),{message:'book_recovery_receipt_invalid'});
  }
  await assert.rejects(wakeBookQueue({...configured,fetchImpl:async()=>new Response(privateDetail)}),{message:'book_recovery_receipt_invalid'});
});
test('the deadline includes fetch and body consumption, even if the transport ignores abort',async()=>{
  for(const stalledAt of ['fetch','body']){
    let signal,attempts=0;
    await assert.rejects(wakeBookQueue({...configured,timeoutMs:5,fetchImpl:async(_url,options)=>{
      attempts++;signal=options.signal;
      if(stalledAt==='fetch')return new Promise(()=>{});
      return {ok:true,json:()=>new Promise(()=>{})};
    }}),{message:'book_recovery_timeout'});
    assert.equal(signal.aborted,true);assert.equal(attempts,1);
  }
});
test('unsafe or unbounded deadlines fail before dispatch',async()=>{
  for(const timeoutMs of [0,-1,Infinity,NaN,30001,'15000'])await assert.rejects(wakeBookQueue({...configured,timeoutMs,
    fetchImpl:()=>assert.fail('Invalid timeout must not dispatch')}),{message:'book_recovery_configuration_invalid'});
});
test('a disabled CLI does not even read private configuration and produces a safe receipt',async()=>{
  const lines=[];
  const disabled={CARONTE_BOOK_RECOVERY_ENABLED:'false',get FUTURE_BOOK_MONITOR_SECRET(){assert.fail('Disabled runner must not read a secret');}};
  assert.equal(await runBookRecovery({env:disabled,write:value=>lines.push(value),fetchImpl:()=>assert.fail('No disabled HTTP')}),0);
  assert.deepEqual(lines.map(JSON.parse),[{event:'caronte_book_recovery',status:'disabled',completionVerified:false}]);
});
test('CLI success reports acceptance only; failure exits nonzero without secrets, addresses or raw receipts',async()=>{
  for(const failure of [false,true]){
    const lines=[];
    const exitCode=await runBookRecovery({env,write:value=>lines.push(value),fetchImpl:async()=>{
      if(failure)throw new Error(privateDetail);return Response.json({ok:true,accepted:true,jobId:null});
    }});
    assert.equal(exitCode,failure?1:0);assert.equal(lines.length,1);
    assert.doesNotMatch(lines[0],/synthetic-monitor-secret|private interview|token=secret|supabase.co/);
    const receipt=JSON.parse(lines[0]);assert.equal(receipt.completionVerified,false);
    assert.equal(receipt.status,failure?'failed':'accepted');
    if(failure)assert.equal(receipt.errorCode,'book_recovery_transport_failed');
  }
});
test('the real executable is harmless without configuration and defaults to disabled',()=>{
  const result=spawnSync(process.execPath,['scripts/wake-caronte-book-queue.mjs'],{encoding:'utf8',env:{CARONTE_BOOK_RECOVERY_ENABLED:'false'}});
  assert.equal(result.status,0);assert.equal(result.stderr,'');
  assert.equal(JSON.parse(result.stdout).status,'disabled');
});
test('the prepared operations workflow gates all invocations and does not deploy or receive provider/service keys',()=>{
  const yaml=readFileSync('.github/workflows/caronte-book-recovery.yml','utf8');
  assert.match(yaml,/cron: ['"]7-59\/10 \* \* \* \*['"]/);
  assert.match(yaml,/vars\.CARONTE_BOOK_RECOVERY_ENABLED == 'true'/);
  assert.match(yaml,/github\.event\.repository\.default_branch/);
  assert.match(yaml,/cancel-in-progress: false/);assert.match(yaml,/environment: caronte-book-operations/);
  assert.match(yaml,/persist-credentials: false/);assert.match(yaml,/timeout-minutes: 2/);
  assert.match(yaml,/contents: read/);assert.match(yaml,/node scripts\/wake-caronte-book-queue\.mjs/);
  assert.match(yaml,/secrets\.FUTURE_BOOK_MONITOR_SECRET/);
  assert.doesNotMatch(yaml,/SUPABASE_SERVICE_ROLE_KEY|OPENAI_API_KEY|ANTHROPIC_API_KEY|LULU_CLIENT_SECRET|pages: write|id-token: write|pull_request_target|continue-on-error|npm install|npm ci|deploy-pages|--retry/);
});
