import {LULU_A5_PAPERBACK_SKU, LULU_VALIDATION_STATUSES} from './lulu-print.mjs';
import {resolveLiteraryContract} from './caronte-literary.mjs';

const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const hex=/^[0-9a-f]{64}$/;
const json=value=>value && typeof value==='object'
  ? Array.isArray(value) ? `[${value.map(json).join(',')}]`
    : `{${Object.keys(value).sort().map(key=>`${JSON.stringify(key)}:${json(value[key])}`).join(',')}}`
  : JSON.stringify(value);
const sha=async text=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text))),x=>x.toString(16).padStart(2,'0')).join('');
const fail=code=>{throw new Error(code);};

/** The human approval is tied to the exact immutable files, not just a PDF row ID. */
export function printArtifactBinding(row,environment) {
  const v=row?.print_validation,l=row?.lulu_metadata,m=row?.metadata,a=v?.editorial_approval;
  const contract=resolveLiteraryContract(m?.literary_contract_version??'caronte-literary-v2');
  const path=kind=>`${row?.session_id}/v${String(row?.version).padStart(2,'0')}/${m?.artifact_id}/${kind}.pdf`;
  if(!uuid.test(row?.id)||!uuid.test(row?.session_id)||!uuid.test(m?.artifact_id)||
      !Number.isSafeInteger(row.version)||row.version<1||!row.manuscript_id||
      !Number.isSafeInteger(row.page_count)||row.page_count<contract.physicalPages.min||row.page_count>contract.physicalPages.max||
      !['approved','released_to_customer'].includes(row.review_status)||
      m.template!=='caronte-a5-embedded-v2'||v?.template!==m.template||m.storage_verified!==true||
      v.fonts_embedded!==true||v.separate_cover!==true||
      !hex.test(v.source_sha256)||!hex.test(v.interior_sha256)||!hex.test(v.cover_sha256)||
      l?.interior_sha256!==v.interior_sha256||l?.cover_sha256!==v.cover_sha256||
      l.environment!==environment||!['sandbox','production'].includes(environment)||
      l.pod_package_id!==LULU_A5_PAPERBACK_SKU||row.storage_path!==path('interior')||
      l.interior_pdf_storage_path!==path('interior')||l.cover_pdf_storage_path!==path('cover')||
      l.cover_dimensions?.source!=='lulu-api'||l.cover_dimensions.pageCount!==row.page_count||
      l.cover_dimensions.podPackageId!==l.pod_package_id||l.cover_dimensions.environment!==environment||
      !a?.reviewer||!Number.isFinite(Date.parse(a.at))||a.version!==row.version||
      a.source_sha256!==v.source_sha256||a.interior_sha256!==v.interior_sha256||a.cover_sha256!==v.cover_sha256||
      !Number.isSafeInteger(row.quality_report?.byte_size)||row.quality_report.byte_size<8||row.quality_report.byte_size>20_000_000||
      !Number.isSafeInteger(row.quality_report?.cover_byte_size)||row.quality_report.cover_byte_size<8||row.quality_report.cover_byte_size>20_000_000) fail('preflight_artifact_not_approved');
  return {pdf_id:row.id,session_id:row.session_id,version:row.version,manuscript_id:row.manuscript_id,
    source_sha256:v.source_sha256,interior_sha256:v.interior_sha256,cover_sha256:v.cover_sha256,
    interior_path:row.storage_path,cover_path:l.cover_pdf_storage_path,
    interior_byte_size:row.quality_report.byte_size,cover_byte_size:row.quality_report.cover_byte_size,
    page_count:row.page_count,pod_package_id:l.pod_package_id,environment,approval:a,
    ...(contract.version==='caronte-literary-v3'?{literary_contract_version:contract.version}:{})};
}

/** One provider operation per invocation. Stored submission intents are never replayed. */
export function createPrintPreflight({environment,read,compareAndSet,verifyFile,signFile,lulu,now=()=>new Date()}) {
  if(!['sandbox','production'].includes(environment)||lulu?.environment!==environment||
      [read,compareAndSet,verifyFile,signFile,now].some(fn=>typeof fn!=='function'))fail('preflight_not_configured');
  const stamp=()=>now().toISOString();
  async function commit(row,state) {
    const ready=state.status==='ready';
    const patch={print_validation:{...row.print_validation,preflight:state,
      ready_for_print:ready,status:ready?'passed':state.status,
      human_editorial_review:['approved','released_to_customer'].includes(row.review_status)?'approved':'pending',
      lulu_interior_preflight:state.interior?.state||'pending',lulu_cover_preflight:state.cover?.state||'pending'},
      lulu_metadata:{...row.lulu_metadata,ready_for_print:ready,
        ready_for_print_status:ready?'ready_for_print':state.status,send_to_lulu:false},
      metadata:{...row.metadata,lulu_preflight_called:!!(state.interior||state.cover)}};
    let saved;
    try{saved=await compareAndSet(row,patch);}catch{fail('preflight_persistence_unverified');}
    if(!saved||json(saved.print_validation)!==json(patch.print_validation)||
        json(saved.lulu_metadata)!==json(patch.lulu_metadata)||json(saved.metadata)!==json(patch.metadata))fail('preflight_persistence_unverified');
    return saved;
  }
  async function receipt(kind,data,intent,binding,creation) {
    if(!Number.isSafeInteger(data?.id)||data.id<1||(!creation&&data.id!==intent.validation_id)||
        typeof data.source_url!=='string'||
        await sha(data.source_url)!==intent.source_url_sha256) {
      return {...intent,state:creation?'uncertain':'failed',error_code:'validation_receipt_invalid',checked_at:stamp()};
    }
    const base={...intent,validation_id:data.id,checked_at:stamp()};
    if(!LULU_VALIDATION_STATUSES[kind].includes(data.status)||
      (data.errors!==undefined&&data.errors!==null&&!Array.isArray(data.errors)))return{
        ...base,state:creation?'uncertain':'failed',error_code:'validation_receipt_invalid'};
    base.provider_status=data.status;
    if(data.errors===undefined||data.errors===null)return{
      ...base,state:data.status==='ERROR'?'failed':'pending',error_code:data.status==='ERROR'?'lulu_validation_failed':'validation_errors_pending'};
    if(data.status==='ERROR'||data.errors.length)return {...base,state:'failed',error_code:'lulu_validation_failed'};
    if(data.status!=='NORMALIZED')return {...base,state:'pending'};
    if(kind==='interior'&&(!/^[0-9]+$/.test(String(data.page_count))||Number(data.page_count)!==binding.page_count||
        !Array.isArray(data.valid_pod_package_ids)||!data.valid_pod_package_ids.includes(binding.pod_package_id))) {
      return {...base,state:'failed',error_code:'validation_print_spec_mismatch'};
    }
    return {...base,state:'normalized',...(kind==='interior'?{page_count:binding.page_count,pod_package_id:binding.pod_package_id}:{})};
  }
  async function run(pdfId) {
    const row=await read(pdfId);
    if(!row||row.id!==pdfId)fail('preflight_pdf_not_found');
    let binding;
    try{binding=printArtifactBinding(row,environment);}catch(error){
      // Revoking approval must also revoke an already-ready flag.
      if(row.print_validation?.ready_for_print||row.lulu_metadata?.ready_for_print) {
        await commit(row,{...(row.print_validation.preflight||{}),status:'approval_required',checked_at:stamp()});
      }
      throw error;
    }
    let state=row.print_validation.preflight||{binding,status:'pending',created_at:stamp()};
    if(json(state.binding)!==json(binding))return commit(row,{...state,status:'binding_changed',checked_at:stamp()});
    if(['binding_changed','approval_required'].includes(state.status))return row;
    for(const fileKind of ['interior','cover']) {
      const stored=state[fileKind];
      if(stored?.state==='normalized'&&(!Number.isSafeInteger(stored.validation_id)||stored.validation_id<1||
          stored.provider_status!=='NORMALIZED'||!hex.test(stored.source_url_sha256)||!uuid.test(stored.attempt_id)||
          (fileKind==='interior'&&(stored.page_count!==binding.page_count||stored.pod_package_id!==binding.pod_package_id)))) {
        return commit(row,{...state,[fileKind]:{...stored,state:'failed',error_code:'validation_receipt_invalid'},status:'failed',checked_at:stamp()});
      }
    }
    const kind=state.interior?.state==='normalized'?'cover':'interior';
    const current=state[kind];
    if(state.interior?.state==='normalized'&&state.cover?.state==='normalized')return row;
    if(current&&['submitting','uncertain','failed'].includes(current.state))return row;
    const methodKind=kind==='interior'?'Interior':'Cover';
    let intent=current,sourceUrl;
    if(!current) {
      let verified;
      try{verified=await verifyFile({kind,path:binding[`${kind}_path`],sha256:binding[`${kind}_sha256`],byteSize:binding[`${kind}_byte_size`]});}
      catch{fail('preflight_file_unverified');}
      if(verified?.verified!==true)fail('preflight_file_unverified');
      try{sourceUrl=await signFile(kind,binding[`${kind}_path`],3600);}
      catch{fail('preflight_source_url_unavailable');}
      let parsed;
      try{parsed=new URL(sourceUrl);}catch{fail('preflight_source_url_invalid');}
      if(parsed.protocol!=='https:'||parsed.username||parsed.password||parsed.hash)fail('preflight_source_url_invalid');
      intent={state:'submitting',attempt_id:crypto.randomUUID(),source_url_sha256:await sha(sourceUrl),started_at:stamp()};
      state={...state,[kind]:intent,status:'pending',checked_at:stamp()};
      const reserved=await commit(row,state);
      // Any intervening edit or approval revocation forbids dispatch from a stale reservation.
      const check=await read(pdfId);
      if(check?.updated_at!==reserved.updated_at||json(check.print_validation.preflight)!==json(state)||
          json(printArtifactBinding(check,environment))!==json(binding))fail('preflight_reservation_changed');
      let data;
      try {
        data=await lulu[`validate${methodKind}`]({source_url:sourceUrl,pod_package_id:binding.pod_package_id,
          ...(kind==='cover'?{interior_page_count:binding.page_count}:{})});
      }catch(error){
        // No receipt, no replay. Even authentication/definite rejection requires an explicit operator decision.
        const result={...intent,state:error?.uncertain===true?'uncertain':'failed',
          error_code:error?.uncertain===true?'submission_uncertain':'validation_submission_failed',checked_at:stamp()};
        return commit(reserved,{...state,[kind]:result,status:result.state,checked_at:stamp()});
      }
      const result=await receipt(kind,data,intent,binding,true);
      const next={...state,[kind]:result,checked_at:stamp()};
      next.status=result.state==='normalized'&&next.interior?.state==='normalized'&&next.cover?.state==='normalized'
        ?'ready':['failed','uncertain'].includes(result.state)?result.state:'pending';
      return commit(reserved,next);
    }
    if(current.state!=='pending'||!Number.isSafeInteger(current.validation_id))fail('preflight_state_invalid');
    let data;
    try{data=await lulu[`get${methodKind}Validation`](current.validation_id);}catch{
      // A failed read does not replace or duplicate the known provider receipt.
      return commit(row,{...state,[kind]:{...current,error_code:'validation_read_failed',checked_at:stamp()},status:'pending',checked_at:stamp()});
    }
    const result=await receipt(kind,data,current,binding,false);
    const next={...state,[kind]:result,checked_at:stamp()};
    next.status=next.interior?.state==='normalized'&&next.cover?.state==='normalized'?'ready'
      :['failed','uncertain'].includes(result.state)?result.state:'pending';
    return commit(row,next);
  }
  return Object.freeze({run});
}
