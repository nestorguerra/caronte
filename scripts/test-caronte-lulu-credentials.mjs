import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createLuluCredentialStore} from '../supabase/functions/_shared/caronte-lulu-credentials.mjs';

const key='synthetic-client-key',secret='synthetic-client-secret';
const id='36bb9d23-c851-47d4-aef3-0883b1fc85cc';
const input={environment:'sandbox',clientKey:key,clientSecret:secret,configurationId:id,expectedRevision:null,saveConsent:true};
function fixture({env={},row=null,loseReadback=false,conflict=false,authFailure=false,rotateDuringProbe=false,storedTestTime}={}){
  let current=structuredClone(row),writes=0,probes=0,revision=0,loseAfterNextWrite=false;const encrypted=new Map();
  const encrypt=async value=>{const ciphertext=`synthetic-cipher-${++revision}`,nonce='synthetic-nonce';encrypted.set(ciphertext,value);return{ciphertext,nonce};};
  const decrypt=async(ciphertext)=>{if(!encrypted.has(ciphertext))throw new Error(secret);return encrypted.get(ciphertext);};
  const store=createLuluCredentialStore({env:name=>env[name]||'',read:async()=>loseReadback&&writes?null:structuredClone(current),
    persist:async(before,patch)=>{writes++;if(conflict)return null;assert.equal(before?.updated_at||null,current?.updated_at||null);
      current={...(current||{}),...structuredClone(patch),updated_at:`revision-${writes}`};
      if(storedTestTime&&typeof current.tested_at==='string')current.tested_at=storedTestTime(current.tested_at);
      if(loseAfterNextWrite)loseReadback=true;return structuredClone(current);},
    encrypt,decrypt,fingerprint:async text=>text.includes(secret)?'a'.repeat(64):'b'.repeat(64),
    authenticate:async credentials=>{probes++;assert.equal(credentials.clientKey,key);if(authFailure)throw new Error(secret);
      if(rotateDuringProbe)current.updated_at='concurrent-rotation';},now:()=>new Date('2026-10-12T12:00:00Z')});
  return{store,row:()=>current,writes:()=>writes,probes:()=>probes,loseNextConfirmation:()=>{loseAfterNextWrite=true;}};
}
test('saving one atomic encrypted pair is write-only, reread, and does not authenticate or create orders',async()=>{
  const app=fixture(),result=await app.store.save(input,{label:'owner'});
  assert.equal(result.configured,true);assert.equal(result.configurationId,id);assert.equal(result.source,'encrypted_oauth_pair');
  assert.equal(result.testedAt,null);assert.equal(app.probes(),0);assert.equal(app.writes(),1);
  assert.doesNotMatch(JSON.stringify(app.row()),/synthetic-client-key|synthetic-client-secret/);
  assert.doesNotMatch(JSON.stringify(result),/clientKey|clientSecret|ciphertext|nonce|configurationTag/);
  const resolved=await app.store.resolve();assert.equal(resolved.clientKey,key);assert.equal(resolved.clientSecret,secret);
  assert.equal(resolved.environment,'sandbox');assert.equal(resolved.configurationTag,'a'.repeat(64));
});
test('invalid consent, environment, UUID, opaque values or revisions have no persistence/provider effects',async()=>{
  for(const change of [{saveConsent:false},{environment:'automatic'},{configurationId:'no-uuid'},
    {clientKey:''},{clientSecret:' x '},{clientSecret:'x'.repeat(4097)},{clientSecret:123},
    {clientSecret:'secret\nline'},{expectedRevision:undefined}]){
    const app=fixture();await assert.rejects(app.store.save({...input,...change},{label:'owner'}),/lulu_oauth_/);
    assert.equal(app.writes(),0);assert.equal(app.probes(),0);
  }
});
test('a complete environment pair takes precedence; incomplete environment never mixes with the encrypted pair',async()=>{
  for(const complete of [false,true]){
    const env={LULU_ENVIRONMENT:'production',LULU_CLIENT_KEY:key,...complete?{LULU_CLIENT_SECRET:secret}:{}};
    const app=fixture({env});const result=await app.store.resolve();assert.equal(result.configured,complete);
    assert.equal(result.source,complete?'env_oauth_pair':'env_oauth_incomplete');
    await assert.rejects(app.store.save(input,{label:'owner'}),/lulu_oauth_managed_by_environment/);
    assert.equal(app.writes(),0);
  }
});
test('a legacy single-key row or failed decryption cannot become a configured OAuth pair',async()=>{
  for(const row of [{provider:'lulu',configured:true,secret_ciphertext:'legacy-key',secret_nonce:'nonce',metadata:{}},
    {provider:'lulu',configured:true,secret_ciphertext:'broken',secret_nonce:'nonce',metadata:{credential_kind:'lulu-oauth-v1',configuration_id:id}}]){
    const app=fixture({row});assert.equal((await app.store.resolve()).configured,false);
    assert.equal((await app.store.status()).testStatus,null);
  }
});
test('CAS conflicts and lost database confirmation never announce a saved pair',async()=>{
  for(const options of [{conflict:true},{loseReadback:true}]){
    const app=fixture(options);await assert.rejects(app.store.save(input,{label:'owner'}),/lulu_oauth_persistence_unverified/);
    assert.equal(app.writes(),1);assert.equal(app.probes(),0);
  }
});
test('a stale panel revision cannot overwrite a newer pair',async()=>{
  const app=fixture();await app.store.save(input,{label:'owner'});
  await assert.rejects(app.store.save({...input,configurationId:'592f91eb-2d82-4cc1-a2ee-d23ddf43b974'},{label:'owner'}),/lulu_oauth_configuration_changed/);
  assert.equal(app.writes(),1);
});
test('explicit OAuth probes preserve encrypted credentials and distinguish failed authentication from storage',async()=>{
  for(const authFailure of [false,true]){
    const app=fixture({authFailure});await app.store.save(input,{label:'owner'});const before=app.row().secret_ciphertext;
    const probe=await app.store.probe({label:'ops'});assert.equal(probe.liveProbeOk,!authFailure);
    const result=await app.store.status();assert.equal(result.testStatus,authFailure?'failed':'configured');
    assert.equal(result.configured,true);assert.equal(app.row().secret_ciphertext,before);assert.equal(app.probes(),1);
    assert.doesNotMatch(JSON.stringify({probe,result,row:app.row()}),/synthetic-client-secret|synthetic-client-key/);
  }
});
test('rotation cannot attach a successful test to an unverified configuration',async()=>{
  const app=fixture({rotateDuringProbe:true});await app.store.save(input,{label:'owner'});
  await assert.rejects(app.store.probe({label:'ops'}),/lulu_oauth_configuration_changed/);
  assert.equal((await app.store.status()).testStatus,null);assert.equal(app.writes(),1);
});
test('a successful OAuth response with lost persistence confirmation is not reported as a verified probe',async()=>{
  const app=fixture();await app.store.save(input,{label:'owner'});app.loseNextConfirmation();
  await assert.rejects(app.store.probe({label:'ops'}),/lulu_oauth_persistence_unverified/);
  assert.equal(app.probes(),1);assert.equal(app.writes(),2);
});
test('PostgreSQL timestamptz formatting preserves the exact OAuth test instant',async()=>{
  const app=fixture({storedTestTime:value=>value.replace(/Z$/,'+00:00')});
  await app.store.save(input,{label:'owner'});
  const result=await app.store.probe({label:'ops'});
  assert.equal(result.liveProbeOk,true);assert.equal(result.persistenceVerified,true);
  assert.equal(result.testedAt,'2026-10-12T12:00:00.000+00:00');
});
test('a different persisted OAuth test instant still rejects confirmation',async()=>{
  const app=fixture({storedTestTime:value=>new Date(Date.parse(value)+1).toISOString()});
  await app.store.save(input,{label:'owner'});
  await assert.rejects(app.store.probe({label:'ops'}),/lulu_oauth_persistence_unverified/);
});
