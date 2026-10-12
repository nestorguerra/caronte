import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createPrintPreflight} from '../supabase/functions/_shared/caronte-print-preflight.mjs';
import {LULU_A5_PAPERBACK_SKU as sku} from '../supabase/functions/_shared/lulu-print.mjs';

const session='6159e0f9-4aef-4f93-9d76-f46bfa51a18a';
const artifact='948bc512-eaf8-4f2c-8ae8-c302561ca8d4';
const hash=character=>character.repeat(64);
const file=kind=>`${session}/v01/${artifact}/${kind}.pdf`;
const row=()=>({id:artifact,session_id:session,version:1,manuscript_id:'source-v1',page_count:194,
  storage_path:file('interior'),review_status:'approved',updated_at:'revision-1',
  metadata:{template:'caronte-a5-embedded-v2',storage_verified:true,artifact_id:artifact},
  quality_report:{byte_size:100,cover_byte_size:80},
  print_validation:{template:'caronte-a5-embedded-v2',fonts_embedded:true,separate_cover:true,ready_for_print:false,
    source_sha256:hash('a'),interior_sha256:hash('b'),cover_sha256:hash('c'),
    editorial_approval:{reviewer:'editor@example.test',at:'2026-10-11T10:00:00Z',version:1,
      source_sha256:hash('a'),interior_sha256:hash('b'),cover_sha256:hash('c')}},
  lulu_metadata:{environment:'sandbox',pod_package_id:sku,ready_for_print:false,
    interior_sha256:hash('b'),cover_sha256:hash('c'),interior_pdf_storage_path:file('interior'),
    cover_pdf_storage_path:file('cover'),cover_dimensions:{source:'lulu-api',pageCount:194,podPackageId:sku,environment:'sandbox'}}});

function fixture(options={}) {
  let record=structuredClone(options.row||row());
  let revision=1;
  let receiptLost=false;
  const calls=[],writes=[];
  const urls={interior:'https://storage.test/interior.pdf?token=private',cover:'https://storage.test/cover.pdf?token=private'};
  const result=(kind,id,status='NORMALIZED')=>({id,status,source_url:urls[kind],errors:[],
    ...(kind==='interior'?{page_count:'194',valid_pod_package_ids:[sku]}:{})});
  const service=createPrintPreflight({
    environment:'sandbox',now:()=>new Date('2026-10-11T11:00:00Z'),
    read:async()=>structuredClone(record),
    compareAndSet:async(before,patch)=>{
      if(options.casFailure||before.updated_at!==record.updated_at)return null;
      record={...record,...structuredClone(patch),updated_at:`revision-${++revision}`};writes.push(structuredClone(record));
      if(options.saveReceiptFailure&&!receiptLost&&record.print_validation.preflight.interior.validation_id){receiptLost=true;throw new Error('DB receipt lost');}
      return structuredClone(record);
    },
    verifyFile:async input=>{calls.push(['verify',input]);if(options.storageFailure)throw new Error('private secret error');return {verified:true};},
    signFile:async(kind)=>{calls.push(['sign',kind]);return urls[kind];},
    lulu:{environment:'sandbox',
      validateInterior:async()=>{calls.push(['post','interior']);if(options.networkFailure)throw Object.assign(new Error('private network echo'),{uncertain:true});return options.interiorPost||result('interior',7,'NORMALIZING');},
      validateCover:async()=>{calls.push(['post','cover']);return options.coverPost||result('cover',9,'NORMALIZING');},
      getInteriorValidation:async id=>{calls.push(['get','interior',id]);if(options.readFailure)throw new Error('private read echo');return options.interiorGet||result('interior',id);},
      getCoverValidation:async id=>{calls.push(['get','cover',id]);return options.coverGet||result('cover',id);}}
  });
  return {service,calls,writes,record:()=>structuredClone(record),change:fn=>{fn(record);record.updated_at=`revision-${++revision}`;},result};
}

test('four bounded operations persist same-ID receipts and only both normalized files permit printing',async()=>{
  const app=fixture();
  for(let index=0;index<4;index++)await app.service.run(artifact);
  const final=app.record();
  assert.deepEqual(app.calls.filter(call=>['post','get'].includes(call[0])),[['post','interior'],['get','interior',7],['post','cover'],['get','cover',9]]);
  assert.equal(final.print_validation.preflight.status,'ready');
  assert.equal(final.print_validation.ready_for_print,true);assert.equal(final.lulu_metadata.ready_for_print,true);
  assert.equal(final.lulu_metadata.send_to_lulu,false);
  assert.doesNotMatch(JSON.stringify(app.writes),/token=private|private network echo/);
  assert.ok(app.writes.some(item=>item.print_validation.preflight.interior.state==='submitting'));
  assert.ok(app.writes.slice(0,-1).every(item=>!item.print_validation.ready_for_print));
  await app.service.run(artifact);assert.equal(app.calls.filter(call=>call[0]==='post').length,2);
});
test('only an explicitly versioned +30 PDF can validate a 220-page interior',async()=>{
  const current=row();current.page_count=220;current.metadata.literary_contract_version='caronte-literary-v3';
  current.lulu_metadata.cover_dimensions.pageCount=220;
  const app=fixture({row:current,interiorGet:{id:7,status:'NORMALIZED',errors:[],page_count:'220',valid_pod_package_ids:[sku],
    source_url:'https://storage.test/interior.pdf?token=private'}});
  for(let i=0;i<4;i++)await app.service.run(artifact);
  assert.equal(app.record().print_validation.ready_for_print,true);
  assert.equal(app.record().print_validation.preflight.binding.literary_contract_version,'caronte-literary-v3');
  delete current.metadata.literary_contract_version;
  await assert.rejects(fixture({row:current}).service.run(artifact),/preflight_artifact_not_approved/);
});
test('basic interior validation never substitutes for full normalization',async()=>{
  const app=fixture({interiorGet:{id:7,status:'VALIDATED',source_url:'https://storage.test/interior.pdf?token=private',errors:[],page_count:194,valid_pod_package_ids:[sku]}});
  await app.service.run(artifact);await app.service.run(artifact);await app.service.run(artifact);
  assert.equal(app.record().print_validation.ready_for_print,false);
  assert.deepEqual(app.calls.filter(call=>call[0]==='post'),[['post','interior']]);
});
test('uncertain submission is held across retries without submitting a second validation',async()=>{
  const app=fixture({networkFailure:true});
  await app.service.run(artifact);await app.service.run(artifact);
  assert.equal(app.record().print_validation.preflight.interior.state,'uncertain');
  assert.equal(app.calls.filter(call=>call[0]==='post').length,1);
  assert.equal(app.record().print_validation.ready_for_print,false);
});
test('a lost database receipt retains submission intent and cannot replay a POST',async()=>{
  const app=fixture({saveReceiptFailure:true});
  await assert.rejects(app.service.run(artifact),/preflight_persistence_unverified/);
  await app.service.run(artifact);
  assert.equal(app.calls.filter(call=>call[0]==='post').length,1);
});
test('concurrent invocations cannot dispatch two submissions',async()=>{
  const app=fixture();await Promise.allSettled([app.service.run(artifact),app.service.run(artifact)]);
  assert.equal(app.calls.filter(call=>call[0]==='post').length,1);
});
test('a failed compare-and-set or private checksum prevents all provider submissions',async()=>{
  for(const options of [{casFailure:true},{storageFailure:true}]){
    const app=fixture(options);await assert.rejects(app.service.run(artifact),error=>{
      assert.doesNotMatch(error.message,/private secret error/);return true;
    });
    assert.equal(app.calls.filter(call=>call[0]==='post').length,0);
  }
});
test('unapproved, legacy, undersized, wrong-environment or inconsistent artifacts fail before file access',async()=>{
  for(const change of [r=>r.review_status='pending_review',r=>r.metadata.template='old-preview',
    r=>r.page_count=32,r=>r.lulu_metadata.environment='production',r=>r.lulu_metadata.cover_sha256=hash('d'),
    r=>r.print_validation.editorial_approval=null,r=>r.storage_path='other-session/interior.pdf',
    r=>r.lulu_metadata.cover_dimensions.pageCount=192]){
    const input=row();change(input);const app=fixture({row:input});
    await assert.rejects(app.service.run(artifact),/preflight_artifact_not_approved/);
    assert.equal(app.calls.length,0);
  }
});
test('normalized receipts with mismatched pages, SKU, ID, source or errors cannot become ready',async()=>{
  for(const patch of [{page_count:'193'},{page_count:'194garbage'},{valid_pod_package_ids:[]},
    {id:8},{source_url:'https://evil.test/stolen?token=secret'},{errors:['private source_url echo']},{status:'DONE'}]){
    const app=fixture();await app.service.run(artifact);
    const state=app.record();const bad=fixture({row:state,interiorGet:{...app.result('interior',7),...patch}});
    await bad.service.run(artifact);
    assert.equal(bad.record().print_validation.ready_for_print,false);
    assert.equal(bad.record().print_validation.preflight.interior.state,'failed');
    assert.doesNotMatch(JSON.stringify(bad.writes),/evil.test|private source_url echo/);
  }
});
test('source changes cannot reuse previously normalized receipts',async()=>{
  const app=fixture();for(let i=0;i<4;i++)await app.service.run(artifact);
  app.change(r=>{r.print_validation.source_sha256=hash('d');r.print_validation.editorial_approval.source_sha256=hash('d');});
  await app.service.run(artifact);
  assert.equal(app.record().print_validation.ready_for_print,false);
  assert.equal(app.record().print_validation.preflight.status,'binding_changed');
  assert.equal(app.calls.filter(call=>call[0]==='post').length,2);
});
test('an interrupted submission intent is attention-required, never replayed',async()=>{
  const app=fixture();await app.service.run(artifact);
  app.change(r=>{r.print_validation.preflight.interior.state='submitting';delete r.print_validation.preflight.interior.validation_id;});
  await app.service.run(artifact);
  assert.equal(app.calls.filter(call=>call[0]==='post').length,1);
  assert.equal(app.record().print_validation.ready_for_print,false);
});
test('failed provider reads preserve the known receipt for later same-ID polling',async()=>{
  const app=fixture({readFailure:true});await app.service.run(artifact);await app.service.run(artifact);
  assert.equal(app.record().print_validation.preflight.interior.validation_id,7);
  assert.equal(app.record().print_validation.preflight.interior.state,'pending');
  const resumed=fixture({row:app.record()});await resumed.service.run(artifact);
  assert.deepEqual(resumed.calls.filter(call=>['post','get'].includes(call[0])),[['get','interior',7]]);
});
for(const [label,errors] of [['null',null],['missing',undefined]]) {
  test(`a NORMALIZING creation receipt with ${label} errors retains the ID for a same-ID GET`,async()=>{
    const pending={id:7,status:'NORMALIZING',source_url:'https://storage.test/interior.pdf?token=private'};
    if(errors!==undefined)pending.errors=errors;
    const app=fixture({interiorPost:pending});
    await app.service.run(artifact);
    const interior=app.record().print_validation.preflight.interior;
    assert.equal(interior.state,'pending');
    assert.equal(interior.validation_id,7);
    assert.equal(interior.provider_status,'NORMALIZING');
    assert.equal(app.record().print_validation.ready_for_print,false);
    assert.doesNotMatch(JSON.stringify(app.writes),/token=private/);
    await app.service.run(artifact);
    assert.equal(app.record().print_validation.preflight.interior.state,'normalized');
    assert.deepEqual(app.calls.filter(call=>['post','get'].includes(call[0])),[['post','interior'],['get','interior',7]]);
  });
  test(`a NORMALIZED creation receipt with ${label} errors cannot normalize until a same-ID GET supplies an explicit empty array`,async()=>{
    const incomplete={id:7,status:'NORMALIZED',source_url:'https://storage.test/interior.pdf?token=private',
      page_count:'194',valid_pod_package_ids:[sku]};
    if(errors!==undefined)incomplete.errors=errors;
    const app=fixture({interiorPost:incomplete});
    await app.service.run(artifact);
    assert.equal(app.record().print_validation.preflight.interior.state,'pending');
    assert.equal(app.record().print_validation.preflight.interior.validation_id,7);
    assert.equal(app.record().print_validation.ready_for_print,false);
    assert.deepEqual(app.calls.filter(call=>['post','get'].includes(call[0])),[['post','interior']]);
    for(let index=0;index<3;index++)await app.service.run(artifact);
    assert.equal(app.record().print_validation.preflight.status,'ready');
    assert.equal(app.record().print_validation.ready_for_print,true);
    assert.equal(app.record().lulu_metadata.send_to_lulu,false);
    assert.deepEqual(app.calls.filter(call=>['post','get'].includes(call[0])),[['post','interior'],['get','interior',7],['post','cover'],['get','cover',9]]);
  });
  test(`a NORMALIZED GET with ${label} errors preserves the receipt and requires a later explicit empty array`,async()=>{
    const incomplete={id:7,status:'NORMALIZED',source_url:'https://storage.test/interior.pdf?token=private',
      page_count:'194',valid_pod_package_ids:[sku]};
    if(errors!==undefined)incomplete.errors=errors;
    const app=fixture({interiorGet:incomplete});
    await app.service.run(artifact);await app.service.run(artifact);
    assert.equal(app.record().print_validation.preflight.interior.state,'pending');
    assert.equal(app.record().print_validation.preflight.interior.validation_id,7);
    assert.equal(app.record().print_validation.ready_for_print,false);
    const resumed=fixture({row:app.record()});
    await resumed.service.run(artifact);
    assert.equal(resumed.record().print_validation.preflight.interior.state,'normalized');
    assert.deepEqual(resumed.calls.filter(call=>['post','get'].includes(call[0])),[['get','interior',7]]);
  });
}
test('an unknown creation status retains the validated receipt identity but remains uncertain without replaying',async()=>{
  const app=fixture({interiorPost:{id:7,status:'NEW_PROVIDER_STATUS',
    source_url:'https://storage.test/interior.pdf?token=private',errors:[]}});
  await app.service.run(artifact);
  const interior=app.record().print_validation.preflight.interior;
  assert.equal(interior.validation_id,7);
  assert.equal(interior.state,'uncertain');
  assert.equal(app.record().print_validation.ready_for_print,false);
  const count=app.calls.length;
  await app.service.run(artifact);
  assert.equal(app.calls.length,count);
  assert.deepEqual(app.calls.filter(call=>['post','get'].includes(call[0])),[['post','interior']]);
  assert.doesNotMatch(JSON.stringify(app.writes),/token=private/);
});
test('a malformed errors object never normalizes either file or authorizes printing',async()=>{
  const app=fixture({interiorPost:{id:7,status:'NORMALIZED',
    source_url:'https://storage.test/interior.pdf?token=private',errors:{message:'private source_url echo'},
    page_count:'194',valid_pod_package_ids:[sku]}});
  await app.service.run(artifact);
  assert.equal(app.record().print_validation.preflight.interior.validation_id,7);
  assert.equal(app.record().print_validation.preflight.interior.state,'uncertain');
  assert.equal(app.record().print_validation.ready_for_print,false);
  assert.equal(app.record().lulu_metadata.ready_for_print,false);
  await app.service.run(artifact);
  assert.deepEqual(app.calls.filter(call=>['post','get'].includes(call[0])),[['post','interior']]);
  assert.doesNotMatch(JSON.stringify(app.writes),/private source_url echo|token=private/);
});
test('invalid creation IDs or mismatched sources cannot become trusted receipts even when optional errors are null',async()=>{
  for(const patch of [{id:0},{id:-1},{id:1.5},{id:'7'},{id:Number.MAX_SAFE_INTEGER+1},
    {source_url:'https://storage.test/other.pdf?token=private'},{source_url:null}]) {
    const app=fixture({interiorPost:{id:7,status:'NORMALIZING',
      source_url:'https://storage.test/interior.pdf?token=private',errors:null,...patch}});
    await app.service.run(artifact);await app.service.run(artifact);
    assert.equal(app.record().print_validation.preflight.interior.validation_id,undefined);
    assert.equal(app.record().print_validation.preflight.interior.state,'uncertain');
    assert.equal(app.record().print_validation.ready_for_print,false);
    assert.deepEqual(app.calls.filter(call=>['post','get'].includes(call[0])),[['post','interior']]);
    assert.doesNotMatch(JSON.stringify(app.writes),/token=private/);
  }
});
test('revoking human approval revokes readiness without any file/provider effect',async()=>{
  const app=fixture();for(let i=0;i<4;i++)await app.service.run(artifact);
  const count=app.calls.length;app.change(r=>r.review_status='rejected');
  await assert.rejects(app.service.run(artifact),/preflight_artifact_not_approved/);
  assert.equal(app.record().print_validation.ready_for_print,false);
  assert.equal(app.record().lulu_metadata.ready_for_print,false);
  assert.equal(app.calls.length,count);
});
test('a normalized marker with a missing receipt cannot authorize another file or readiness',async()=>{
  const app=fixture();await app.service.run(artifact);await app.service.run(artifact);
  app.change(r=>delete r.print_validation.preflight.interior.validation_id);
  const count=app.calls.length;await app.service.run(artifact);
  assert.equal(app.record().print_validation.preflight.status,'failed');
  assert.equal(app.record().print_validation.ready_for_print,false);
  assert.equal(app.calls.length,count);
});
