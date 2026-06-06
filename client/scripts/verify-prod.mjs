import { chromium } from 'playwright';
const URLS = process.argv.slice(2);
async function check(b, url){
  const ctx=await b.newContext();
  const p=await ctx.newPage();
  const net=[]; const errors=[];
  p.on('console',m=>{if(m.type()==='error')errors.push(m.text().slice(0,120));});
  p.on('request',r=>{const u=r.url();if(/google-analytics\.com|googletagmanager\.com\/gtag\/js|analytics\.google\.com|clarity\.ms/.test(u))net.push(u.slice(0,110));});
  let title='(load failed)';
  try{ await p.goto(url,{waitUntil:'networkidle',timeout:30000}); title=await p.title(); }catch(e){ console.log('  goto err',String(e).slice(0,90)); }
  await p.waitForTimeout(3000);
  const info = await p.evaluate(()=>({
    rootLen: (document.getElementById('root')?.innerText||'').slice(0,160),
    bodyTextLen: document.body.innerText.length,
    gtag: typeof window.gtag,
    clarity: typeof window.clarity,
  }));
  const collect = net.filter(u=>/\/g\/collect/.test(u));
  const tid = (collect[0]||'').match(/tid=([^&]+)/)?.[1] || null;
  console.log(`\n=== ${url} ===`);
  console.log('  title       :', title);
  console.log('  root text   :', JSON.stringify(info.rootLen));
  console.log('  gtag/clarity:', info.gtag, '/', info.clarity);
  console.log('  GA collect  :', collect.length>0, 'tid=', tid);
  console.log('  clarity tag :', net.some(u=>/clarity\.ms\/tag/.test(u)));
  console.log('  net:'); net.forEach(u=>console.log('    '+u));
  console.log('  console errors:', errors.length, errors.slice(0,4));
  await ctx.close();
}
async function main(){
  const b=await chromium.launch();
  for(const u of URLS) await check(b,u);
  await b.close();
}
main().then(()=>process.exit(0)).catch(e=>{console.error(e);process.exit(1)});
