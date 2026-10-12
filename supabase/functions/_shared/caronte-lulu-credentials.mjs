const kind='lulu-oauth-v1';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const fail=code=>{throw new Error(code);};
function pair(value){
  if(!['sandbox','production'].includes(value?.environment))fail('lulu_oauth_input_invalid');
  for(const key of ['clientKey','clientSecret'])if(typeof value[key]!=='string'||
    !/^[\x21-\x7e]{1,2048}$/.test(value[key]))fail('lulu_oauth_input_invalid');
  return{environment:value.environment,clientKey:value.clientKey,clientSecret:value.clientSecret};
}
const actorLabel=actor=>{
  if(typeof actor?.label!=='string'||!actor.label.trim()||actor.label.length>254||/[\u0000-\u001f]/.test(actor.label))fail('lulu_oauth_actor_invalid');
  return actor.label;
};

/** Private atomic OAuth pair. All returned public status objects are allowlisted. */
export function createLuluCredentialStore({env,read,persist,encrypt,decrypt,fingerprint,authenticate,now=()=>new Date()}){
  if([env,read,persist,encrypt,decrypt,fingerprint,authenticate,now].some(fn=>typeof fn!=='function'))fail('lulu_oauth_store_invalid');
  const stamp=()=>now().toISOString();
  const unavailable=(source,row=null,environment='')=>({configured:false,source,environment,setting:row,configurationTag:null});
  async function readSetting(){try{return await read();}catch{fail('lulu_oauth_storage_unavailable');}}
  async function resolve(row){
    const fromEnv={environment:env('LULU_ENVIRONMENT')||'',clientKey:env('LULU_CLIENT_KEY')||'',clientSecret:env('LULU_CLIENT_SECRET')||''};
    let selected;
    if(Object.values(fromEnv).some(Boolean)){
      try{selected={...pair(fromEnv),configured:true,source:'env_oauth_pair',setting:row||null};}
      catch{return unavailable('env_oauth_incomplete',row||null,fromEnv.environment);}
    }else{
      row=row===undefined?await readSetting():row;
      if(!row)return unavailable('missing');
      if(row.configured!==true||row.metadata?.credential_kind!==kind)return unavailable('legacy_unusable',row);
      try{
        const decoded=JSON.parse(await decrypt(row.secret_ciphertext,row.secret_nonce));
        if(decoded.kind!==kind||!uuid.test(decoded.configurationId)||decoded.configurationId!==row.metadata.configuration_id
          ||decoded.environment!==row.metadata.environment)throw new Error();
        selected={...pair(decoded),configured:true,source:'encrypted_oauth_pair',setting:row,configurationId:decoded.configurationId};
      }catch{return unavailable('encrypted_pair_unavailable',row);}
    }
    try{selected.configurationTag=await fingerprint(JSON.stringify({kind,...pair(selected)}));}
    catch{fail('lulu_oauth_identity_unavailable');}
    if(!/^[0-9a-f]{64}$/.test(selected.configurationTag))fail('lulu_oauth_identity_unavailable');
    return selected;
  }
  function publicStatus(credentials,row=credentials.setting){
    const m=row?.metadata||{},tested=credentials.configured&&m.last_test_configuration===credentials.configurationTag&&
      ['configured','failed'].includes(m.last_test_status)&&Number.isFinite(Date.parse(row?.tested_at))&&Date.parse(row.tested_at)<=now().getTime();
    return{provider:'lulu',displayName:'Lulu print API / OAuth',required:false,configured:credentials.configured,
      status:credentials.configured?'configured':'not_configured',source:credentials.source,
      environment:credentials.environment,managedByEnvironment:credentials.source.startsWith('env_'),
      configurationId:credentials.configurationId||null,updatedAt:row?.updated_at||null,secretLast4:null,
      testedAt:tested?row.tested_at:null,testStatus:tested?m.last_test_status:null,
      testDetail:tested?(m.last_test_status==='configured'?`lulu_oauth_ok:${credentials.environment}`:'lulu_oauth_failed'):null,
      voiceId:null,voiceName:null};
  }
  async function status(){const row=await readSetting();return publicStatus(await resolve(row),row);}
  async function commit(before,patch){
    let saved;try{saved=await persist(before,patch);}catch{fail('lulu_oauth_persistence_unverified');}
    if(!saved)fail('lulu_oauth_persistence_unverified');
    const confirmed=await readSetting();
    if(!confirmed||confirmed.updated_at!==saved.updated_at||Object.entries(patch).some(([key,value])=>
      key==='metadata'?Object.entries(value).some(([field,entry])=>JSON.stringify(confirmed.metadata?.[field])!==JSON.stringify(entry)):
      // PostgREST emits timestamptz with +00:00; our ISO clock emits Z.
      // Compare the instant, without accepting a missing or changed timestamp.
      key==='tested_at'&&typeof value==='string'?!Number.isFinite(Date.parse(value))||Date.parse(confirmed[key])!==Date.parse(value):
      confirmed[key]!==value))fail('lulu_oauth_persistence_unverified');
    return confirmed;
  }
  async function save(input,actor){
    const value=pair(input),by=actorLabel(actor);
    if(input.saveConsent!==true||!uuid.test(input.configurationId)||!(input.expectedRevision===null||typeof input.expectedRevision==='string'&&input.expectedRevision.length<=128))fail('lulu_oauth_input_invalid');
    if((await resolve(null)).source.startsWith('env_'))fail('lulu_oauth_managed_by_environment');
    const before=await readSetting();
    if((before?.updated_at||null)!==input.expectedRevision)fail('lulu_oauth_configuration_changed');
    const encoded={kind,configurationId:input.configurationId,...value};let protectedValue;
    try{protectedValue=await encrypt(JSON.stringify(encoded));}catch{fail('lulu_oauth_encryption_required');}
    if(!protectedValue?.ciphertext||!protectedValue.nonce)fail('lulu_oauth_encryption_required');
    const confirmed=await commit(before,{provider:'lulu',display_name:'Lulu print API / OAuth',required:false,configured:true,status:'configured',
      secret_ciphertext:protectedValue.ciphertext,secret_nonce:protectedValue.nonce,secret_last4:null,tested_at:null,updated_by:by,
      metadata:{credential_kind:kind,configuration_id:input.configurationId,environment:value.environment,
        saved_from:'future_book_admin',rotated_at:stamp()}});
    const resolved=await resolve(confirmed);
    if(!resolved.configured||resolved.configurationId!==input.configurationId||resolved.clientKey!==value.clientKey||resolved.clientSecret!==value.clientSecret)fail('lulu_oauth_persistence_unverified');
    return publicStatus(resolved,confirmed);
  }
  async function probe(actor){
    const by=actorLabel(actor),before=await readSetting(),credentials=await resolve(before);
    if(!credentials.configured)fail('lulu_oauth_pair_required');
    let ok=false;try{await authenticate(credentials);ok=true;}catch{}
    const current=await readSetting(),currentCredentials=await resolve(current);
    if(current?.updated_at!==before?.updated_at||currentCredentials.configurationTag!==credentials.configurationTag)fail('lulu_oauth_configuration_changed');
    const confirmed=await commit(before,{provider:'lulu',display_name:'Lulu print API / OAuth',required:false,configured:true,
      status:ok?'configured':'failed',tested_at:stamp(),metadata:{...(before?.metadata||{}),last_test_configuration:credentials.configurationTag,
        last_test_status:ok?'configured':'failed',tested_from:'future_book_admin',tested_by:by}});
    return{...publicStatus(await resolve(confirmed),confirmed),liveProbeOk:ok,persistenceVerified:true};
  }
  return Object.freeze({resolve,status,save,probe});
}
