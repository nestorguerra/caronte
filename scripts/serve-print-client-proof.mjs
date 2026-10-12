// Private browser boundary. Original HTML/CSS/client modules, synthetic API only.
// Never part of src/dist. No real audio, provider, manuscript, order or payment.
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';

const sourceRoot=new URL('../src/',import.meta.url);
const sid='11111111-1111-4111-8111-111111111111',jid='22222222-2222-4222-8222-222222222222';
const session={id:sid,publicToken:'synthetic-local-session',status:'book_ready',bookStatus:'ready',mode:'backend'};
const manuscript={id:'33333333-3333-4333-8333-333333333333',title:'Prueba local de progreso · no es un libro del cliente',
 manuscript:{title:'Prueba local de progreso',sections:Array.from({length:5},(_,i)=>({title:`Capítulo sintético ${i+1}`,kind:'chapter',paragraphs:['Solo verifica la interfaz.']}))}};
let job=null,pdf=null,polls=0;const calls=[];
const server=createServer(async(req,res)=>{
 try{
  const url=new URL(req.url,'http://localhost'),path=url.pathname;
  res.setHeader('Cache-Control','no-store');
  if(path==='/functions/v1/future-book-session'&&req.method==='POST'){
   const chunks=[];let size=0;
   for await(const chunk of req){size+=chunk.length;if(size>8192)throw Error('proof_request_size');chunks.push(chunk);}
   const input=JSON.parse(Buffer.concat(chunks).toString());
   if(input.sessionId!==sid||input.publicToken!==session.publicToken)throw Error('proof_session_scope');
   calls.push(input.action);let result;
   if(input.action==='getBookStatus')result={ok:true,session,manuscript,job:null};
   else if(input.action==='generatePdf'){
    if(!job){job={id:jid,status:'queued',stage:'plan',progress:0};session.status='pdf_generating';}
    result={ok:true,session,job,pdf};
   }else if(input.action==='getPdfStatus'){
    if(job?.status==='queued'){
     polls++;job.stage=polls===1?'part':'interior';job.progress=polls===1?70:95;
     if(polls>=3){job.status='ready';job.progress=100;session.status='pending_review';
      pdf={id:'44444444-4444-4444-8444-444444444444',sessionId:sid,reviewStatus:'pending_review',pageCount:194,
       storagePath:`${sid}/v01/${jid}/interior.pdf`,luluMetadata:{ready_for_print:false}};}
    }
    result={ok:true,session,job,pdf};
   }else if(input.action==='recordInterviewHeartbeat')result={ok:true,session};
   else throw Error('proof_action_not_allowed');
   res.setHeader('Content-Type','application/json');res.end(JSON.stringify(result));return;
  }
  if(path==='/proof-observations'){
   res.setHeader('Content-Type','application/json');res.end(JSON.stringify({calls,jobStatus:job?.status||null,polls,
    generationRequests:calls.filter(x=>x==='generatePdf').length,readyForPrint:false}));return;
  }
  if(path==='/config/env.js'){
   const origin=`http://127.0.0.1:${server.address().port}`;
   res.setHeader('Content-Type','text/javascript');res.end(`window.LicitiaEnv=${JSON.stringify({appEnv:'production',supabaseUrl:origin,
    supabaseAnonKey:'synthetic-local-anon',functionsBaseUrl:`${origin}/functions/v1`})};
sessionStorage.setItem('future_book_minimal_console_v8','1');
if(!sessionStorage.getItem('future_book_sprint3_session'))sessionStorage.setItem('future_book_sprint3_session',${JSON.stringify(JSON.stringify(session))});`);return;
  }
  if(path==='/tiresias.html'){
   const html=await readFile(new URL('tiresias.html',sourceRoot),'utf8');
   res.setHeader('Content-Type','text/html');res.end(html.replace(/<title>.*?<\/title>/,'<title>Caronte · prueba local sin proveedores</title>'));return;
  }
  if(/^\/(scripts|styles)\/[a-z0-9-]+\.(js|css)$/.test(path)){
   res.setHeader('Content-Type',path.endsWith('.css')?'text/css':'text/javascript');
   res.end(await readFile(new URL(path.slice(1),sourceRoot)));return;
  }
  if(path==='/favicon.ico'){res.statusCode=204;res.end();return;}
  res.statusCode=404;res.end('proof_route_not_found');
 }catch{res.statusCode=400;res.setHeader('Content-Type','application/json');res.end('{"error":"proof_boundary_rejected"}');}
});
server.listen(0,'127.0.0.1',()=>console.log(`Print client proof: http://127.0.0.1:${server.address().port}/tiresias.html`));
