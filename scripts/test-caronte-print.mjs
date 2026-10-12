import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
import vm from 'node:vm';
import {test} from 'node:test';
const original=readFileSync('supabase/functions/future-book-session/index.ts','utf8');
const source=stripTypeScriptTypes(original.replace(/^import .*;\n/gm,''),{mode:'strip'});
const context=vm.createContext({btoa,atob,Uint8Array,TextEncoder,crypto:globalThis.crypto,
  Deno:{env:{get:()=>''},serve(){}},setTimeout,clearTimeout});
vm.runInContext(source,context);
const legacyPdf={base64:btoa('%PDF-1.4\nlegacy'),pageCount:32,byteSize:11000,pageSize:'A5',template:'future-book-a5-editorial-v1'};

test('a legacy preview without embedded fonts or a separate cover cannot be print-ready',()=>{
  const report=context.validateEditorialPdf(legacyPdf,false,{path:'private/preview.pdf'});
  assert.equal(report.ready_for_print,false);
  assert.ok(report.checks.some(check=>check.code==='fonts_embedded'&&check.status==='fail'));
  assert.ok(report.checks.some(check=>check.code==='separate_cover'&&check.status==='fail'));
});
test('the physical page gate targets 180-200, not the old thirty-two-page beta',()=>{
  const report=context.validateEditorialPdf(legacyPdf,false,{path:'private/preview.pdf'});
  assert.equal(report.checks.find(check=>check.code==='page_count').status,'fail');
});
test('a full current manuscript cannot be silently routed into the lossy padded legacy writer',()=>{
  const manuscript={title:'Todavía, mañana',word_count:45000,sections:Array.from({length:5},(_,index)=>({id:`ch_0${index+1}`,kind:'chapter',title:'Capítulo',paragraphs:['acción '.repeat(9000)]}))};
  assert.throws(()=>context.buildPdfDocument(manuscript,'session-proof'),/print_renderer_required/);
});
