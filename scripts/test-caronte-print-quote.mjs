import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createPrintQuotation,parsePrintCosts} from '../supabase/functions/_shared/caronte-print-quote.mjs';
import {printArtifactBinding} from '../supabase/functions/_shared/caronte-print-preflight.mjs';
import {LULU_A5_PAPERBACK_SKU as sku} from '../supabase/functions/_shared/lulu-print.mjs';

const id='948bc512-eaf8-4f2c-8ae8-c302561ca8d4',session='6159e0f9-4aef-4f93-9d76-f46bfa51a18a',hash=x=>x.repeat(64);
const address={name:'Synthetic Reader',street1:'Example street 1',city:'Madrid',postcode:'28001',country_code:'ES',state_code:'M',phone_number:'+34910000000',email:'reader@example.test'};
const cost=(excl,tax,incl)=>({total_cost_excl_tax:excl,total_tax:tax,total_cost_incl_tax:incl});
const quote=()=>({currency:'EUR',shipping_address:address,line_item_costs:[{quantity:1,...cost('10.00','0.40','10.40'),discounts:[]}],
  shipping_cost:cost('5.00','1.05','6.05'),fulfillment_cost:cost('0.75','0.16','0.91'),
  fees:[{fee_type:'HANDLING_FEE',currency:'EUR',...cost('1.00','0.21','1.21')},{fee_type:'FULFILLMENT_FEE',currency:'EUR',...cost('0.75','0.16','0.91')}],
  ...cost('15.75','1.61','17.36'),total_discount_amount:'0.00'});
const row=()=>{
  const p=kind=>`${session}/v01/${id}/${kind}.pdf`;
  const input={id,session_id:session,manuscript_id:'manuscript-v1',version:1,page_count:194,review_status:'approved',updated_at:'r1',storage_path:p('interior'),
    metadata:{template:'caronte-a5-embedded-v2',artifact_id:id,storage_verified:true},quality_report:{byte_size:100,cover_byte_size:80},
    print_validation:{template:'caronte-a5-embedded-v2',fonts_embedded:true,separate_cover:true,ready_for_print:true,source_sha256:hash('a'),interior_sha256:hash('b'),cover_sha256:hash('c'),
      editorial_approval:{version:1,reviewer:'editor',at:'2026-10-11T10:00:00Z',source_sha256:hash('a'),interior_sha256:hash('b'),cover_sha256:hash('c')}},
    lulu_metadata:{ready_for_print:true,environment:'sandbox',pod_package_id:sku,interior_sha256:hash('b'),cover_sha256:hash('c'),
      interior_pdf_storage_path:p('interior'),cover_pdf_storage_path:p('cover'),cover_dimensions:{source:'lulu-api',environment:'sandbox',pageCount:194,podPackageId:sku}}};
  input.print_validation.preflight={status:'ready',binding:printArtifactBinding(input,'sandbox'),
    interior:{state:'normalized',provider_status:'NORMALIZED',validation_id:7,attempt_id:id,source_url_sha256:hash('d'),page_count:194,pod_package_id:sku},
    cover:{state:'normalized',provider_status:'NORMALIZED',validation_id:9,attempt_id:id,source_url_sha256:hash('e')}};
  return input;
};
function fixture(options={}){
  let record=structuredClone(options.row||row()),time=Date.parse('2026-10-11T11:00:00Z'),revision=1;
  const calls=[],writes=[];
  const lulu={environment:'sandbox',shippingOptions:async input=>{calls.push(['shipping',input]);return options.shipping||[{id:1,level:'MAIL',currency:'EUR',cost_excl_tax:'5.00',traceable:false,min_delivery_date:'2026-10-20',max_delivery_date:'2026-10-25'}];},
    quote:async input=>{calls.push(['quote',input]);if(options.providerFailure)throw new Error('private address response');return options.quote||quote();},
    createPrintJob:()=>assert.fail('Quoting must never create a print job')};
  const service=createPrintQuotation({lulu,now:()=>new Date(time),read:async()=>structuredClone(record),
    addressHash:async value=>{assert.equal(value.street1,address.street1);return hash('f');},
    protectAddress:async value=>{assert.equal(value.street1,address.street1);return {ciphertext:'encrypted-proof',nonce:'synthetic-nonce'};},
    compareAndSet:async(before,patch)=>{
      if(options.casFailure||before.updated_at!==record.updated_at)return null;
      record={...record,...structuredClone(patch),updated_at:`r${++revision}`};writes.push(structuredClone(record));return structuredClone(record);
    }});
  const input={shippingAddress:address,shippingConsent:true,currency:'EUR',shippingLevel:'MAIL'};
  return {service,calls,writes,input,row:()=>structuredClone(record),advance:ms=>time+=ms,change:fn=>{fn(record);record.updated_at=`r${++revision}`;}};
}
test('costs use exact decimal strings and do not count handling or fulfillment twice',()=>{
  const costs=parsePrintCosts(quote(),{currency:'EUR',quantity:1});
  assert.equal(costs.total_incl_tax,'17.36');assert.equal(costs.shipping_handling.incl_tax,'6.05');assert.equal(costs.fulfillment.incl_tax,'0.91');
  assert.equal(costs.tax,'1.61');assert.equal(costs.discount,'0.00');
});
test('missing totals, wrong currency, unknown fees or inconsistent arithmetic fail closed',()=>{
  for(const modify of [q=>delete q.total_tax,q=>q.total_cost_incl_tax='17.35',q=>q.currency='USD',q=>q.total_tax=1.61,
    q=>q.fees[1].total_cost_incl_tax='0.92',q=>q.fees.push({fee_type:'UNKNOWN_FEE',...cost('1.00','0.00','1.00')}),q=>q.total_cost_excl_tax='1e3']){
    const data=quote();modify(data);assert.throws(()=>parsePrintCosts(data,{currency:'EUR',quantity:1}));
  }
});
test('one confirmed private quotation binds files, destination and shipping without creating an order',async()=>{
  const app=fixture();const result=await app.service.quote(id,app.input);
  assert.equal(result.status,'quoted');assert.equal(result.costs.total_incl_tax,'17.36');assert.equal(result.orderCreated,false);
  assert.equal(app.row().metadata.print_quote.address_hash,hash('f'));
  assert.equal(app.row().metadata.print_quote.binding.pdf_id,id);
  assert.equal(app.row().metadata.print_quote.protected_address.ciphertext,'encrypted-proof');
  assert.doesNotMatch(JSON.stringify(app.writes),/Example street|reader@example.test|Synthetic Reader|910000000/);
  assert.equal(app.calls[0][1].shipping_address.country,'ES');assert.equal(app.calls[0][1].shipping_address.state_code,'M');
  assert.equal(app.calls[0][1].shipping_address.street1,undefined);
  assert.equal(app.calls[1][1].shipping_address.country_code,'ES');
});
test('shipping consent and an exact normalized print pair are required before any provider call',async()=>{
  for(const change of [r=>r.print_validation.ready_for_print=false,r=>r.review_status='rejected',r=>r.print_validation.preflight.interior.validation_id=null,
    r=>r.print_validation.preflight.binding.source_sha256=hash('f'),r=>r.print_validation.ready_for_print='true',
    r=>r.print_validation.preflight.cover.attempt_id='not-an-attempt']){
    const record=row();change(record);const app=fixture({row:record});await assert.rejects(app.service.quote(id,app.input));assert.equal(app.calls.length,0);
  }
  const app=fixture();await assert.rejects(app.service.quote(id,{...app.input,shippingConsent:false}));assert.equal(app.calls.length,0);
});
test('shipping methods are returned by Lulu, not manufactured from a fixed list',async()=>{
  const app=fixture();const result=await app.service.shippingOptions(id,app.input);
  assert.deepEqual(result.options.map(item=>item.level),['MAIL']);assert.equal(result.options[0].traceable,false);
  await assert.rejects(app.service.quote(id,{...app.input,shippingLevel:'EXPRESS'}),/shipping_option_unavailable/);
  assert.equal(app.calls.filter(call=>call[0]==='quote').length,0);
});
test('address suggestions/warnings are not silently used to quote another destination',async()=>{
  const data=quote();data.shipping_address={...address,warnings:[{message:'private address details'}],suggested_address:{...address,street1:'Corrected street 2'}};
  const app=fixture({quote:data});const result=await app.service.quote(id,app.input);
  assert.equal(result.status,'address_review_required');assert.equal(result.suggestedAddress.street1,'Corrected street 2');
  assert.equal(app.writes.length,0);assert.doesNotMatch(JSON.stringify(result),/private address details/);
});
test('expired or changed-file quotations cannot remain usable',async()=>{
  const app=fixture();await app.service.quote(id,app.input);app.advance(15*60*1000);
  assert.equal((await app.service.status(id)).status,'expired');
  const changed=fixture();await changed.service.quote(id,changed.input);changed.change(r=>r.print_validation.source_sha256=hash('f'));
  assert.equal((await changed.service.status(id)).status,'invalidated');
});
test('failed persistence or provider calculation never reports a usable quotation',async()=>{
  for(const options of [{casFailure:true},{providerFailure:true}]){
    const app=fixture(options);await assert.rejects(app.service.quote(id,app.input),error=>{assert.doesNotMatch(error.message,/private address/);return true;});
  }
});
test('overlong address fields are rejected rather than truncated into a different destination',async()=>{
  const app=fixture();await assert.rejects(app.service.quote(id,{...app.input,shippingAddress:{...address,street1:'x'.repeat(31)}}),/shipping_address_invalid/);
  assert.equal(app.calls.length,0);
});
test('a submitting, uncertain or accepted order freezes its quotation and destination',async()=>{
  for(const state of ['submitting','uncertain','submitted','verified','unrecognized']){
    const record=row();record.metadata.print_order={state};const app=fixture({row:record});
    await assert.rejects(app.service.quote(id,app.input));await assert.rejects(app.service.shippingOptions(id,app.input));
    assert.equal(app.calls.length,0);assert.equal(app.writes.length,0);
  }
});
