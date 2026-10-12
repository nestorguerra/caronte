import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
import vm from 'node:vm';
import {createPrintPreflight,printArtifactBinding} from '../supabase/functions/_shared/caronte-print-preflight.mjs';
import {createPrintQuotation} from '../supabase/functions/_shared/caronte-print-quote.mjs';
import {createPrintOrder} from '../supabase/functions/_shared/caronte-print-order.mjs';
import {createLuluCredentialStore} from '../supabase/functions/_shared/caronte-lulu-credentials.mjs';
import {LULU_A5_PAPERBACK_SKU} from '../supabase/functions/_shared/lulu-print.mjs';

const code=stripTypeScriptTypes(readFileSync('supabase/functions/future-book-session/index.ts','utf8').replace(/^import .*;\n/gm,''),{mode:'strip'});
const serviceCode=stripTypeScriptTypes(readFileSync('supabase/functions/_shared/service.ts','utf8').replace(/^export /gm,''),{mode:'strip'});
const id='948bc512-eaf8-4f2c-8ae8-c302561ca8d4',session='6159e0f9-4aef-4f93-9d76-f46bfa51a18a';
function fixture({role='editor',missingReadback=false,luluConfigured=true,authFailure=false,quoteReadbackFailure=false,ordersEnabled=true,storedLulu=false}={}) {
  const hash=x=>x.repeat(64),path=kind=>`${session}/v01/${id}/${kind}.pdf`;
  let row={id,session_id:session,manuscript_id:'manuscript',version:1,page_count:194,updated_at:'revision-1',
    review_status:'pending_review',storage_path:path('interior'),quality_report:{byte_size:100,cover_byte_size:80},
    metadata:{template:'caronte-a5-embedded-v2',storage_verified:true,artifact_id:id},
    print_validation:{template:'caronte-a5-embedded-v2',fonts_embedded:true,separate_cover:true,
      source_sha256:hash('a'),interior_sha256:hash('b'),cover_sha256:hash('c'),ready_for_print:false},
    lulu_metadata:{environment:'sandbox',pod_package_id:LULU_A5_PAPERBACK_SKU,ready_for_print:false,
      interior_sha256:hash('b'),cover_sha256:hash('c'),interior_pdf_storage_path:path('interior'),cover_pdf_storage_path:path('cover'),
      cover_dimensions:{source:'lulu-api',pageCount:194,podPackageId:LULU_A5_PAPERBACK_SKU,environment:'sandbox'}}};
  let revision=1,setting=null;const calls=[],sideEffects=[];
  const rest=async(resource,options={})=>{
    calls.push({resource,...options});
    if(resource.startsWith('future_book_provider_settings')){
      if(options.method){
        if(options.method==='PATCH'&&new URLSearchParams(resource.split('?')[1]).get('updated_at')!==`eq.${setting?.updated_at}`)return [];
        if(options.method==='POST'&&setting)return [];
        setting={...(setting||{}),...structuredClone(options.body),updated_at:`provider-revision-${++revision}`};
      }
      return setting?[structuredClone(setting)]:[];
    }
    if(resource.startsWith('future_book_sessions'))return [{id:session,status:'interview_completed',book_status:'ready'}];
    if(!resource.startsWith('future_book_pdfs'))return [];
    if(options.method==='PATCH'){
      const condition=new URLSearchParams(resource.split('?')[1]).get('updated_at');
      if(condition&&condition!==`eq.${row.updated_at}`)return [];
      row={...row,...structuredClone(options.body),updated_at:`revision-${++revision}`};return [structuredClone(row)];
    }
    if(missingReadback&&revision>1||quoteReadbackFailure&&row.metadata?.print_quote)return [];
    const select=new URLSearchParams(resource.split('?')[1]).get('select');
    return [structuredClone(!select||select==='*'?row:Object.fromEntries(select.split(',').filter(key=>key in row).map(key=>[key,row[key]])))];
  };
  const env={SUPABASE_URL:'https://storage.test',SUPABASE_SERVICE_ROLE_KEY:'synthetic-service-key',LULU_ENVIRONMENT:'sandbox',LULU_CLIENT_KEY:'synthetic-key',LULU_CLIENT_SECRET:'synthetic-secret',FUTURE_BOOK_SECRET_KEY:'synthetic-encryption-key',FUTURE_BOOK_LULU_ORDERS_ENABLED:ordersEnabled?'true':''};
  if(!luluConfigured){delete env.LULU_CLIENT_SECRET;env.LULU_API_KEY='obsolete-synthetic-key';}
  if(storedLulu){delete env.LULU_ENVIRONMENT;delete env.LULU_CLIENT_KEY;delete env.LULU_CLIENT_SECRET;}
  const urls={interior:'https://storage.test/interior?token=private',cover:'https://storage.test/cover?token=private'};
  const client={environment:'sandbox',authenticate:async()=>{sideEffects.push(['oauth']);if(authFailure)throw new Error('private provider error');return {environment:'sandbox'};}};
  const amount=(excl,tax,incl)=>({total_cost_excl_tax:excl,total_tax:tax,total_cost_incl_tax:incl});
  client.shippingOptions=async()=>{sideEffects.push(['shipping']);return [{level:'MAIL',currency:'EUR',cost_excl_tax:'5.00',traceable:false}];};
  client.quote=async input=>{sideEffects.push(['quote']);return {currency:'EUR',shipping_address:input.shipping_address,
    line_item_costs:[{quantity:1,...amount('10.00','0.40','10.40')}],shipping_cost:amount('5.00','1.05','6.05'),
    fulfillment_cost:amount('0.75','0.16','0.91'),...amount('15.75','1.61','17.36'),total_discount_amount:'0.00'};};
  let printJob;
  client.createPrintJob=async input=>{sideEffects.push(['order-post']);printJob={...structuredClone(input),id:71,status:{name:'UNPAID',changed:new Date().toISOString()},
    line_items:[{...structuredClone(input.line_items[0]),id:83,printable_normalization:{...input.line_items[0].printable_normalization,
      interior:{source_url:urls.interior,page_count:194},cover:{source_url:urls.cover,page_count:1}}}]};return structuredClone(printJob);};
  client.getPrintJob=async()=>structuredClone(printJob);
  client.getPrintJobCosts=async()=>{const quote=await client.quote({shipping_address:{}});quote.line_item_costs[0].line_item_id=83;
    quote.line_item_costs[0].line_item_external_id=printJob.external_id;return quote;};
  for(const kind of ['Interior','Cover']) {
    const lower=kind.toLowerCase();client[`validate${kind}`]=async()=>{sideEffects.push(['post',lower]);return {id:lower==='interior'?7:9,status:'NORMALIZING',errors:[],source_url:urls[lower]};};
    client[`get${kind}Validation`]=async validationId=>({id:validationId,status:'NORMALIZED',errors:[],source_url:urls[lower],page_count:'194',valid_pod_package_ids:[LULU_A5_PAPERBACK_SKU]});
  }
  const context=vm.createContext({rest,encodeParam:encodeURIComponent,crypto:globalThis.crypto,TextEncoder,TextDecoder,
    Uint8Array,Date,URL,Request,Response,AbortController,setTimeout,clearTimeout,
    fetch:async()=>assert.fail('Only injected provider/storage boundaries may be used'),
    createPrintPreflight,printArtifactBinding,createPrintQuotation,createPrintOrder,createLuluCredentialStore,LULU_A5_PAPERBACK_SKU,btoa,atob,
    createPrintFileAccess:input=>{
      assert.equal(input.url,env.SUPABASE_URL);assert.equal(input.serviceKey,env.SUPABASE_SERVICE_ROLE_KEY);
      return {verifyFile:async()=>{sideEffects.push(['verify']);return {verified:true};},signFile:async kind=>urls[kind]};
    },
    createLuluPrintClient:input=>{
      assert.equal(input.environment,storedLulu?oauthInput.environment:env.LULU_ENVIRONMENT);
      assert.equal(input.clientKey,storedLulu?oauthInput.clientKey:env.LULU_CLIENT_KEY);
      assert.equal(input.clientSecret,storedLulu?oauthInput.clientSecret:env.LULU_CLIENT_SECRET);
      return client;
    },Deno:{env:{get:name=>env[name]||''},serve(){}}});
  // Preserve the real shared bindings; replace only the REST transport below.
  vm.runInContext(serviceCode,context);context.rest=rest;
  vm.runInContext(code,context);
  vm.runInContext(`requireFutureBookAdmin=async(req,payload,action)=>{if(!canRunAdminAction('${role}',action))throw new Error('Insufficient future book admin permissions');return {role:'${role}',label:'editor@example.test'};};auditFutureBookAdmin=async()=>{};patchSession=async()=>{};insertEvent=async()=>{};`,context);
  const req=new Request('https://example.test');
  return {context,calls,sideEffects,row:()=>row,setting:()=>setting,
    setEnvironment:values=>Object.assign(env,values),
    rotateEnvironment:()=>{env.LULU_CLIENT_SECRET='synthetic-other-account-secret';},
    unbind:()=>{delete row.metadata.lulu_credential_tag;},
    saveLulu:input=>context.adminSaveLuluCredentials(req,input),
    approve:()=>context.patchPdfReview(req,{pdfId:id},'approved'),
    validate:()=>context.adminValidatePrint(req,{pdfId:id}),
    reject:()=>context.patchPdfReview(req,{pdfId:id},'rejected'),
    status:()=>context.adminPrintStatus(req,{pdfId:id}),
    dashboard:()=>context.adminDashboard(req,{}),
    detail:()=>context.adminSessionDetail(req,{sessionId:session}),
    quotation:(action,input={})=>context.adminPrintQuotation(req,{pdfId:id,...input},action),
    order:(action,input={})=>context.adminPrintOrder(req,{pdfId:id,...input},action)};
}
test('server approval is hash-bound and preflight uses conditional writes with database readback',async()=>{
  const app=fixture();await app.approve();
  assert.equal(app.row().print_validation.editorial_approval.interior_sha256,'b'.repeat(64));
  for(let index=0;index<4;index++)await app.validate();
  assert.equal((await app.status()).pdf.luluMetadata.ready_for_print,true);
  assert.equal(app.sideEffects.filter(effect=>effect[0]==='post').length,2);
  const patchCalls=app.calls.filter(call=>call.method==='PATCH');
  assert.ok(patchCalls.every(call=>new URLSearchParams(call.resource.split('?')[1]).has('updated_at')));
  await app.reject();
  assert.equal(app.row().print_validation.ready_for_print,false);
  assert.equal(app.row().lulu_metadata.ready_for_print,false);
  assert.equal(app.row().print_validation.editorial_approval,null);
});
const oauthInput={environment:'sandbox',clientKey:'synthetic-stored-oauth-client',clientSecret:'synthetic-stored-oauth-secret',
  configurationId:'36bb9d23-c851-47d4-aef3-0883b1fc85cc',expectedRevision:null,saveConsent:true};
test('the native credential route saves an encrypted pair and print operations resolve it without environment keys',async()=>{
  const app=fixture({role:'owner',storedLulu:true});const result=await app.saveLulu(oauthInput);
  assert.equal(result.provider.source,'encrypted_oauth_pair');assert.equal(result.provider.configurationId,oauthInput.configurationId);
  const credentials=await app.context.luluCredentials();assert.equal(credentials.clientKey,oauthInput.clientKey);assert.equal(credentials.clientSecret,oauthInput.clientSecret);
  assert.doesNotMatch(JSON.stringify({result,setting:app.setting()}),/synthetic-stored-oauth-client|synthetic-stored-oauth-secret/);
  await printReady(app);const quote=await app.quotation('adminQuotePrint',{shippingAddress:destination,shippingConsent:true,shippingLevel:'MAIL',currency:'EUR'});
  assert.equal(quote.quotation.status,'quoted');assert.ok(app.row().metadata.lulu_credential_tag);
  assert.equal((await app.status()).pdf.metadata.lulu_credential_tag,undefined);
  const approval=await app.order('adminApprovePrintOrder',{quoteId:quote.quotation.id,shippingAddress:destination,shippingConsent:true,
    orderConsent:true,manualPaymentConfirmed:true,amount:quote.quotation.costs.total_incl_tax,currency:'EUR',shippingLevel:'MAIL',quantity:1});
  await app.order('adminSubmitPrintOrder',{orderId:approval.order.id});
  assert.equal((await app.order('adminSyncPrintOrder')).order.canPay,true);
  const probe=await app.context.adminTestProvider(new Request('https://example.test'),{provider:'lulu'});
  assert.equal(probe.provider.liveProbeOk,true);assert.equal(probe.provider.persistenceVerified,true);
  assert.equal((await app.context.luluCredentials()).clientSecret,oauthInput.clientSecret);
  assert.equal(app.sideEffects.filter(effect=>effect[0]==='order-post').length,1);
});
test('existing roles without credential-write permission cannot save or expose a private pair',async()=>{
  for(const role of ['ops','editor','support','viewer']){
    const app=fixture({role,storedLulu:true});await assert.rejects(app.saveLulu(oauthInput),/Insufficient/);
    assert.equal(app.calls.length,0);assert.equal(app.sideEffects.length,0);
  }
});
test('changing a Lulu pair forbids provider work on previous PDF receipts and intents',async()=>{
  const app=fixture();const approval=await approveOrder(app);await app.order('adminSubmitPrintOrder',{orderId:approval.order.id});
  const effects=app.sideEffects.length;app.rotateEnvironment();
  await assert.rejects(app.order('adminSyncPrintOrder'),/print_lulu_configuration_changed/);
  await assert.rejects(app.validate(),/print_lulu_configuration_changed/);
  await assert.rejects(app.quotation('adminPrintQuote'),/print_lulu_configuration_changed/);
  assert.equal(app.sideEffects.length,effects);
});
test('native configuration identity covers the complete long pair and is stable for unchanged credentials',async()=>{
  const app=fixture();app.setEnvironment({LULU_CLIENT_KEY:'k'.repeat(2048),LULU_CLIENT_SECRET:'first-synthetic-secret'});
  const first=await app.context.luluCredentials(),repeat=await app.context.luluCredentials();
  assert.equal(first.configurationTag,repeat.configurationTag);
  app.setEnvironment({LULU_CLIENT_SECRET:'different-synthetic-secret'});
  const changed=await app.context.luluCredentials();
  assert.notEqual(first.configurationTag,changed.configurationTag);
  app.setEnvironment({SUPABASE_SERVICE_ROLE_KEY:'',FUTURE_BOOK_SECRET_KEY:''});
  await assert.rejects(app.context.luluCredentials(),/lulu_oauth_identity_unavailable/);
  assert.equal(app.sideEffects.length,0);
});
test('an old unbound preflight cannot be attached to another account or dispatched again automatically',async()=>{
  const app=fixture();await printReady(app);app.unbind();const effects=app.sideEffects.length;
  await assert.rejects(app.validate(),/print_lulu_configuration_binding_required/);
  assert.equal(app.sideEffects.length,effects);
});
test('viewer and support cannot approve or validate and cannot access storage/provider effects',async()=>{
  for(const role of ['viewer','support']){
    const app=fixture({role});await assert.rejects(app.validate(),/Insufficient/);
    assert.equal(app.calls.length,0);assert.equal(app.sideEffects.length,0);
    assert.equal((await app.status()).ok,true);
  }
});
test('missing database readback never dispatches a preflight submission',async()=>{
  const app=fixture({missingReadback:true});
  await assert.rejects(app.approve(),/print_review_persistence_unverified/);
  assert.equal(app.sideEffects.length,0);
});
test('a legacy single Lulu key cannot claim configuration or a successful live probe',async()=>{
  const app=fixture({luluConfigured:false});
  const probe=await app.context.testProviderConnectivity('lulu');
  assert.equal(probe.ok,false);assert.equal(probe.status,'not_configured');
  assert.equal(app.sideEffects.length,0);
  vm.runInContext("providerSecret=async(provider)=>{if(provider==='lulu')throw new Error('Legacy Lulu setting must not be read');return null;};",app.context);
  const status=(await app.context.providerStatus()).find(item=>item.provider==='lulu');
  assert.equal(status.configured,false);
});
test('Lulu connectivity tests OAuth only and do not fabricate success on authentication failure',async()=>{
  for(const authFailure of [false,true]){
    const app=fixture({authFailure});const probe=await app.context.testProviderConnectivity('lulu');
    assert.equal(probe.ok,!authFailure);
    assert.deepEqual(app.sideEffects,[['oauth']]);
    assert.doesNotMatch(JSON.stringify(probe),/synthetic-secret|private provider error/);
  }
});
const destination={name:'Synthetic Reader',street1:'Example street 1',city:'Madrid',postcode:'28001',country_code:'ES',state_code:'M',phone_number:'+34910000000',email:'reader@example.test'};
async function printReady(app){await app.approve();for(let i=0;i<4;i++)await app.validate();
  vm.runInContext("requireFutureBookAdmin=async(req,payload,action)=>{if(!canRunAdminAction('ops',action))throw new Error('Insufficient future book admin permissions');return {role:'ops',label:'operator'};};",app.context);}
test('quote route persists encrypted destination, hides it from public PDF metadata and rereads totals',async()=>{
  const app=fixture();await printReady(app);
  const result=await app.quotation('adminQuotePrint',{shippingAddress:destination,shippingConsent:true,shippingLevel:'MAIL',currency:'EUR'});
  assert.equal(result.quotation.costs.total_incl_tax,'17.36');
  const readback=await app.quotation('adminPrintQuote');assert.equal(readback.quotation.id,result.quotation.id);
  assert.ok(app.row().metadata.print_quote.protected_address.ciphertext);
  assert.doesNotMatch(JSON.stringify(app.row()),/Example street|reader@example.test|Synthetic Reader/);
  assert.equal((await app.status()).pdf.metadata.print_quote,undefined);
  assert.equal(app.sideEffects.filter(effect=>effect[0]==='quote').length,1);
});
test('editor, viewer and support cannot send destinations to Lulu through quotation actions',async()=>{
  for(const role of ['editor','viewer','support'])for(const action of ['adminPrintQuote','adminQuotePrint','adminShippingOptions']){
    const app=fixture({role});await assert.rejects(app.quotation(action,{shippingAddress:destination,shippingConsent:true}),/Insufficient/);
    assert.equal(app.calls.length,0);assert.equal(app.sideEffects.length,0);
  }
});
test('lost quotation DB readback never announces a saved or payable quotation',async()=>{
  const app=fixture({quoteReadbackFailure:true});await printReady(app);
  await assert.rejects(app.quotation('adminQuotePrint',{shippingAddress:destination,shippingConsent:true,shippingLevel:'MAIL',currency:'EUR'}),/print_quote_persistence_unverified/);
});
async function approveOrder(app){
  await printReady(app);const quote=await app.quotation('adminQuotePrint',{shippingAddress:destination,shippingConsent:true,shippingLevel:'MAIL',currency:'EUR'});
  return app.order('adminApprovePrintOrder',{quoteId:quote.quotation.id,shippingAddress:destination,shippingConsent:true,orderConsent:true,manualPaymentConfirmed:true,
    amount:quote.quotation.costs.total_incl_tax,currency:'EUR',shippingLevel:'MAIL',quantity:1});
}
test('actual order routes decrypt the approved destination, archive intent and verify provider costs before payment access',async()=>{
  const app=fixture(),approval=await approveOrder(app);assert.equal(approval.order.canSubmit,true);
  const submitted=await app.order('adminSubmitPrintOrder',{orderId:approval.order.id});assert.equal(submitted.order.canPay,false);
  const checked=await app.order('adminSyncPrintOrder');assert.equal(checked.order.canPay,true);assert.equal(checked.order.providerId,71);
  const publicRow=(await app.status()).pdf;assert.equal(publicRow.metadata.print_order,undefined);assert.equal(publicRow.printOrder.hasIntent,true);
  assert.equal(publicRow.printOrder.canRequote,false);
  assert.doesNotMatch(JSON.stringify(app.row()),/Example street|reader@example.test|Synthetic Reader|token=private/);
  assert.equal(app.sideEffects.filter(x=>x[0]==='order-post').length,1);
});
test('the default-off server switch blocks print-job dispatch even with a saved spend approval',async()=>{
  const app=fixture({ordersEnabled:false}),approval=await approveOrder(app);
  assert.equal(approval.order.canSubmit,false);assert.equal(approval.order.submissionEnabled,false);
  await assert.rejects(app.order('adminSubmitPrintOrder',{orderId:approval.order.id}),/print_order_dispatch_disabled/);
  assert.equal(app.sideEffects.filter(x=>x[0]==='order-post').length,0);
});
test('editor, viewer and support cannot approve, submit, reconcile or synchronize print orders',async()=>{
  for(const role of ['editor','viewer','support'])for(const action of ['adminApprovePrintOrder','adminSubmitPrintOrder','adminReconcilePrintOrder','adminSyncPrintOrder','adminPrintOrder']){
    const app=fixture({role});await assert.rejects(app.order(action),/Insufficient/);assert.equal(app.calls.length,0);assert.equal(app.sideEffects.length,0);
  }
});
test('dashboard and session detail recover a submitted order marker without exposing its private receipt',async()=>{
  const app=fixture(),approval=await approveOrder(app);
  await app.order('adminSubmitPrintOrder',{orderId:approval.order.id});
  for(const response of [await app.dashboard(),await app.detail()]){
    const [pdf]=response.pdfs;assert.equal(pdf.id,id);
    assert.equal(pdf.metadata.template,'caronte-a5-embedded-v2');assert.equal(pdf.metadata.storage_verified,true);
    assert.deepEqual(JSON.parse(JSON.stringify(pdf.printOrder)),{hasIntent:true,canRequote:false});
    assert.equal(pdf.metadata.print_order,undefined);assert.equal(pdf.metadata.print_quote,undefined);
    assert.doesNotMatch(JSON.stringify(response.pdfs),/protected_address|ciphertext|Example street|reader@example.test|Synthetic Reader|token=private/);
  }
  assert.equal(app.sideEffects.filter(x=>x[0]==='order-post').length,1);
});
test('projected PDF lists keep preflight eligibility and distinguish an approved but unsubmitted order',async()=>{
  const app=fixture();
  for(const response of [await app.dashboard(),await app.detail()]){
    assert.equal(response.pdfs[0].metadata.template,'caronte-a5-embedded-v2');
    assert.equal(response.pdfs[0].metadata.storage_verified,true);assert.equal(response.pdfs[0].printOrder,null);
  }
  await approveOrder(app);
  for(const response of [await app.dashboard(),await app.detail()]){
    assert.deepEqual(JSON.parse(JSON.stringify(response.pdfs[0].printOrder)),{hasIntent:true,canRequote:true});
    assert.equal(response.pdfs[0].metadata.print_order,undefined);assert.equal(response.pdfs[0].metadata.print_quote,undefined);
  }
  assert.equal(app.sideEffects.filter(x=>x[0]==='order-post').length,0);
});
