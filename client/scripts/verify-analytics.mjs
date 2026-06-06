import { chromium } from 'playwright';
const BASE='http://localhost:5173';
async function main(){
  const b=await chromium.launch();
  const ctx=await b.newContext();
  const p=await ctx.newPage();
  const errors=[];
  const net=[];
  p.on('console',m=>{if(m.type()==='error')errors.push(m.text().slice(0,120));});
  p.on('request',r=>{const u=r.url();if(/google-analytics\.com\/g\/collect|googletagmanager\.com\/gtag\/js|analytics\.google\.com|clarity\.ms/.test(u))net.push(u.slice(0,90));});
  await p.goto(`${BASE}/login`,{waitUntil:'networkidle',timeout:20000}).catch(e=>console.log('goto',String(e).slice(0,80)));
  await p.waitForTimeout(2500);
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
  console.log('NET (analytics requests):'); net.forEach(u=>console.log('  '+u));
  console.log('  gaCollectFired =', net.some(u=>/google-analytics\.com\/g\/collect|analytics\.google\.com/.test(u)));
  console.log('CONSOLE_ERRORS', errors.length, errors.slice(0,5));
  await b.close();
}
main().then(()=>process.exit(0)).catch(e=>{console.error(e);process.exit(1)});
