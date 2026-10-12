const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const digest = async bytes => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)),
  byte => byte.toString(16).padStart(2, '0')).join('');

async function readBounded(response,maximum,signal) {
  if(!response.ok||!response.body)throw new Error('print_archive_unverified');
  const length=Number(response.headers.get('content-length'));
  if(length>maximum)throw new Error('print_archive_mismatch');
  const reader=response.body.getReader(),chunks=[];
  let size=0;
  const cancel=()=>{reader.cancel().catch(()=>{});};
  signal.addEventListener('abort',cancel,{once:true});
  if(signal.aborted)cancel();
  try {
    for(;;) {
      const {done,value}=await reader.read();if(done)break;
      size+=value.length;if(size>maximum)throw new Error('print_archive_mismatch');chunks.push(value);
    }
  }finally {signal.removeEventListener('abort',cancel);await reader.cancel().catch(()=>{});}
  if(signal.aborted)throw new Error('print_archive_timeout');
  const bytes=new Uint8Array(size);let offset=0;
  for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
  return bytes;
}

async function withDeadline(timeoutMs,task) {
  const controller=new AbortController();let timer;
  const deadline=new Promise((_,reject)=>{
    timer=setTimeout(()=>{controller.abort();reject(new Error('print_archive_timeout'));},timeoutMs);
  });
  try{return await Promise.race([task(controller.signal),deadline]);}
  finally{clearTimeout(timer);controller.abort();}
}

export function createPrintFileAccess({url,serviceKey,fetch:fetchImpl=globalThis.fetch,timeoutMs=20000}) {
  let origin;
  try{origin=new URL(url);}catch{throw new Error('print_storage_not_configured');}
  if(origin.protocol!=='https:'||origin.username||origin.password||origin.pathname!=='/'||
      origin.search||origin.hash||!serviceKey||!Number.isSafeInteger(timeoutMs)||timeoutMs<1)throw new Error('print_storage_not_configured');
  const auth={apikey:serviceKey,Authorization:`Bearer ${serviceKey}`};
  const pathPattern=new RegExp(`^${uuid.source.slice(1,-1)}/v[0-9]{2,}/${uuid.source.slice(1,-1)}/(?:interior|cover)\\.pdf$`,'i');
  const scope=path=>{if(typeof path!=='string'||!pathPattern.test(path))throw new Error('print_archive_scope');};
  return Object.freeze({
    async verifyFile({path,sha256,byteSize}) {
      scope(path);
      if(!/^[0-9a-f]{64}$/.test(sha256)||!Number.isSafeInteger(byteSize)||byteSize<8||byteSize>20_000_000)throw new Error('print_archive_size');
      return withDeadline(timeoutMs,async signal=>{
        const response=await fetchImpl(`${origin.origin}/storage/v1/object/future-book-pdfs/${path}`,{method:'GET',headers:auth,redirect:'error',signal});
        const bytes=await readBounded(response,byteSize,signal);
        if(bytes.length!==byteSize||await digest(bytes)!==sha256)throw new Error('print_archive_mismatch');
        return {path,sha256,byteSize,verified:true};
      });
    },
    async signFile(kind,path,expiresIn) {
      scope(path);
      if(!['interior','cover'].includes(kind)||!path.endsWith(`/${kind}.pdf`)||expiresIn!==3600)throw new Error('print_archive_scope');
      return withDeadline(timeoutMs,async signal=>{
        const response=await fetchImpl(`${origin.origin}/storage/v1/object/sign/future-book-pdfs/${path}`,{method:'POST',redirect:'error',signal,
          headers:{...auth,'Content-Type':'application/json'},body:JSON.stringify({expiresIn})});
        const bytes=await readBounded(response,16384,signal);
        let data,signed;
        try{data=JSON.parse(new TextDecoder().decode(bytes));
          const value=data.signedURL||data.signedUrl;
          if(typeof value!=='string'||/[\s\\]/.test(value))throw new Error();
          signed=new URL(value.startsWith('/')?`/storage/v1${value}`:value,origin.origin);
        }catch{throw new Error('print_signed_url_invalid');}
        if(signed.origin!==origin.origin||signed.username||signed.password||signed.hash||
            signed.pathname!==`/storage/v1/object/sign/future-book-pdfs/${path}`||!signed.searchParams.get('token'))throw new Error('print_signed_url_invalid');
        return signed.href;
      });
    }
  });
}

export function createPrintArchive({url, serviceKey, fetch: fetchImpl = globalThis.fetch, timeoutMs = 20000}) {
  if (!/^https:\/\//.test(url || '') || !serviceKey || !Number.isSafeInteger(timeoutMs) || timeoutMs < 1) {
    throw new Error('print_storage_not_configured');
  }
  return async ({sessionId, version, artifactId, files}) => {
    if (!uuid.test(sessionId) || !uuid.test(artifactId) || !Number.isSafeInteger(version) || version < 1) {
      throw new Error('print_archive_scope');
    }
    const receipts = {};
    for (const kind of ['interior', 'cover']) {
      const input = files[kind];
      if (!input?.bytes || input.bytes.length < 8 || input.bytes.length > 20_000_000) throw new Error('print_archive_size');
      const bytes = new Uint8Array(input.bytes);
      const hash = await digest(bytes);
      if (hash !== input.sha256) throw new Error('print_archive_source_mismatch');
      const path = `${sessionId}/v${String(version).padStart(2, '0')}/${artifactId}/${kind}.pdf`;
      const endpoint = `${url}/storage/v1/object/future-book-pdfs/${path}`;
      const auth = {apikey: serviceKey, Authorization: `Bearer ${serviceKey}`};
      const controller = new AbortController();
      let timer;
      const deadline = new Promise((_, reject) => {
        timer = setTimeout(() => { controller.abort(); reject(new Error('print_archive_timeout')); }, timeoutMs);
      });
      const task = async () => {
        const upload = await fetchImpl(endpoint, {method: 'POST', redirect: 'error', signal: controller.signal,
          headers: {...auth, 'Content-Type': 'application/pdf', 'x-upsert': 'false'}, body: bytes}).catch(() => null);
        if (upload && !upload.ok && ![400, 409, 408].includes(upload.status) && upload.status < 500) throw new Error('print_archive_rejected');
        // Acceptance or a duplicate response is never sufficient: verify the object itself.
        const read = await fetchImpl(endpoint, {method: 'GET', redirect: 'error', signal: controller.signal, headers: auth});
        const length = Number(read.headers.get('content-length'));
        if (length && length !== bytes.length) throw new Error('print_archive_mismatch');
        const remote = await readBounded(read, bytes.length, controller.signal);
        const size=remote.length;
        if(size!==bytes.length)throw new Error('print_archive_mismatch');
        if (await digest(remote) !== hash) throw new Error('print_archive_mismatch');
        return {path, sha256: hash, byteSize: size, verified: true, status: 'stored_private'};
      };
      try { receipts[kind] = await Promise.race([task(), deadline]); }
      finally { clearTimeout(timer); controller.abort(); }
    }
    return {...receipts, artifactId};
  };
}

// Internal worker access only. IDs/version are reserved in the private job row;
// callers must persist an expected receipt before write(). No public URLs.
export function createPrintStageArchive({url,serviceKey,fetch:fetchImpl=globalThis.fetch,timeoutMs=20000}) {
  let origin;
  try {origin=new URL(url);} catch {throw new Error('print_storage_not_configured');}
  if(origin.protocol!=='https:'||origin.username||origin.password||origin.pathname!=='/'||
      origin.search||origin.hash||!serviceKey||!Number.isSafeInteger(timeoutMs)||timeoutMs<1)throw new Error('print_storage_not_configured');
  const headers={apikey:serviceKey,Authorization:`Bearer ${serviceKey}`};
  const path=(job,key)=>{
    if(!uuid.test(job?.id)||!uuid.test(job?.session_id)||!Number.isSafeInteger(job.version)||job.version<1)throw new Error('print_archive_scope');
    let suffix;
    if(['interior','cover'].includes(key))suffix=`${key}.pdf`;
    else {
      const match=/^part:([1-9][0-9]*):([1-9][0-9]*)$/.exec(key);
      const first=Number(match?.[1]),last=Number(match?.[2]);
      if(!match||!Number.isSafeInteger(first)||!Number.isSafeInteger(last)||(first-1)%10||
          first>200||last>200||last<first||last>first+9||(last!==first+9&&(last<180||last%2)))throw new Error('print_archive_scope');
      suffix=`parts/${first}-${last}.pdf`;
    }
    return `${job.session_id}/v${String(job.version).padStart(2,'0')}/${job.id}/${suffix}`;
  };
  const expected=(job,key,receipt)=>{
    const reserved=path(job,key);
    if(receipt?.path!==reserved)throw new Error('print_archive_scope');
    if(!/^[a-f0-9]{64}$/.test(receipt.sha256)||!Number.isSafeInteger(receipt.byteSize)||
        receipt.byteSize<8||receipt.byteSize>20_000_000)throw new Error('print_archive_size');
    return {path:reserved,sha256:receipt.sha256,byteSize:receipt.byteSize};
  };
  const read=async(receipt,signal)=>{
    try {
      const response=await fetchImpl(`${origin.origin}/storage/v1/object/future-book-pdfs/${receipt.path}`,
        {method:'GET',headers,redirect:'error',signal});
      if(response.status===404){await response.body?.cancel();return null;}
      // Hosted Storage may wrap its object-not-found status in HTTP 400.
      // Inspect only a small, deadline-bound error body. Other 400s, missing
      // buckets, auth failures and ambiguous responses never permit a write.
      if(response.status===400){
        const errorBytes=await readBounded({ok:true,body:response.body,headers:response.headers},4096,signal);
        let error;
        try{error=JSON.parse(new TextDecoder().decode(errorBytes));}
        catch{throw new Error('print_archive_unverified');}
        const codes=[error?.code,error?.error].filter(value=>value!==undefined);
        if(String(error?.statusCode)==='404'&&error?.message==='Object not found'&&codes.length>0&&
            codes.every(code=>['not_found','NoSuchKey'].includes(code)))return null;
        throw new Error('print_archive_unverified');
      }
      const bytes=await readBounded(response,receipt.byteSize,signal);
      if(bytes.length!==receipt.byteSize||await digest(bytes)!==receipt.sha256)throw new Error('print_archive_mismatch');
      return {...receipt,bytes,verified:true};
    }catch(error){
      if(/^print_archive_[a-z_]+$/.test(error?.message||''))throw error;
      throw new Error(signal.aborted?'print_archive_timeout':'print_archive_unverified');
    }
  };
  return Object.freeze({path,
    async read(job,key,receipt){
      const record=expected(job,key,receipt);
      return withDeadline(timeoutMs,signal=>read(record,signal));
    },
    async write(job,key,file){
      const reserved=path(job,key);
      if(!(file?.bytes instanceof Uint8Array)||file.bytes.length<8||file.bytes.length>20_000_000||
          file.byteSize!==file.bytes.length)throw new Error('print_archive_size');
      const bytes=new Uint8Array(file.bytes),sha256=await digest(bytes);
      if(sha256!==file.sha256)throw new Error('print_archive_source_mismatch');
      const receipt=expected(job,key,{path:reserved,sha256,byteSize:bytes.length});
      return withDeadline(timeoutMs,async signal=>{
        const existing=await read(receipt,signal);
        if(existing)return {...receipt,verified:true};
        const response=await fetchImpl(`${origin.origin}/storage/v1/object/future-book-pdfs/${reserved}`,
          {method:'POST',redirect:'error',signal,headers:{...headers,'Content-Type':'application/pdf','x-upsert':'false'},body:bytes}).catch(()=>null);
        if(response){await response.body?.cancel();
          if(!response.ok&&![400,408,409].includes(response.status)&&response.status<500)throw new Error('print_archive_rejected');}
        // Lost acceptance never authorizes another POST. Read the same reserved
        // object; a later claim can recover it without rendering or writing.
        if(!await read(receipt,signal))throw new Error('print_archive_unverified');
        return {...receipt,verified:true};
      });
    }
  });
}
