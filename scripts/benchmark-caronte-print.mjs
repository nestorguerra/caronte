// Private synthetic benchmark. No provider calls, user data or generated files.
import {readFile} from 'node:fs/promises';
import {PDFDocument} from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import {createPrintRenderer,prototypeCoverDimensions} from '../supabase/functions/_shared/caronte-print.mjs';
import {loadPrintFonts} from '../supabase/functions/_shared/caronte-print-fonts.mjs';
import {printManuscript} from './fixtures/print-manuscript.mjs';

const argument=process.argv.slice(2);
if(argument.length>1||argument.some(value=>!['--fixture=varied','--fixture=repeated'].includes(value)))throw new Error('print_benchmark_arguments');
const varied=argument[0]!=='--fixture=repeated',source=printManuscript();
if(varied){
  let seed=20261012;
  const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed;};
  for(const chapter of source.sections)chapter.paragraphs=chapter.paragraphs.map(text=>{
    const words=text.split(' ');
    for(let index=words.length-1;index>0;index--){const target=random()%(index+1);[words[index],words[target]]=[words[target],words[index]];}
    return words.join(' ');
  });
}
// Imports and fixture construction are excluded in both before/after samples.
// Font loading, validation, all layout candidates and both PDFs are included.
const cpuStart=process.cpuUsage(),wallStart=performance.now();
const fonts=await loadPrintFonts(readFile),render=createPrintRenderer({PDFDocument,fontkit,fonts});
const bundle=await render(source,{coverDimensions:async pageCount=>({...prototypeCoverDimensions(pageCount),
  source:'lulu-api',pageCount,podPackageId:'0583X0827.BW.STD.PB.060UC444.MXX',environment:'sandbox'})});
const cpu=process.cpuUsage(cpuStart);
console.log(JSON.stringify({runtime:process.version,fixtureOnly:true,fixture:varied?'varied-lines':'repeated-lines',
  externalRequests:0,pages:bundle.interior.pageCount,words:bundle.wordCount,
  wallMs:Math.round(performance.now()-wallStart),cpuUserMs:Math.round(cpu.user/1000),cpuSystemMs:Math.round(cpu.system/1000),
  maxRssMiB:Math.round(process.resourceUsage().maxRSS/1024),readyForPrint:false}));
