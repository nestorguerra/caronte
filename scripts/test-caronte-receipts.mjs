import assert from 'node:assert/strict';
import {createHash,webcrypto} from 'node:crypto';
import {test} from 'node:test';
import * as captures from '../src/scripts/caronte-capture-store.js';

const input=()=>({sessionId:'session-1',captureId:'ec7b8ec8-91e6-419d-876b-3bd18f45e2c7',questionIndex:1,
  transcript:'Todo el texto original debe conservarse.',transcriptSource:'browser',transcriptionFinal:true,audioCaptured:true,
  audioBlob:new Blob([new Uint8Array([1,2,3])]),audioByteLength:3});
const receipt=payload=>({ok:true,saved:true,session:{id:payload.sessionId},answer:{id:'answer-1',session_id:payload.sessionId,question_index:payload.questionIndex,
  transcript:payload.transcript,transcript_source:'browser',audio_storage_path:`${payload.sessionId}/q01-${payload.captureId}.webm`,
  metadata:{capture_id:payload.captureId,transcription_final:true,answer_state:'complete',audio_storage_status:'stored_private',
    audio_storage_verified:true,audio_bytes:3,audio_sha256:createHash('sha256').update(new Uint8Array([1,2,3])).digest('hex')}}});
const validate=(result,payload)=>{assert.equal(typeof captures.validateCaptureReceipt,'function');return captures.validateCaptureReceipt(result,payload,webcrypto);};

test('a committed answer receipt verifies the exact Blob checksum and ownership',async()=>{
  const payload=input();assert.equal(await validate(receipt(payload),payload),true);
});
test('legacy base64 audio uses the same raw-byte receipt contract',async()=>{
  const payload=input();delete payload.audioBlob;payload.audioBase64='AQID';
  assert.equal(await validate(receipt(payload),payload),true);
});
test('an unsaved transcription or recovery response does not acknowledge the capture',async()=>{
  const payload=input();assert.equal(await validate({ok:true,saved:false,needsAudioRecovery:true,session:{id:payload.sessionId}},payload),false);
});
test('capture, session, question and private path mismatches reject acknowledgement',async()=>{
  const payload=input();
  for(const change of [value=>{value.session.id='other';},value=>{value.answer.session_id='other';},value=>{value.answer.question_index=2;},
    value=>{value.answer.metadata.capture_id='other';},value=>{value.answer.audio_storage_path='other/q01-other.webm';}]) {
    const result=receipt(payload);change(result);await assert.rejects(validate(result,payload),/receipt|archive/);
  }
});
test('missing readback flag, checksum or full bytes cannot attest an audio archive',async()=>{
  const payload=input();
  for(const change of [value=>{value.answer.metadata.audio_storage_verified=false;},value=>{value.answer.metadata.audio_sha256=null;},
    value=>{value.answer.metadata.audio_bytes=2;},value=>{value.answer.metadata.audio_sha256='0'.repeat(64);},value=>{value.answer.metadata.audio_storage_status='discarded_by_policy';}]) {
    const result=receipt(payload);change(result);await assert.rejects(validate(result,payload),/audio|archive/);
  }
});
test('pending or placeholder text is not a persisted transcript receipt',async()=>{
  const payload=input();
  for(const change of [value=>{value.answer.transcript='';},value=>{value.answer.transcript='[Audio capturado: pendiente.]';},
    value=>{value.answer.transcript_source='pending';},value=>{value.answer.metadata.transcription_final=false;},value=>{value.answer.metadata.answer_state='follow_up_required';}]) {
    const result=receipt(payload);change(result);await assert.rejects(validate(result,payload),/receipt/);
  }
});
test('follow-up acknowledgement requires the persisted initial answer and the same question',async()=>{
  const payload=input();const result=receipt(payload);result.saved=false;result.needsFollowUp=true;
  result.question={index:1,text:'Dígame una escena',followUp:true};result.answer.metadata.answer_state='follow_up_required';
  assert.equal(await validate(result,payload),true);
  delete result.answer;await assert.rejects(validate(result,payload),/receipt/);
});
test('captured audio with no remaining source bytes cannot be acknowledged as text-only',async()=>{
  const payload=input();delete payload.audioBlob;await assert.rejects(validate(receipt(payload),payload),/audio/);
});
test('a genuinely text-only answer can be acknowledged without invented audio',async()=>{
  const payload=input();delete payload.audioBlob;payload.audioCaptured=false;payload.audioByteLength=0;
  const result=receipt(payload);result.answer.audio_storage_path=null;
  result.answer.metadata={capture_id:payload.captureId,transcription_final:true,answer_state:'complete'};
  assert.equal(await validate(result,payload),true);
});
test('a browser-final transcript cannot be silently truncated in a receipt',async()=>{
  const payload=input();const result=receipt(payload);result.answer.transcript='Todo el texto';
  await assert.rejects(validate(result,payload),/receipt/);
});
