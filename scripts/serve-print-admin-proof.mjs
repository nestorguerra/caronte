// Private browser fixture. Never included in src/dist or connected to a provider.
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';

const sourceRoot=new URL('../src/',import.meta.url);
const fakePdf=()=>({id:'948bc512-eaf8-4f2c-8ae8-c302561ca8d4',fileName:'prueba-local-interior-v01.pdf',
  reviewStatus:'approved',pageCount:194,metadata:{template:'caronte-a5-embedded-v2',storage_verified:true},
  printValidation:{editorial_approval:{reviewer:'prueba-local'},ready_for_print:false,
    preflight:{status:'pending',interior:{state:'pending',validation_id:7}}},
  luluMetadata:{ready_for_print:false,ready_for_print_status:'pending',send_to_lulu:false}});
const examples={normal:fakePdf(),uncertain:fakePdf(),quote:fakePdf()};
examples.oauth= fakePdf();examples.oauth_unconfirmed=fakePdf();
const oauthProviders={};
for(const scenario of ['oauth','oauth_unconfirmed'])oauthProviders[scenario]={provider:'lulu',displayName:'Lulu / prueba local sin conexión',
  configured:false,status:'not_configured',source:'missing',managedByEnvironment:false,updatedAt:null,configurationId:null};
examples.uncertain.printValidation.preflight={status:'uncertain',interior:{state:'uncertain'}};
examples.quote.printValidation={editorial_approval:{reviewer:'prueba-local'},ready_for_print:true,
  preflight:{status:'ready',interior:{state:'normalized'},cover:{state:'normalized'}}};
examples.quote.luluMetadata={ready_for_print:true,ready_for_print_status:'ready_for_print',send_to_lulu:false};
examples.order_uncertain=structuredClone(examples.quote);examples.order_uncertain.printOrder={hasIntent:true,canRequote:false};
let syntheticQuotation={id:null,status:'not_quoted',costs:null,orderCreated:false,paymentCreated:false};
const syntheticCosts={currency:'EUR',printing:{incl_tax:'10.40'},shipping_handling:{incl_tax:'6.05'},fulfillment:{incl_tax:'0.91'},
  discount:'0.00',tax:'1.61',total_incl_tax:'17.36'};
const syntheticOrder=()=>({pdfId:examples.quote.id,state:'not_approved',canSubmit:false,canPay:false,canSync:false,canReconcile:false,
  submissionEnabled:true,paymentStatus:'unknown',delivered:false,environment:'sandbox',quantity:1,shippingLevel:'MAIL',costs:syntheticCosts});
const orders={quote:syntheticOrder(),order_uncertain:{...syntheticOrder(),id:'synthetic-intent',quoteId:'synthetic-quote',state:'uncertain',canReconcile:true}};
let syntheticSyncs=0;
const calls=[];
const printJobs={};
for(const scenario of ['print_queue','print_cancel','print_unknown']){
 examples[scenario]=fakePdf();
 printJobs[scenario]={ok:true,job:{id:'22222222-2222-4222-8222-222222222222',session_id:'11111111-1111-4111-8111-111111111111',
  version:1,status:'blocked',stage:'part',error_code:'print_archive_timeout',updated_at:'2026-10-12T00:00:00.000Z'},
  canResume:true,canCancel:true,lastControl:null,steps:[{step_key:'plan:0:12',status:'completed',attempt:1,output_hash:'a'.repeat(64)},
   {step_key:'part:1:10',status:'failed',attempt:3,error_code:'print_archive_timeout'}]};
}
const prefix=`const hasBackendConfig=()=>true;
const getStoredUser=()=>({email:'prueba-local@example.test'});
const clearSession=()=>{};const signIn=async()=>{};const signOut=async()=>{};
const callFunction=async(name,payload)=>{
  const response=await fetch('/proof-api',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...payload,scenario:new URLSearchParams(location.search).get('scenario')||'normal'})});
  const data=await response.json();if(!response.ok)throw new Error('proof_boundary_rejected');return data;
};\n`;
const server=createServer(async(req,res)=>{
  try{
    const path=new URL(req.url,'http://localhost').pathname;
    res.setHeader('Cache-Control','no-store');
    if(path==='/proof-api'&&req.method==='POST'){
      const chunks=[];let length=0;
      for await(const chunk of req){length+=chunk.length;if(length>8192)throw new Error('proof_request_size');chunks.push(chunk);}
      const payload=JSON.parse(Buffer.concat(chunks).toString());
      const pdf=examples[payload.scenario];if(!pdf)throw new Error('proof_scenario');
      calls.push({action:payload.action,scenario:payload.scenario});
      let data;
      if(payload.action==='adminDashboard')data={ok:true,admin:{role:oauthProviders[payload.scenario]?'owner':orders[payload.scenario]||printJobs[payload.scenario]?'ops':'editor',label:'Prueba local'},metrics:{},sessions:[],bookJobs:[],
        printJobs:printJobs[payload.scenario]?{available:true,items:[printJobs[payload.scenario].job],hasMore:false,nextOffset:null}:{available:false,items:null},
        pdfs:[pdf],providers:[oauthProviders[payload.scenario]||{provider:'lulu',displayName:'Lulu / prueba local sin conexión',configured:false,status:'not_configured'}]};
      else if(payload.action==='adminPrintJob'&&printJobs[payload.scenario]&&payload.jobId===printJobs[payload.scenario].job.id)data=printJobs[payload.scenario];
      else if(['adminResumePrint','adminCancelPrint'].includes(payload.action)&&printJobs[payload.scenario]&&
        payload.jobId===printJobs[payload.scenario].job.id&&payload.expectedRevision===printJobs[payload.scenario].job.updated_at&&payload.reason?.length>=8){
        const detail=printJobs[payload.scenario];
        if(payload.scenario!=='print_unknown'){
          detail.job={...detail.job,status:payload.action==='adminResumePrint'?'queued':'cancelled',error_code:null,updated_at:'2026-10-12T00:01:00.000Z'};
          detail.lastControl={action:payload.action==='adminResumePrint'?'resume':'cancel',previousRevision:payload.expectedRevision,at:detail.job.updated_at};
          detail.canResume=false;detail.canCancel=false;
          if(payload.action==='adminResumePrint')detail.steps=detail.steps.map(step=>step.status==='failed'?{...step,status:'started',attempt:0,error_code:null}:step);
        }
        data={ok:true};
      }
      else if(payload.action==='adminSaveLuluCredentials'&&oauthProviders[payload.scenario]&&payload.saveConsent===true&&
        ['sandbox','production'].includes(payload.environment)&&payload.expectedRevision===oauthProviders[payload.scenario].updatedAt&&
        /^[0-9a-f-]{36}$/i.test(payload.configurationId)&&typeof payload.clientKey==='string'&&typeof payload.clientSecret==='string'){
        const next={provider:'lulu',displayName:'Lulu / prueba local sin conexión',configured:true,status:'configured',source:'encrypted_oauth_pair',
          managedByEnvironment:false,environment:payload.environment,configurationId:payload.configurationId,updatedAt:new Date().toISOString(),testStatus:null};
        if(payload.scenario==='oauth')oauthProviders[payload.scenario]=next;
        data={ok:true,provider:next};
      }
      else if(payload.action==='adminPrintStatus')data={ok:true,pdf};
      else if(payload.action==='adminValidatePrint'&&payload.scenario==='normal'){
        const state=pdf.printValidation.preflight;
        if(state.interior.state==='pending')state.interior.state='normalized';
        else if(!state.cover)state.cover={state:'pending',validation_id:9};
        else state.cover.state='normalized';
        if(state.interior.state==='normalized'&&state.cover?.state==='normalized'){
          state.status='ready';pdf.printValidation.ready_for_print=true;pdf.luluMetadata.ready_for_print=true;pdf.luluMetadata.ready_for_print_status='ready_for_print';
        }
        data={ok:true,pdf};
      }else if(payload.scenario==='quote'&&payload.action==='adminPrintQuote')data={ok:true,quotation:syntheticQuotation};
      else if(orders[payload.scenario]&&payload.action==='adminPrintOrder')data={ok:true,order:orders[payload.scenario]};
      else if(payload.scenario==='quote'&&payload.action==='adminApprovePrintOrder'&&payload.orderConsent===true&&
        payload.manualPaymentConfirmed===true&&payload.amount==='17.36'&&payload.quoteId===syntheticQuotation.id){
        orders.quote={...orders.quote,id:'synthetic-intent',quoteId:syntheticQuotation.id,state:'approved',canSubmit:true};
        pdf.printOrder={hasIntent:true,canRequote:true};data={ok:true,order:orders.quote};
      }else if(payload.scenario==='quote'&&payload.action==='adminSubmitPrintOrder'&&orders.quote.state==='approved'){
        orders.quote={...orders.quote,state:'submitted',canSubmit:false,providerId:23,providerStatus:'UNPAID',canSync:true};
        pdf.printOrder={hasIntent:true,canRequote:false};
        data={ok:true,order:orders.quote};
      }else if(payload.scenario==='order_uncertain'&&payload.action==='adminReconcilePrintOrder'&&orders.order_uncertain.canReconcile){
        orders.order_uncertain={...orders.order_uncertain,state:'submitted',canReconcile:false,providerId:23,providerStatus:'UNPAID',canSync:true};
        data={ok:true,order:orders.order_uncertain};
      }else if(orders[payload.scenario]&&payload.action==='adminSyncPrintOrder'&&orders[payload.scenario].canSync){
        const status=++syntheticSyncs===1?'UNPAID':syntheticSyncs===2?'SHIPPED':'DELIVERED';
        orders[payload.scenario]={...orders[payload.scenario],state:'verified',providerStatus:status,checkedAt:new Date().toISOString(),
          canPay:status==='UNPAID',paymentStatus:status==='UNPAID'?'unpaid':'paid_confirmed',delivered:status==='DELIVERED',
          paymentPortalUrl:status==='UNPAID'?'https://developers.sandbox.lulu.com/':null,
          tracking:status==='UNPAID'?null:{id:'SYNTHETIC-ONLY',carrier:'Transportista ficticio',urls:['https://carrier.example.test/track/SYNTHETIC-ONLY']}};
        data={ok:true,order:orders[payload.scenario]};
      }
      else if(payload.scenario==='quote'&&payload.action==='adminShippingOptions'&&payload.shippingConsent===true)
        data={ok:true,options:[{level:'MAIL',currency:'EUR',cost_excl_tax:'5.00',traceable:false}],orderCreated:false,paymentCreated:false};
      else if(payload.scenario==='quote'&&payload.action==='adminQuotePrint'&&payload.shippingConsent===true&&payload.shippingLevel==='MAIL'){
        syntheticQuotation={id:'synthetic-quote',pdfId:pdf.id,status:'quoted',environment:'sandbox',quantity:1,shippingLevel:'MAIL',
          createdAt:new Date().toISOString(),expiresAt:new Date(Date.now()+900000).toISOString(),
          costs:{currency:'EUR',printing:{incl_tax:'10.40'},shipping_handling:{incl_tax:'6.05'},fulfillment:{incl_tax:'0.91'},
            discount:'0.00',tax:'1.61',total_incl_tax:'17.36'},orderCreated:false,paymentCreated:false};
        data={ok:true,quotation:syntheticQuotation};
      }else throw new Error('proof_action_not_allowed');
      res.setHeader('Content-Type','application/json');res.end(JSON.stringify(data));return;
    }
    if(path==='/proof-observations'){res.setHeader('Content-Type','application/json');res.end(JSON.stringify({calls,printJobs}));return;}
    if(path==='/futuro-admin.html'){
      const html=await readFile(new URL('futuro-admin.html',sourceRoot),'utf8');
      res.setHeader('Content-Type','text/html');res.end(html.replace('<h1>Back office</h1>','<h1>Back office · prueba local</h1>').replace('Control operativo, proveedores y revision editorial.','Datos sintéticos. Sin proveedores, pedidos ni pagos.'));return;
    }
    if(path==='/scripts/future-admin.js'){
      const js=await readFile(new URL('scripts/future-admin.js',sourceRoot),'utf8');
      res.setHeader('Content-Type','text/javascript');res.end(prefix+js.replace(/^import .*;\n/gm,''));return;
    }
    if(path==='/styles/future-admin.css'){
      res.setHeader('Content-Type','text/css');res.end(await readFile(new URL('styles/future-admin.css',sourceRoot)));return;
    }
    if(path==='/config/env.js'){res.setHeader('Content-Type','text/javascript');res.end('// No private configuration in this proof.');return;}
    if(path==='/favicon.ico'){res.statusCode=204;res.end();return;}
    res.statusCode=404;res.end('proof_route_not_found');
  }catch{res.statusCode=400;res.end('proof_boundary_rejected');}
});
server.listen(0,'127.0.0.1',()=>console.log(`Print proof: http://127.0.0.1:${server.address().port}/futuro-admin.html`));
