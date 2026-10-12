import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {readFile} from 'node:fs/promises';
import {stripTypeScriptTypes} from 'node:module';
import vm from 'node:vm';
import {PDFDocument} from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import {createPrintRenderer, prototypeCoverDimensions} from '../supabase/functions/_shared/caronte-print.mjs';
import {createPrintArchive} from '../supabase/functions/_shared/caronte-print-storage.mjs';
import {loadPrintFonts} from '../supabase/functions/_shared/caronte-print-fonts.mjs';
import {createLuluCredentialStore} from '../supabase/functions/_shared/caronte-lulu-credentials.mjs';
import {printManuscript} from './fixtures/print-manuscript.mjs';

const code = stripTypeScriptTypes(readFileSync('supabase/functions/future-book-session/index.ts', 'utf8').replace(/^import .*;\n/gm, ''), {mode: 'strip'});
const renderer = createPrintRenderer({PDFDocument, fontkit, fonts: await loadPrintFonts(readFile)});
const id = '6159e0f9-4aef-4f93-9d76-f46bfa51a18a';
function fixture({coverFailure=false, lostPdfReadback=false, reorderReadback=false, degraded=false}={}) {
  let session = {id, status: 'book_ready', public_token: 'synthetic-token'};
  const pdfs=[], objects=new Map(), dimensions=[];
  const rest = async (resource, options={}) => {
    if(resource.startsWith('future_book_sessions')) {
      if(options.method==='PATCH') session={...session,...options.body};
      return [structuredClone(session)];
    }
    if(resource.startsWith('future_book_manuscripts'))return [{id:'manuscript-proof',status:'ready',manuscript:printManuscript(),provider_chain:{degraded}}];
    if(resource.startsWith('future_book_pdfs')) {
      if(options.method==='POST') { const row={id:'pdf-proof',...options.body};pdfs.push(row);return [row]; }
      if(lostPdfReadback)return [];
      return structuredClone(pdfs).map(row => reorderReadback ? {...row,
        lulu_metadata:Object.fromEntries(Object.entries(row.lulu_metadata).reverse()),
        print_validation:Object.fromEntries(Object.entries(row.print_validation).reverse())} : row);
    }
    return [];
  };
  const env = {SUPABASE_URL:'https://storage.test',SUPABASE_SERVICE_ROLE_KEY:'synthetic-storage-key',LULU_ENVIRONMENT:'sandbox',LULU_CLIENT_KEY:'synthetic-lulu-key',LULU_CLIENT_SECRET:'synthetic-lulu-secret'};
  const fetchImpl = async (url, options) => {
    if(options.method==='POST') {
      if(coverFailure && url.endsWith('/cover.pdf'))return new Response('',{status:503});
      objects.set(url,new Uint8Array(options.body));return new Response('{}',{status:200});
    }
    return objects.has(url)?new Response(objects.get(url),{status:200}):new Response('',{status:404});
  };
  const context = vm.createContext({rest,encodeParam:encodeURIComponent,crypto:globalThis.crypto,
    btoa,atob,TextEncoder,TextDecoder,Uint8Array,Request,Response,URL,AbortController,setTimeout,clearTimeout,
    fetch:fetchImpl,renderPrintBundle:renderer,createPrintArchive,createLuluCredentialStore,
    createLuluPrintClient:()=>({calculateCoverDimensions:async input=>{
      dimensions.push(input);const geometry=prototypeCoverDimensions(input.interior_page_count);
      return {width:String(geometry.width),height:String(geometry.height),unit:'pt'};
    }}),LULU_A5_PAPERBACK_SKU:'0583X0827.BW.STD.PB.060UC444.MXX',
    Deno:{env:{get:name=>env[name]||''},serve(){}}});
  vm.runInContext(code,context);
  vm.runInContext('enforceAbuseLimit = async () => ({});',context);
  return {context,pdfs,objects,dimensions,session:()=>session,
    // Historical monolithic helper coverage only. Literary-v2 HTTP generation
    // now enters the durable queue, tested with real auth in queue-route tests.
    generate:()=>context.generateProductionPrintPdf(session,{id:'manuscript-proof',manuscript:printManuscript()},1,degraded)};
}

test('the historical monolithic helper saves a verified pair and binds Lulu dimensions to real pages',async()=>{
  const app=fixture();const result=await app.generate();
  assert.equal(result.ok,true);
  assert.equal(app.dimensions[0].interior_page_count,result.pdf.pageCount);
  assert.equal(app.objects.size,2);
  assert.equal(result.pdf.luluMetadata.cover_status,'separate_full_spread_pending_preflight');
  assert.equal(result.pdf.luluMetadata.ready_for_print,false);
  assert.equal(result.pdf.luluMetadata.cover_dimensions.source,'lulu-api');
  assert.ok(result.pdf.luluMetadata.cover_pdf_storage_path.endsWith('/cover.pdf'));
  assert.equal(app.session().status,'pending_review');
});
test('failed cover storage and missing database readback never announce PDF completion',async()=>{
  const app=fixture({coverFailure:true});
  await assert.rejects(app.generate(),/print_archive_unverified/);
  assert.equal(app.pdfs.length,0);assert.notEqual(app.session().status,'pending_review');
  await assert.rejects(fixture({lostPdfReadback:true}).generate(),/print_bundle_persistence_unverified/);
});
test('degraded manuscripts cannot enter the full print pipeline',async()=>{
  const app=fixture({degraded:true});
  await assert.rejects(app.generate(),/print_manuscript_not_approved/);
  assert.equal(app.dimensions.length,0);assert.equal(app.objects.size,0);
});
test('JSONB field ordering is irrelevant, but the complete stored pair is still checked',async()=>{
  const result=await fixture({reorderReadback:true}).generate();
  assert.equal(result.ok,true);
});
