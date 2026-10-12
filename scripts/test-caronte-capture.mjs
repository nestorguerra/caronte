import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash,webcrypto} from 'node:crypto';
import vm from 'node:vm';
import {test} from 'node:test';
import {legacyCaptureId,validateCaptureReceipt} from '../src/scripts/caronte-capture-store.js';

const source=readFileSync('src/scripts/future-book.js','utf8');
const fragments=[['function clearFutureBookSessionState()', 'function accessTokenFromUrl()'], ['function wordCount(', 'function preferredAudioMimeType()'], ['function resetCaptureState(', 'async function recordInterviewHeartbeat('], ['async function flushPendingAnswerQueue()', 'function localSession()'], ['function setupRecognition()', 'async function beginInterview()']]
  .map(([start,end])=>source.slice(source.indexOf(start),source.indexOf(end,source.indexOf(start)))).join('\n');
const text='Tengo cincuenta años y recuerdo cuando decidí cuidar de mi familia porque el trabajo me estaba dejando sin tiempo para las personas que quiero.';
function confirmedReceipt(input,{followUp=false,metadata={},answer={},...overrides}={}) {
  const bytes=Buffer.from(input.audioBase64||'','base64');
  return {ok:true,saved:!followUp,needsFollowUp:followUp,session:{id:input.sessionId},
    answer:{id:'answer-1',session_id:input.sessionId,question_index:input.questionIndex,transcript:input.transcript,transcript_source:'browser',
      audio_storage_path:`${input.sessionId}/q${String(input.questionIndex).padStart(2,'0')}-${input.captureId}.webm`,
      metadata:{capture_id:input.captureId,transcription_final:true,answer_state:followUp?'follow_up_required':'complete',
        audio_storage_status:'stored_private',audio_storage_verified:true,audio_bytes:bytes.length,audio_sha256:createHash('sha256').update(bytes).digest('hex'),...metadata},...answer},
    ...(followUp?{question:{index:input.questionIndex,text:'Dígame una escena',followUp:true}}:{nextQuestion:{index:2,text:'Otra'}}),...overrides};
}

function client({reply=()=>({ok:true,saved:false,needsTranscription:true,errorCode:'provider_missing',session:{id:'s1'}}),quota=false,getMedia=async stream=>stream,recorderFailure=false,recognitionFailure=false,beforeCommit=async()=>{},audioBlob=null}={}) {
  const storage=new Map(); const calls=[]; const notes=[]; const ui=[];
  const captures=new Map();
  const sessions=new Map(); const tracks=[{stopped:false,stop(){this.stopped=true;}}];
  const stream={getTracks:()=>tracks}; const recorders=[]; const recognizers=[];
  class Recorder {
    constructor(input) {if(recorderFailure) throw new Error('recorder unsupported'); this.stream=input; this.state='inactive'; recorders.push(this);}
    start(){this.state='recording';}
    stop(){this.state='inactive'; this.onstop?.();}
  }
  class Recognition {constructor(){if(recognitionFailure) throw new Error('speech unavailable'); recognizers.push(this);} start(){} stop(){} abort(){}}
  const context=vm.createContext({
    PENDING_ANSWERS_KEY:'test-pending',crypto:webcrypto,
    STORAGE_KEY:'session',ANSWERS_KEY:'answers',MANUSCRIPT_KEY:'book',PDF_KEY:'pdf',NAME_KEY:'name',ENTRY_STAGE_KEY:'stage',RITUAL_LOG_KEY:'ritual',ACCESS_TOKEN_KEY:'access',PAYMENT_DEADLINE_KEY:'payment',
    sessionStorage:{removeItem:key=>sessions.delete(key)},enteredName:'Test',entryStage:'interview',
    currentSession:{id:'s1',mode:'backend',publicToken:'test-only-token',status:'interview_active'},
    currentQuestion:{index:1,text:'Primera pregunta'}, currentTranscript:text,
    currentCaptureId:'',currentCaptureSessionId:'s1',currentTranscriptFinal:true,
    currentAnswerPayload:null,
    pendingMigrationPromise:null,legacyCaptureId:payload=>legacyCaptureId(payload,webcrypto),validateCaptureReceipt:(result,payload)=>validateCaptureReceipt(result,payload,webcrypto),
    captureStore:{put:async payload=>{await beforeCommit();if(quota)throw new Error('QuotaExceededError');captures.set(JSON.stringify([payload.sessionId,payload.captureId]),structuredClone(payload));},list:async sessionId=>[...captures.values()].filter(row=>sessionId==null||row.sessionId===sessionId),acknowledge:async(sessionId,captureId)=>captures.delete(JSON.stringify([sessionId,captureId]))},
    recordingStartPending:false,recordingRequestId:'',mediaRecorder:null,recognition:null,audioChunks:[],recordingStartedAt:0,
    answerSavePending:false, currentFollowUp:false, currentAudioMimeType:'audio/webm',
    lastDurationSeconds:30,audioCaptured:true,browserSpeechSupported:true,
    saveAnswerButton:{disabled:false},recordAnswerButton:{},stopRecordingButton:{},liveTranscript:{},answerMeta:{},
    localStorage:{getItem:key=>storage.get(key)||null,removeItem:key=>storage.delete(key),setItem:(key,value)=>{if(quota) throw new Error('QuotaExceededError'); storage.set(key,value);}},
    window:{SpeechRecognition:Recognition},navigator:{mediaDevices:{getUserMedia:()=>getMedia(stream)}},MediaRecorder:Recorder,
    preferredAudioMimeType:()=> 'audio/webm',voiceOrb:{classList:{add(){},remove(){}}},
    hasBackendConfig:()=>true,
    currentAudioPayload:async()=>audioBlob?{audioBlob,audioByteLength:audioBlob.size}:{audioBase64:'AQID',audioByteLength:3},
    blobToBase64:async blob=>Buffer.from(await blob.arrayBuffer()).toString('base64'),MAX_CLIENT_AUDIO_BYTES:24*1024*1024,
    futureAction:async(action,input)=>{calls.push({action,...structuredClone(input)}); return reply(input,context);},
    setText:(element,value)=>{element.textContent=value;},note:value=>notes.push(value),
    saveSession:session=>{context.currentSession={...session,mode:'backend'};},
    clearQuestionAudioCache:()=>ui.push('reset'),showComplete:()=>ui.push('completed'),
    showInterview:()=>ui.push('interview'),startQuestionAudioFlow:async()=>ui.push('question-audio')
  });
  vm.runInContext(fragments,context);
  return {storage,captures,calls,notes,ui,context,tracks,recorders,recognizers,run:code=>vm.runInContext(code,context)};
}

test('an unconfirmed answer is retained and never advances or says saved',async()=>{
  const app=client();
  await app.run('saveAnswer()');
  assert.equal(app.context.currentQuestion.index,1);
  assert.deepEqual(app.ui,[]);
  assert.doesNotMatch(app.context.answerMeta.textContent,/^saved/);
  assert.equal((await app.run('readPendingAnswers()')).length,1);
  assert.equal(app.context.saveAnswerButton.disabled,false);
});

test('transcription failure receipts retain the complete binary capture and identifier for a manual retry',async()=>{
  for(const errorCode of ['transcription_timeout','transcription_transport_failed','transcription_response_too_large']) {
    const audioBlob=new Blob([new Uint8Array([1,2,3])],{type:'audio/webm'});
    const app=client({audioBlob,reply:()=>({ok:true,saved:false,needsTranscription:true,errorCode,session:{id:'s1'}})});
    app.run('currentTranscriptFinal=false');
    await app.run('saveAnswer()');const first=app.calls[0];
    const queue=await app.run('readPendingAnswers()');
    assert.equal(queue.length,1);assert.equal(queue[0].captureId,first.captureId);
    assert.equal(queue[0].transcript,text);assert.equal(queue[0].transcriptionFinal,false);
    assert.deepEqual(new Uint8Array(await queue[0].audioBlob.arrayBuffer()),new Uint8Array([1,2,3]));
    assert.equal(app.context.currentQuestion.index,1);assert.deepEqual(app.ui,[]);
    assert.equal(app.context.saveAnswerButton.disabled,false);assert.equal(app.context.answerSavePending,false);
    assert.ok(app.context.answerMeta.textContent.includes(errorCode));
    await app.run('saveAnswer()');
    assert.equal(app.calls[1].captureId,first.captureId);assert.equal(app.calls[1].audioBase64,'AQID');
    assert.equal((await app.run('readPendingAnswers()')).length,1);assert.deepEqual(app.ui,[]);
  }
});

test('retry entries remain scoped to their original session',async()=>{
  const app=client({reply:()=>({ok:true,saved:true,session:{id:'s2'}})});
  await app.run("queuePendingAnswer({sessionId:'s1',questionIndex:1,transcript:'Primera sesión'})");
  app.run("currentSession={id:'s2',mode:'backend'}");
  await app.run('flushPendingAnswerQueue()');
  assert.equal(app.calls.length,0);
  assert.equal((await app.run('readPendingAnswers(true)'))[0].transcript,'Primera sesión');
});

test('the complete twenty-one-answer queue is not clipped to eight entries',async()=>{
  const app=client();
  await app.run("(async()=>{for(let index=1;index<=21;index++) await queuePendingAnswer({sessionId:'s1',questionIndex:index,transcript:'Respuesta '+index});})()");
  assert.equal((await app.run('readPendingAnswers()')).length,21);
});

test('a late save receipt cannot replace a different session',async()=>{
  const app=client({reply:(_,context)=>{
    context.currentSession={id:'s2',mode:'backend'};
    return {ok:true,saved:true,session:{id:'s1'},answer:{transcript:text},nextQuestion:{index:2,text:'Otra'}};
  }});
  await app.run('saveAnswer()');
  assert.equal(app.context.currentSession.id,'s2');
  assert.equal(app.context.currentQuestion.index,1);
  assert.deepEqual(app.ui,[]);
});

test('a capture identifier is stable across retries of exactly the same answer',async()=>{
  const app=client({reply:()=>{throw new Error('timeout');}});
  await app.run('saveAnswer()');
  await app.run('saveAnswer()');
  assert.match(app.calls[0].captureId||'',/^[0-9a-f-]{36}$/);
  assert.equal(app.calls[0].captureId,app.calls[1].captureId);
  assert.equal(app.calls[0].sessionId,'s1');
});

test('local storage failure never claims that the answer was queued durably',async()=>{
  const app=client({quota:true,reply:()=>{throw new Error('timeout');}});
  await app.run('saveAnswer()');
  assert.equal(app.context.currentTranscript,text);
  assert.doesNotMatch(app.context.answerMeta.textContent,/answer_queued_retry/);
  assert.match(app.context.answerMeta.textContent,/no.*cierre|no.*recargue|memoria/i);
});

test('an online replay cannot acknowledge and clear an entry from another current session',async()=>{
  const app=client({reply:()=>({ok:true,saved:true,session:{id:'s2'},answer:{transcript:text}})});
  await app.run("queuePendingAnswer({sessionId:'s1',questionIndex:1,transcript:'Respuesta original'})");
  await assert.rejects(app.run('flushPendingAnswerQueue()'),/session|sesión/i);
  assert.equal((await app.run('readPendingAnswers()')).length,1);
});

test('an online event cannot send a duplicate while a manual save is in flight',async()=>{
  let finish;
  const delayed=new Promise(resolve=>{finish=resolve;});
  const app=client({reply:()=>delayed});
  const manual=app.run('saveAnswer()');
  await new Promise(resolve=>setImmediate(resolve));
  const online=app.run('flushPendingAnswerQueue()');
  finish({ok:true,saved:false,needsTranscription:true,session:{id:'s1'}});
  await Promise.all([manual,online]);
  assert.equal(app.calls.length,1);
});

test('a follow-up receipt with no question cannot clear the pending recording',async()=>{
  const app=client({reply:()=>({ok:true,saved:false,needsFollowUp:true,session:{id:'s1'}})});
  await app.run('saveAnswer()');
  assert.equal((await app.run('readPendingAnswers()')).length,1);
  assert.equal(app.context.currentTranscript,text);
});

test('a real follow-up keeps its flag after resetting capture and starts the next prompt',async()=>{
  const app=client({reply:input=>confirmedReceipt(input,{followUp:true})});
  await app.run('saveAnswer()');
  assert.equal(app.context.currentFollowUp,true);
  assert.equal((await app.run('readPendingAnswers()')).length,0);
  assert.deepEqual(app.ui,['reset','interview','question-audio']);
});

test('resetting the interface does not delete unconfirmed answers from any session',async()=>{
  const app=client();
  await app.run("(async()=>{await queuePendingAnswer({sessionId:'s1',questionIndex:1,transcript:'Primera sesión'});await queuePendingAnswer({sessionId:'s2',questionIndex:1,transcript:'Segunda sesión'});clearFutureBookSessionState();})()");
  assert.equal((await app.run('readPendingAnswers(true)')).length,2);
  assert.equal(app.context.currentSession,null);
});

test('late speech recognition cannot overwrite the next question',async()=>{
  const app=client(); await app.run('startRecording()');
  const old=app.recognizers[0];
  app.run("resetCaptureState(); currentQuestion={index:2,text:'Otra'}; currentTranscript='Respuesta nueva'; currentTranscriptFinal=true");
  old.onresult({results:[Object.assign([{transcript:'Respuesta antigua'}],{isFinal:false})]});
  old.onerror();
  assert.equal(app.context.currentTranscript,'Respuesta nueva');
  assert.equal(app.context.currentTranscriptFinal,true);
});

test('late recorder callbacks cannot append audio or change a new session',async()=>{
  const app=client(); await app.run('startRecording()');
  const old=app.recorders[0];
  app.run("resetCaptureState(); currentSession={id:'s2'}; currentTranscript='Respuesta nueva'; saveAnswerButton.disabled=true");
  old.ondataavailable({data:{size:5}}); old.onstop();
  assert.equal(app.context.audioChunks.length,0);
  assert.equal(app.context.currentTranscript,'Respuesta nueva');
  assert.equal(app.context.saveAnswerButton.disabled,true);
  assert.equal(app.tracks[0].stopped,true);
});

test('denied microphone permission preserves the previous unsaved recording',async()=>{
  const app=client({getMedia:async()=>{throw new Error('Permission denied');}});
  app.run("currentCaptureId='previous'; audioChunks=[{size:9}]; audioCaptured=true; currentAnswerPayload={captureId:'previous'}");
  await assert.rejects(app.run('startRecording()'),/Permission denied/);
  assert.equal(app.context.currentCaptureId,'previous');
  assert.equal(app.context.currentTranscript,text);
  assert.equal(app.context.audioChunks[0].size,9);
  assert.equal(app.context.currentAnswerPayload.captureId,'previous');
  assert.equal(app.context.saveAnswerButton.disabled,false);
});

test('microphone permission arriving after reset releases its stream without starting recording',async()=>{
  let grant;
  const app=client({getMedia:stream=>new Promise(resolve=>{grant=()=>resolve(stream);})});
  const starting=app.run('startRecording()');
  app.run('resetCaptureState()'); grant(); await starting;
  assert.equal(app.recorders.length,0);
  assert.equal(app.tracks[0].stopped,true);
  assert.equal(app.context.currentCaptureId,'');
});

test('a recorder construction failure releases the microphone and preserves prior capture',async()=>{
  const app=client({recorderFailure:true});
  app.run("currentCaptureId='previous'; audioChunks=[{size:9}]; audioCaptured=true");
  await assert.rejects(app.run('startRecording()'),/recorder unsupported/);
  assert.equal(app.tracks[0].stopped,true);
  assert.equal(app.context.currentTranscript,text);
  assert.equal(app.context.audioChunks[0].size,9);
});

test('double recording clicks request only one stream while permission is pending',async()=>{
  const grants=[]; let requests=0;
  const app=client({getMedia:stream=>{requests++; return new Promise(resolve=>{grants.push(()=>resolve(stream));});}});
  const first=app.run('startRecording()'); const second=app.run('startRecording()');
  grants.forEach(grant=>grant()); await Promise.all([first,second]);
  assert.equal(requests,1);
  assert.equal(app.recorders.length,1);
});

test('speech recognition construction failure does not interrupt audio capture',async()=>{
  const app=client({recognitionFailure:true});
  await app.run('startRecording()');
  app.recorders[0].ondataavailable({data:{size:9}});
  app.run('stopRecording()');
  assert.equal(app.context.audioCaptured,true);
  assert.equal(app.context.saveAnswerButton.disabled,false);
  assert.equal(app.tracks[0].stopped,true);
  assert.equal(app.context.currentTranscriptFinal,false);
});

test('network submission waits for the local capture transaction to commit',async()=>{
  let release;
  const commit=new Promise(resolve=>{release=resolve;});
  const app=client({beforeCommit:()=>commit});
  const saving=app.run('saveAnswer()');
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(app.calls.length,0);
  release(); await saving;
  assert.equal(app.calls.length,1);assert.equal(app.captures.size,1);
});

test('new audio is journaled as a Blob but serialized as base64 only for transport',async()=>{
  const app=client({audioBlob:new Blob(['complete-binary-audio'],{type:'audio/webm'})});
  await app.run('saveAnswer()');
  const [queued]=await app.run('readPendingAnswers()');
  assert.equal(await queued.audioBlob.text(),'complete-binary-audio');
  assert.equal(queued.audioBase64,undefined);
  assert.equal(app.calls[0].audioBlob,undefined);
  assert.equal(Buffer.from(app.calls[0].audioBase64,'base64').toString(),'complete-binary-audio');
});

test('legacy migration preserves unscoped entries and assigns stable capture IDs',async()=>{
  const app=client();
  const scoped={sessionId:'s1',questionIndex:1,transcript:'Respuesta heredada'};
  const unscoped={questionIndex:2,transcript:'Sin sesión conocida'};
  app.storage.set('test-pending',JSON.stringify([scoped,unscoped]));
  const [migrated]=await app.run('readPendingAnswers()');
  assert.equal(migrated.captureId,await legacyCaptureId(scoped,webcrypto));
  assert.deepEqual(JSON.parse(app.storage.get('test-pending')),[unscoped]);
  assert.equal(app.captures.size,1);
});

test('a previously acknowledged capture is not falsely announced as queued again',async()=>{
  const app=client({reply:()=>{throw new Error('timeout');}});
  app.context.captureStore.put=async()=>({acknowledged:true});
  await app.run('saveAnswer()');
  assert.doesNotMatch(app.context.answerMeta.textContent,/answer_queued_retry/);
});

test('saved text without a verified audio archive cannot erase a local recording',async()=>{
  const app=client({reply:input=>confirmedReceipt(input,{metadata:{audio_storage_verified:false}})});
  await app.run('saveAnswer()');
  assert.equal((await app.run('readPendingAnswers()')).length,1);
  assert.equal(app.context.currentQuestion.index,1);assert.deepEqual(app.ui,[]);
  assert.equal(app.context.saveAnswerButton.disabled,false);
});

test('a byte-mismatched archive receipt leaves the complete Blob pending',async()=>{
  const app=client({audioBlob:new Blob(['full-source-audio']),reply:input=>confirmedReceipt(input,{metadata:{audio_sha256:'0'.repeat(64)}})});
  await app.run('saveAnswer()');
  const [pending]=await app.run('readPendingAnswers()');
  assert.ok(pending);assert.equal(await pending.audioBlob.text(),'full-source-audio');
  assert.equal(app.context.currentQuestion.index,1);assert.deepEqual(app.ui,[]);
});

test('another capture receipt cannot clear this question even with matching audio bytes',async()=>{
  const app=client({reply:input=>confirmedReceipt(input,{metadata:{capture_id:'another-capture'}})});
  await app.run('saveAnswer()');
  assert.equal((await app.run('readPendingAnswers()')).length,1);
  assert.equal(app.context.currentQuestion.index,1);assert.deepEqual(app.ui,[]);
});

test('a follow-up without its persisted audio source retains the initial capture',async()=>{
  const app=client({reply:input=>confirmedReceipt(input,{followUp:true,answer:{audio_storage_path:null}})});
  await app.run('saveAnswer()');
  assert.equal((await app.run('readPendingAnswers()')).length,1);
  assert.equal(app.context.currentFollowUp,false);assert.deepEqual(app.ui,[]);
});

test('online replay applies the same archive verification before removing a pending capture',async()=>{
  const app=client({reply:input=>confirmedReceipt(input,{metadata:{audio_bytes:1}})});
  await app.run("queuePendingAnswer({sessionId:'s1',captureId:'capture-1',questionIndex:1,transcript:'Respuesta original',audioBase64:'AQID',audioCaptured:true})");
  await assert.rejects(app.run('flushPendingAnswerQueue()'),/audio|archive/);
  assert.equal((await app.run('readPendingAnswers()')).length,1);
});

test('a readback-verified audio and persisted text receipt clears only its capture and advances',async()=>{
  const app=client({audioBlob:new Blob(['full-source-audio']),reply:input=>confirmedReceipt(input)});
  await app.run("queuePendingAnswer({sessionId:'s2',captureId:'other',questionIndex:1,transcript:'Otra sesión'})");
  await app.run('saveAnswer()');
  assert.equal((await app.run('readPendingAnswers()')).length,0);
  assert.equal((await app.run('readPendingAnswers(true)')).length,1);
  assert.equal(app.context.currentQuestion.index,2);
  assert.deepEqual(app.ui,['reset','interview','question-audio']);
});
