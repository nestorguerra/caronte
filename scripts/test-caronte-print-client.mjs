import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import vm from 'node:vm';

const source=readFileSync('src/scripts/future-book.js','utf8');
const fragment=source.slice(source.indexOf('async function generatePdf()'),source.indexOf('function downloadBase64Pdf('));
function client(initial){
 const calls=[],notes=[],shown=[],timers=[],states=[];
 const book={id:'real-book',manuscript:{title:'Mi libro'}};
 const context=vm.createContext({currentSession:{id:'s1',mode:'backend',status:'book_ready'},pdfStatusTimer:null,
  generatePdfButton:{disabled:false,hidden:false},downloadPdfButton:{hidden:true},
  window:{setTimeout:fn=>{timers.push(fn);return timers.length;},clearTimeout(){}},
  futureAction:async action=>{calls.push(action);return action==='getBookStatus'?{manuscript:book}:initial;},
  saveSession:(session,mode)=>{context.currentSession={...session,mode};},
  showBook:(manuscript,pdf)=>shown.push({manuscript,pdf}),renderPdfState:pdf=>states.push(pdf),
  readLocalManuscript:()=>null,note:value=>notes.push(value),setStep(){},Math,Number,Error});
 vm.runInContext(fragment,context);
 return{context,calls,notes,shown,timers,states};
}

test('queued printing shows actual stage progress and never presents an empty PDF as ready',async()=>{
 const app=client({session:{id:'s1',status:'pdf_generating'},job:{id:'p1',status:'queued',stage:'plan',progress:4},pdf:null});
 await app.context.generatePdf();
 assert.deepEqual(app.calls,['generatePdf','getBookStatus']);assert.equal(app.timers.length,1);
 assert.equal(app.context.generatePdfButton.disabled,true);assert.match(app.notes.at(-1),/pdf_engine.*plan.*4%/);
});
test('polling advances the display through status-only reads and stops for a verified PDF',async()=>{
 const pdf={id:'pdf1',reviewStatus:'pending_review'};
 const app=client({session:{id:'s1',status:'pending_review'},job:{id:'p1',status:'ready'},pdf});
 assert.equal(typeof app.context.pollPdfStatus,'function');
 await app.context.pollPdfStatus('s1',{id:'real-book'});
 assert.deepEqual(app.calls,['getPdfStatus']);assert.equal(app.shown.at(-1).pdf.id,'pdf1');assert.equal(app.timers.length,0);
});
test('blocked, cancelled and ready-without-file states do not trigger another generation or claim',async()=>{
 for(const status of ['blocked','cancelled','ready']){
  const app=client({session:{id:'s1'},job:{status,errorCode:status==='blocked'?'print_retry_limit':null},pdf:null});
  assert.equal(typeof app.context.pollPdfStatus,'function');await app.context.pollPdfStatus('s1',{id:'real-book'});
  assert.deepEqual(app.calls,['getPdfStatus']);assert.equal(app.timers.length,0);assert.equal(app.context.generatePdfButton.disabled,true);
  assert.match(app.notes.at(-1),/print_retry_limit|cancelled|bundle_not_available/);
 }
});
test('temporary polling failure schedules only another read and keeps generation disabled',async()=>{
 const app=client(null);app.context.generatePdfButton.disabled=true;
 app.context.futureAction=async action=>{app.calls.push(action);throw Error('timeout');};
 assert.equal(typeof app.context.pollPdfStatus,'function');await app.context.pollPdfStatus('s1',{id:'real-book'});
 assert.deepEqual(app.calls,['getPdfStatus']);assert.equal(app.timers.length,1);assert.equal(app.context.generatePdfButton.disabled,true);
 assert.match(app.notes.at(-1),/pdf_engine.*reconnecting/);
});
test('late generation and polling responses cannot replace a different active session',async()=>{
 for(const operation of ['generatePdf','pollPdfStatus']){
  const app=client(null);app.context.futureAction=async action=>{
   app.calls.push(action);app.context.currentSession={id:'s2',mode:'backend'};
   return{session:{id:'s1'},job:{status:'ready'},pdf:{id:'foreign'}};
  };
  assert.equal(typeof app.context[operation],'function');await app.context[operation]('s1',{id:'real-book'});
  assert.equal(app.context.currentSession.id,'s2');assert.equal(app.shown.length,0);assert.equal(app.timers.length,0);
 }
});
test('a foreign response credential scope is rejected even if the current session did not change',async()=>{
 const app=client({session:{id:'s2'},job:{status:'ready'},pdf:{id:'foreign',sessionId:'s2'}});
 assert.equal(typeof app.context.pollPdfStatus,'function');await app.context.pollPdfStatus('s1',{id:'real-book'});
 assert.equal(app.context.currentSession.id,'s1');assert.equal(app.shown.length,0);assert.equal(app.timers.length,1);
});
test('recovery of a saved pdf_generating session reads book and print status, without re-enqueueing',async()=>{
 const fragment=source.slice(source.indexOf('async function ensureSession()'),source.indexOf('\nfunction ',source.indexOf('async function ensureSession()')));
 const calls=[],displayed=[];const stored={id:'s1',publicToken:'synthetic-token',mode:'backend',status:'pdf_generating',bookStatus:'ready'};
 const context=vm.createContext({hasBackendConfig:()=>true,IS_LOCAL_PREVIEW:false,syncAccessToken:()=>'',
  recoverBackendSession:async value=>value,readStoredSession:()=>stored,currentSession:null,
  sessionStatus:{},setText(){},note(){},flushPendingAnswerQueue:async()=>null,
  futureAction:async action=>{calls.push(action);return action==='getBookStatus'?{manuscript:{id:'real-book'}}:
   {session:stored,job:{status:'queued',stage:'part',progress:70},pdf:null};},
  saveSession:(session,mode)=>{context.currentSession={...session,mode};},
  displayPdfResult:(result,book)=>displayed.push({result,book}),readLocalManuscript:()=>null,readLocalPdf:()=>null,
  showBook:()=>assert.fail('Recovery must preserve print job progress'),showComplete:()=>assert.fail('Do not return to interview completion')});
 vm.runInContext(fragment,context);await context.ensureSession();
 assert.deepEqual(calls,['getBookStatus','getPdfStatus']);assert.equal(displayed[0].result.job.stage,'part');assert.equal(displayed[0].book.id,'real-book');
});
