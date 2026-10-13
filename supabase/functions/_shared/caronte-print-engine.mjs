import {countWords,resolveLiteraryContract} from './caronte-literary.mjs';
import {PRINT_TEMPLATE,printSizesFor,compactPrintChapterPlan} from './caronte-print.mjs';

export const PRINT_JOB_VERSION='caronte-a5-chunks-v1';
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const first=value=>Array.isArray(value)?value[0]||null:value||null;
const fail=code=>{throw Object.assign(new Error(code),{code});};
const encode=value=>encodeURIComponent(String(value));
const canonical=value=>Array.isArray(value)?`[${value.map(canonical).join(',')}]`:value&&typeof value==='object'
  ?`{${Object.keys(value).sort().map(key=>`${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`:JSON.stringify(value);
export const printJobFingerprint=async value=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',
  new TextEncoder().encode(canonical(value)))),byte=>byte.toString(16).padStart(2,'0')).join('');
const jsonOnly=value=>{const record={...value};delete record.bytes;return structuredClone(record);};
const initialFor=source=>Array.from({length:5},(_,index)=>printSizesFor(source).map(size=>({key:`plan:${index}:${size}`,stage:'plan',index,size}))).flat();
const derivedKey=key=>/^(geometry:|slice-count:|slice-geometry:|selected:|selection$)/.test(key);
const slicedKey=key=>/^(slice-count:|slice-geometry:|selected:|selection$)/.test(key);
const sliceIntervals=(source,index)=>{
  const paragraphs=source.sections?.[index]?.paragraphs;
  if(!Array.isArray(paragraphs)||!paragraphs.length)fail('print_slice_scope');
  const intervals=[];let start=0;
  while(start<paragraphs.length){
    let end=start,characters=0;
    while(end<paragraphs.length&&end-start<24){
      if(typeof paragraphs[end]!=='string')fail('print_slice_scope');
      if(characters+paragraphs[end].length>16000)break;
      characters+=paragraphs[end].length;end++;
    }
    if(end===start)fail('print_slice_paragraph_limit');
    intervals.push({start,end});start=end;
  }
  return intervals;
};
const sliceSteps=(source,index,size,mode)=>sliceIntervals(source,index).map(({start,end},n,all)=>({
  key:`slice-${mode==='counts'?'count':'geometry'}:${index}:${size}:${start}`,stage:'plan',operation:'slice',
  index,size,mode,start,end,previousKey:n?`slice-${mode==='counts'?'count':'geometry'}:${index}:${size}:${all[n-1].start}`:null
}));

function schedule(completed,source,sliced=false){
  const initial=initialFor(source),pages=resolveLiteraryContract(source.prompt_version).physicalPages;
  for(const step of initial)if(!completed.has(step.key)){
    if(sliced)for(const interval of sliceSteps(source,step.index,step.size,'counts'))if(!completed.has(interval.key))return interval;
    // The original descriptor is frozen: derived receipts must not change the
    // fingerprint or reset the attempts of a pre-existing started plan.
    return step;
  }
  if(!completed.has('compose'))for(const item of initial){
    const plan=completed.get(item.key),key=item.key.replace('plan:','geometry:');
    if(plan.plan_format!=='chapter-counts-v1'&&!completed.has(key))
      return {...item,key,operation:'compact',originalKey:item.key};
  }
  if(!completed.has('compose')){
    if(sliced){
      if(!completed.has('selection'))return{key:'selection',stage:'plan',operation:'selection'};
      const size=Number(completed.get('selection').selection_size);
      if(!printSizesFor(source).includes(size))fail('print_layout_identity');
      for(let index=0;index<5;index++){
        const key=`selected:${index}:${size}`;
        if(completed.has(key))continue;
        for(const interval of sliceSteps(source,index,size,'geometry'))if(!completed.has(interval.key))return interval;
        return{key,stage:'plan',operation:'selected',index,size};
      }
    }
    return{key:'compose',stage:'compose'};
  }
  const manifest=completed.get('compose').output,count=manifest?.layout?.pages?.length;
  if(!Number.isSafeInteger(count)||count<pages.min||count>pages.max||count%2||manifest.proof!==false)fail('print_layout_identity');
  for(let firstPage=1;firstPage<=count;firstPage+=10){
    const lastPage=Math.min(firstPage+9,count),key=`part:${firstPage}:${lastPage}`;
    if(!completed.has(key))return{key,stage:'part',firstPage,lastPage};
  }
  for(const stage of ['interior','cover'])if(!completed.has(stage))return{key:stage,stage};
  return{key:'finish',stage:'finish'};
}
function publicJob(job,steps,sliced=false){
  const count=steps.filter(step=>step.status==='completed').length;
  const pages=steps.find(step=>step.step_key==='compose'&&step.status==='completed')?.output?.layout?.pages?.length;
  const extra=steps.filter(step=>step.step_key.startsWith('plan:')&&step.status==='completed'&&step.plan_format!=='chapter-counts-v1').length;
  let sliceCount=0;
  if(sliced){
    const byKey=new Map(steps.map(step=>[step.step_key,step]));
    for(const plan of initialFor(job.source_snapshot))if(byKey.get(plan.key)?.status!=='completed'||
      byKey.has(`slice-count:${plan.index}:${plan.size}:0`))sliceCount+=sliceIntervals(job.source_snapshot,plan.index).length;
    // Partition boundaries do not depend on the selected font size.
    sliceCount+=6+job.source_snapshot.sections.reduce((sum,_,index)=>sum+sliceIntervals(job.source_snapshot,index).length,0);
  }
  const total=initialFor(job.source_snapshot).length+extra+sliceCount+1+Math.ceil((pages||resolveLiteraryContract(job.source_snapshot?.prompt_version).physicalPages.max)/10)+2+1;
  return{id:job.id,status:job.status,stage:job.stage,completedSteps:count,totalSteps:total,
    progress:job.status==='ready'?100:Math.min(98,Math.floor(count/total*100)),
    errorCode:job.error_code||null,createdAt:job.created_at,updatedAt:job.updated_at};
}

// Service-only coordinator. The HTTP boundary must authenticate, authorize and
// gate activation. No recursive wake, paid model, order, payment or public URL.
export function createPrintEngine({rest,stages,archive,settings,coverDimensions}){
  const sliced=typeof stages.planChapterSlice==='function';
  const rpc=async(name,body)=>{
    try{return await rest(`rpc/${name}`,{method:'POST',body});}
    catch(error){
      for(const code of ['lease_lost','active_print_source_changed','print_source_changed','print_manuscript_not_approved']){
        if(String(error?.message||'').includes(code))fail(code);
      }
      fail('print_storage_unavailable');
    }
  };
  const readJob=async(sessionId)=>first(await rest(`future_book_print_jobs?session_id=eq.${encode(sessionId)}&select=*&order=created_at.desc&limit=1`));
  const readSteps=async(jobId,mode='summary')=>{
    const fields=mode==='nonPlan'?'*':'step_key,stage,status,attempt,input_hash,output_hash,error_code,plan_format:output->>format,selection_size:output->>size';
    const rows=[];
    for(let offset=0;;offset+=500){
      const page=await rest(`future_book_print_steps?job_id=eq.${encode(jobId)}&select=${fields}${mode==='nonPlan'?'&stage=neq.plan':''}&order=created_at.asc,step_key.asc&limit=500&offset=${offset}`);
      if(!Array.isArray(page)||page.length>500)fail('print_storage_unavailable');
      rows.push(...page);if(page.length<500)return rows;
    }
  };
  const planRecords=async(job,completed,keys)=>{
    const output=[];
    for(let at=0;at<keys.length;at+=5){
      const batch=keys.slice(at,at+5),rows=await rest(`future_book_print_steps?job_id=eq.${encode(job.id)}&step_key=in.(${batch.map(encode).join(',')})&select=*`);
      if(!Array.isArray(rows)||rows.length!==batch.length)fail('print_step_receipt_corrupt');
      for(const key of batch){
        const row=rows.find(item=>item.step_key===key);
        if(row?.status!=='completed'||row.stage!=='plan'||!row.output||
          row.output_hash!==completed.get(key)?.output_hash||await printJobFingerprint(row.output)!==row.output_hash||
          row.output.sourceFingerprint!==job.source_sha256)fail('print_step_receipt_corrupt');
        output.push(row.output);
      }
    }
    return output;
  };
  const sliceChain=(job,completed,index,size,mode)=>planRecords(job,completed,
    sliceSteps(job.source_snapshot,index,size,mode).map(item=>item.key));
  const chapterPlans=async(job,completed)=>{
    const originals=initialFor(job.source_snapshot).map(step=>step.key);
    const keys=originals.map(key=>completed.get(key).plan_format==='chapter-counts-v1'?key:key.replace('plan:','geometry:')),plans=[];
    for(let at=0;at<keys.length;at+=5){
      const batch=keys.slice(at,at+5),rows=await rest(`future_book_print_steps?job_id=eq.${encode(job.id)}&step_key=in.(${batch.map(encode).join(',')})&select=*`);
      if(!Array.isArray(rows)||rows.length!==batch.length)fail('print_step_receipt_corrupt');
      for(const key of batch){
        const row=rows.find(item=>item.step_key===key);
        if(row?.status!=='completed'||row.stage!=='plan'||!row.output||
          await printJobFingerprint(row.output)!==row.output_hash)fail('print_step_receipt_corrupt');
        if(key.startsWith('geometry:')&&(row.output.originalPlanKey!==key.replace('geometry:','plan:')||
          row.output.originalPlanHash!==completed.get(row.output.originalPlanKey)?.output_hash))fail('print_step_receipt_corrupt');
        plans.push(await compactPrintChapterPlan(row.output));
      }
    }
    return plans;
  };
  const readPdf=async(job)=>{
    const pdf=first(await rest(`future_book_pdfs?id=eq.${encode(job.pdf_id)}&session_id=eq.${encode(job.session_id)}&select=*&limit=1`));
    const steps=await readSteps(job.id,'nonPlan');
    const interior=steps.find(step=>step.step_key==='interior'&&step.status==='completed');
    const cover=steps.find(step=>step.step_key==='cover'&&step.status==='completed');
    if(!interior?.output?.storage_verified||!cover?.output?.storage_verified||
        await printJobFingerprint(interior.output)!==interior.output_hash||
        await printJobFingerprint(cover.output)!==cover.output_hash)fail('print_bundle_persistence_unverified');
    if(!pdf||pdf.id!==job.pdf_id||pdf.session_id!==job.session_id||pdf.manuscript_id!==job.manuscript_id||
        pdf.version!==job.version||pdf.storage_path!==archive.path(job,'interior')||
        pdf.print_job_id!==job.id||pdf.metadata?.print_job_id!==job.id||pdf.print_validation?.source_sha256!==job.source_sha256||
        pdf.page_count!==interior.output.pageCount||pdf.print_validation?.interior_sha256!==interior.output.sha256||
        pdf.print_validation?.cover_sha256!==cover.output.sha256||pdf.lulu_metadata?.interior_sha256!==interior.output.sha256||
        pdf.lulu_metadata?.cover_sha256!==cover.output.sha256||pdf.lulu_metadata?.interior_pdf_storage_path!==archive.path(job,'interior')||
        pdf.lulu_metadata?.cover_pdf_storage_path!==archive.path(job,'cover')||pdf.lulu_metadata?.environment!==job.lulu_environment||
        pdf.lulu_metadata?.pod_package_id!==job.pod_package_id)fail('print_bundle_persistence_unverified');
    return pdf;
  };
  async function status(sessionId){
    if(!uuid.test(sessionId))fail('print_job_scope');
    const job=await readJob(sessionId);if(!job)return{job:null,pdf:null};
    const steps=await readSteps(job.id),pdf=job.status==='ready'?await readPdf(job):null;
    return{job:publicJob(job,steps,sliced),pdf};
  }
  async function enqueue(sessionId,row){
    if(!uuid.test(sessionId)||!uuid.test(row?.id)||row.session_id!==sessionId)fail('print_job_scope');
    const source=structuredClone(row.manuscript);
    if(row.status!=='ready'||row.provider_chain?.degraded===true||['deterministic','openai_failed'].includes(row.provider_chain?.drafting)||
        ['degraded_provider_fallback','blocked_safety','needs_caronte_rewrite'].includes(row.quality_report?.status)||row.quality_report?.editorial_gate!=='pass'||
        !['caronte-literary-v2','caronte-literary-v3'].includes(source?.prompt_version)||!Array.isArray(source.sections)||source.sections.length!==5||
        !row.updated_at||!Number.isFinite(Date.parse(row.updated_at)))fail('print_manuscript_not_approved');
    const words=countWords(source.sections.flatMap(chapter=>chapter.paragraphs||[]).join(' '));
    const contract=resolveLiteraryContract(source.prompt_version);
    if(words<contract.manuscriptWords.min||words>contract.manuscriptWords.max)fail('print_manuscript_word_count');
    if(source.future_age!==source.current_age+contract.horizonYears)fail('print_manuscript_not_approved');
    const config=await settings();
    if(!['sandbox','production'].includes(config?.environment)||!/^[a-f0-9]{64}$/.test(config.configurationTag)||
        typeof config.podPackageId!=='string'||!config.podPackageId)fail('print_lulu_credentials_required');
    const sourceHash=await printJobFingerprint(source);
    const inputHash=await printJobFingerprint({sourceHash,manuscriptId:row.id,revision:row.updated_at,version:PRINT_JOB_VERSION,config});
    const job=first(await rpc('caronte_enqueue_print',{p_session_id:sessionId,p_manuscript_id:row.id,
      p_manuscript_revision:row.updated_at,p_source:source,p_source_sha256:sourceHash,p_input_hash:inputHash,
      p_stages_version:PRINT_JOB_VERSION,p_environment:config.environment,p_configuration_tag:config.configurationTag,
      p_pod_package_id:config.podPackageId}));
    if(!job?.id)fail('print_enqueue_unverified');
    // Lost enqueue acceptance can be resolved by status; never reserve an ID or
    // version in memory or retry with a new identity.
    const result=await status(sessionId);
    if(result.job?.id!==job.id)fail('print_enqueue_unverified');return result;
  }
  async function advance(jobId=null){
    if(jobId!==null&&!uuid.test(jobId))fail('print_job_scope');
    const claimed=first(await rpc('caronte_claim_print_job',{p_job_id:jobId}));
    if(!claimed?.id)return{status:'idle'};
    const job=structuredClone(claimed),summaries=await readSteps(job.id),details=await readSteps(job.id,'nonPlan');
    const steps=summaries.map(row=>row.stage==='plan'?row:details.find(detail=>detail.step_key===row.step_key));
    if(steps.some(row=>!row))fail('print_storage_unavailable');
    let step;
    const checkpoint=async(record,state,delay=0)=>{
      if(await rpc('caronte_checkpoint_print_job',{
        p_job_id:job.id,p_lease_token:job.lease_token,p_step:record,p_state:state,p_delay_seconds:delay})!==true)fail('print_storage_unavailable');
      try{
        const observed=first(await rest(`future_book_print_steps?job_id=eq.${encode(job.id)}&step_key=eq.${encode(record.step_key)}&select=*&limit=1`));
        if(!observed||['step_key','stage','status','attempt','input_hash','output','output_hash','error_code']
          .some(key=>canonical(observed[key]??null)!==canonical(record[key]??null)))fail('print_storage_unavailable');
        const owner=await readJob(job.session_id);
        if(owner?.id!==job.id||owner.status!==state||(state==='running'&&owner.lease_token!==job.lease_token))fail('print_storage_unavailable');
      }catch{fail('print_storage_unavailable');}
    };
    try{
      if(!uuid.test(job.id)||!uuid.test(job.pdf_id)||!uuid.test(job.session_id)||!uuid.test(job.manuscript_id)||
          !Number.isSafeInteger(job.version)||job.version<1||job.stages_version!==PRINT_JOB_VERSION||
          await printJobFingerprint(job.source_snapshot)!==job.source_sha256||!Number.isFinite(Date.parse(job.created_at)))fail('print_job_identity');
      const completed=new Map();
      for(const record of steps){
        if(record.output&&await printJobFingerprint(record.output)!==record.output_hash)fail('print_step_receipt_corrupt');
        if(record.status==='completed'){
          if(completed.has(record.step_key)||(!record.output&&record.stage!=='plan')||
            !/^[a-f0-9]{64}$/.test(record.output_hash||''))fail('print_step_receipt_corrupt');
          completed.set(record.step_key,record);
        }
      }
      if(sliced&&['finishChapterSlices','selectLayoutSize'].some(name=>typeof stages[name]!=='function'))fail('print_slice_scope');
      const next=schedule(completed,job.source_snapshot,sliced),previous=steps.find(record=>record.step_key===next.key);
      const inputHash=await printJobFingerprint({jobId:job.id,pdfId:job.pdf_id,version:job.version,
        source:job.source_sha256,identity:job.input_hash,createdAt:new Date(job.created_at).toISOString(),stage:next,
        // All pre-existing stage descriptors, including legacy geometry caches,
        // retain their old fingerprints. Only new sliced steps bind derivatives.
        receipts:[...completed].filter(([key])=>slicedKey(next.key)||!derivedKey(key))
          .sort(([a],[b])=>a.localeCompare(b)).map(([key,value])=>[key,value.output_hash])});
      if(previous?.input_hash&&previous.input_hash!==inputHash)fail('print_step_input_changed');
      step={step_key:next.key,stage:next.stage,status:'started',attempt:previous?.attempt||0,input_hash:inputHash,
        output:previous?.output||null,output_hash:previous?.output_hash||null};
      const source=job.source_snapshot,manifest=completed.get('compose')?.output;
      const load=async(key)=>{
        const receipt=completed.get(key)?.output;
        if(!receipt?.storage_verified)fail('print_step_receipt_corrupt');
        const record=await archive.read(job,key,receipt);if(!record)fail('print_archive_unverified');
        return{...receipt,bytes:record.bytes};
      };
      // Count the claim before any recovery read, render or final verification.
      // A read-only retry must not bypass the durable attempt budget.
      if(step.attempt>=3)fail('print_retry_limit');
      step.attempt++;await checkpoint(step,'running');
      if(next.stage==='finish'){
        const interior=await load('interior'),cover=await load('cover');
        const validation={template:PRINT_TEMPLATE,ready_for_print:false,status:'pending_external_preflight',
          page_count:interior.pageCount,fonts_embedded:true,separate_cover:true,human_editorial_review:'pending',
          lulu_interior_preflight:'pending',lulu_cover_preflight:'pending',source_sha256:job.source_sha256,
          interior_sha256:interior.sha256,cover_sha256:cover.sha256};
        const pdf={id:job.pdf_id,print_job_id:job.id,session_id:job.session_id,manuscript_id:job.manuscript_id,version:job.version,
          status:'generated',review_status:'pending_review',file_name:`caronte-${job.session_id}-v${String(job.version).padStart(2,'0')}.pdf`,
          mime_type:'application/pdf',pdf_base64:null,page_size:'A5',page_count:interior.pageCount,storage_path:interior.path,
          print_validation:validation,lulu_metadata:{ready_for_print:false,ready_for_print_status:'pending_external_preflight',send_to_lulu:false,
            title:source.title,language:'es',trim_size:'A5',trim_width_points:interior.width,trim_height_points:interior.height,
            pod_package_id:job.pod_package_id,environment:job.lulu_environment,interior_pdf_storage_path:interior.path,
            cover_pdf_storage_path:cover.path,cover_status:'separate_full_spread_pending_preflight',cover_dimensions:cover.dimensions,
            interior_sha256:interior.sha256,cover_sha256:cover.sha256},
          quality_report:{...validation,word_count:manifest.wordCount,paragraph_count:interior.paragraphCount,
            byte_size:interior.byteSize,cover_byte_size:cover.byteSize,font_size:manifest.layout.size,
            leading:manifest.layout.leading,margins:manifest.layout.margins,chapter_starts:manifest.layout.chapterStarts},
          metadata:{template:PRINT_TEMPLATE,storage_mode:'private_storage_primary',artifact_id:job.id,print_job_id:job.id,
            ...(source.prompt_version==='caronte-literary-v3'?{literary_contract_version:source.prompt_version}:{}),
            storage_verified:true,lulu_dimensions_called:true,lulu_preflight_called:false,lulu_order_created:false,
            lulu_credential_tag:job.lulu_configuration_tag}};
        try{if(await rpc('caronte_finish_print_job',{p_job_id:job.id,p_lease_token:job.lease_token,p_pdf:pdf})!==job.pdf_id)fail('print_storage_unavailable');}
        catch(error){
          if(error.code==='lease_lost')throw error;
          const observed=await readJob(job.session_id);
          if(observed?.id!==job.id||observed.status!=='ready')throw error;
        }
        const observed=await readJob(job.session_id);
        if(observed?.id!==job.id||observed.status!=='ready')fail('print_bundle_persistence_unverified');
        await readPdf(observed);return{status:'ready',jobId:job.id,pdfId:job.pdf_id};
      }
      const binary=['part','interior','cover'].includes(next.stage);
      if(binary&&step.output){
        const recovered=await archive.read(job,next.key,step.output);
        if(recovered){
          const output={...step.output,storage_verified:true};
          await checkpoint({...step,status:'completed',output,output_hash:await printJobFingerprint(output)},'queued');
          return{status:'queued',jobId:job.id};
        }
      }
      let output;
      if(next.operation==='compact'){
        const original=first(await rest(`future_book_print_steps?job_id=eq.${encode(job.id)}&step_key=eq.${encode(next.originalKey)}&select=*&limit=1`));
        if(original?.status!=='completed'||!original.output||original.output_hash!==completed.get(next.originalKey)?.output_hash||
          await printJobFingerprint(original.output)!==original.output_hash)fail('print_step_receipt_corrupt');
        const compact=await compactPrintChapterPlan(original.output);
        const record={...compact,originalPlanKey:next.originalKey,originalPlanHash:original.output_hash};delete record.sha256;
        output={...record,sha256:await printJobFingerprint(record)};
      }else if(next.operation==='slice'){
        const previousSlice=next.previousKey?(await planRecords(job,completed,[next.previousKey]))[0]:null;
        output=await stages.planChapterSlice(source,next.index,{size:next.size,mode:next.mode,previous:previousSlice,
          maxParagraphs:24,maxCharacters:16000});
        if(output.startParagraph!==next.start||output.endParagraph!==next.end)fail('print_slice_chain');
      }else if(next.operation==='selection')output=await stages.selectLayoutSize(source,await chapterPlans(job,completed));
      else if(next.operation==='selected')output=await stages.finishChapterSlices(source,next.index,
        await sliceChain(job,completed,next.index,next.size,'geometry'),{size:next.size,compact:false});
      else if(next.stage==='plan')output=sliced?await stages.finishChapterSlices(source,next.index,
        await sliceChain(job,completed,next.index,next.size,'counts'),{size:next.size,compact:true}):
        await stages.planChapter(source,next.index,{size:next.size,compact:true});
      else if(next.stage==='compose'){
        const options={createdAt:new Date(job.created_at).toISOString(),proof:false};
        if(sliced){
          const selection=(await planRecords(job,completed,['selection']))[0];
          options.geometryPlans=await planRecords(job,completed,Array.from({length:5},(_,index)=>`selected:${index}:${selection.size}`));
          output=await stages.composeLayout(source,await chapterPlans(job,completed),options);
          if(output.layout?.size!==selection.size||output.layout.pages.length!==selection.pageCount)fail('print_layout_identity');
        }else output=await stages.composeLayout(source,await chapterPlans(job,completed),options);
      }
      else if(next.stage==='part')output=await stages.renderInteriorPart(source,manifest,next);
      else if(next.stage==='interior'){
        const parts=[];
        for(let firstPage=1;firstPage<=manifest.layout.pages.length;firstPage+=10){
          parts.push(await load(`part:${firstPage}:${Math.min(firstPage+9,manifest.layout.pages.length)}`));
        }
        output=await stages.mergeInterior(source,manifest,parts);
      }else if(next.stage==='cover'){
        const current=await settings();
        if(current.environment!==job.lulu_environment||current.configurationTag!==job.lulu_configuration_tag||
            current.podPackageId!==job.pod_package_id)fail('print_lulu_configuration_changed');
        output=await stages.renderCover(source,manifest,await load('interior'),{coverDimensions:async count=>{
          const dimensions=await coverDimensions(job,count);
          if(dimensions.environment!==job.lulu_environment||dimensions.podPackageId!==job.pod_package_id||
              dimensions.pageCount!==count||dimensions.source!=='lulu-api')fail('print_lulu_dimensions_mismatch');
          return dimensions;
        }});
      }
      if(!output||output.sourceFingerprint!==job.source_sha256)fail('print_step_source_changed');
      let receipt=jsonOnly(output);
      if(binary){
        receipt.path=archive.path(job,next.key);
        if(step.output&&canonical(receipt)!==canonical(step.output))fail('print_step_output_changed');
        step={...step,output:receipt,output_hash:await printJobFingerprint(receipt)};
        await checkpoint(step,'running'); // Reserved bytes before external write.
        const saved=await archive.write(job,next.key,output);
        if(!saved.verified||saved.path!==receipt.path||saved.sha256!==receipt.sha256||saved.byteSize!==receipt.byteSize)fail('print_archive_unverified');
        receipt={...receipt,storage_verified:true};
      }
      await checkpoint({...step,status:'completed',output:receipt,output_hash:await printJobFingerprint(receipt)},'queued');
      return{status:'queued',jobId:job.id};
    }catch(error){
      if(['lease_lost','print_storage_unavailable'].includes(error?.code))throw error;
      const code=/^print_[a-z_]{1,70}$/.test(error?.code||error?.message||'')?(error.code||error.message):'print_step_failed';
      const retry=['print_archive_unverified','print_archive_timeout'].includes(code)&&(step?.attempt||0)<3;
      await checkpoint({...step,step_key:step?.step_key||'gate',stage:step?.stage||'gate',status:'failed',
        attempt:step?.attempt||0,error_code:code},retry?'queued':'blocked',retry?10:0);
      return{status:retry?'queued':'blocked',jobId:job.id,errorCode:code};
    }
  }
  return Object.freeze({enqueue,status,advance});
}
