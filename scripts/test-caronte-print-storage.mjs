import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createPrintArchive} from '../supabase/functions/_shared/caronte-print-storage.mjs';
import * as storage from '../supabase/functions/_shared/caronte-print-storage.mjs';
const sessionId = '6159e0f9-4aef-4f93-9d76-f46bfa51a18a';
const artifactId = '09f66477-e8e5-4c3d-b5f7-b312099efb78';
const bytes = new TextEncoder().encode('%PDF-1.7\nprivate print proof');
const sha256 = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), x => x.toString(16).padStart(2, '0')).join('');
const files = {interior: {bytes, sha256}, cover: {bytes, sha256}};
function fixture({lostPost=false, corruptRead=false, coverFailure=false}={}) {
  const calls=[], objects=new Map();
  const archive=createPrintArchive({url:'https://storage.test',serviceKey:'synthetic-secret',fetch:async (url, options)=>{
    calls.push({url, method:options.method, upsert:options.headers['x-upsert']});
    if(options.method==='POST') {
      if(coverFailure && url.endsWith('/cover.pdf'))return new Response('',{status:503});
      objects.set(url,new Uint8Array(options.body));
      if(lostPost)throw new Error('lost_response');
      return new Response('{}',{status:200});
    }
    if(!objects.has(url))return new Response('',{status:404});
    return new Response(corruptRead?new Uint8Array([1,2,3]):objects.get(url),{status:200});
  }});
  return {archive,calls,objects};
}
test('both private PDFs are created without overwrite and read back byte-for-byte',async()=>{
  const app=fixture();const result=await app.archive({sessionId,version:2,artifactId,files});
  assert.equal(result.interior.verified,true);assert.equal(result.cover.sha256,sha256);
  assert.equal(app.calls.filter(call=>call.method==='POST').length,2);
  assert.equal(app.calls.filter(call=>call.method==='GET').length,2);
  assert.ok(app.calls.every(call=>!call.url.includes('public')));
  assert.ok(app.calls.filter(call=>call.method==='POST').every(call=>call.upsert==='false'));
});
test('lost upload acceptance can only recover from an exact private readback',async()=>{
  const app=fixture({lostPost:true});const result=await app.archive({sessionId,version:2,artifactId,files});
  assert.equal(result.cover.verified,true);
  await assert.rejects(fixture({corruptRead:true}).archive({sessionId,version:2,artifactId,files}),/print_archive_mismatch/);
});
test('a failed cover never returns a complete pair, and traversal never reaches storage',async()=>{
  const app=fixture({coverFailure:true});
  await assert.rejects(app.archive({sessionId,version:2,artifactId,files}),/print_archive_unverified/);
  const bad=fixture();
  await assert.rejects(bad.archive({sessionId:'../other',version:2,artifactId,files}),/print_archive_scope/);
  assert.equal(bad.calls.length,0);
});
test('a stalled readback is bounded and its body is canceled',async()=>{
  let canceled=false;
  const archive=createPrintArchive({url:'https://storage.test',serviceKey:'synthetic-key',timeoutMs:20,
    fetch:async (url,options)=>options.method==='POST'?new Response('{}'):
      new Response(new ReadableStream({cancel(){canceled=true;}}))});
  await assert.rejects(archive({sessionId,version:2,artifactId,files}),/print_archive_timeout/);
  await new Promise(resolve=>setTimeout(resolve,0));
  assert.equal(canceled,true);
});
test('declared source checksum must match before anything leaves the server',async()=>{
  const app=fixture();
  await assert.rejects(app.archive({sessionId,version:2,artifactId,files:{...files,interior:{bytes,sha256:'0'.repeat(64)}}}),/print_archive_source_mismatch/);
  assert.equal(app.calls.length,0);
});
test('preflight access verifies the complete private file before signing for one hour',async()=>{
  const calls=[];
  const path=`${sessionId}/v02/${artifactId}/interior.pdf`;
  const access=storage.createPrintFileAccess({url:'https://storage.test',serviceKey:'synthetic-key',fetch:async(url,init)=>{
    calls.push({url,...init});return init.method==='GET'?new Response(bytes):new Response(JSON.stringify({signedURL:`/object/sign/future-book-pdfs/${path}?token=private`}));
  }});
  assert.equal((await access.verifyFile({path,byteSize:bytes.length,sha256})).verified,true);
  assert.equal(await access.signFile('interior',path,3600),`https://storage.test/storage/v1/object/sign/future-book-pdfs/${path}?token=private`);
  assert.equal(JSON.parse(calls[1].body).expiresIn,3600);
  assert.ok(calls.every(call=>call.redirect==='error'));
});
test('preflight file mismatch, traversal and foreign signed-URL origins fail closed',async()=>{
  let calls=0;
  const access=storage.createPrintFileAccess({url:'https://storage.test',serviceKey:'synthetic-key',fetch:async(url,init)=>{
    calls++;return init.method==='GET'?new Response(new Uint8Array(bytes.length)):new Response('{"signedURL":"https://evil.test/collect"}');
  }});
  await assert.rejects(access.verifyFile({path:'../outside',byteSize:bytes.length,sha256}),/print_archive_scope/);assert.equal(calls,0);
  const path=`${sessionId}/v02/${artifactId}/interior.pdf`;
  await assert.rejects(access.verifyFile({path,byteSize:bytes.length,sha256}),/print_archive_mismatch/);
  await assert.rejects(access.signFile('interior',path,3600),/print_signed_url_invalid/);
});
test('preflight verification and signed-URL response bodies have bounded deadlines',async()=>{
  for(const operation of ['verify','sign']){
    let canceled=false;
    const access=storage.createPrintFileAccess({url:'https://storage.test',serviceKey:'synthetic-key',timeoutMs:15,
      fetch:async()=>new Response(new ReadableStream({cancel(){canceled=true;}}))});
    const path=`${sessionId}/v02/${artifactId}/interior.pdf`;
    await assert.rejects(operation==='verify'?access.verifyFile({path,byteSize:bytes.length,sha256}):access.signFile('interior',path,3600),/print_archive_timeout/);
    await new Promise(resolve=>setTimeout(resolve,0));assert.equal(canceled,true);
  }
});

const stageJob={id:artifactId,session_id:sessionId,version:2};
const stageKey='part:1:10';
const stageFile={bytes,byteSize:bytes.length,sha256};
function stageFixture({missingBody,missingStatus=400,corruptRead=false}={}){
  const calls=[],objects=new Map();
  const archive=storage.createPrintStageArchive({url:'https://storage.test',serviceKey:'synthetic-key',
    fetch:async(url,init)=>{
      calls.push({url,method:init.method,upsert:init.headers['x-upsert']});
      if(init.method==='POST'){
        objects.set(url,new Uint8Array(init.body));
        return new Response('{}',{status:200});
      }
      if(!objects.has(url))return new Response(missingBody,{status:missingStatus,
        headers:{'Content-Type':'application/json'}});
      const remote=new Uint8Array(objects.get(url));
      if(corruptRead)remote[remote.length-1]^=1;
      return new Response(remote,{status:200,headers:{'Content-Type':'application/pdf'}});
    }});
  return {archive,calls,objects,receipt:{path:archive.path(stageJob,stageKey),byteSize:bytes.length,sha256}};
}
const hostedMissingObjects=[
  ['hosted legacy not_found', {statusCode:'404',error:'not_found',message:'Object not found'}],
  ['modern NoSuchKey error', {statusCode:'404',error:'NoSuchKey',message:'Object not found'}],
  ['modern NoSuchKey code', {statusCode:'404',code:'NoSuchKey',message:'Object not found'}]
];
for(const [name,payload] of hostedMissingObjects){
  test(`stage archive recognizes ${name} at HTTP 400 and stores the exact reserved PDF once`,async()=>{
    const app=stageFixture({missingBody:JSON.stringify(payload)});
    assert.equal(await app.archive.read(stageJob,stageKey,app.receipt),null);
    const result=await app.archive.write(stageJob,stageKey,stageFile);
    assert.deepEqual(result,{...app.receipt,verified:true});
    const recovered=await app.archive.read(stageJob,stageKey,app.receipt);
    assert.deepEqual(recovered.bytes,bytes);
    assert.equal(recovered.sha256,sha256);
    assert.equal(recovered.verified,true);
    await app.archive.write(stageJob,stageKey,stageFile);
    const uploads=app.calls.filter(call=>call.method==='POST');
    assert.equal(uploads.length,1);
    assert.equal(uploads[0].upsert,'false');
    assert.ok(app.calls.every(call=>call.url===`https://storage.test/storage/v1/object/future-book-pdfs/${app.receipt.path}`));
    assert.deepEqual(app.objects.get(uploads[0].url),bytes);
  });
}
test('hosted missing-object recognition never skips checksum verification after upload',async()=>{
  const app=stageFixture({missingBody:JSON.stringify(hostedMissingObjects[0][1]),corruptRead:true});
  await assert.rejects(app.archive.write(stageJob,stageKey,stageFile),/print_archive_mismatch/);
  assert.equal(app.calls.filter(call=>call.method==='POST').length,1);
});
const unsafeStageResponses=[
  ['malformed JSON',400,'{"statusCode":"404"'],
  ['InvalidJWT',400,JSON.stringify({statusCode:'404',error:'InvalidJWT',message:'Object not found'})],
  ['AccessDenied',400,JSON.stringify({statusCode:'404',error:'AccessDenied',message:'Object not found'})],
  ['NoSuchBucket',400,JSON.stringify({statusCode:'404',error:'NoSuchBucket',message:'Object not found'})],
  ['legacy not_found for another failure',400,JSON.stringify({statusCode:'404',error:'not_found',message:'Bucket not found'})],
  ['legacy not_found without its exact missing status',400,JSON.stringify({statusCode:'400',error:'not_found',message:'Object not found'})],
  ['unrecognized JSON error',400,JSON.stringify({statusCode:'404',error:'bad_request',message:'Object not found'})],
  ['HTTP 401 with missing-looking JSON',401,JSON.stringify(hostedMissingObjects[0][1])],
  ['HTTP 403 with missing-looking JSON',403,JSON.stringify(hostedMissingObjects[0][1])]
];
for(const [name,status,body] of unsafeStageResponses){
  test(`stage archive never authorizes upload from ${name}`,async()=>{
    const app=stageFixture({missingBody:body,missingStatus:status});
    await assert.rejects(app.archive.read(stageJob,stageKey,app.receipt),/print_archive_unverified/);
    await assert.rejects(app.archive.write(stageJob,stageKey,stageFile),/print_archive_unverified/);
    assert.equal(app.calls.filter(call=>call.method==='POST').length,0);
    assert.equal(app.objects.size,0);
  });
}
test('oversized HTTP 400 missing-looking error JSON cannot authorize upload',async()=>{
  const app=stageFixture({missingBody:JSON.stringify({...hostedMissingObjects[0][1],padding:'x'.repeat(131072)})});
  await assert.rejects(app.archive.write(stageJob,stageKey,stageFile),/print_archive_(?:unverified|mismatch)/);
  assert.equal(app.calls.filter(call=>call.method==='POST').length,0);
});
test('a stalled HTTP 400 error body has a bounded deadline and is canceled before any upload',async()=>{
  let canceled=false,uploads=0;
  const archive=storage.createPrintStageArchive({url:'https://storage.test',serviceKey:'synthetic-key',timeoutMs:15,
    fetch:async(url,init)=>{
      if(init.method==='POST'){uploads++;return new Response('{}');}
      return new Response(new ReadableStream({cancel(){canceled=true;}}),{status:400,
        headers:{'Content-Type':'application/json'}});
    }});
  await assert.rejects(archive.write(stageJob,stageKey,stageFile),/print_archive_timeout/);
  await new Promise(resolve=>setTimeout(resolve,0));
  assert.equal(canceled,true);
  assert.equal(uploads,0);
});
