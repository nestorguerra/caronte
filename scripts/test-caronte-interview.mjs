import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
import {webcrypto} from 'node:crypto';
import {createServer} from 'node:http';
import vm from 'node:vm';
import {test} from 'node:test';
import {validateCaptureReceipt} from '../src/scripts/caronte-capture-store.js';

// Run the real Edge function code. Only network/auth/rate-limit boundaries are
// replaced; saveAnswer, transcription, storage and completion logic remain real.
const original = readFileSync('supabase/functions/future-book-session/index.ts', 'utf8');
const source = stripTypeScriptTypes(original.replace(/^import .*;\n/gm, ''), {mode:'strip'});
const text = 'Tengo cincuenta años y recuerdo cuando decidí cuidar de mi familia porque el trabajo me estaba dejando sin tiempo para las personas que quiero.';
const payload = overrides => ({sessionId:'session-1',publicToken:'test-token',questionIndex:1,questionText:'¿Qué momento vital atraviesas?',transcript:text,transcriptSource:'browser',transcriptionFinal:true,audioBase64:'AQID',audioMimeType:'audio/webm',audioCaptured:true,durationSeconds:30,...overrides});

function backend({transcription={text},transcriptionFetch=null,clock=null,storageStatus=200,answers=[],total=21,key=true,storageEnabled=true,readbackBody=null,readbackStatus=200,losePersistedAnswer=false,transformStoredAnswer=answer=>answer}={}) {
  const records=structuredClone(answers);
  const events=[];
  const requests=[];
  const objects=new Map();
  let session={id:'session-1',public_token:'test-token',status:'interview_active',question_count:total,payment_status:'simulated_approved'};
  const rest=async (resource, options={}) => {
    const [table, query='']=resource.split('?');
    const filters=new URLSearchParams(query);
    if (table==='future_book_sessions') {
      if(options.method==='PATCH') session={...session,...options.body};
      return [structuredClone(session)];
    }
    if(table==='future_book_answers') {
      if(options.method==='POST'||options.method==='PATCH') {
        const index=records.findIndex(item=>filters.get('id')?item.id===filters.get('id').slice(3):item.question_index===options.body.question_index);
        const saved=transformStoredAnswer({...(index<0?{id:`answer-${records.length+1}`} :records[index]),...structuredClone(options.body)});
        if(index<0) records.push(saved); else records[index]=saved;
        return [saved];
      }
      let rows=records;
      if(losePersistedAnswer) return [];
      if(filters.get('question_index')) rows=rows.filter(item=>item.question_index===Number(filters.get('question_index').slice(3)));
      return structuredClone(rows);
    }
    if(table==='future_book_events') events.push(structuredClone(options.body));
    return [];
  };
  const context=vm.createContext({
    rest, encodeParam:encodeURIComponent, crypto:webcrypto,
    Request, Response, Blob, FormData, URL, URLSearchParams, TextEncoder, TextDecoder,
    setTimeout:clock?.setTimeout||setTimeout, clearTimeout:clock?.clearTimeout||clearTimeout, AbortController, Uint8Array, atob, btoa,
    Deno:{env:{get:name=>({SUPABASE_URL:'https://storage.test',SUPABASE_SERVICE_ROLE_KEY:'test-only-service-key',APP_ENV:'production',FUTURE_BOOK_STORE_AUDIO:storageEnabled?'true':'false'})[name]},serve(){}},
    fetch:async (url, options) => {
      requests.push({url:String(url),method:options?.method});
      if(String(url).includes('/storage/')) {
        const path=String(url).split('/object/')[1];
        const method=options?.method||'GET';
        if(method==='GET') {
          if(readbackStatus!==200) return new Response('',{status:readbackStatus});
          const bytes=readbackBody||objects.get(path);
          return bytes?new Response(bytes,{status:200}):new Response('',{status:404});
        }
        if(storageStatus!==200) return new Response('',{status:storageStatus});
        if(method==='PUT'&&!objects.has(path)) return new Response('',{status:404});
        if(method==='POST'&&objects.has(path)) return new Response('',{status:400});
        objects.set(path,new Uint8Array(options.body));
        return new Response('{}',{status:200});
      }
      if(String(url).includes('/audio/transcriptions')) {
        if(transcriptionFetch) return await transcriptionFetch(url,options);
        if(transcription instanceof Error) throw transcription;
        return new Response(typeof transcription==='string'?transcription:JSON.stringify(transcription),{status:200});
      }
      throw new Error('unexpected_network_request');
    }
  });
  vm.runInContext(source,context);
  // These are external access boundaries, not the behavior under test.
  vm.runInContext('enforceAbuseLimit = async () => ({});',context);
  context.providerSecret=async () => key?'test-only-provider-key':'';
  return {records,events,requests,objects,context,
    save:input=>context.saveAnswer(new Request('https://example.test'),input),
    session:()=>session};
}

// Advance only the production 60-second transcription deadline. Other clocks
// keep their native behavior; there is no new timeout setting in production.
function transcriptionClock() {
  const timers=new Map();
  return {
    setTimeout(callback,delay) {if(delay!==60000)return setTimeout(callback,delay);const id=Symbol('transcription-deadline');timers.set(id,callback);return id;},
    clearTimeout(id) {if(!timers.delete(id))clearTimeout(id);},
    pending:()=>timers.size,
    expire() {assert.equal(timers.size,1);const [id,callback]=timers.entries().next().value;timers.delete(id);callback();}
  };
}

function heldTranscription(status=200) {
  const reading=Promise.withResolvers();let streamController,canceled=false;
  const response=new Response(new ReadableStream({start(controller){streamController=controller;},cancel(){canceled=true;}}),{status});
  const textMethod=response.text.bind(response),readerMethod=response.body.getReader.bind(response.body);
  response.text=()=>{reading.resolve();return textMethod();};
  response.body.getReader=(...args)=>{reading.resolve();return readerMethod(...args);};
  return {response,reading:reading.promise,canceled:()=>canceled,
    close(){try{streamController.close();}catch{/* Deadline may already have canceled it. */}}};
}

test('missing transcription provider never saves a placeholder or advances the interview',async()=>{
  const app=backend({key:false});
  const result=await app.save(payload({transcript:'[Audio capturado: 30 segundos. Transcripcion pendiente en backend.]',transcriptSource:'pending',transcriptionFinal:false}));
  assert.equal(result.saved,false);
  assert.equal(result.needsTranscription,true);
  assert.equal(result.nextQuestion,undefined);
  assert.equal(app.records.length,0);
  assert.equal(app.session().status,'interview_active');
});

test('an interim browser transcript is replaced with the complete server transcript',async()=>{
  const app=backend();
  const result=await app.save(payload({transcript:'Tengo cincuenta años y recuerdo',transcriptionFinal:false}));
  assert.equal(result.saved,true);
  assert.equal(result.answer.transcript,text);
  assert.equal(result.answer.transcript_source,'backend');
  assert.equal(app.requests.filter(item=>item.url.includes('/audio/transcriptions')).length,1);
});

test('malformed provider JSON cannot become the interview transcript',async()=>{
  const app=backend({transcription:'upstream body is not a JSON transcription'});
  const result=await app.save(payload({transcript:'',transcriptSource:'pending',transcriptionFinal:false}));
  assert.equal(result.saved,false);
  assert.equal(result.needsTranscription,true);
  assert.equal(app.records.length,0);
});

test('transcription deadline stays active after headers and retains the immutable audio on a stalled body',async()=>{
  const clock=transcriptionClock(),held=heldTranscription();let signal;
  const app=backend({clock,transcriptionFetch:async(_,options)=>{signal=options.signal;return held.response;}});
  const pending=app.save(payload({captureId:'ec7b8ec8-91e6-419d-876b-3bd18f45e2c7',transcript:'',transcriptSource:'pending',transcriptionFinal:false}));
  try {
    await held.reading;
    assert.equal(clock.pending(),1,'The full response body must remain inside the deadline');
    clock.expire();const result=await pending;
    assert.equal(result.saved,false);assert.equal(result.needsTranscription,true);
    assert.equal(result.errorCode,'transcription_timeout');assert.equal(result.nextQuestion,undefined);
    assert.equal(signal.aborted,true);assert.equal(held.canceled(),true);
    assert.equal(app.records.length,0);assert.equal(app.session().status,'interview_active');
    assert.equal(app.objects.size,1);assert.deepEqual([...app.objects.values()][0],new Uint8Array([1,2,3]));
    assert.ok(app.events.some(event=>event.event_type==='answer_transcription_failed'&&event.metadata.status==='transcription_timeout'));
    assert.equal(app.events.some(event=>event.event_type==='answer_transcription_completed'),false);
  } finally {held.close();await pending.catch(()=>null);}
  assert.equal(clock.pending(),0);
});

test('a failed transcription stream returns a safe recovery receipt instead of throwing its private body error',async()=>{
  const clock=transcriptionClock();
  const response=new Response(new ReadableStream({start(controller){controller.error(new Error('Private upstream body and key must not be disclosed'));}}));
  const app=backend({clock,transcriptionFetch:async()=>response});
  const result=await app.save(payload({transcript:'',transcriptSource:'pending',transcriptionFinal:false}));
  assert.equal(result.saved,false);assert.equal(result.needsTranscription,true);
  assert.equal(result.errorCode,'transcription_transport_failed');assert.equal(app.records.length,0);
  assert.equal(app.objects.size,1);assert.equal(clock.pending(),0);
  assert.doesNotMatch(JSON.stringify([result,app.events]),/Private upstream body|key must not/);
});

test('invalid UTF-8 in a provider response cannot silently replace words in an acknowledged transcript',async()=>{
  const prefix=new TextEncoder().encode(`{"text":"${text} `),suffix=new TextEncoder().encode('"}');
  const bytes=new Uint8Array(prefix.length+2+suffix.length);
  bytes.set(prefix);bytes.set([0xc3,0x28],prefix.length);bytes.set(suffix,prefix.length+2);
  const clock=transcriptionClock(),app=backend({clock,transcriptionFetch:async()=>new Response(bytes)});
  const result=await app.save(payload({transcript:'',transcriptSource:'pending',transcriptionFinal:false}));
  assert.equal(result.saved,false);assert.equal(result.errorCode,'transcription_transport_failed');
  assert.equal(app.records.length,0);assert.equal(app.objects.size,1);assert.equal(clock.pending(),0);
});

test('a complete multichunk unicode transcription is preserved and clears its deadline',async()=>{
  const complete=`${text} Corazón, raíces, mañana y decisión. `.repeat(100)+'La última frase no puede perderse.';
  const bytes=new TextEncoder().encode(JSON.stringify({text:complete}));
  const response=new Response(new ReadableStream({start(controller){
    for(let index=0;index<bytes.length;index+=37)controller.enqueue(bytes.slice(index,index+37));controller.close();
  }}));
  const clock=transcriptionClock(),app=backend({clock,transcriptionFetch:async()=>response});
  const result=await app.save(payload({transcript:'Texto provisional',transcriptionFinal:false}));
  assert.ok(complete.length>12000);assert.equal(result.saved,true);
  assert.equal(result.answer.transcript,complete);assert.equal(result.answer.transcript_source,'backend');
  assert.equal(clock.pending(),0);
});

test('the full 200,000-character transcript still fits when the provider JSON escapes every character',async()=>{
  const complete=`${text} `+'á'.repeat(200000-text.length-1);
  const escaped=[...complete].map(character=>`\\u${character.charCodeAt(0).toString(16).padStart(4,'0')}`).join('');
  const response=new Response(`{"text":"${escaped}"}`),clock=transcriptionClock();
  const app=backend({clock,transcriptionFetch:async()=>response});
  const result=await app.save(payload({transcript:'',transcriptSource:'pending',transcriptionFinal:false}));
  assert.equal(complete.length,200000);assert.equal(result.saved,true);
  assert.equal(result.answer.transcript,complete);assert.equal(clock.pending(),0);
});

test('HTTP transcription failure cancels its body without reading or revealing the upstream error',async()=>{
  const held=heldTranscription(429),clock=transcriptionClock();let read=false;
  held.response.text=async()=>{read=true;throw new Error('Private upstream failure');};
  const app=backend({clock,transcriptionFetch:async()=>held.response});
  try {
    const result=await app.save(payload({transcript:'',transcriptSource:'pending',transcriptionFinal:false}));
    assert.equal(result.saved,false);assert.equal(result.errorCode,'openai_http_429');
    assert.equal(read,false);assert.equal(held.canceled(),true);assert.equal(clock.pending(),0);
    assert.equal(app.records.length,0);assert.doesNotMatch(JSON.stringify([result,app.events]),/Private upstream failure/);
  } finally {held.close();}
});

test('an oversized transcription response is rejected without clipping text or acknowledging the answer',async()=>{
  let canceled=false;
  const clock=transcriptionClock(),response=new Response(new ReadableStream({
    start(controller){controller.enqueue(new TextEncoder().encode(JSON.stringify({text,unexpected:'x'.repeat(2*1024*1024)})));},
    cancel(){canceled=true;}
  }));
  const app=backend({clock,transcriptionFetch:async()=>response});
  const result=await app.save(payload({transcript:'',transcriptSource:'pending',transcriptionFinal:false}));
  assert.equal(result.saved,false);assert.equal(result.needsTranscription,true);
  assert.equal(result.errorCode,'transcription_response_too_large');
  assert.equal(app.records.length,0);assert.equal(app.objects.size,1);assert.equal(clock.pending(),0);
  assert.equal(canceled,true,'Rejecting an oversized body must also close its reader');
});

test('late headers after a deadline cannot revive transcription or acknowledge an answer',async()=>{
  const clock=transcriptionClock(),entered=Promise.withResolvers(),reply=Promise.withResolvers(),held=heldTranscription();
  const app=backend({clock,transcriptionFetch:async()=>{entered.resolve();return await reply.promise;}});
  const pending=app.save(payload({transcript:'',transcriptSource:'pending',transcriptionFinal:false}));
  try {
    await entered.promise;clock.expire();const result=await pending;
    assert.equal(result.saved,false);assert.equal(result.errorCode,'transcription_timeout');
    reply.resolve(held.response);
    await new Promise(resolve=>setImmediate(resolve));
    assert.equal(held.canceled(),true);assert.equal(app.records.length,0);assert.equal(app.objects.size,1);
    assert.equal(app.events.some(event=>event.event_type==='answer_transcription_completed'),false);
    assert.equal(clock.pending(),0);
  } finally {reply.resolve(held.response);held.close();await pending.catch(()=>null);}
});

test('a native HTTP response that stalls after headers is aborted and leaves the interview recoverable',{timeout:5000},async()=>{
  const reading=Promise.withResolvers(),closed=Promise.withResolvers(),clock=transcriptionClock();
  let count=0;
  const server=createServer((req,res)=>{
    count++;assert.equal(req.method,'POST');assert.equal(req.url,'/audio/transcriptions');
    req.resume();res.on('close',()=>closed.resolve({ended:res.writableEnded}));
    res.writeHead(200,{'content-type':'application/json'});res.flushHeaders();res.write('{"text":"Incomplete body');
  });
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
  const port=server.address().port;
  const app=backend({clock,transcriptionFetch:async(url,options)=>{
    assert.equal(String(url),'https://api.openai.com/v1/audio/transcriptions');
    const response=await fetch(`http://127.0.0.1:${port}/audio/transcriptions`,options);
    const getReader=response.body.getReader.bind(response.body);
    response.body.getReader=(...args)=>{reading.resolve();return getReader(...args);};
    return response;
  }});
  try {
    const pending=app.save(payload({transcript:'',transcriptSource:'pending',transcriptionFinal:false}));
    await reading.promise;clock.expire();const result=await pending;
    assert.equal(result.saved,false);assert.equal(result.needsTranscription,true);assert.equal(result.errorCode,'transcription_timeout');
    assert.equal((await closed.promise).ended,false);assert.equal(count,1);assert.equal(app.records.length,0);
    assert.equal(app.objects.size,1);assert.equal(app.session().status,'interview_active');assert.equal(clock.pending(),0);
  } finally {server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
});

test('captured audio storage failure never acknowledges a complete saved answer',async()=>{
  const app=backend({storageStatus:503});
  const result=await app.save(payload());
  assert.equal(result.saved,false);
  assert.equal(result.needsAudioRecovery,true);
  assert.equal(app.records.length,0);
});

test('a blank follow-up with no audio is not accepted as an answer',async()=>{
  const app=backend();
  const result=await app.save(payload({transcript:'',transcriptSource:'pending',audioBase64:null,audioCaptured:false,followUpAttempt:true}));
  assert.equal(result.saved,false);
  assert.equal(app.records.length,0);
});

test('the complete transcript is preserved beyond the old twelve-thousand-character cutoff',async()=>{
  const complete=`${text} `.repeat(110)+'La última frase no puede perderse.';
  assert.ok(complete.length>12000);
  const app=backend();
  const result=await app.save(payload({transcript:complete}));
  assert.equal(result.answer.transcript,complete);
});

test('invalid question indexes are rejected instead of coerced into another answer',async()=>{
  for(const index of [0,22,1.5,'not-a-number']) {
    const app=backend();
    await assert.rejects(app.save(payload({questionIndex:index})),/question_index_invalid/);
    assert.equal(app.records.length,0);
    assert.equal(app.requests.length,0);
  }
});

test('legacy pending answers do not complete the interview and the next question fills the gap',async()=>{
  const app=backend({total:2,answers:[{id:'old',question_index:1,transcript:'[Audio capturado: pendiente.]',transcript_source:'pending'}]});
  const result=await app.save(payload({questionIndex:2}));
  assert.equal(result.completed,false);
  assert.equal(result.nextQuestion.index,1);
  assert.equal(app.session().status,'interview_active');
});

test('a successfully saved final capture can be acknowledged again without another provider call',async()=>{
  const app=backend({total:1});
  const input=payload({captureId:'ec7b8ec8-91e6-419d-876b-3bd18f45e2c7',transcript:'',transcriptSource:'pending',transcriptionFinal:false});
  const first=await app.save(input);
  assert.equal(first.completed,true);
  const again=await app.save(input);
  assert.equal(again.saved,true);
  assert.equal(again.completed,true);
  assert.equal(again.answer.id,first.answer.id);
  assert.equal(app.records.length,1);
  assert.equal(app.requests.filter(item=>item.url.includes('/audio/transcriptions')).length,1);
});

test('the same capture identifier cannot overwrite an acknowledged answer with different input',async()=>{
  const app=backend();
  const input=payload({captureId:'ec7b8ec8-91e6-419d-876b-3bd18f45e2c7'});
  await app.save(input);
  await assert.rejects(app.save({...input,transcript:'Un texto diferente que no corresponde a la captura recibida.'}),/capture_input_mismatch/);
  assert.equal(app.records[0].transcript,text);
});

test('a short initial answer is retained together with its follow-up, not silently replaced',async()=>{
  const app=backend();
  const initial=await app.save(payload({captureId:'ec7b8ec8-91e6-419d-876b-3bd18f45e2c7',transcript:'Yo lo recuerdo.'}));
  assert.equal(initial.needsFollowUp,true);
  assert.equal(initial.saved,false);
  const completed=await app.save(payload({captureId:'46f2ef7a-4ba1-463e-a577-1e29a965f2b5',followUpAttempt:true}));
  assert.equal(completed.saved,true);
  assert.ok(completed.answer.transcript.includes('Yo lo recuerdo.'));
  assert.ok(completed.answer.transcript.endsWith(text));
});

test('public input cannot claim a server transcription or an admin provenance',async()=>{
  for(const source of ['backend','manual_admin']) {
    const app=backend({transcription:{text}});
    const saved=await app.save(payload({transcriptSource:source,transcript:'Un texto declarado por el cliente.'}));
    assert.equal(saved.saved,true);
    assert.equal(saved.answer.transcript,text);
    assert.equal(app.requests.filter(item=>item.url.includes('/audio/transcriptions')).length,1);
  }
});

test('resuming the interview asks for the first missing answer rather than skipping a gap',async()=>{
  const app=backend({answers:[{id:'answer-2',question_index:2,transcript:text,transcript_source:'browser'}]});
  const result=await app.context.startInterview(payload());
  assert.equal(result.question.index,1);
});

test('resuming an initial short draft preserves the follow-up prompt and flag',async()=>{
  const app=backend();
  await app.save(payload({captureId:'ec7b8ec8-91e6-419d-876b-3bd18f45e2c7',transcript:'Yo lo recuerdo.'}));
  const result=await app.context.startInterview(payload());
  assert.equal(result.question.index,1);
  assert.equal(result.question.followUp,true);
});

test('a new capture uses creation semantics and keeps immutable private audio',async()=>{
  const app=backend(); const id='ec7b8ec8-91e6-419d-876b-3bd18f45e2c7';
  const first=await app.context.uploadPrivateAudioArtifact('session-1',1,'audio/webm',new Uint8Array([1,2,3]),id);
  assert.equal(first.status,'stored_private');
  const again=await app.context.uploadPrivateAudioArtifact('session-1',1,'audio/webm',new Uint8Array([9,9,9]),id);
  assert.notEqual(again.status,'stored_private');
  assert.deepEqual([...app.objects.values()][0],new Uint8Array([1,2,3]));
});

test('accepted but changed audio is not acknowledged without byte readback verification',async()=>{
  const app=backend({readbackBody:new Uint8Array([9,9,9])});
  const result=await app.save(payload());
  assert.equal(result.saved,false); assert.equal(result.needsAudioRecovery,true);
  assert.ok(app.requests.some(item=>item.url.includes('/storage/')&&item.method==='GET'));
  assert.equal(app.records.length,0);
});

test('a follow-up receipt includes its persisted initial text and verified audio hash',async()=>{
  const app=backend();
  const result=await app.save(payload({captureId:'ec7b8ec8-91e6-419d-876b-3bd18f45e2c7',transcript:'Yo lo recuerdo.'}));
  assert.equal(result.needsFollowUp,true);
  assert.equal(result.answer.transcript,'Yo lo recuerdo.');
  assert.equal(result.answer.metadata.audio_storage_verified,true);
  assert.match(result.answer.metadata.audio_sha256,/^[0-9a-f]{64}$/);
  assert.equal(result.answer.metadata.audio_bytes,3);
});

test('disabled retention cannot advance a voice interview or pay for transcription',async()=>{
  const app=backend({storageEnabled:false});
  const result=await app.save(payload({transcript:'',transcriptSource:'pending',transcriptionFinal:false}));
  assert.equal(result.saved,false); assert.equal(result.needsAudioRecovery,true);
  assert.equal(app.records.length,0);assert.equal(app.requests.length,0);
});

test('database acceptance without readback is not reported as a persisted answer',async()=>{
  const app=backend({losePersistedAnswer:true});
  await assert.rejects(app.save(payload()),/answer_persistence_unconfirmed/);
});

test('a replay does not acknowledge private audio that has disappeared since saving',async()=>{
  const app=backend({total:1}); const input=payload({captureId:'ec7b8ec8-91e6-419d-876b-3bd18f45e2c7'});
  const first=await app.save(input);assert.equal(first.saved,true);
  app.objects.clear();
  const replay=await app.save(input);
  assert.equal(replay.saved,false);assert.equal(replay.needsAudioRecovery,true);
});

test('database readback is compared with the submitted full transcript, not an altered write response',async()=>{
  const app=backend({transformStoredAnswer:answer=>({...answer,transcript:'Tengo cincuenta años'})});
  await assert.rejects(app.save(payload({captureId:'ec7b8ec8-91e6-419d-876b-3bd18f45e2c7'})),/answer_persistence_unconfirmed/);
  assert.equal(app.session().status,'interview_active');
});

test('real server receipts and browser verification agree for initial and completed follow-up captures',async()=>{
  const app=backend();
  const initial=payload({captureId:'ec7b8ec8-91e6-419d-876b-3bd18f45e2c7',transcript:'Yo lo recuerdo.'});
  assert.equal(await validateCaptureReceipt(await app.save(initial),initial,webcrypto),true);
  const followUp=payload({captureId:'46f2ef7a-4ba1-463e-a577-1e29a965f2b5',followUpAttempt:true});
  assert.equal(await validateCaptureReceipt(await app.save(followUp),followUp,webcrypto),true);
});

test('resume does not skip a voice answer whose metadata says its audio was not archived',async()=>{
  const app=backend({answers:[{id:'unverified-audio',session_id:'session-1',question_index:1,transcript:text,transcript_source:'browser',
    metadata:{answer_state:'complete',transcription_final:true,audio_captured:true,audio_received:true,audio_storage_verified:false}}]});
  const result=await app.context.startInterview(payload());
  assert.equal(result.question.index,1);
});
