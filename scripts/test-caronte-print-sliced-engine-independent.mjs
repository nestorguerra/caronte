import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createHash} from 'node:crypto';
import {createPrintEngine, PRINT_JOB_VERSION} from '../supabase/functions/_shared/caronte-print-engine.mjs';
import {PRINT_TEMPLATE} from '../supabase/functions/_shared/caronte-print.mjs';
import {printManuscript} from './fixtures/print-manuscript.mjs';

// Independent, synthetic coordinator boundary. No PDF, network or PostgreSQL.
const sid='11111111-1111-4111-8111-111111111111', mid='33333333-3333-4333-8333-333333333333';
const jid='22222222-2222-4222-8222-222222222222', pid='44444444-4444-4444-8444-444444444444';
const sizes=[12,12.5,13,13.5,14], copy=value=>structuredClone(value);
const canonical=value=>Array.isArray(value)?`[${value.map(canonical).join(',')}]`:value&&typeof value==='object'
  ?`{${Object.keys(value).sort().map(key=>`${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`:JSON.stringify(value);
const hash=value=>createHash('sha256').update(canonical(value)).digest('hex');
const seal=value=>({...value,sha256:hash(value)});
const settings=async()=>({environment:'sandbox',configurationTag:'a'.repeat(64),podPackageId:'synthetic-package'});

function fixture(){
  const source=printManuscript(), sourceHash=hash(source), fontHash='f'.repeat(64);
  const identity={template:PRINT_TEMPLATE,stagesVersion:PRINT_JOB_VERSION,sourceFingerprint:sourceHash,fontFingerprint:fontHash};
  const steps=[], work=[];let job=null,clock=0,lease=0,loseAck=false,intercept=null;
  const rest=async(path,{body:p}={})=>{
    if(path==='rpc/caronte_enqueue_print'){
      job={id:jid,pdf_id:pid,session_id:sid,manuscript_id:mid,version:1,source_snapshot:copy(source),
        source_sha256:sourceHash,input_hash:p.p_input_hash,stages_version:p.p_stages_version,
        lulu_environment:p.p_environment,lulu_configuration_tag:p.p_configuration_tag,pod_package_id:p.p_pod_package_id,
        created_at:'2026-10-12T00:00:00.000Z',status:'queued',stage:'plan',lease_until:null};return copy(job);
    }
    if(path==='rpc/caronte_claim_print_job'){
      if(!job||!['queued','running'].includes(job.status)||job.lease_until>clock)return null;
      job.status='running';job.lease_until=clock+140;job.lease_token=`lease-${++lease}`;return copy(job);
    }
    if(path==='rpc/caronte_checkpoint_print_job'){
      if(job.status!=='running'||job.lease_token!==p.p_lease_token||job.lease_until<=clock)throw Error('lease_lost');
      const at=steps.findIndex(row=>row.step_key===p.p_step.step_key), old=steps[at];
      if(old?.status==='completed')throw Error('completed_step_is_immutable');
      if(old?.input_hash&&old.input_hash!==p.p_step.input_hash)throw Error('input_hash_is_immutable');
      if(old&&p.p_step.attempt<old.attempt)throw Error('attempt_cannot_reset');
      if(at<0)steps.push(copy(p.p_step));else steps[at]=copy(p.p_step);
      job.status=p.p_state;job.stage=p.p_step.stage;job.error_code=p.p_step.error_code??null;
      if(p.p_state!=='running'){job.lease_token=null;job.lease_until=null;}
      if(loseAck&&p.p_step.status==='completed'){loseAck=false;throw Error('saved completion acknowledgement lost');}
      return true;
    }
    if(path.startsWith('future_book_print_jobs?'))return job?[copy(job)]:[];
    if(path.startsWith('future_book_print_steps?')){
      const query=new URLSearchParams(path.split('?')[1]),key=query.get('step_key');
      let rows=key?.startsWith('eq.')?steps.filter(row=>row.step_key===key.slice(3)):
        key?.startsWith('in.(')?steps.filter(row=>key.slice(4,-1).split(',').includes(row.step_key)):steps;
      if(query.get('stage')==='neq.plan')rows=rows.filter(row=>row.stage!=='plan');
      const fields=query.get('select');
      return copy(!fields||fields==='*'?rows:rows.map(row=>Object.fromEntries(fields.split(',').map(field=>{
        const projection=field.match(/^([^:]+):output->>(.+)$/);
        return projection?[projection[1],row.output?.[projection[2]]]:[field,row[field]];
      }))));
    }
    if(path.startsWith('future_book_pdfs?'))return [];
    throw Error(`Unexpected synthetic boundary: ${path}`);
  };
  const plan=(index,size,compact=true)=>seal({...identity,chapterIndex:index,
    ...(compact?{format:'chapter-counts-v1'}:{}),candidates:[{size,leading:size*1.4,paragraphCount:30,
      ...(compact?{pageCount:38}:{pages:Array.from({length:38},(_,n)=>({number:n+5,kind:n?'body':'chapter',lines:[]}))})}]});
  const stages={
    async planChapter(){throw Error('whole-chapter calculation exceeds the runtime envelope');},
    async planChapterSlice(input,index,options){
      assert.deepEqual(input,source);const start=options.previous?.endParagraph??0;
      const maxParagraphs=options.maxParagraphs??24,maxCharacters=options.maxCharacters??16000;
      assert.ok(maxParagraphs<=24&&maxCharacters<=16000,'one claim retains the fixed work envelope');
      let end=start,characters=0;
      while(end<30&&end-start<maxParagraphs&&characters+source.sections[index].paragraphs[end].length<=maxCharacters){
        characters+=source.sections[index].paragraphs[end].length;end++;
      }
      assert.ok(end>start);work.push({index,size:options.size,mode:options.mode,start,end,characters});
      if(intercept)await intercept(copy(work.at(-1)));
      return seal({...identity,format:'chapter-slice-v1',chapterIndex:index,size:options.size,mode:options.mode,
        startParagraph:start,endParagraph:end,totalParagraphs:30,previousSha256:options.previous?.sha256??null,
        startState:options.previous?.state??null,state:{pageNumber:5+Math.floor(end*37/30),y:80},
        maxParagraphs,maxCharacters,done:end===30,...(options.mode==='geometry'?{pages:[]}: {})});
    },
    async finishChapterSlices(input,index,chain,{size,compact}){
      assert.deepEqual(input,source);let previous=null;
      for(const slice of chain){
        assert.equal(slice.startParagraph,previous?.endParagraph??0);
        assert.equal(slice.previousSha256,previous?.sha256??null);previous=slice;
      }
      assert.equal(previous?.done,true,'only a complete chain can become an original plan');
      return plan(index,size,compact);
    },
    async selectLayoutSize(input,plans){
      assert.deepEqual(input,source);assert.equal(plans.length,25);
      return seal({...identity,format:'layout-selection-v1',size:12,pageCount:194});
    },
    async composeLayout(input,plans,{geometryPlans,createdAt}){
      assert.deepEqual(input,source);assert.equal(plans.length,25);
      assert.equal(geometryPlans?.length,5,'whole-book composition needs all five frozen geometries');
      for(let index=0;index<5;index++)assert.deepEqual(geometryPlans[index],plan(index,12,false));
      return {...identity,createdAt,wordCount:48300,proof:false,layoutHash:'b'.repeat(64),manifestHash:'c'.repeat(64),
        layout:{pages:Array.from({length:194},()=>({})),size:12,leading:16.8,paragraphCount:150}};
    }
  };
  const engine=()=>createPrintEngine({rest,stages,settings,archive:{},coverDimensions:async()=>{throw Error('no provider');}});
  const enqueue=()=>engine().enqueue(sid,{id:mid,session_id:sid,status:'ready',manuscript:copy(source),
    updated_at:'2026-10-12T00:00:00.000Z',provider_chain:{degraded:false},quality_report:{editorial_gate:'pass'}});
  const seed=(key,output,inputHash='a'.repeat(64))=>steps.push({step_key:key,stage:'plan',status:'completed',attempt:1,
    input_hash:inputHash,output:copy(output),output_hash:hash(output),error_code:null});
  const seedCounts=()=>{for(let index=0;index<5;index++)for(const size of sizes)seed(`plan:${index}:${size}`,plan(index,size));};
  return {engine,enqueue,steps,work,plan,seed,seedCounts,identity,source,get job(){return job;},
    tick:n=>{clock+=n;},loseAcknowledgement:()=>{loseAck=true;},intercept:fn=>{intercept=fn;}};
}

test('independent sliced queue preserves completed plans and the exact already-started plan identity',async()=>{
  const app=fixture();await app.enqueue();app.seed('plan:0:12',app.plan(0,12));
  const frozen=copy(app.steps[0]), next={key:'plan:0:12.5',stage:'plan',index:0,size:12.5};
  const inputHash=hash({jobId:jid,pdfId:pid,version:1,source:app.job.source_sha256,identity:app.job.input_hash,
    createdAt:app.job.created_at,stage:next,receipts:[['plan:0:12',frozen.output_hash]]});
  app.steps.push({step_key:next.key,stage:'plan',status:'started',attempt:1,input_hash:inputHash,output:null,output_hash:null});
  for(let n=0;n<20&&!app.steps.some(row=>row.step_key===next.key&&row.status==='completed');n++){
    const result=await app.engine().advance();assert.equal(result.status,'queued',result.errorCode);
  }
  const completed=app.steps.find(row=>row.step_key===next.key);
  assert.equal(completed.status,'completed');assert.equal(completed.input_hash,inputHash);
  assert.deepEqual(completed.output,app.plan(0,12.5));assert.deepEqual(app.steps[0],frozen);
  assert.ok(app.steps.some(row=>row.step_key.startsWith('slice-count:0:12.5:')));
  assert.equal(app.work.some(row=>row.index===0&&row.size===12),false,'completed work is never recalculated');
});

test('independent sliced queue resumes the next cursor after a saved completion loses its acknowledgement',async()=>{
  const app=fixture();await app.enqueue();app.loseAcknowledgement();
  await assert.rejects(app.engine().advance(),/print_storage_unavailable/);
  const saved=copy(app.steps.find(row=>row.step_key==='slice-count:0:12:0'));
  assert.equal(saved?.status,'completed','lost HTTP acceptance is not a lost durable slice');
  const result=await app.engine().advance();assert.equal(result.status,'queued',result.errorCode);
  assert.deepEqual(app.steps.find(row=>row.step_key===saved.step_key),saved);
  assert.equal(app.work.filter(row=>row.start===0&&row.index===0&&row.size===12).length,1);
  assert.ok(app.steps.some(row=>row.step_key===`slice-count:0:12:${saved.output.endParagraph}`&&row.status==='completed'));
});

test('independent selected geometry keeps compose absent until all five complete chains are durable',async()=>{
  const app=fixture();await app.enqueue();app.seedCounts();
  app.seed('selection',seal({...app.identity,format:'layout-selection-v1',size:12,pageCount:194}));
  for(let index=0;index<4;index++)app.seed(`selected:${index}:12`,app.plan(index,12,false));
  const counts=copy(app.steps.filter(row=>row.step_key.startsWith('plan:')));
  const first=await app.engine().advance();assert.equal(first.status,'queued',first.errorCode);
  assert.equal(app.steps.some(row=>row.step_key==='compose'),false);
  assert.ok(app.steps.some(row=>row.step_key==='slice-geometry:4:12:0'&&row.status==='completed'));
  for(let n=0;n<20&&!app.steps.some(row=>row.step_key==='compose');n++){
    const result=await app.engine().advance();assert.equal(result.status,'queued',result.errorCode);
  }
  assert.equal(app.steps.find(row=>row.step_key==='selected:4:12')?.status,'completed');
  assert.equal(app.steps.find(row=>row.step_key==='compose')?.status,'completed');
  assert.deepEqual(app.steps.filter(row=>row.step_key.startsWith('plan:')),counts);
});

test('independent slice claims retain the three-attempt budget and reject an expired process after replacement',async()=>{
  const app=fixture();await app.enqueue();let release,entered;
  const suspended=new Promise(resolve=>{release=resolve;}),started=new Promise(resolve=>{entered=resolve;});
  app.intercept(async()=>{
    if(app.work.length<3)throw Object.assign(Error('print_archive_timeout'),{code:'print_archive_timeout'});
    entered();await suspended;
  });
  for(let n=0;n<2;n++){const result=await app.engine().advance();assert.equal(result.status,'queued',result.errorCode);}
  const old=app.engine().advance();await started;
  assert.equal((await app.engine().advance()).status,'idle','a live lease cannot be stolen');
  app.tick(141);const replacement=await app.engine().advance();
  assert.equal(replacement.status,'blocked');assert.equal(replacement.errorCode,'print_retry_limit');
  release();await assert.rejects(old,/lease_lost/);
  const terminal=app.steps.find(row=>row.step_key==='slice-count:0:12:0');
  assert.equal(terminal?.attempt,3);assert.equal(terminal?.status,'failed');assert.equal(app.work.length,3);
  assert.equal(app.steps.some(row=>row.status==='completed'),false);
});
