import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createPrintOrder} from '../supabase/functions/_shared/caronte-print-order.mjs';
import {printArtifactBinding} from '../supabase/functions/_shared/caronte-print-preflight.mjs';
import {LULU_A5_PAPERBACK_SKU as sku} from '../supabase/functions/_shared/lulu-print.mjs';

const id='948bc512-eaf8-4f2c-8ae8-c302561ca8d4',session='6159e0f9-4aef-4f93-9d76-f46bfa51a18a';
const quoteId='823f720c-a30b-46f0-bd04-f72af76273a4',hash=x=>x.repeat(64);
const address={name:'Synthetic Reader',street1:'Example street 1',city:'Madrid',postcode:'28001',country_code:'ES',state_code:'M',phone_number:'+34910000000',email:'reader@example.test',is_business:false,is_postbox:false};
const amount=(excl,tax,incl)=>({total_cost_excl_tax:excl,total_tax:tax,total_cost_incl_tax:incl});
const costs=()=>({currency:'EUR',line_item_costs:[{quantity:1,line_item_id:83,...amount('10.00','0.40','10.40')}],
  shipping_cost:amount('5.00','1.05','6.05'),fulfillment_cost:amount('0.75','0.16','0.91'),...amount('15.75','1.61','17.36'),total_discount_amount:'0.00'});
function record(){
  const path=kind=>`${session}/v01/${id}/${kind}.pdf`;
  const row={id,session_id:session,manuscript_id:'manuscript',version:1,page_count:194,file_name:'synthetic-book.pdf',updated_at:'r1',review_status:'approved',storage_path:path('interior'),
    metadata:{template:'caronte-a5-embedded-v2',storage_verified:true,artifact_id:id},quality_report:{byte_size:100,cover_byte_size:80},
    print_validation:{template:'caronte-a5-embedded-v2',fonts_embedded:true,separate_cover:true,source_sha256:hash('a'),interior_sha256:hash('b'),cover_sha256:hash('c'),ready_for_print:true,
      editorial_approval:{reviewer:'editor',at:'2026-10-12T09:00:00Z',version:1,source_sha256:hash('a'),interior_sha256:hash('b'),cover_sha256:hash('c')}},
    lulu_metadata:{environment:'sandbox',pod_package_id:sku,ready_for_print:true,interior_sha256:hash('b'),cover_sha256:hash('c'),
      interior_pdf_storage_path:path('interior'),cover_pdf_storage_path:path('cover'),cover_dimensions:{source:'lulu-api',environment:'sandbox',pageCount:194,podPackageId:sku}}};
  const binding=printArtifactBinding(row,'sandbox');
  row.print_validation.preflight={status:'ready',binding,interior:{state:'normalized',provider_status:'NORMALIZED',validation_id:7,attempt_id:id,source_url_sha256:hash('d'),page_count:194,pod_package_id:sku},
    cover:{state:'normalized',provider_status:'NORMALIZED',validation_id:9,attempt_id:id,source_url_sha256:hash('e')}};
  row.metadata.print_quote={id:quoteId,binding,address_hash:hash('f'),protected_address:{ciphertext:'synthetic-ciphertext',nonce:'synthetic-nonce'},quantity:1,shipping_level:'MAIL',
    costs:{currency:'EUR',printing:{excl_tax:'10.00',tax:'0.40',incl_tax:'10.40'},shipping_handling:{excl_tax:'5.00',tax:'1.05',incl_tax:'6.05'},fulfillment:{excl_tax:'0.75',tax:'0.16',incl_tax:'0.91'},
      discount:'0.00',tax:'1.61',total_excl_tax:'15.75',total_incl_tax:'17.36'},created_at:'2026-10-12T10:00:00Z',expires_at:'2026-10-12T10:15:00Z'};
  return row;
}
function fixture(options={}){
  let row=record(),revision=1,time=Date.parse('2026-10-12T10:01:00Z'),job=null;
  const calls=[],writes=[],urls={interior:'https://storage.test/interior?token=synthetic',cover:'https://storage.test/cover?token=synthetic'};
  const lulu={environment:'sandbox',authenticate:async()=>{},quote:async()=>{calls.push('quote');const value={...costs(),shipping_address:structuredClone(address)};options.changeCosts?.(value);return value;},
    createPrintJob:async input=>{calls.push('create');assert.equal(row.metadata.print_order.state,'submitting');
      job={id:71,external_id:input.external_id,shipping_address:input.shipping_address,contact_email:input.contact_email,shipping_level:input.shipping_level,
        status:{name:'UNPAID',changed:'2026-10-12T10:02:00Z'},line_items:[{...input.line_items[0],id:83,status:{name:'ACCEPTED',messages:{}},
          printable_normalization:{...input.line_items[0].printable_normalization,interior:{source_url:urls.interior,page_count:194},cover:{source_url:urls.cover,page_count:1}}}]};
      if(options.lostCreate)throw new Error('private provider error with address');return structuredClone(job);},
    getPrintJob:async()=>{calls.push('read-job');if(options.readFailure)throw new Error('private provider body');return structuredClone(job);},
    getPrintJobCosts:async()=>{calls.push('read-costs');const value=costs();value.line_item_costs[0].line_item_external_id=job.line_items[0].external_id;return value;},
    reconcilePrintJob:async external=>{calls.push('reconcile');assert.equal(external,job?.external_id||`caronte:sandbox:${id}`);
      return options.reconciliation||{outcome:'matched',resubmitAllowed:false,searchComplete:true,printJob:structuredClone(job),matchingJobIds:[71],matchCount:1};}};
  const app=createPrintOrder({lulu,now:()=>new Date(time),read:async()=>structuredClone(row),
    compareAndSet:async(before,patch)=>{if(options.casFailure||before.updated_at!==row.updated_at)return null;
      row={...row,...structuredClone(patch),updated_at:`r${++revision}`};writes.push(structuredClone(row));
      if(options.lostIntentReadback&&row.metadata.print_order.state==='submitting')throw new Error('lost DB readback');return structuredClone(row);},
    decryptAddress:async()=>structuredClone(address),addressHash:async value=>value.street1===address.street1?hash('f'):hash('0'),
    verifyFile:async()=>{calls.push('verify-file');if(options.fileFailure)throw new Error('private storage error');return {verified:true};},signFile:async kind=>urls[kind]});
  const input={quoteId,shippingAddress:address,shippingConsent:true,orderConsent:true,manualPaymentConfirmed:true,amount:'17.36',currency:'EUR',shippingLevel:'MAIL',quantity:1};
  const actor={id:'synthetic-operator',role:'ops'};
  return {app,input,actor,calls,writes,row:()=>structuredClone(row),job:()=>job,advance:ms=>time+=ms,change:fn=>{fn(row);row.updated_at=`r${++revision}`;}};
}
test('exact spend approval is durable but does not submit an order or create a payment',async()=>{
  const f=fixture(),approved=await f.app.approve(id,f.input,f.actor);
  assert.equal(approved.state,'approved');assert.equal(approved.canSubmit,true);assert.equal(approved.canPay,false);
  assert.equal(f.row().metadata.print_order.quotation.id,quoteId);assert.equal(f.calls.length,0);
  assert.doesNotMatch(JSON.stringify(f.writes),/Example street|reader@example.test|Synthetic Reader/);
});
test('missing consent, wrong amount, expired quotation, changed destination or unauthorized role cannot approve spend',async()=>{
  for(const modify of [x=>x.shippingConsent=false,x=>x.orderConsent=false,x=>x.manualPaymentConfirmed=false,x=>x.amount='18.00',x=>x.quoteId=id,x=>x.shippingAddress={...address,street1:'Another street'},x=>x.quantity=2]){
    const f=fixture(),input=structuredClone(f.input);modify(input);await assert.rejects(f.app.approve(id,input,f.actor));assert.equal(f.writes.length,0);assert.equal(f.calls.length,0);
  }
  const expired=fixture();expired.advance(15*60*1000);await assert.rejects(expired.app.approve(id,expired.input,expired.actor));
  const viewer=fixture();await assert.rejects(viewer.app.approve(id,viewer.input,{id:'viewer',role:'viewer'}));
});
test('one approved immutable pair is submitted once and only provider readback permits manual payment',async()=>{
  const f=fixture(),approval=await f.app.approve(id,f.input,f.actor);
  await f.app.submit(id,approval.id);const created=await f.app.status(id);
  assert.equal(created.providerId,71);assert.equal(created.canPay,false);assert.equal(created.canSubmit,false);
  await assert.rejects(f.app.submit(id,approval.id));assert.equal(f.calls.filter(x=>x==='create').length,1);
  const verified=await f.app.sync(id);assert.equal(verified.providerStatus,'UNPAID');assert.equal(verified.canPay,true);assert.equal(verified.paymentStatus,'unpaid');
  assert.equal(verified.paymentPortalUrl,'https://developers.sandbox.lulu.com/');assert.equal(verified.delivered,false);
});
test('changed price, storage failure or lost reservation receipt cannot dispatch a print-job POST',async()=>{
  for(const options of [{changeCosts:value=>value.total_cost_incl_tax='18.00'},{fileFailure:true},{lostIntentReadback:true},{casFailure:true}]){
    const f=fixture(options);let approval;
    try{approval=await f.app.approve(id,f.input,f.actor);await f.app.submit(id,approval.id);}catch{}
    assert.equal(f.calls.filter(x=>x==='create').length,0);
    if(!options.casFailure)assert.ok(approval);
  }
});
test('lost create response is held and reconciliation cannot create another paid intent',async()=>{
  const f=fixture({lostCreate:true}),approval=await f.app.approve(id,f.input,f.actor);
  assert.equal((await f.app.submit(id,approval.id)).state,'uncertain');
  await assert.rejects(f.app.submit(id,approval.id));await assert.rejects(f.app.approve(id,f.input,f.actor));
  const reconciled=await f.app.reconcile(id);assert.equal(reconciled.providerId,71);assert.equal(reconciled.canPay,false);
  const verified=await f.app.sync(id);assert.equal(verified.canPay,true);assert.equal(f.calls.filter(x=>x==='create').length,1);
});
test('no match, duplicate match or incomplete search never authorizes a second POST',async()=>{
  for(const result of [{outcome:'not_found',searchComplete:true,matchCount:0,matchingJobIds:[],resubmitAllowed:false},
    {outcome:'ambiguous',searchComplete:true,matchCount:2,matchingJobIds:[71,72],resubmitAllowed:false},
    {outcome:'matched',searchComplete:false,matchCount:1,matchingJobIds:[71],printJob:{id:71},resubmitAllowed:false}]){
    const f=fixture({lostCreate:true,reconciliation:result}),approval=await f.app.approve(id,f.input,f.actor);await f.app.submit(id,approval.id);
    const status=await f.app.reconcile(id);assert.equal(status.canSubmit,false);assert.equal(status.canPay,false);assert.equal(status.providerId,null);
    assert.equal(f.calls.filter(x=>x==='create').length,1);
  }
});
test('concurrent submissions cannot send two print jobs',async()=>{
  const f=fixture(),approval=await f.app.approve(id,f.input,f.actor);
  const results=await Promise.allSettled([f.app.submit(id,approval.id),f.app.submit(id,approval.id)]);
  assert.equal(results.filter(x=>x.status==='fulfilled').length,1);assert.equal(f.calls.filter(x=>x==='create').length,1);
});
test('identity, quantity, PDF source and address mismatches cannot become a payable receipt',async()=>{
  for(const modify of [job=>job.id=72,job=>job.external_id='another-job',job=>job.line_items[0].quantity=2,
    job=>job.line_items[0].printable_normalization.interior.source_url='https://evil.test/another.pdf',job=>job.shipping_address.street1='Another street',
    job=>job.line_items[0].printable_normalization.interior.page_count=32,job=>delete job.line_items[0].printable_normalization.cover.page_count]){
    const f=fixture(),approval=await f.app.approve(id,f.input,f.actor);await f.app.submit(id,approval.id);modify(f.job());
    const status=await f.app.sync(id);assert.equal(status.canPay,false);assert.equal(status.paymentStatus,'unknown');assert.equal(status.canSync,true);
    assert.equal(f.calls.filter(x=>x==='create').length,1);
  }
});
test('payment-in-progress is not paid and shipment is not delivery',async()=>{
  const f=fixture(),approval=await f.app.approve(id,f.input,f.actor);await f.app.submit(id,approval.id);
  f.job().status.name='PAYMENT_IN_PROGRESS';assert.equal((await f.app.sync(id)).paymentStatus,'payment_in_progress');
  f.job().status.name='PRODUCTION_DELAYED';assert.equal((await f.app.sync(id)).paymentStatus,'paid_confirmed');
  f.job().status.name='SHIPPED';f.job().line_items[0].status={name:'SHIPPED',messages:{tracking_id:'synthetic-tracking',carrier_name:'Synthetic carrier',tracking_urls:['https://tracking.example.test/71']}};
  const shipped=await f.app.sync(id);assert.equal(shipped.delivered,false);assert.equal(shipped.tracking.id,'synthetic-tracking');
  f.job().status.name='DELIVERED';assert.equal((await f.app.sync(id)).delivered,true);
});
test('failed, stale or revoked governing state suppresses the payment link',async()=>{
  const failed=fixture({readFailure:true}),a=await failed.app.approve(id,failed.input,failed.actor);await failed.app.submit(id,a.id);
  const unavailable=await failed.app.sync(id);assert.equal(unavailable.canPay,false);assert.doesNotMatch(JSON.stringify(unavailable),/private provider body/);
  const f=fixture(),approval=await f.app.approve(id,f.input,f.actor);await f.app.submit(id,approval.id);await f.app.sync(id);
  f.advance(120000);assert.equal((await f.app.status(id)).canPay,false);
  f.change(row=>row.review_status='rejected');assert.equal((await f.app.status(id)).canPay,false);
  assert.equal((await f.app.sync(id)).canPay,false);
});
test('fresh provider address warnings cannot be ignored before dispatch',async()=>{
  const f=fixture({changeCosts:body=>body.shipping_address.warnings={message:'Address unverified'}}),approval=await f.app.approve(id,f.input,f.actor);
  await assert.rejects(f.app.submit(id,approval.id));assert.equal(f.calls.filter(x=>x==='create').length,0);
});
test('a historical paid receipt cannot regress into another payable order after cancellation',async()=>{
  const f=fixture(),approval=await f.app.approve(id,f.input,f.actor);await f.app.submit(id,approval.id);
  f.job().status.name='PRODUCTION_DELAYED';await f.app.sync(id);
  f.job().status.name='CANCELED';await f.app.sync(id);
  f.job().status.name='UNPAID';const status=await f.app.sync(id);
  assert.equal(status.canPay,false);assert.equal(status.paymentPortalUrl,null);assert.equal(status.paymentStatus,'unknown');
  assert.equal(status.state,'status_unverified');assert.equal(f.calls.filter(x=>x==='create').length,1);
});
test('future-dated readback and a failed refresh cannot present a currently verified payable receipt',async()=>{
  const options={},f=fixture(options),approval=await f.app.approve(id,f.input,f.actor);await f.app.submit(id,approval.id);await f.app.sync(id);
  f.change(row=>row.metadata.print_order.receipt.checked_at='2026-10-12T10:10:00Z');assert.equal((await f.app.status(id)).canPay,false);
  options.readFailure=true;const status=await f.app.sync(id);
  assert.equal(status.state,'status_unverified');assert.equal(status.canPay,false);assert.equal(status.paymentStatus,'unknown');
});
