import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { test } from 'node:test';

const source = await readFile(new URL('../src/scripts/future-admin.js', import.meta.url), 'utf8');
const html = await readFile(new URL('../src/futuro-admin.html', import.meta.url), 'utf8');

// Execute the production module with only its browser/API boundaries replaced.
// No network, provider calls, payment, or persistence outside this test process.
class Element {
  constructor() { this.value = ''; this.hidden = false; this.disabled = false; this.dataset = {}; this.listeners = {}; this.children = []; this.textContent = ''; this._html = ''; }
  set innerHTML(value) { this._html = value; this.children = []; }
  get innerHTML() { return this._html + this.children.map(child => child.innerHTML).join(''); }
  append(child) { this.children.push(child); }
  addEventListener(name, callback) { this.listeners[name] = callback; }
  setAttribute(name, value) { this[name] = value; }
  removeAttribute(name) { delete this[name]; }
  focus() { this.focused = true; }
  reset() {}
  closest() { return this; }
}

function harness({ backend = true, reply = () => ({ ok: true, admin: { role: 'ops' }, metrics: {}, sessions: [], pdfs: [], bookJobs: [] }) } = {}) {
  const nodes = new Map([...html.matchAll(/id="([^"]+)"/g)].map(([, id]) => [`#${id}`, new Element()]));
  nodes.get('#adminWorkspace').hidden = true;
  const storage = new Map();
  const calls = [];
  const intervals = [];
  const context = vm.createContext({
    document: { querySelector: selector => nodes.get(selector) || null, createElement: () => new Element() },
    HTMLElement: Element, Error, URL, URLSearchParams, Intl, Date, FormData,
    window: { location: { href: 'https://example.test/futuro-admin.html', search: '' } },
    sessionStorage: { getItem: key => storage.get(key) || null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) },
    localStorage: { getItem: () => null, setItem: () => assert.fail('Operational data must not be simulated in local storage') },
    setInterval: callback => intervals.push(callback),
    hasBackendConfig: () => backend, getStoredUser: () => null,
    clearSession() {}, signOut: async () => {}, signIn: async () => {},
    callFunction: async (name, payload) => { calls.push({ name, ...payload }); return reply(payload); }
  });
  vm.runInContext(source.replace(/^import .*;\n/gm, ''), context);
  return { nodes, calls, intervals, run: code => vm.runInContext(code, context), set: (key, value) => { context[key] = value; } };
}

const jobId = '35ef09ae-43bd-48ed-ac97-90a7b76ed268';
const printDetail=()=>({ok:true,job:{id:jobId,session_id:'synthetic',status:'blocked',stage:'part',version:1,
 updated_at:'2026-10-12T00:00:00.000Z',error_code:'print_archive_timeout'},canResume:true,canCancel:true,
 steps:[{step_key:'plan:0:12',status:'completed',attempt:1,output_hash:'a'.repeat(64)},
 {step_key:'part:1:10',status:'failed',attempt:3,error_code:'print_archive_timeout'}],lastControl:null});
test('print queue distinguishes unavailable/empty, escapes fields and paginates without inventing a total',async()=>{
 const app=harness();app.run('renderPrintJobs(undefined)');
 assert.match(app.nodes.get('#printJobsBody').innerHTML,/no disponible/i);
 app.set('page',{available:true,items:[],hasMore:false,nextOffset:null});app.run('renderPrintJobs(page)');
 assert.match(app.nodes.get('#printJobsBody').innerHTML,/no hay trabajos/i);
 app.set('page',{available:true,items:[{...printDetail().job,stage:'<script>bad</script>'}],hasMore:true,nextOffset:100});
 app.run('renderPrintJobs(page)');assert.doesNotMatch(app.nodes.get('#printJobsBody').innerHTML,/<script>/);
 assert.match(app.nodes.get('#printJobsBody').innerHTML,/data-print-job/);assert.equal(app.nodes.get('#morePrintJobsButton').hidden,false);
});
test('print intervention checks current job/revision, makes one mutation and verifies lost acceptance separately',async()=>{
 let detail=printDetail();const app=harness({reply:payload=>{
  if(payload.action==='adminPrintJob')return structuredClone(detail);
  if(payload.action==='adminResumePrint'){
   assert.equal(payload.expectedRevision,detail.job.updated_at);
   detail={...detail,job:{...detail.job,status:'queued',updated_at:'2026-10-12T00:01:00.000Z'},canResume:false,canCancel:false,
    lastControl:{action:'resume',previousRevision:payload.expectedRevision}};
   throw Error('network_lost');
  }
  return{ok:true,admin:{role:'ops'},printJobs:{available:true,items:[detail.job],hasMore:false}};
 }});
 app.set('fixture',detail);app.run("latestDashboardData={admin:{role:'ops'}};selectedPrintJobId=fixture.job.id;renderPrintJobDetail(fixture)");
 app.nodes.get('#printJobReasonInput').value='Almacenamiento corregido';
 await app.run("changePrintJob('adminResumePrint')");
 assert.deepEqual(app.calls.filter(c=>c.action!=='adminDashboard').map(c=>c.action),['adminPrintJob','adminResumePrint','adminPrintJob']);
 assert.equal(app.nodes.get('#resumePrintButton').disabled,true);assert.equal(app.nodes.get('#printJobReasonInput').value,'');
 assert.match(app.nodes.get('#printJobActionStatus').textContent,/confirmado/i);
});
test('print intervention cannot retry an unknown outcome or confirm a changed receipt without the exact decision',async()=>{
 const detail=printDetail();const app=harness({reply:payload=>payload.action==='adminPrintJob'?structuredClone(detail):{ok:true}});
 app.set('fixture',detail);app.run("latestDashboardData={admin:{role:'ops'}};selectedPrintJobId=fixture.job.id;renderPrintJobDetail(fixture)");
 app.nodes.get('#printJobReasonInput').value='Cancelar conservando datos';
 await assert.rejects(app.run("changePrintJob('adminCancelPrint')"),/confirmado/i);
 assert.equal(app.calls.filter(c=>c.action==='adminCancelPrint').length,1);
 assert.equal(app.nodes.get('#cancelPrintButton').disabled,true);
 await assert.rejects(app.run("changePrintJob('adminCancelPrint')"),/sin confirmar/i);
 assert.equal(app.calls.filter(c=>c.action==='adminCancelPrint').length,1);
});
test('print detail renders minimal receipts and role/source gates prevent browser mutations',async()=>{
 const app=harness({reply:()=>({...printDetail(),canResume:false,canCancel:true})});
 app.set('fixture',printDetail());app.run("latestDashboardData={admin:{role:'viewer'}};selectedPrintJobId=fixture.job.id;renderPrintJobDetail(fixture)");
 assert.equal(app.nodes.get('#resumePrintButton').disabled,true);assert.equal(app.nodes.get('#cancelPrintButton').disabled,true);
 app.nodes.get('#printJobReasonInput').value='Motivo suficientemente largo';
 await assert.rejects(app.run("changePrintJob('adminResumePrint')"),/permitida/i);
 assert.equal(app.calls.filter(c=>c.action==='adminResumePrint').length,0);
 app.run("latestDashboardData={admin:{role:'ops'}}");
 await assert.rejects(app.run("changePrintJob('adminResumePrint')"),/permitida/i);
 assert.equal(app.calls.filter(c=>c.action==='adminResumePrint').length,0);
});
test('print intervention cannot operate on a different selected job or submit twice while reading',async()=>{
 let release;const pending=new Promise(resolve=>{release=resolve;});
 const app=harness({reply:()=>pending});app.set('fixture',printDetail());
 app.run("latestDashboardData={admin:{role:'ops'}};selectedPrintJobId=fixture.job.id;renderPrintJobDetail(fixture)");
 app.nodes.get('#printJobReasonInput').value='Cancelar conservando archivos';
 const first=app.run("changePrintJob('adminCancelPrint')");
 await assert.rejects(app.run("changePrintJob('adminCancelPrint')"),/en curso/);
 release({...printDetail(),job:{...printDetail().job,id:'other'}});
 await assert.rejects(first,/no coincide/);assert.equal(app.calls.filter(c=>c.action==='adminCancelPrint').length,0);
});
test('print validation button requires an approved full-size pair and an operator role',()=>{
  const app=harness();app.set('pdfs',[{id:'pdf-id',reviewStatus:'approved',pageCount:194,
    metadata:{storage_verified:true,template:'caronte-a5-embedded-v2'},
    printValidation:{editorial_approval:{reviewer:'editor'},preflight:{status:'pending',interior:{state:'pending',validation_id:7}}},
    luluMetadata:{ready_for_print:false,ready_for_print_status:'pending'}}]);
  app.run("latestDashboardData={admin:{role:'editor'}};renderPdfs(pdfs)");
  assert.match(app.nodes.get('#pdfBody').innerHTML,/data-validate-print="pdf-id"/);
  assert.match(app.nodes.get('#pdfBody').innerHTML,/Consultar Lulu/);
  assert.match(app.nodes.get('#pdfBody').innerHTML,/Interior.*pendiente/i);
  app.run("latestDashboardData={admin:{role:'viewer'}};renderPdfs(pdfs)");
  assert.doesNotMatch(app.nodes.get('#pdfBody').innerHTML,/data-validate-print="pdf-id"/);
});
test('uncertain print submission disables repeat validation and describes the required reconciliation',()=>{
  const app=harness();app.set('pdfs',[{id:'pdf-id',reviewStatus:'approved',pageCount:194,
    metadata:{storage_verified:true,template:'caronte-a5-embedded-v2'},
    printValidation:{editorial_approval:{reviewer:'editor'},preflight:{status:'uncertain',interior:{state:'uncertain'}}},
    luluMetadata:{ready_for_print:false}}]);
  app.run("latestDashboardData={admin:{role:'ops'}};renderPdfs(pdfs)");
  assert.match(app.nodes.get('#pdfBody').innerHTML,/Conciliación necesaria/);
  assert.doesNotMatch(app.nodes.get('#pdfBody').innerHTML,/data-validate-print/);
  assert.doesNotMatch(app.nodes.get('#pdfBody').innerHTML,/Listo para imprimir/);
});
function printPdf(state='pending') {
  return {id:'pdf-id',reviewStatus:'approved',pageCount:194,metadata:{template:'caronte-a5-embedded-v2',storage_verified:true},
    printValidation:{editorial_approval:{reviewer:'editor'},ready_for_print:false,preflight:{status:state,interior:{state:'pending',validation_id:7}}},
    luluMetadata:{ready_for_print:false,ready_for_print_status:state}};
}
test('print action rereads its receipt, tolerates JSONB key order, and makes one bounded mutation',async()=>{
  const before=printPdf(),after=printPdf();after.printValidation.preflight.interior.checked_at='confirmed';
  let reads=0;
  const app=harness({reply:payload=>payload.action==='adminValidatePrint'?{ok:true,pdf:after}:
    {ok:true,pdf:++reads===1?before:{...after,printValidation:Object.fromEntries(Object.entries(after.printValidation).reverse())}}});
  app.set('fixture',before);app.run("latestDashboardData={admin:{role:'editor'},pdfs:[fixture]}");
  await app.run("validatePrint('pdf-id')");
  assert.deepEqual(app.calls.map(call=>call.action),['adminPrintStatus','adminValidatePrint','adminPrintStatus']);
  assert.match(app.nodes.get('#printValidationStatus').textContent,/No se ha creado ni pagado/);
});
test('lost print confirmation cannot report readiness or issue another POST',async()=>{
  let reads=0;const pdf=printPdf();
  const app=harness({reply:payload=>{
    if(payload.action==='adminValidatePrint')return {ok:true,pdf:{...pdf,printValidation:{...pdf.printValidation,preflight:{status:'ready'}}}};
    reads++;return {ok:true,pdf};
  }});
  app.set('fixture',pdf);app.run("latestDashboardData={admin:{role:'ops'},pdfs:[fixture]}");
  await assert.rejects(app.run("validatePrint('pdf-id')"),/confirmar/);
  assert.equal(reads,2);assert.equal(app.calls.filter(call=>call.action==='adminValidatePrint').length,1);
  assert.match(app.nodes.get('#printValidationStatus').textContent,/sin confirmar/);
});
test('Lulu uses a server-side OAuth pair, never the obsolete one-key form',()=>{
  const app=harness();app.set('providers',[{provider:'lulu',configured:false,status:'not_configured'}]);
  app.run('renderProviders(providers)');
  assert.doesNotMatch(app.nodes.get('#providerGrid').innerHTML,/name="apiKey"/);
  assert.match(app.nodes.get('#providerGrid').innerHTML,/OAuth/);
});
test('only the existing owner permission can render a write-only Lulu form, and environment configuration is read-only',()=>{
  const app=harness();app.set('providers',[{provider:'lulu',configured:false,status:'not_configured',source:'missing'}]);
  app.run("latestDashboardData={admin:{role:'owner'}};renderProviders(providers)");
  const rendered=app.nodes.get('#providerGrid').innerHTML;
  assert.match(rendered,/data-lulu-credentials-form/);assert.match(rendered,/name="clientKey" type="password"/);
  assert.match(rendered,/name="clientSecret" type="password"/);assert.match(rendered,/name="saveConsent"/);
  assert.doesNotMatch(rendered,/name="apiKey"|value=".*synthetic-client/);
  for(const role of ['ops','editor','support','viewer']){
    app.run(`latestDashboardData.admin.role='${role}';renderProviders(providers)`);
    assert.doesNotMatch(app.nodes.get('#providerGrid').innerHTML,/data-lulu-credentials-form/);
  }
  app.run("latestDashboardData.admin.role='owner';providers[0].managedByEnvironment=true;renderProviders(providers)");
  assert.doesNotMatch(app.nodes.get('#providerGrid').innerHTML,/data-lulu-credentials-form/);
});
function luluFormApp(reply){
  const app=harness({reply}),status=new Element(),button=new Element(),form=new Element();
  form.dataset.expectedRevision='';form.fields={environment:'sandbox',clientKey:'synthetic-client-key',clientSecret:'synthetic-client-secret',saveConsent:'yes'};
  form.querySelector=selector=>selector.includes('status')?status:button;
  form.reset=()=>{form.fields={};};form.closest=selector=>selector==='[data-lulu-credentials-form]'?form:null;
  app.set('FormData',class{constructor(value){this.fields={...value.fields};}get(name){return this.fields[name]??null;}});
  app.set('crypto',globalThis.crypto);app.set('event',{target:form,preventDefault(){}});
  app.run("latestDashboardData={admin:{role:'owner'},providers:[{provider:'lulu',source:'missing',updatedAt:null}]}");
  return{...app,form,status,button};
}
test('Lulu save clears fields immediately, makes one write, and requires matching dashboard readback',async()=>{
  let configurationId;
  const app=luluFormApp(payload=>{
    if(payload.action==='adminSaveLuluCredentials'){
      configurationId=payload.configurationId;assert.deepEqual(app.form.fields,{});
      return{ok:true,provider:{provider:'lulu',configured:true,configurationId,environment:'sandbox',source:'encrypted_oauth_pair'}};
    }
    return{ok:true,admin:{role:'owner'},providers:[{provider:'lulu',configured:true,configurationId,environment:'sandbox',source:'encrypted_oauth_pair'}],sessions:[],pdfs:[]};
  });
  await app.run('handleProviderSubmit(event)');
  assert.deepEqual(app.calls.map(call=>call.action),['adminSaveLuluCredentials','adminDashboard']);
  assert.match(app.status.textContent,/guardado.*releído/i);assert.equal(app.button.disabled,false);
  assert.equal(app.calls[0].expectedRevision,null);assert.equal(app.calls[0].saveConsent,true);
});
test('Lulu save cannot confirm a receipt or dashboard for a different environment',async()=>{
  for(const mismatch of ['receipt','dashboard']){
    let id;
    const app=luluFormApp(payload=>{
      if(payload.action==='adminSaveLuluCredentials'){
        id=payload.configurationId;
        return{ok:true,provider:{provider:'lulu',configured:true,configurationId:id,
          environment:mismatch==='receipt'?'production':'sandbox',source:'encrypted_oauth_pair'}};
      }
      return{ok:true,admin:{role:'owner'},providers:[{provider:'lulu',configured:true,configurationId:id,
        environment:mismatch==='dashboard'?'production':'sandbox',source:'encrypted_oauth_pair'}],sessions:[],pdfs:[]};
    });
    await assert.rejects(app.run('handleProviderSubmit(event)'),/sin confirmar/i);
    assert.equal(app.calls.filter(call=>call.action==='adminSaveLuluCredentials').length,1);
    assert.doesNotMatch(app.status.textContent,/guardado y releído/i);
  }
});
test('a pending Lulu save clears fields, suppresses a second submission, and keeps the form revision',async()=>{
  let finishSave,id;
  const app=luluFormApp(payload=>{
    if(payload.action==='adminSaveLuluCredentials'){
      id=payload.configurationId;return new Promise(resolve=>{finishSave=resolve;});
    }
    return{ok:true,admin:{role:'owner'},providers:[{provider:'lulu',configured:true,configurationId:id,
      environment:'sandbox',source:'encrypted_oauth_pair'}],sessions:[],pdfs:[]};
  });
  app.form.dataset.expectedRevision='revision-at-form-open';
  app.run("latestDashboardData.providers[0].updatedAt='newer-dashboard-revision'");
  const pending=app.run('handleProviderSubmit(event)');
  await app.run('handleProviderSubmit(event)');
  assert.equal(app.calls.length,1);assert.equal(app.button.disabled,true);assert.deepEqual(app.form.fields,{});
  assert.equal(app.calls[0].expectedRevision,'revision-at-form-open');
  finishSave({ok:true,provider:{provider:'lulu',configured:true,configurationId:id,environment:'sandbox',source:'encrypted_oauth_pair'}});
  await pending;assert.equal(app.button.disabled,false);
});
test('logout removes provider forms, and a failed dashboard read hides them',async()=>{
  const app=harness();app.run("providerGrid.innerHTML='<form>private input</form>'");
  app.nodes.get('#adminLogoutButton').listeners.click();
  assert.equal(app.nodes.get('#providerGrid').innerHTML,'');
  const failed=harness({reply:()=>{throw new Error('unavailable');}});
  failed.run("providerGrid.innerHTML='<form>private input</form>'");
  await assert.rejects(failed.run('refresh()'),/unavailable/);
  assert.equal(failed.nodes.get('#providerGrid').innerHTML,'');assert.equal(failed.nodes.get('#adminWorkspace').hidden,true);
});
test('lost or contradictory Lulu save confirmation stays unverified, with no automatic resubmission or raw error',async()=>{
  for(const failure of ['receipt','transport']){
    const app=luluFormApp(payload=>{
      if(failure==='transport')throw new Error('synthetic-client-secret must never appear');
      return payload.action==='adminSaveLuluCredentials'?{ok:true,provider:{configured:true,configurationId:payload.configurationId}}:
        {ok:true,admin:{role:'owner'},providers:[{provider:'lulu',configured:false}],sessions:[],pdfs:[]};
    });
    await assert.rejects(app.run('handleProviderSubmit(event)'),/sin confirmar/i);
    assert.equal(app.calls.filter(call=>call.action==='adminSaveLuluCredentials').length,1);
    assert.deepEqual(app.form.fields,{});assert.doesNotMatch(app.status.textContent,/synthetic-client-secret/);
  }
});
function readyPrintPdf(){const pdf=printPdf('ready');pdf.printValidation.ready_for_print=true;pdf.luluMetadata.ready_for_print=true;
  pdf.printValidation.preflight.interior={state:'normalized'};pdf.printValidation.preflight.cover={state:'normalized'};return pdf;}
function fillQuote(app){for(const [field,value] of Object.entries({Name:'Synthetic Reader',Street1:'Example street 1',Street2:'',City:'Madrid',Postcode:'28001',Country:'ES',State:'M',Phone:'+34910000000',Email:'reader@example.test'}))app.nodes.get(`#printAddress${field}`).value=value;
  app.nodes.get('#printQuoteConsent').checked=true;app.nodes.get('#printQuoteCurrency').value='EUR';}
test('only operations can prepare a quotation for a normalized approved PDF',()=>{
  const app=harness();app.set('fixture',readyPrintPdf());
  app.run("latestDashboardData={admin:{role:'ops'},pdfs:[fixture]};renderPdfs([fixture])");
  assert.match(app.nodes.get('#pdfBody').innerHTML,/data-print-quote="pdf-id"/);
  app.run("latestDashboardData.admin.role='editor';renderPdfs([fixture])");
  assert.doesNotMatch(app.nodes.get('#pdfBody').innerHTML,/data-print-quote/);
});
test('quotation UI confirms server receipt and displays the exact total with no payment action',async()=>{
  const receipt={id:'quote-id',pdfId:'pdf-id',status:'quoted',currency:'EUR',shippingLevel:'MAIL',expiresAt:'2026-10-11T12:00:00Z',
    costs:{currency:'EUR',printing:{incl_tax:'10.40'},shipping_handling:{incl_tax:'6.05'},fulfillment:{incl_tax:'0.91'},discount:'0.00',tax:'1.61',total_incl_tax:'17.36'}};
  const app=harness({reply:payload=>payload.action==='adminShippingOptions'?{ok:true,options:[{level:'MAIL',currency:'EUR',cost_excl_tax:'5.00',traceable:false}]}:{ok:true,quotation:receipt}});
  app.set('fixture',readyPrintPdf());app.run("latestDashboardData={admin:{role:'ops'},pdfs:[fixture]};selectedPrintPdfId='pdf-id'");fillQuote(app);
  await app.run('loadPrintShippingOptions()');app.nodes.get('#printShippingLevel').value='MAIL';await app.run('calculatePrintQuote()');
  assert.match(app.nodes.get('#printQuoteSummary').innerHTML,/17,36 EUR/);
  assert.doesNotMatch(app.nodes.get('#printQuoteSummary').innerHTML,/data-pay|data-order/);
  assert.deepEqual(app.calls.map(call=>call.action),['adminShippingOptions','adminQuotePrint','adminPrintQuote']);
});
test('changed address requires new shipping options and missing consent cannot transmit a destination',async()=>{
  const app=harness({reply:()=>({ok:true,options:[{level:'MAIL',currency:'EUR'}]})});
  app.set('fixture',readyPrintPdf());app.run("latestDashboardData={admin:{role:'ops'},pdfs:[fixture]};selectedPrintPdfId='pdf-id'");fillQuote(app);
  app.nodes.get('#printQuoteConsent').checked=false;await assert.rejects(app.run('loadPrintShippingOptions()'),/confirme/i);assert.equal(app.calls.length,0);
  app.nodes.get('#printQuoteConsent').checked=true;await app.run('loadPrintShippingOptions()');app.nodes.get('#printShippingLevel').value='MAIL';
  app.nodes.get('#printAddressCity').value='Another city';await assert.rejects(app.run('calculatePrintQuote()'),/opciones/i);
  assert.equal(app.calls.filter(call=>call.action==='adminQuotePrint').length,0);
});
test('lost quotation readback is not shown as saved or ready to pay',async()=>{
  const app=harness({reply:payload=>payload.action==='adminShippingOptions'?{ok:true,options:[{level:'MAIL',currency:'EUR'}]}:
    {ok:true,quotation:{id:payload.action==='adminQuotePrint'?'quote-id':'different-id',pdfId:'pdf-id',status:'quoted'}}});
  app.set('fixture',readyPrintPdf());app.run("latestDashboardData={admin:{role:'ops'},pdfs:[fixture]};selectedPrintPdfId='pdf-id'");fillQuote(app);
  await app.run('loadPrintShippingOptions()');app.nodes.get('#printShippingLevel').value='MAIL';
  await assert.rejects(app.run('calculatePrintQuote()'),/confirmar/i);
  assert.doesNotMatch(app.nodes.get('#printQuoteSummary').innerHTML,/17,36|Presupuesto confirmado/);
});
const safeDetail = () => ({ ok: true, job: { id: jobId, session_id: 'session-real', status: 'blocked', stage: 'outline', error_code: 'provider_key_missing' }, steps: [{ step_key: 'outline', stage: 'outline', status: 'failed', attempt: 1, diagnostic: { uncertain: false } }], manuscript: null });

function orderFixture(overrides={}) {return {id:'order-id',pdfId:'pdf-id',quoteId:'quote-id',state:'approved',environment:'sandbox',quantity:1,
  shippingLevel:'MAIL',costs:{currency:'EUR',total_incl_tax:'17.36'},canSubmit:true,canPay:false,canSync:false,canReconcile:false,
  paymentStatus:'unknown',delivered:false,submissionEnabled:true,...overrides};}
function orderApp(reply=()=>({ok:true,order:orderFixture()})){
  const app=harness({reply});app.set('fixture',readyPrintPdf());
  app.run("latestDashboardData={admin:{role:'ops'},pdfs:[fixture]};selectedPrintPdfId='pdf-id';selectedPrintOrderPdfId='pdf-id'");
  fillQuote(app);app.nodes.get('#printShippingLevel').value='MAIL';
  app.set('quote',{id:'quote-id',pdfId:'pdf-id',status:'quoted',shippingLevel:'MAIL',costs:{currency:'EUR',total_incl_tax:'17.36'}});
  app.run('lastPrintQuotation=quote;confirmedPrintQuoteInput=printReceiptJson({...printQuoteInput(),shippingLevel:"MAIL"})');
  return app;
}
test('order approval requires two separate confirmations and the typed exact amount',async()=>{
  const app=orderApp();app.nodes.get('#printOrderAmount').value='17.36';
  await assert.rejects(app.run("printOrderAction('approve')"),/confirme/i);
  assert.equal(app.calls.filter(call=>call.action==='adminApprovePrintOrder').length,0);
  app.nodes.get('#printOrderConsent').checked=true;app.nodes.get('#printManualPaymentConsent').checked=true;
  await app.run("printOrderAction('approve')");
  const approval=app.calls.find(call=>call.action==='adminApprovePrintOrder');
  assert.equal(approval.amount,'17.36');assert.equal(approval.currency,'EUR');assert.equal(approval.quantity,1);
  assert.equal(approval.orderConsent,true);assert.equal(approval.manualPaymentConfirmed,true);
  assert.equal(app.nodes.get('#printPaymentPortal').hidden,true);
  assert.match(app.nodes.get('#printOrderActionStatus').textContent,/guardada y releída/i);
});
test('one order dispatch is reread and a lost confirmation disables repeat dispatch and payment',async()=>{
  let reads=0;const app=orderApp(payload=>payload.action==='adminSubmitPrintOrder'?{ok:true,order:orderFixture({state:'submitted',canSubmit:false,providerId:7,canSync:true})}:
    {ok:true,order:++reads===1?orderFixture():orderFixture({state:'uncertain',canSubmit:false,canReconcile:true})});
  app.set('approved',orderFixture());app.run('renderPrintOrder(approved)');
  await assert.rejects(app.run("printOrderAction('submit')"),/confirmar/i);
  assert.equal(app.calls.filter(call=>call.action==='adminSubmitPrintOrder').length,1);
  assert.equal(app.nodes.get('#printOrderSubmitButton').disabled,true);assert.equal(app.nodes.get('#printPaymentPortal').hidden,true);
  assert.match(app.nodes.get('#printOrderActionStatus').textContent,/sin confirmar/i);
});
test('uncertain order offers reconciliation only, never a second submission',async()=>{
  const app=orderApp(()=>({ok:true,order:orderFixture({state:'uncertain',canSubmit:false,canReconcile:true})}));
  await app.run("openPrintOrder('pdf-id')");
  assert.equal(app.nodes.get('#printOrderSubmitButton').disabled,true);
  assert.equal(app.nodes.get('#printOrderReconcileButton').disabled,false);
  await assert.rejects(app.run("printOrderAction('submit')"),/envío|enviar/i);
  assert.equal(app.calls.filter(call=>call.action==='adminSubmitPrintOrder').length,0);
});
test('payment portal is restricted to fresh confirmed manual-payment state; shipment is not delivery',()=>{
  const app=orderApp();
  app.set('order',orderFixture({state:'verified',canSubmit:false,canPay:true,providerStatus:'UNPAID',paymentStatus:'unpaid',
    checkedAt:new Date().toISOString(),paymentPortalUrl:'https://developers.sandbox.lulu.com/'}));app.run('renderPrintOrder(order)');
  assert.equal(app.nodes.get('#printPaymentPortal').hidden,false);
  assert.match(app.nodes.get('#printOrderSummary').innerHTML,/no confirma el pago/i);
  for(const overrides of [{paymentPortalUrl:'https://untrusted.example/'},{checkedAt:'2000-01-01T00:00:00Z'},
    {canPay:false,providerStatus:'PAYMENT_IN_PROGRESS',paymentStatus:'payment_in_progress'},
    {canPay:false,providerStatus:'SHIPPED',paymentStatus:'paid_confirmed'}]){
    app.set('changes',overrides);app.run('renderPrintOrder({...order,...changes})');assert.equal(app.nodes.get('#printPaymentPortal').hidden,true);
  }
  assert.match(app.nodes.get('#printOrderSummary').innerHTML,/entrega sin confirmar/i);
  assert.match(app.nodes.get('#printOrderSummary').innerHTML,/pago confirmado/i);
});
test('order follow-up survives editorial revocation but is not exposed to an editor',()=>{
  const app=orderApp();app.run("fixture.reviewStatus='rejected';fixture.printOrder={hasIntent:true};renderPdfs([fixture])");
  assert.match(app.nodes.get('#pdfBody').innerHTML,/data-print-order/);
  app.run("latestDashboardData.admin.role='editor';renderPdfs([fixture])");assert.doesNotMatch(app.nodes.get('#pdfBody').innerHTML,/data-print-order/);
});
test('an attempted order offers follow-up, not a quotation claiming no order exists',()=>{
  const app=orderApp();app.run('fixture.printOrder={hasIntent:true,canRequote:false};renderPdfs([fixture])');
  assert.match(app.nodes.get('#pdfBody').innerHTML,/data-print-order/);assert.doesNotMatch(app.nodes.get('#pdfBody').innerHTML,/data-print-quote/);
});
test('changing the destination clears quote approval, order controls and payment access',()=>{
  const app=orderApp();app.set('approved',orderFixture());app.run('renderPrintOrder(approved)');
  app.nodes.get('#printQuoteForm').listeners.input({target:app.nodes.get('#printAddressCity')});
  assert.equal(app.nodes.get('#printPrepareOrderButton').disabled,true);assert.equal(app.nodes.get('#printOrderPanel').hidden,true);
  assert.equal(app.nodes.get('#printOrderConsent').checked,false);assert.equal(app.nodes.get('#printPaymentPortal').hidden,true);
});
test('order operations are single-flight and cannot race a fresh quotation',async()=>{
  let release;
  const app=orderApp(()=>new Promise(resolve=>{release=()=>resolve({ok:true,order:orderFixture()});}));
  const first=app.run("printOrderAction('status')");await app.run("printOrderAction('status')");
  assert.equal(app.calls.length,1);release();await first;
  app.run('printQuoteBusy=true');await assert.rejects(app.run("printOrderAction('submit')"),/presupuesto/i);
  assert.equal(app.calls.length,1);
});

test('revoked approval or role clears the open private quotation and address on refresh',async()=>{
  for(const kind of ['role','review','artifact']){
    const pdf=readyPrintPdf();let dashboard={ok:true,admin:{role:'ops'},pdfs:[pdf],metrics:{},sessions:[],bookJobs:[]};
    const app=harness({reply:payload=>payload.action==='adminDashboard'?dashboard:payload.action==='adminPrintStatus'?{ok:true,pdf}:{ok:true,quotation:{status:'not_quoted'}}});
    await app.run('refresh()');await app.run("openPrintQuote('pdf-id')");fillQuote(app);
    app.nodes.get('#printQuoteActionStatus').textContent='Presupuesto guardado y releído. Ningún pedido ni cobro.';
    dashboard=structuredClone(dashboard);
    if(kind==='role')dashboard.admin.role='viewer';
    else if(kind==='review')dashboard.pdfs[0].reviewStatus='rejected';
    else dashboard.pdfs[0].printValidation.interior_sha256='changed-file';
    await app.run('refresh()');
    assert.equal(app.nodes.get('#printQuotePanel').hidden,true);
    assert.equal(app.nodes.get('#printAddressStreet1').value,'');
    assert.equal(app.nodes.get('#printQuoteConsent').checked,false);
    assert.match(app.nodes.get('#printQuoteActionStatus').textContent,/sin pedido ni cobro/i);
    assert.doesNotMatch(app.nodes.get('#printQuoteActionStatus').textContent,/guardado y releído/);
  }
});

test('empty real dashboard remains empty, with unknown metrics instead of fake numbers', async () => {
  const app = harness();
  await app.run('refresh()');
  assert.doesNotMatch(app.nodes.get('#sessionsBody').innerHTML, /show-|showcase/);
  assert.match(app.nodes.get('#sessionsBody').innerHTML, /no hay sesiones/i);
  assert.match(app.nodes.get('#metricsGrid').innerHTML, /—/);
  assert.doesNotMatch(app.nodes.get('#opsHeadline').textContent, /224|14|12/);
});

test('missing backend does not open or simulate the panel', async () => {
  const app = harness({ backend: false });
  app.nodes.get('#adminTokenInput').value = 'test-only-token';
  await assert.rejects(app.run('openPanel()'), /backend|configur/i);
  assert.equal(app.nodes.get('#adminWorkspace').hidden, true);
  assert.equal(app.calls.length, 0);
});

test('missing monitor data cannot claim open access or zero alerts', () => {
  const app = harness();
  app.run('renderMonitor(undefined)');
  assert.doesNotMatch(app.nodes.get('#monitorGrid').innerHTML, /Disponible|<strong>0<\/strong>|<strong>open<\/strong>/);
  assert.match(app.nodes.get('#monitorGrid').innerHTML, /—/);
  assert.equal(app.nodes.get('#accessToggleButton').disabled, true);
});

test('reported empty monitor remains a real zero and an explicit access state', () => {
  const app = harness();
  app.set('fixture', {access:{disabled:false},p0:{failedSessions:0,missingRequiredProviders:0,stalePendingPdfs:0},alerts:[]});
  app.run('renderMonitor(fixture)');
  assert.match(app.nodes.get('#monitorGrid').innerHTML, /Disponible/);
  assert.match(app.nodes.get('#monitorGrid').innerHTML, /<strong>0<\/strong>/);
  assert.equal(app.nodes.get('#accessToggleButton').disabled, false);
});

test('missing observability is unknown, not zero incidents or normal costs', () => {
  const app = harness();
  app.run('renderObservability(undefined)');
  assert.doesNotMatch(app.nodes.get('#observabilityGrid').innerHTML, /<strong>0<\/strong>|<strong>no<\/strong>|normal/);
  assert.match(app.nodes.get('#observabilityGrid').innerHTML, /—/);
});

test('missing costs, security and beta policy never manufacture financial or privacy state', () => {
  const app = harness();
  app.run('renderCosts(undefined); renderSecurity(undefined); renderViralAccess(undefined)');
  for (const id of ['#costGrid', '#securityGrid', '#viralAccessGrid']) {
    assert.match(app.nodes.get(id).innerHTML, /—/);
    assert.doesNotMatch(app.nodes.get(id).innerHTML, /<strong>0(?: EUR)?<\/strong>|<strong>(?:7|30|365) d<\/strong>|<strong>fixed_beta<\/strong>/);
  }
});

test('authentication failure keeps gate visible and never exposes workspace', async () => {
  const app = harness({ reply: () => { throw new Error('admin_token_invalid'); } });
  app.nodes.get('#adminTokenInput').value = 'test-only-token';
  await assert.rejects(app.run('openPanel()'), /admin_token_invalid/);
  assert.equal(app.nodes.get('#adminGate').hidden, false);
  assert.equal(app.nodes.get('#adminWorkspace').hidden, true);
});

test('runtime failure marks the dashboard unavailable rather than silently refreshing stale success', async () => {
  const app = harness({ reply: () => { throw new Error('network_unavailable'); } });
  app.nodes.get('#adminWorkspace').hidden = false;
  await assert.rejects(app.run('refresh()'));
  assert.equal(app.nodes.get('#adminWorkspace').hidden, true);
  assert.match(app.nodes.get('#adminMode').textContent, /network_unavailable|conexi|sincronizar/i);
});

test('book queue distinguishes absent contract from real zero and escapes provider fields', async () => {
  const app = harness();
  app.run('renderBookJobs(undefined)');
  assert.match(app.nodes.get('#bookJobsBody').innerHTML, /no disponible/i);
  app.run('renderBookJobs([])');
  assert.match(app.nodes.get('#bookJobsBody').innerHTML, /no hay trabajos/i);
  app.set('fixture', [{ id: jobId, session_id: 'real', status: 'blocked', stage: '<script>bad</script>', error_code: 'provider_key_missing' }]);
  app.run('renderBookJobs(fixture)');
  assert.match(app.nodes.get('#bookJobsBody').innerHTML, /data-book-job/);
  assert.doesNotMatch(app.nodes.get('#bookJobsBody').innerHTML, /<script>/);
});

test('safe failure permits resume, while uncertainty, gates and unknown errors block it', () => {
  const app = harness();
  for (const detail of [safeDetail(), { ...safeDetail(), job: { ...safeDetail().job, error_code: 'provider_http_error' } }]) {
    app.set('fixture', detail);
    assert.equal(app.run("bookJobPermissions(fixture, {role:'ops'}).resume"), true);
  }
  const uncertain = safeDetail(); uncertain.steps[0].diagnostic.uncertain = true;
  const gate = safeDetail(); gate.steps[0].stage = 'gate';
  const unknown = safeDetail(); unknown.job.error_code = 'provider_submission_uncertain';
  for (const detail of [uncertain, gate, unknown]) {
    app.set('fixture', detail);
    assert.equal(app.run("bookJobPermissions(fixture, {role:'ops'}).resume"), false);
    assert.equal(app.run("bookJobPermissions(fixture, {role:'ops'}).cancel"), true);
  }
  app.set('fixture', safeDetail());
  assert.equal(app.run("bookJobPermissions(fixture, {role:'viewer'}).resume"), false);
  app.set('fixture', { ...safeDetail(), job: { ...safeDetail().job, status: 'queued' } });
  assert.equal(app.run("bookJobPermissions(fixture, {role:'owner'}).cancel"), false);
});

test('detail uses real receipts and displays uncertain resume disabled', () => {
  const app = harness();
  const detail = safeDetail(); detail.job.error_code = 'provider_submission_uncertain'; detail.steps[0].provider_request_id = 'request-real';
  detail.steps[0].diagnostic.uncertain = true; detail.steps[0].usage = { input_tokens: 182 };
  app.set('fixture', detail);
  app.run("latestDashboardData = {admin:{role:'ops'}}; renderBookJobDetail(fixture)");
  assert.equal(app.nodes.get('#resumeBookButton').disabled, true);
  assert.equal(app.nodes.get('#cancelBookButton').disabled, false);
  assert.match(app.nodes.get('#bookJobStepsBody').innerHTML, /request-real/);
  assert.match(app.nodes.get('#bookJobStepsBody').innerHTML, /182/);
  assert.match(app.nodes.get('#bookJobActionStatus').textContent, /incierto|reconcili/i);
});

test('resume requires an operator reason and rereads state before one mutation', async () => {
  let jobStatus = 'blocked';
  const app = harness({ reply: payload => {
    if (payload.action === 'adminBookJob') return { ...safeDetail(), job: { ...safeDetail().job, status: jobStatus } };
    if (payload.action === 'adminResumeBook') {
      jobStatus = 'queued';
      return { ok: true, job: { id: jobId, status: jobStatus } };
    }
    return { ok: true, admin: { role: 'ops' }, bookJobs: [] };
  } });
  app.set('fixture', safeDetail());
  app.run("latestDashboardData = {admin:{role:'ops'}}; selectedBookJobId = fixture.job.id; renderBookJobDetail(fixture)");
  await assert.rejects(app.run("changeBookJob('adminResumeBook')"), /motivo/i);
  assert.equal(app.calls.length, 0);
  app.nodes.get('#bookJobReasonInput').value = 'Clave corregida y comprobada';
  await app.run("changeBookJob('adminResumeBook')");
  assert.equal(app.calls[0].action, 'adminBookJob');
  const writes = app.calls.filter(call => call.action === 'adminResumeBook');
  assert.equal(writes.length, 1);
  assert.equal(writes[0].jobId, jobId);
  assert.equal(writes[0].reason, 'Clave corregida y comprobada');
  assert.equal(app.calls.filter(call => call.action === 'adminBookJob').length, 2);
  assert.equal(app.nodes.get('#resumeBookButton').disabled, true);
  assert.equal(app.nodes.get('#bookJobReasonInput').value, '');
});

test('accepted mutation is not reported as verified when governing readback is unchanged', async () => {
  const app = harness({ reply: payload => payload.action === 'adminBookJob' ? safeDetail() : { ok: true } });
  app.set('fixture', safeDetail());
  app.run("latestDashboardData = {admin:{role:'ops'}}; selectedBookJobId = fixture.job.id; renderBookJobDetail(fixture)");
  app.nodes.get('#bookJobReasonInput').value = 'Causa corregida por el operador';
  await assert.rejects(app.run("changeBookJob('adminResumeBook')"), /No se ha confirmado/);
  assert.equal(app.calls.filter(call => call.action === 'adminResumeBook').length, 1);
  assert.equal(app.calls.filter(call => call.action === 'adminBookJob').length, 2);
  assert.equal(app.nodes.get('#bookJobReasonInput').value, 'Causa corregida por el operador');
});

test('cancel blocked job is confirmed by a separate authoritative read', async () => {
  let status = 'blocked';
  const app = harness({ reply: payload => {
    if (payload.action === 'adminCancelBook') { status = 'cancelled'; return { ok: true }; }
    if (payload.action === 'adminBookJob') return { ...safeDetail(), job: { ...safeDetail().job, status } };
    return { ok: true, admin: { role: 'ops' }, bookJobs: [] };
  } });
  app.set('fixture', safeDetail());
  app.run("latestDashboardData = {admin:{role:'ops'}}; selectedBookJobId = fixture.job.id; renderBookJobDetail(fixture)");
  app.nodes.get('#bookJobReasonInput').value = 'El cliente cancela este trabajo';
  await app.run("changeBookJob('adminCancelBook')");
  assert.equal(app.calls.filter(call => call.action === 'adminCancelBook').length, 1);
  assert.match(app.nodes.get('#bookJobSummary').textContent, /cancelled|Cancelado/);
  assert.equal(app.nodes.get('#cancelBookButton').disabled, true);
});

test('approved PDFs and print-ready files are not counted as sent or in transit', () => {
  const app = harness();
  app.set('fixture', { sessions: [], pdfs: [{ reviewStatus: 'approved', luluMetadata: { status: 'ready_for_print' } }], metrics: { pdfApproved: 1 } });
  assert.equal(app.run('operationNumbers(fixture).booksDone'), 0);
  assert.equal(app.run('operationNumbers(fixture).inTransit'), 0);
});

test('viewer cannot send a resume mutation even with a known safe error', async () => {
  const app = harness({ reply: () => safeDetail() });
  app.set('fixture', safeDetail());
  app.run("latestDashboardData = {admin:{role:'viewer'}}; selectedBookJobId = fixture.job.id; renderBookJobDetail(fixture)");
  app.nodes.get('#bookJobReasonInput').value = 'Intento de operador sin permiso';
  await assert.rejects(app.run("changeBookJob('adminResumeBook')"), /no está permitida/);
  assert.equal(app.calls.filter(call => call.action === 'adminResumeBook').length, 0);
});

test('a concurrent click does not submit the book operation twice', async () => {
  let release;
  const pendingRead = new Promise(resolve => { release = resolve; });
  const app = harness({ reply: () => pendingRead });
  app.set('fixture', safeDetail());
  app.run("latestDashboardData = {admin:{role:'ops'}}; selectedBookJobId = fixture.job.id; renderBookJobDetail(fixture)");
  app.nodes.get('#bookJobReasonInput').value = 'Motivo de cancelación del libro';
  const first = app.run("changeBookJob('adminCancelBook')");
  await assert.rejects(app.run("changeBookJob('adminCancelBook')"), /en curso/);
  release({ ...safeDetail(), job: { ...safeDetail().job, status: 'cancelled' } });
  await assert.rejects(first, /no está permitida/);
  assert.equal(app.calls.filter(call => call.action === 'adminCancelBook').length, 0);
});

test('stale safe detail cannot resume if server now reports uncertainty', async () => {
  const uncertain = safeDetail(); uncertain.job.error_code = 'provider_submission_uncertain'; uncertain.steps[0].diagnostic.uncertain = true;
  const app = harness({ reply: () => uncertain });
  app.set('fixture', safeDetail());
  app.run("latestDashboardData = {admin:{role:'ops'}}; selectedBookJobId = fixture.job.id; renderBookJobDetail(fixture)");
  app.nodes.get('#bookJobReasonInput').value = 'Comprobar el bloqueo actual';
  await assert.rejects(app.run("changeBookJob('adminResumeBook')"));
  assert.equal(app.calls.filter(call => call.action === 'adminResumeBook').length, 0);
  assert.equal(app.nodes.get('#resumeBookButton').disabled, true);
});

test('a mismatched governing job cannot authorize a mutation of the selected job', async () => {
  const other = safeDetail(); other.job.id = 'other-job';
  const app = harness({reply: () => other});
  app.set('fixture', safeDetail());
  app.run("latestDashboardData = {admin:{role:'ops'}}; selectedBookJobId = fixture.job.id; renderBookJobDetail(fixture)");
  app.nodes.get('#bookJobReasonInput').value = 'Causa corregida por el operador';
  await assert.rejects(app.run("changeBookJob('adminResumeBook')"), /no coincide|no está permitida/);
  assert.equal(app.calls.filter(call => call.action === 'adminResumeBook').length, 0);
});

test('provider POST uncertainty never enables the legacy dead-letter retry route', () => {
  const app = harness();
  app.set('fixture', [{ id: 'dead-1', status: 'open', failed_action: 'book_generation_retry', diagnostic: { uncertain: true }, error_code: 'provider_submission_uncertain' }]);
  app.run('renderDeadLetters(fixture)');
  assert.match(app.nodes.get('#deadLetterBody').innerHTML, /data-retry-dead-letter="dead-1"\s+disabled/);
});
test('private print preview exposes the separate cover and clears it for the next legacy PDF', () => {
  const app = harness();
  app.set('fixture', {signedUrl:'https://storage.example/interior.pdf',coverSignedUrl:'https://storage.example/cover.pdf',fileName:'interior.pdf'});
  app.run('previewPdf(fixture)');
  assert.equal(app.nodes.get('#coverPdfLink').hidden,false);
  assert.equal(app.nodes.get('#coverPdfLink').href,'https://storage.example/cover.pdf');
  app.run("previewPdf({signedUrl:'https://storage.example/old.pdf'})");
  assert.equal(app.nodes.get('#coverPdfLink').hidden,true);
  assert.equal(app.nodes.get('#coverPdfLink').href,undefined);
});
test('an unavailable PDF clears any previously selected private preview', () => {
  const app = harness();
  app.run("previewPdf({signedUrl:'https://storage.example/interior.pdf'})");
  app.run('previewPdf(null)');
  assert.equal(app.nodes.get('#pdfPreview').src,undefined);
});
