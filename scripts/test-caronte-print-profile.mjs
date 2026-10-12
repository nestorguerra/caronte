import assert from 'node:assert/strict';
import {test} from 'node:test';
import {spawnSync} from 'node:child_process';
import {summarizePrintWorkerProfile} from './benchmark-caronte-print-worker.mjs';

const rows=Array.from({length:49},(_,index)=>({index,requestCpuMs:100,processCpuMs:300,maxRssMiB:180,
 state:index===48?'ready':'queued',requestJsonBytes:50,responseJsonBytes:120,restResponseBytes:2000,externalRequests:0}));
test('worker profile requires all measured claims and a final receipt; it never certifies Edge or printing',()=>{
 const summary=summarizePrintWorkerProfile(rows,{status:'ready',pageCount:194,pdfs:1,objects:22,readyForPrint:false});
 assert.equal(summary.claims,49);assert.equal(summary.maximumRequestCpuMs,100);
 assert.equal(summary.maximumProcessCpuMs,300);assert.equal(summary.maximumRssMiB,180);
 assert.equal(summary.hostedRuntimeVerified,false);assert.equal(summary.readyForPrint,false);
 for(const input of [rows.slice(0,48),[{...rows[0],requestCpuMs:NaN},...rows.slice(1)]])
  assert.throws(()=>summarizePrintWorkerProfile(input,{status:'ready',pageCount:194,pdfs:1,objects:22,readyForPrint:false}));
 assert.throws(()=>summarizePrintWorkerProfile(rows,{status:'blocked',pageCount:194,pdfs:0,objects:22,readyForPrint:false}));
});
test('profile reports overruns without hiding them or disclosing source and transport payloads',()=>{
 const measured=rows.map((r,i)=>({...r,requestCpuMs:i===26?2501:100,maxRssMiB:i===26?270:180,private:'never disclose'}));
 const summary=summarizePrintWorkerProfile(measured,{status:'ready',pageCount:194,pdfs:1,objects:22,readyForPrint:false});
 assert.equal(summary.requestCpuOverruns,1);assert.equal(summary.rssOverruns,1);
 assert.doesNotMatch(JSON.stringify(summary),/never disclose|private/);
});
test('benchmark rejects an invalid CLI before creating an artifact or connecting to a provider',()=>{
 const result=spawnSync(process.execPath,['scripts/benchmark-caronte-print-worker.mjs','--output-dir=https://provider.invalid/'],{encoding:'utf8'});
 assert.notEqual(result.status,0);assert.match(result.stderr,/print_worker_profile_arguments/);
});
