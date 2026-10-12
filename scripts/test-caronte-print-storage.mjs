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
