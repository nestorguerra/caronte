import assert from 'node:assert/strict';
import {test} from 'node:test';
import {webcrypto} from 'node:crypto';
import {createCaptureStore, legacyCaptureId} from '../src/scripts/caronte-capture-store.js';

// The actual repository code runs against a transactional in-memory IndexedDB
// boundary here. The separate localhost fixture verifies native IndexedDB.
function database({quota=false,blocked=false,holdCommit=false}={}) {
  const rows=new Map(); const commits=[]; let created=false;
  const db={objectStoreNames:{contains:()=>created},close(){},
    createObjectStore(){created=true;return {createIndex(){}};},
    transaction(){
      const staged=new Map(rows); const tx={error:null,abort(){this.error=new Error('AbortError'); this.onabort?.();}};
      let pending=0;
      const operation=callback=>{
        const request={}; pending++;
        queueMicrotask(()=>{
          if(quota){tx.error=new Error('QuotaExceededError');tx.onabort?.();return;}
          request.result=callback(); request.onsuccess?.(); pending--;
          setImmediate(()=>{if(pending) return; const commit=()=>{rows.clear();for(const [key,value] of staged) rows.set(key,value);tx.oncomplete?.();};if(holdCommit) commits.push(commit);else commit();});
        });
        return request;
      };
      tx.objectStore=()=>({
        put:row=>operation(()=>{staged.set(row.key,structuredClone(row));return row.key;}),
        delete:key=>operation(()=>staged.delete(key)),
        get:key=>operation(()=>structuredClone(staged.get(key))),
        getAll:()=>operation(()=>[...staged.values()].map(row=>structuredClone(row))),
        index:()=>({getAll:sessionId=>operation(()=>[...staged.values()].filter(row=>row.sessionId===sessionId).map(row=>structuredClone(row)))})
      });
      return tx;
    }
  };
  return {rows,commits,indexedDB:{open(){const request={};queueMicrotask(()=>{if(blocked){request.onblocked?.();return;}request.result=db;if(!created)request.onupgradeneeded?.();request.onsuccess?.();});return request;}}};
}
const entry=(captureId='capture-1',sessionId='session-1',questionIndex=1)=>({captureId,sessionId,questionIndex,transcript:'Respuesta completa',audioBlob:new Blob(['audio-real-boundary'],{type:'audio/webm'})});

test('committed audio and full text survive reopening the capture store',async()=>{
  const boundary=database(); const store=createCaptureStore({indexedDB:boundary.indexedDB});
  await store.put(entry());
  const reopened=createCaptureStore({indexedDB:boundary.indexedDB});
  const [saved]=await reopened.list('session-1');
  assert.equal(saved.transcript,'Respuesta completa');
  assert.equal(await saved.audioBlob.text(),'audio-real-boundary');
});

test('request success is not reported as saved before the transaction commits',async()=>{
  const boundary=database({holdCommit:true}); const store=createCaptureStore({indexedDB:boundary.indexedDB});
  let saved=false; const saving=store.put(entry()).then(()=>{saved=true;});
  await new Promise(resolve=>setImmediate(resolve)); await new Promise(resolve=>setImmediate(resolve));
  assert.equal(saved,false); assert.equal(boundary.rows.size,0);
  boundary.commits.shift()(); await saving; assert.equal(saved,true);
});

test('captures from other sessions and other attempts of the same question are retained',async()=>{
  const store=createCaptureStore({indexedDB:database().indexedDB});
  await store.put(entry('first','session-1')); await store.put(entry('second','session-1')); await store.put(entry('third','session-2'));
  assert.equal((await store.list('session-1')).length,2);
  assert.equal((await store.list('session-2')).length,1);
});

test('acknowledgement removes only the exact session and capture',async()=>{
  const store=createCaptureStore({indexedDB:database().indexedDB});
  await store.put(entry('first','session-1')); await store.put(entry('second','session-1')); await store.put(entry('first','session-2'));
  await store.acknowledge('session-1','first');
  assert.deepEqual((await store.list('session-1')).map(row=>row.captureId),['second']);
  assert.equal((await store.list('session-2')).length,1);
});

test('all twenty-one full answers remain available without clipping',async()=>{
  const store=createCaptureStore({indexedDB:database().indexedDB});
  for(let index=1;index<=21;index++) await store.put(entry(`capture-${index}`,'session-1',index));
  assert.equal((await store.list('session-1')).length,21);
});

test('quota abort and unavailable IndexedDB cannot produce a durable acknowledgement',async()=>{
  const store=createCaptureStore({indexedDB:database({quota:true}).indexedDB});
  await assert.rejects(store.put(entry()),/QuotaExceeded/);
  await assert.rejects(createCaptureStore({indexedDB:null}).put(entry()),/capture_store_unavailable/);
});

test('a blocked database open is surfaced instead of waiting forever',async()=>{
  const store=createCaptureStore({indexedDB:database({blocked:true}).indexedDB});
  await assert.rejects(store.list('session-1'),/capture_store_blocked/);
});

test('incomplete or unscoped captures are rejected, not mixed into an active session',async()=>{
  const store=createCaptureStore({indexedDB:database().indexedDB});
  for(const invalid of [{...entry(),sessionId:''},{...entry(),captureId:''},{...entry(),questionIndex:0}]) {
    await assert.rejects(store.put(invalid),/capture_identity_invalid/);
  }
});

test('legacy identifiers are stable UUIDs across failed migration attempts',async()=>{
  const legacy={sessionId:'session-1',questionIndex:1,transcript:'Respuesta heredada',audioBase64:'AQID'};
  const first=await legacyCaptureId(legacy,webcrypto);
  assert.match(first,/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  assert.equal(await legacyCaptureId(legacy,webcrypto),first);
  assert.notEqual(await legacyCaptureId({...legacy,transcript:'Otra'},webcrypto),first);
});

test('acknowledged captures cannot be requeued by an interrupted legacy migration',async()=>{
  const boundary=database(); const store=createCaptureStore({indexedDB:boundary.indexedDB});
  await store.put(entry()); await store.acknowledge('session-1','capture-1');
  await store.put(entry());
  assert.equal((await store.list('session-1')).length,0);
  assert.ok([...boundary.rows.values()].every(row=>!row.payload?.audioBlob));
});
