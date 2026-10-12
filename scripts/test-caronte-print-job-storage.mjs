import assert from 'node:assert/strict';
import {test} from 'node:test';
import * as storage from '../supabase/functions/_shared/caronte-print-storage.mjs';
const job={id:'22222222-2222-4222-8222-222222222222',session_id:'11111111-1111-4111-8111-111111111111',version:1};
const bytes=new TextEncoder().encode('%PDF-1.7\nsynthetic storage boundary');
const hash=async data=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',data)),v=>v.toString(16).padStart(2,'0')).join('');
const file={bytes,sha256:await hash(bytes),byteSize:bytes.length};
function fixture(options={}){
 const objects=new Map(),calls=[];
 // This fixture checks storage integrity, not a 50 ms performance guarantee.
 // Use the production deadline; the stalled-body test below supplies its own.
 const archive=storage.createPrintStageArchive({url:'https://storage.test',serviceKey:'synthetic-key',fetch:async(url,init)=>{
  calls.push({url,method:init.method,upsert:init.headers['x-upsert']});
  if(init.method==='POST'){
   if(objects.has(url))return new Response('',{status:409});
   objects.set(url,new Uint8Array(init.body));if(options.lostPost)throw Error('lost acceptance');return new Response('{}');
  }
  return objects.has(url)?new Response(objects.get(url)):new Response('',{status:404});
 }});
 return{archive,objects,calls};
}
test('stage objects have reserved paths, no overwrite, and exact private readback',async()=>{
 const app=fixture();const receipt=await app.archive.write(job,'part:1:10',file);
 assert.equal(receipt.path,`${job.session_id}/v01/${job.id}/parts/1-10.pdf`);
 assert.equal(receipt.verified,true);assert.equal(receipt.sha256,file.sha256);
 assert.deepEqual((await app.archive.read(job,'part:1:10',receipt)).bytes,bytes);
 assert.ok(app.calls.filter(c=>c.method==='POST').every(c=>c.upsert==='false'));
 assert.ok(app.calls.every(c=>!c.url.includes('/public/')&&!c.url.includes('/sign/')));
});
test('lost upload acceptance and an already-present exact object never cause another upload',async()=>{
 const app=fixture({lostPost:true});const receipt=await app.archive.write(job,'interior',file);
 const recovered=await app.archive.write(job,'interior',file);
 assert.equal(recovered.sha256,receipt.sha256);assert.equal(app.calls.filter(c=>c.method==='POST').length,1);
});
test('only a definite 404 means absent; corrupt or unavailable existing bytes never permit replacement',async()=>{
 const app=fixture();const receipt={...file,path:`${job.session_id}/v01/${job.id}/cover.pdf`};delete receipt.bytes;
 assert.equal(await app.archive.read(job,'cover',receipt),null);
 app.objects.set(`https://storage.test/storage/v1/object/future-book-pdfs/${receipt.path}`,new Uint8Array(bytes.length));
 await assert.rejects(app.archive.write(job,'cover',file),/print_archive_mismatch/);
 assert.equal(app.calls.filter(c=>c.method==='POST').length,0);
 const unavailable=storage.createPrintStageArchive({url:'https://storage.test',serviceKey:'synthetic-key',fetch:async()=>new Response('',{status:503})});
 await assert.rejects(unavailable.read(job,'cover',receipt),/print_archive_unverified/);
});
test('scope, source hash and receipt path reject before any network request',async()=>{
 const app=fixture();
 for(const key of ['part:2:11','part:1:11','part:201:210','../cover','cover.pdf']){
  await assert.rejects(app.archive.write(job,key,file),/print_archive_scope/);
 }
 await assert.rejects(app.archive.write({...job,version:0},'interior',file),/print_archive_scope/);
 await assert.rejects(app.archive.write(job,'interior',{...file,sha256:'0'.repeat(64)}),/print_archive_source_mismatch/);
 await assert.rejects(app.archive.read(job,'interior',{...file,path:'another/job/interior.pdf'}),/print_archive_scope/);
 assert.equal(app.calls.length,0);
});
test('only a versioned +30 job can archive the final 220-page parts beyond the old 200-page limit',async()=>{
  const app=fixture(),current={...job,source_snapshot:{prompt_version:'caronte-literary-v3'}};
  const saved=await app.archive.write(current,'part:211:220',file);
  assert.ok(saved.path.endsWith('/parts/211-220.pdf'));
  await app.archive.write(current,'part:221:224',file);
  await assert.rejects(app.archive.write(job,'part:211:220',file),/print_archive_scope/);
  await assert.rejects(app.archive.write(current,'part:221:226',file),/print_archive_scope/);
});
test('full response bodies have a deadline and are canceled',async()=>{
 let canceled=false;
 const archive=storage.createPrintStageArchive({url:'https://storage.test',serviceKey:'synthetic-key',timeoutMs:15,
  fetch:async()=>new Response(new ReadableStream({cancel(){canceled=true;}}))});
 await assert.rejects(archive.write(job,'cover',file),/print_archive_timeout/);
 await new Promise(resolve=>setTimeout(resolve,0));assert.equal(canceled,true);
});
test('credential-bearing, non-root or non-HTTPS storage origins are never accepted',()=>{
 for(const url of ['http://storage.test','https://user:secret@storage.test','https://storage.test/other','https://storage.test/?token=secret']){
  assert.throws(()=>storage.createPrintStageArchive({url,serviceKey:'synthetic-key'}),/print_storage_not_configured/);
 }
});
test('transport errors produce a stable storage code without leaking underlying response details',async()=>{
 const archive=storage.createPrintStageArchive({url:'https://storage.test',serviceKey:'synthetic-key',
  fetch:async()=>{throw Error('SYNTHETIC_PRIVATE_TRANSPORT_DETAILS');}});
 await assert.rejects(archive.write(job,'cover',file),{message:'print_archive_unverified'});
});
