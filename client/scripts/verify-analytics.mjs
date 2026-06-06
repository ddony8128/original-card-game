import { chromium } from 'playwright';
const BASE='http://localhost:5173';
async function main(){
  const b=await chromium.launch();
  const ctx=await b.newContext();
  const p=await ctx.newPage();
  const errors=[];
  p.on('console',m=>{if(m.type()==='error')errors.push(m.text().slice(0,120));});
  await p.goto(`${BASE}/login`,{waitUntil:'networkidle',timeout:20000}).catch(e=>console.log('goto',String(e).slice(0,80)));
  await p.waitForTimeout(1500);
  const res = await p.evaluate(()=>{
    const scripts=[...document.querySelectorAll('script')].map(s=>s.src).filter(Boolean);
    const dl = (window).dataLayer;
    const firstType = dl && dl.length ? Object.prototype.toString.call(dl[0]) : null;
    return {
      hasGtagFn: typeof (window).gtag === 'function',
      hasClarityFn: typeof (window).clarity === 'function',
      gtagScript: scripts.some(s=>s.includes('googletagmanager.com/gtag/js')),
      clarityScript: scripts.some(s=>s.includes('clarity.ms/tag')),
      dataLayerLen: dl ? dl.length : 0,
      firstEntryType: firstType,           // '[object Arguments]' 이어야 GA가 명령으로 인식
      clarityQLen: (window).clarity && (window).clarity.q ? (window).clarity.q.length : null,
    };
  });
  console.log('RESULT', JSON.stringify(res,null,2));
  console.log('CONSOLE_ERRORS', errors.length, errors.slice(0,5));
  await b.close();
}
main().then(()=>process.exit(0)).catch(e=>{console.error(e);process.exit(1)});
