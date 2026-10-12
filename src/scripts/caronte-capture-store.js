// Browser-local journal. Only a committed transaction may acknowledge storage.
// Never store public tokens or provider credentials alongside the interview.
const FIELDS=['sessionId','captureId','questionIndex','questionText','transcript','transcriptSource','durationSeconds','audioMimeType','audioBlob','audioBase64','audioByteLength','audioCaptured','browserSpeechSupported','transcriptionFinal','followUpAttempt','qualityScore','localPatch','queuedAt'];
const keyFor=(sessionId,captureId)=>JSON.stringify([sessionId,captureId]);

export function createCaptureStore({indexedDB=globalThis.indexedDB,dbName='caronte-interview-captures-v1',timeoutMs=10000}={}) {
  let opening;
  function open() {
    if(!indexedDB?.open) return Promise.reject(new Error('capture_store_unavailable'));
    if(opening) return opening;
    opening=new Promise((resolve,reject)=>{
      let settled=false;
      const request=indexedDB.open(dbName,1);
      const finish=(error,db)=>{if(settled){db?.close();return;}settled=true;clearTimeout(timer);error?reject(error):resolve(db);};
      const timer=setTimeout(()=>finish(new Error('capture_store_open_timeout')),timeoutMs);
      request.onupgradeneeded=()=>{
        const db=request.result;
        if(!db.objectStoreNames.contains('captures')) db.createObjectStore('captures',{keyPath:'key'}).createIndex('sessionId','sessionId',{unique:false});
      };
      request.onerror=()=>finish(request.error||new Error('capture_store_open_failed'));
      request.onblocked=()=>finish(new Error('capture_store_blocked'));
      request.onsuccess=()=>{
        const db=request.result;
        db.onversionchange=()=>{db.close();opening=null;};
        finish(null,db);
      };
    }).catch(error=>{opening=null;throw error;});
    return opening;
  }
  async function transaction(mode,operation) {
    const db=await open();
    return new Promise((resolve,reject)=>{
      let result;
      const tx=db.transaction(['captures'],mode,mode==='readwrite'?{durability:'strict'}:undefined);
      const timer=setTimeout(()=>{try{tx.abort();}catch{}reject(new Error('capture_store_transaction_timeout'));},timeoutMs);
      const fail=()=>{clearTimeout(timer);reject(tx.error||new Error('capture_store_transaction_aborted'));};
      tx.onabort=fail;
      tx.onerror=fail;
      tx.oncomplete=()=>{clearTimeout(timer);resolve(result);};
      try {
        const request=operation(tx.objectStore('captures'),value=>{result=value;});
        if(request) request.onsuccess=()=>{result=request.result;};
      } catch(error) {
        clearTimeout(timer);try{tx.abort();}catch{}reject(error);
      }
    });
  }
  return {
    async put(payload) {
      if(!payload?.sessionId||!payload?.captureId||!Number.isInteger(payload.questionIndex)||payload.questionIndex<1) throw new Error('capture_identity_invalid');
      const capture=Object.fromEntries(FIELDS.filter(field=>Object.hasOwn(payload,field)).map(field=>[field,payload[field]]));
      capture.queuedAt=payload.queuedAt||new Date().toISOString();
      const key=keyFor(payload.sessionId,payload.captureId);
      return transaction('readwrite',(store,receive)=>{
        const lookup=store.get(key);
        lookup.onsuccess=()=>{
          if(lookup.result?.acknowledgedAt) { receive({acknowledged:true}); return; }
          store.put({key,sessionId:payload.sessionId,payload:capture});
          receive(capture);
        };
      });
    },
    async list(sessionId=null) {
      const rows=await transaction('readonly',store=>sessionId==null?store.getAll():store.index('sessionId').getAll(sessionId));
      return rows.filter(row=>!row.acknowledgedAt).map(row=>row.payload).sort((a,b)=>a.questionIndex-b.questionIndex||String(a.queuedAt).localeCompare(String(b.queuedAt))||String(a.captureId).localeCompare(String(b.captureId)));
    },
    async acknowledge(sessionId,captureId) {
      if(!sessionId||!captureId) throw new Error('capture_identity_invalid');
      // Keep a minimal receipt, not the biography/audio. Old localStorage data
      // must not resurrect a capture after its remote acknowledgement.
      await transaction('readwrite',store=>store.put({key:keyFor(sessionId,captureId),sessionId,acknowledgedAt:new Date().toISOString()}));
    }
  };
}

// Stable across a crash after IndexedDB commits but before localStorage cleanup.
export async function legacyCaptureId(payload,crypto=globalThis.crypto) {
  if(!crypto?.subtle) throw new Error('legacy_capture_identity_unavailable');
  const digest=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(payload)))).slice(0,16);
  digest[6]=(digest[6]&15)|80;digest[8]=(digest[8]&63)|128;
  const hex=[...digest].map(byte=>byte.toString(16).padStart(2,'0')).join('');
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
}

// Only a persisted, capture-scoped receipt may remove the local source. For
// audio, compare the server's private-object readback against our original bytes.
export async function validateCaptureReceipt(result,payload,crypto=globalThis.crypto) {
  if(result?.session?.id!==payload.sessionId) throw new Error('answer_receipt_session_mismatch');
  if(result.ok!==true) throw new Error('answer_receipt_invalid');
  const followUp=result.needsFollowUp===true;
  if(result.saved!==true&&!followUp) return false;
  if(followUp&&(result.saved===true||result.question?.index!==payload.questionIndex
    ||result.question?.followUp!==true||!result.question?.text?.trim())) throw new Error('answer_receipt_followup_invalid');
  const answer=result.answer;
  const metadata=answer?.metadata;
  if(!answer?.id||answer.session_id!==payload.sessionId||answer.question_index!==payload.questionIndex
    ||metadata?.capture_id!==payload.captureId||metadata.transcription_final!==true
    ||metadata.answer_state!==(followUp?'follow_up_required':'complete')
    ||typeof answer.transcript!=='string'||!answer.transcript.trim()||/^\[Audio capturado:/i.test(answer.transcript.trim())
    ||!['browser','backend'].includes(answer.transcript_source)) throw new Error('answer_receipt_invalid');
  if(payload.transcriptSource==='browser'&&payload.transcriptionFinal===true&&answer.transcript_source==='browser') {
    const submitted=String(payload.transcript||'').trim();
    if(!submitted||(answer.transcript!==submitted
      &&!(payload.followUpAttempt===true&&answer.transcript.endsWith(`\n\n${submitted}`)))) throw new Error('answer_receipt_transcript_mismatch');
  }
  let bytes;
  if(payload.audioBlob) bytes=new Uint8Array(await payload.audioBlob.arrayBuffer());
  else if(payload.audioBase64) {
    try { bytes=Uint8Array.from(atob(payload.audioBase64),char=>char.charCodeAt(0)); }
    catch { throw new Error('answer_receipt_audio_source_invalid'); }
  }
  if(!bytes?.length) {
    if(payload.audioCaptured===true||Number(payload.audioByteLength)>0) throw new Error('answer_receipt_audio_source_missing');
    return true;
  }
  const prefix=`${payload.sessionId}/q${String(payload.questionIndex).padStart(2,'0')}-${payload.captureId}.`;
  if(metadata.audio_storage_verified!==true||metadata.audio_storage_status!=='stored_private'
    ||metadata.audio_bytes!==bytes.length||!answer.audio_storage_path?.startsWith(prefix)
    ||!crypto?.subtle||!/^[0-9a-f]{64}$/.test(metadata.audio_sha256||'')) throw new Error('answer_receipt_audio_archive_unconfirmed');
  const digest=new Uint8Array(await crypto.subtle.digest('SHA-256',bytes));
  const sha256=[...digest].map(byte=>byte.toString(16).padStart(2,'0')).join('');
  if(sha256!==metadata.audio_sha256) throw new Error('answer_receipt_audio_archive_mismatch');
  return true;
}
