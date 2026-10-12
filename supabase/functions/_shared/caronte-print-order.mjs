import {readyBinding,shippingAddress,parsePrintCosts} from './caronte-print-quote.mjs';
import {LULU_PRINT_JOB_STATUSES,luluPaymentPortalUrl} from './lulu-print.mjs';

const fail=code=>{throw new Error(code);};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const json=value=>value&&typeof value==='object'?Array.isArray(value)?`[${value.map(json).join(',')}]`
  :`{${Object.keys(value).sort().map(key=>`${JSON.stringify(key)}:${json(value[key])}`).join(',')}}`:JSON.stringify(value);
const money=value=>typeof value==='string'&&/^\d{1,24}(?:\.\d{1,24})?$/.test(value)
  ?value.split('.').map((part,index)=>index?part.replace(/0+$/,''):part.replace(/^0+(?=\d)/,'')).join('.').replace(/\.$/,''):null;
const sameMoney=(a,b)=>money(a)!==null&&money(a)===money(b);
const sameCosts=(a,b)=>a?.currency===b?.currency&&['tax','discount','total_excl_tax','total_incl_tax'].every(key=>sameMoney(a?.[key],b?.[key]))&&
  ['printing','shipping_handling','fulfillment'].every(kind=>['excl_tax','tax','incl_tax'].every(key=>sameMoney(a?.[kind]?.[key],b?.[kind]?.[key])));
const sha=async value=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))),x=>x.toString(16).padStart(2,'0')).join('');
const amount=value=>({total_cost_excl_tax:value?.excl_tax,total_tax:value?.tax,total_cost_incl_tax:value?.incl_tax});
function storedCosts(costs){return parsePrintCosts({currency:costs?.currency,line_item_costs:[{quantity:1,...amount(costs?.printing)}],
  shipping_cost:amount(costs?.shipping_handling),fulfillment_cost:amount(costs?.fulfillment),total_cost_excl_tax:costs?.total_excl_tax,
  total_cost_incl_tax:costs?.total_incl_tax,total_tax:costs?.tax,total_discount_amount:costs?.discount},{currency:costs?.currency,quantity:1});}

/** At most one submitted intent per immutable PDF; no automatic POST replay. */
export function createPrintOrder({read,compareAndSet,decryptAddress,addressHash,verifyFile,signFile,lulu,now=()=>new Date()}) {
  if(!['sandbox','production'].includes(lulu?.environment)||[read,compareAndSet,decryptAddress,addressHash,verifyFile,signFile,now].some(fn=>typeof fn!=='function'))fail('print_order_not_configured');
  const environment=lulu.environment,stamp=()=>now().toISOString();
  async function load(pdfId){if(!uuid.test(pdfId))fail('print_order_pdf_invalid');const row=await read(pdfId);if(row?.id!==pdfId)fail('print_order_pdf_not_found');return row;}
  function usableQuote(row){
    const q=row.metadata?.print_quote;let binding;
    try{binding=readyBinding(row,environment);}catch{fail('print_order_artifact_not_ready');}
    if(!uuid.test(q?.id)||json(q.binding)!==json(binding)||q.quantity!==1||!/^[0-9a-f]{64}$/.test(q.address_hash)||
        !q.protected_address?.ciphertext||!q.protected_address?.nonce||!['MAIL','PRIORITY_MAIL','GROUND_HD','GROUND_BUS','GROUND','EXPEDITED','EXPRESS'].includes(q.shipping_level))fail('print_order_quote_invalid');
    const created=Date.parse(q.created_at),expires=Date.parse(q.expires_at),time=now().getTime();
    if(!Number.isFinite(created)||expires-created!==900000||created>time||time>=expires)fail('print_order_quote_expired');
    storedCosts(q.costs);return q;
  }
  function stillApproved(row,order){try{return json(readyBinding(row,environment))===json(order.quotation.binding);}catch{return false;}}
  function summary(row){
    const order=row.metadata?.print_order;if(!order)return {pdfId:row.id,state:'not_approved',canSubmit:false,canPay:false,canSync:false,canReconcile:false};
    let canSubmit=false;
    if(order.state==='approved')try{canSubmit=usableQuote(row).id===order.quotation.id&&stillApproved(row,order);}catch{}
    const r=order.receipt,verified=r?.verified===true,paid=['PRODUCTION_DELAYED','PRODUCTION_READY','IN_PRODUCTION','SHIPPED','DELIVERED'];
    const age=now().getTime()-Date.parse(r?.checked_at);
    const canPay=verified&&r.status==='UNPAID'&&!order.payment_confirmed_at&&stillApproved(row,order)&&age>=0&&age<120000;
    return {id:order.id,pdfId:row.id,quoteId:order.quotation.id,environment,state:order.state==='approved'&&!canSubmit?'approval_invalidated':order.state==='verified'&&!verified?'status_unverified':order.state,
      title:order.title,quantity:1,shippingLevel:order.quotation.shipping_level,costs:order.quotation.costs,expiresAt:order.quotation.expires_at,
      providerId:order.provider_id||null,providerStatus:order.receipt?.status||null,checkedAt:order.receipt?.checked_at||null,
      canSubmit,canPay,canSync:Number.isSafeInteger(order.provider_id),canReconcile:['submitting','uncertain'].includes(order.state),
      paymentStatus:!verified?'unknown':paid.includes(r.status)?'paid_confirmed':r.status==='UNPAID'&&!order.payment_confirmed_at?'unpaid':r.status==='PAYMENT_IN_PROGRESS'&&!order.payment_confirmed_at?'payment_in_progress':'unknown',
      delivered:verified&&r.status==='DELIVERED'&&!!r.tracking?.id&&!!r.tracking?.urls?.length,
      tracking:verified?r.tracking||null:null,providerCosts:r?.actual_costs||null,
      paymentPortalUrl:canPay?luluPaymentPortalUrl(environment):null,resubmitAllowed:false,errorCode:order.error_code||null};
  }
  async function save(row,order){
    const patch={metadata:{...row.metadata,print_order:order}};let saved;
    try{saved=await compareAndSet(row,patch);}catch{fail('print_order_persistence_unverified');}
    if(!saved||json(saved.metadata)!==json(patch.metadata))fail('print_order_persistence_unverified');return saved;
  }
  async function approve(pdfId,input,actor){
    if(!['ops','owner','legacy_token','local_admin'].includes(actor?.role)||typeof actor.id!=='string'||!actor.id.trim()||actor.id.length>254)fail('print_order_approval_forbidden');
    if(input?.shippingConsent!==true||input.orderConsent!==true||input.manualPaymentConfirmed!==true)fail('print_order_consent_required');
    const row=await load(pdfId),q=usableQuote(row),existing=row.metadata.print_order;
    if(existing&&!['approved','approval_invalidated'].includes(existing.state))fail('print_order_already_attempted');
    if(input.quoteId!==q.id||input.quantity!==1||input.currency!==q.costs.currency||!sameMoney(input.amount,q.costs.total_incl_tax)||input.shippingLevel!==q.shipping_level)fail('print_order_approval_mismatch');
    let address;try{address=shippingAddress(input.shippingAddress);}catch{fail('print_order_destination_invalid');}
    if(await addressHash(address)!==q.address_hash)fail('print_order_destination_changed');
    const order={id:`caronte:${environment}:${pdfId}`,state:'approved',title:row.file_name||'Caronte · libro desde el futuro',quotation:q,
      approval:{by:actor.id,role:actor.role,at:stamp(),manual_payment_confirmed:true},created_at:existing?.created_at||stamp()};
    return summary(await save(row,order));
  }
  async function addressFor(order){
    let address;try{address=shippingAddress(await decryptAddress(order.quotation.protected_address));}
    catch{fail('print_order_destination_unavailable');}
    if(await addressHash(address)!==order.quotation.address_hash)fail('print_order_destination_changed');return address;
  }
  async function submit(pdfId,orderId){
    const row=await load(pdfId),order=row.metadata?.print_order;
    if(order?.id!==orderId||order.state!=='approved'||order.approval?.manual_payment_confirmed!==true)fail('print_order_not_submittable');
    const q=usableQuote(row);if(q.id!==order.quotation.id||json(q)!==json(order.quotation))fail('print_order_approval_changed');
    const address=await addressFor(order),sources={};
    for(const kind of ['interior','cover']){
      const binding=q.binding;let verified;
      try{verified=await verifyFile({kind,path:binding[`${kind}_path`],sha256:binding[`${kind}_sha256`],byteSize:binding[`${kind}_byte_size`]});}
      catch{fail('print_order_file_unverified');}
      if(verified?.verified!==true)fail('print_order_file_unverified');
      let source;try{source=await signFile(kind,binding[`${kind}_path`],3600);}catch{fail('print_order_file_unavailable');}
      let parsed;try{parsed=new URL(source);}catch{fail('print_order_source_invalid');}
      if(parsed.protocol!=='https:'||parsed.username||parsed.password||parsed.hash)fail('print_order_source_invalid');sources[kind]=source;
    }
    let fresh;
    try{await lulu.authenticate();fresh=await lulu.quote({line_items:[{page_count:q.binding.page_count,pod_package_id:q.binding.pod_package_id,quantity:1}],shipping_address:address,shipping_option:q.shipping_level});}
    catch{fail('print_order_price_unverified');}
    let matching=false;
    try{matching=json(shippingAddress(fresh.shipping_address))===json(address)&&(!fresh.shipping_address.warnings||Array.isArray(fresh.shipping_address.warnings)&&!fresh.shipping_address.warnings.length)&&
      !Object.values(fresh.shipping_address.suggested_address||{}).some(value=>value!=null&&value!=='')&&sameCosts(parsePrintCosts(fresh,{currency:q.costs.currency,quantity:1}),q.costs);}catch{}
    if(!matching){await save(row,{...order,state:'approval_invalidated',error_code:'print_order_price_or_destination_changed'});fail('print_order_price_or_destination_changed');}
    const current=await load(pdfId);
    if(current.updated_at!==row.updated_at||json(usableQuote(current))!==json(q))fail('print_order_approval_changed');
    const intent={...order,state:'submitting',started_at:stamp(),source_hashes:{interior:await sha(sources.interior),cover:await sha(sources.cover)}};
    const reserved=await save(current,intent),checked=await load(pdfId);
    if(checked.updated_at!==reserved.updated_at||json(checked.metadata.print_order)!==json(intent)||json(usableQuote(checked))!==json(q))fail('print_order_reservation_changed');
    let job;
    try{job=await lulu.createPrintJob({external_id:order.id,contact_email:address.email,shipping_address:address,shipping_level:q.shipping_level,production_delay:120,
      line_items:[{external_id:order.id,title:order.title,quantity:1,printable_normalization:{pod_package_id:q.binding.pod_package_id,
        interior:{source_url:sources.interior},cover:{source_url:sources.cover}}}]});}
    catch{return summary(await save(checked,{...intent,state:'uncertain',error_code:'print_order_submission_uncertain'}));}
    if(!Number.isSafeInteger(job?.id)||job.id<1||job.external_id!==order.id||!LULU_PRINT_JOB_STATUSES.includes(job.status?.name))
      return summary(await save(checked,{...intent,state:'uncertain',error_code:'print_order_creation_receipt_invalid'}));
    return summary(await save(checked,{...intent,state:'submitted',provider_id:job.id,
      receipt:{status:job.status.name,verified:false,checked_at:stamp()},error_code:null}));
  }
  async function sync(pdfId){
    const row=await load(pdfId),order=row.metadata?.print_order;
    if(!Number.isSafeInteger(order?.provider_id)||order.provider_id<1)fail('print_order_provider_id_missing');
    let job,actual,tracking=null;
    try{
      job=await lulu.getPrintJob(order.provider_id);const address=await addressFor(order),line=job?.line_items?.[0],p=line?.printable_normalization;
      if(job?.id!==order.provider_id||job.external_id!==order.id||job.shipping_level!==order.quotation.shipping_level||job.contact_email!==address.email||
          job.line_items.length!==1||!Number.isSafeInteger(line?.id)||line.id<1||line.external_id!==order.id||line.quantity!==1||line.title!==order.title||
          p?.pod_package_id!==order.quotation.binding.pod_package_id||Number(p?.interior?.page_count)!==order.quotation.binding.page_count||Number(p?.cover?.page_count)!==1||
          await sha(p?.interior?.source_url||'')!==order.source_hashes.interior||
          await sha(p?.cover?.source_url||'')!==order.source_hashes.cover||!LULU_PRINT_JOB_STATUSES.includes(job.status?.name)||
          !Number.isFinite(Date.parse(job.status.changed))||Date.parse(job.status.changed)>now().getTime()+60000||
          order.receipt?.provider_changed_at&&Date.parse(job.status.changed)<Date.parse(order.receipt.provider_changed_at))fail('print_order_receipt_invalid');
      if(order.payment_confirmed_at&&['UNPAID','PAYMENT_IN_PROGRESS'].includes(job.status.name))fail('print_order_payment_regressed');
      const echo=job.shipping_address;
      if(json(shippingAddress({...echo,email:echo?.email||address.email}))!==json(address)||
          echo?.warnings&&(!Array.isArray(echo.warnings)||echo.warnings.length)||Object.values(echo?.suggested_address||{}).some(value=>value!=null&&value!==''))fail('print_order_destination_changed');
      const data=await lulu.getPrintJobCosts(order.provider_id),costLine=data?.line_item_costs?.[0];
      if(data?.line_item_costs?.length!==1||costLine.line_item_id!==line.id||costLine.line_item_external_id!==order.id)fail('print_order_cost_receipt_invalid');
      actual=parsePrintCosts(data,{currency:order.quotation.costs.currency,quantity:1});
      if(!sameCosts(actual,order.quotation.costs))fail('print_order_cost_changed');
      const messages=line.status?.messages||{},urls=messages.tracking_urls||line.tracking_urls;
      if(Array.isArray(urls)&&urls.length&&urls.length<=10){
        const safe=urls.filter(value=>{try{const url=new URL(value);return typeof value==='string'&&value.length<=8192&&url.protocol==='https:'&&!url.username&&!url.password&&!url.hash&&!/^(localhost|127\.|0\.|\[::1\])/.test(url.hostname);}catch{return false;}});
        const text=value=>typeof value==='string'&&value.length<=255&&!/[\u0000-\u001f]/.test(value)?value:null;
        if(safe.length===urls.length)tracking={urls:safe,id:text(messages.tracking_id||line.tracking_id),carrier:text(messages.carrier_name||line.carrier_name)};
      }
    }catch{return summary(await save(row,{...order,error_code:'print_order_status_unverified',receipt:{...order.receipt,verified:false,
      ...(actual?{actual_costs:actual}:{}),last_check_at:stamp()}}));}
    const paymentConfirmed=order.payment_confirmed_at||(['PRODUCTION_DELAYED','PRODUCTION_READY','IN_PRODUCTION','SHIPPED','DELIVERED'].includes(job.status.name)?stamp():null);
    return summary(await save(row,{...order,state:'verified',payment_confirmed_at:paymentConfirmed,error_code:null,receipt:{status:job.status.name,provider_changed_at:job.status.changed,
      checked_at:stamp(),verified:true,actual_costs:actual,tracking}}));
  }
  async function reconcile(pdfId){
    const row=await load(pdfId),order=row.metadata?.print_order;
    if(!['submitting','uncertain'].includes(order?.state)||order.id!==`caronte:${environment}:${pdfId}`)fail('print_order_reconciliation_not_required');
    let result;try{result=await lulu.reconcilePrintJob(order.id,{maxPages:10,pageSize:100,timeoutMs:60000});}
    catch{return summary(await save(row,{...order,state:'uncertain',error_code:'print_order_reconciliation_incomplete'}));}
    const job=result?.printJob,matched=result?.outcome==='matched'&&result.searchComplete===true&&result.resubmitAllowed===false&&result.matchCount===1&&
      Array.isArray(result.matchingJobIds)&&result.matchingJobIds.length===1&&Number.isSafeInteger(job?.id)&&job.id>0&&
      result.matchingJobIds[0]===job.id&&job.external_id===order.id;
    const reconciliation={outcome:matched?'matched':['not_found','ambiguous'].includes(result?.outcome)?result.outcome:'incomplete',
      checked_at:stamp(),resubmit_allowed:false};
    return summary(await save(row,matched?{...order,state:'submitted',provider_id:job.id,reconciliation,error_code:null}
      :{...order,state:'uncertain',reconciliation,error_code:'print_order_reconciliation_required'}));
  }
  return Object.freeze({approve,submit,sync,reconcile,status:async pdfId=>summary(await load(pdfId))});
}
