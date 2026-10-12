import {printArtifactBinding} from './caronte-print-preflight.mjs';

const fail=code=>{throw new Error(code);};
const levels=['MAIL','PRIORITY_MAIL','GROUND_HD','GROUND_BUS','GROUND','EXPEDITED','EXPRESS'];
const currencies=['AUD','CAD','EUR','GBP','USD'];
const json=value=>value&&typeof value==='object' ? Array.isArray(value)?`[${value.map(json).join(',')}]`
  :`{${Object.keys(value).sort().map(key=>`${JSON.stringify(key)}:${json(value[key])}`).join(',')}}`:JSON.stringify(value);
const decimal=value=>{
  if(typeof value!=='string'||value.length>48||!/^\d{1,24}(?:\.\d{1,24})?$/.test(value))fail('print_quote_money_invalid');
  const [whole,fraction='']=value.split('.');return {value,n:BigInt(whole+fraction),scale:fraction.length};
};
function equalSum(total,parts) {
  const values=[decimal(total),...parts.map(decimal)],scale=Math.max(...values.map(v=>v.scale));
  return values[0].n*10n**BigInt(scale-values[0].scale)===values.slice(1).reduce((sum,v)=>sum+v.n*10n**BigInt(scale-v.scale),0n);
}
const amounts=value=>{
  if(!value)fail('print_quote_money_invalid');
  const result={excl_tax:decimal(value.total_cost_excl_tax).value,tax:decimal(value.total_tax).value,incl_tax:decimal(value.total_cost_incl_tax).value};
  if(!equalSum(result.incl_tax,[result.excl_tax,result.tax]))fail('print_quote_totals_inconsistent');return result;
};
const sameAmounts=(a,b)=>['excl_tax','tax','incl_tax'].every(key=>equalSum(a[key],[b[key]]));

/** Provider totals are authoritative. Verify them without binary-float rounding or duplicated fees. */
export function parsePrintCosts(data,{currency,quantity}) {
  if(data?.currency!==currency||!currencies.includes(currency))fail('print_quote_currency_mismatch');
  if(!Array.isArray(data.line_item_costs)||data.line_item_costs.length!==1||data.line_item_costs[0].quantity!==quantity)fail('print_quote_lines_invalid');
  const print=amounts(data.line_item_costs[0]),shipping=amounts(data.shipping_cost),totals=amounts(data);
  const discount=decimal(data.total_discount_amount).value;
  const fees=data.fees;
  if(fees!==undefined&&!Array.isArray(fees))fail('print_quote_fees_invalid');
  const fulfillmentFees=[];
  for(const fee of fees||[]) {
    if(fee.currency!==currency||!['HANDLING_FEE','FULFILLMENT_FEE'].includes(fee.fee_type))fail('print_quote_fees_invalid');
    const amount=amounts(fee);
    // Lulu's shipping_cost already includes handling. fees lists it again for information.
    if(fee.fee_type==='FULFILLMENT_FEE')fulfillmentFees.push(amount);
  }
  if(fulfillmentFees.length>1)fail('print_quote_fees_invalid');
  const legacy=data.fulfillment_cost?amounts(data.fulfillment_cost):null;
  if(legacy&&fulfillmentFees[0]&&!sameAmounts(legacy,fulfillmentFees[0]))fail('print_quote_fees_invalid');
  const fulfillment=legacy||fulfillmentFees[0]||{excl_tax:'0.00',tax:'0.00',incl_tax:'0.00'};
  for(const key of ['excl_tax','tax','incl_tax'])if(!equalSum(totals[key],[print[key],shipping[key],fulfillment[key]]))fail('print_quote_totals_inconsistent');
  return {currency,printing:print,shipping_handling:shipping,fulfillment,discount,tax:totals.tax,
    total_excl_tax:totals.excl_tax,total_incl_tax:totals.incl_tax};
}

export function shippingAddress(input) {
  if(!input||typeof input!=='object'||Array.isArray(input))fail('shipping_address_invalid');
  const result={};
  const limits={name:35,street1:30,street2:30,city:30,postcode:64,country_code:2,state_code:6,phone_number:20,email:254,organization:30};
  for(const [key,max] of Object.entries(limits)) {
    if(input[key]===undefined||input[key]===null||input[key]==='')continue;
    if(typeof input[key]!=='string'||input[key].length>max||/[\u0000-\u001f\u007f]/.test(input[key]))fail('shipping_address_invalid');
    const text=input[key].trim();if(text)result[key]=text;
  }
  for(const field of ['name','street1','city','postcode','country_code','phone_number','email'])if(!result[field])fail('shipping_address_invalid');
  if(!/^[A-Z]{2}$/.test(result.country_code)||!/^\+?[\d\s\-./()]{8,20}$/.test(result.phone_number)||!/^\S+@[^\s@]+\.[^\s@]+$/.test(result.email))fail('shipping_address_invalid');
  if(result.state_code&&!/^[A-Z0-9-]{1,6}$/.test(result.state_code))fail('shipping_address_invalid');
  for(const key of ['is_business','is_postbox']){
    if(input[key]!==undefined&&typeof input[key]!=='boolean')fail('shipping_address_invalid');
    result[key]=input[key]===true;
  }
  return result;
}
export function readyBinding(row,environment) {
  let binding;
  try{binding=printArtifactBinding(row,environment);}catch{fail('print_quote_artifact_not_ready');}
  const p=row.print_validation.preflight;
  if(row.print_validation.ready_for_print!==true||row.lulu_metadata.ready_for_print!==true||p?.status!=='ready'||json(p.binding)!==json(binding))fail('print_quote_artifact_not_ready');
  for(const kind of ['interior','cover']){
    const receipt=p[kind];
    if(receipt?.state!=='normalized'||receipt.provider_status!=='NORMALIZED'||!Number.isSafeInteger(receipt.validation_id)||receipt.validation_id<1||
        !/^[0-9a-f]{64}$/.test(receipt.source_url_sha256)||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(receipt.attempt_id||''))fail('print_quote_artifact_not_ready');
  }
  if(p.interior.page_count!==binding.page_count||p.interior.pod_package_id!==binding.pod_package_id)fail('print_quote_artifact_not_ready');
  return binding;
}

export function createPrintQuotation({read,compareAndSet,protectAddress,addressHash,lulu,now=()=>new Date()}) {
  if(!['sandbox','production'].includes(lulu?.environment)||[read,compareAndSet,protectAddress,addressHash,now].some(fn=>typeof fn!=='function'))fail('print_quote_not_configured');
  async function prepare(pdfId,input){
    if(input?.shippingConsent!==true)fail('shipping_consent_required');
    const address=shippingAddress(input.shippingAddress),currency=input.currency||'EUR';
    if(!currencies.includes(currency))fail('print_quote_currency_invalid');
    const row=await read(pdfId);if(row?.id!==pdfId)fail('print_quote_pdf_not_found');
    const order=row.metadata?.print_order;
    if(order&&!['approved','approval_invalidated'].includes(order.state))fail('print_quote_order_already_attempted');
    return {row,binding:readyBinding(row,lulu.environment),address,currency};
  }
  async function optionsFor({binding,address,currency}){
    let data;
    try{data=await lulu.shippingOptions({currency,line_items:[{page_count:binding.page_count,pod_package_id:binding.pod_package_id,quantity:1}],
      shipping_address:{country:address.country_code,state_code:address.state_code,postcode:address.postcode,is_business:address.is_business,is_postbox:address.is_postbox}});}
    catch{fail('print_shipping_lookup_failed');}
    if(!Array.isArray(data)||data.length>100)fail('print_shipping_response_invalid');
    const seen=new Set();
    return data.map(item=>{
      if(!levels.includes(item.level)||item.currency!==currency||seen.has(item.level))fail('print_shipping_response_invalid');seen.add(item.level);
      const date=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value))?value:null;
      return {level:item.level,currency,cost_excl_tax:item.cost_excl_tax==null?null:decimal(item.cost_excl_tax).value,
        traceable:typeof item.traceable==='boolean'?item.traceable:null,
        min_delivery_date:date(item.min_delivery_date),max_delivery_date:date(item.max_delivery_date)};
    });
  }
  const publicQuote=(receipt,status)=>({id:receipt?.id||null,status,pdfId:receipt?.binding?.pdf_id||null,
    environment:receipt?.binding?.environment||lulu.environment,quantity:receipt?.quantity||1,
    shippingLevel:receipt?.shipping_level||null,createdAt:receipt?.created_at||null,expiresAt:receipt?.expires_at||null,
    costs:receipt?.costs||null,orderCreated:false,paymentCreated:false});
  async function status(pdfId){
    const row=await read(pdfId);if(row?.id!==pdfId)fail('print_quote_pdf_not_found');
    const receipt=row.metadata?.print_quote;if(!receipt)return publicQuote(null,'not_quoted');
    let binding;try{binding=readyBinding(row,lulu.environment);}catch{return publicQuote(receipt,'invalidated');}
    if(json(binding)!==json(receipt.binding))return publicQuote(receipt,'invalidated');
    if(!Number.isFinite(Date.parse(receipt.expires_at))||now().getTime()>=Date.parse(receipt.expires_at))return publicQuote(receipt,'expired');
    return publicQuote(receipt,'quoted');
  }
  async function quote(pdfId,input){
    const context=await prepare(pdfId,input),{row,binding,address,currency}=context;
    const options=await optionsFor(context);
    if(!options.some(option=>option.level===input.shippingLevel))fail('shipping_option_unavailable');
    let data;
    try{data=await lulu.quote({line_items:[{page_count:binding.page_count,pod_package_id:binding.pod_package_id,quantity:1}],shipping_address:address,shipping_option:input.shippingLevel});}
    catch{fail('print_quote_provider_failed');}
    const echoed=data?.shipping_address;
    let normalized;try{normalized=shippingAddress(echoed);}catch{fail('print_quote_address_unverified');}
    if((echoed.warnings&&(!Array.isArray(echoed.warnings)||echoed.warnings.length))||json(normalized)!==json(address)||echoed.suggested_address&&Object.values(echoed.suggested_address).some(v=>v!=null&&v!=='')){
      const suggestion={};
      for(const key of ['name','street1','street2','city','postcode','country_code','state_code']) {
        const value=echoed.suggested_address?.[key]??echoed[key];
        if(typeof value==='string'&&value.length<=254&&!/[\u0000-\u001f]/.test(value))suggestion[key]=value;
      }
      return {status:'address_review_required',suggestedAddress:suggestion,orderCreated:false,paymentCreated:false};
    }
    const costs=parsePrintCosts(data,{currency,quantity:1});
    let protectedAddress,hashedAddress;
    try{protectedAddress=await protectAddress(address);hashedAddress=await addressHash(address);}catch{fail('print_quote_address_protection_failed');}
    if(!protectedAddress?.ciphertext||!protectedAddress?.nonce||!/^[0-9a-f]{64}$/.test(hashedAddress))fail('print_quote_address_protection_failed');
    const created=now();
    const receipt={id:crypto.randomUUID(),binding,address_hash:hashedAddress,protected_address:protectedAddress,quantity:1,
      shipping_level:input.shippingLevel,costs,created_at:created.toISOString(),expires_at:new Date(created.getTime()+15*60*1000).toISOString()};
    const patch={metadata:{...row.metadata,print_quote:receipt}};
    let saved;try{saved=await compareAndSet(row,patch);}catch{fail('print_quote_persistence_unverified');}
    if(!saved||json(saved.metadata)!==json(patch.metadata))fail('print_quote_persistence_unverified');
    return publicQuote(receipt,'quoted');
  }
  return Object.freeze({quote,status,shippingOptions:async(pdfId,input)=>({options:await optionsFor(await prepare(pdfId,input)),orderCreated:false,paymentCreated:false})});
}
