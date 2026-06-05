import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const API='http://localhost:3000', BASE='http://localhost:5173', USER='uitest_screens', PASS='test1234!';
const OUT=new URL('../screenshots/',import.meta.url).pathname.replace(/^\/([A-Za-z]:)/,'$1');
async function token(){await fetch(`${API}/api/auth/register`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:USER,password:PASS})}).catch(()=>{});const r=await fetch(`${API}/api/auth/login`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:USER,password:PASS})});return (await r.json()).token;}
async function main(){
  mkdirSync(OUT,{recursive:true});
  const t=await token();
  const b=await chromium.launch();
  for(const vp of [{tag:'desktop',width:1440,height:900},{tag:'mobile',width:390,height:844}]){
    const ctx=await b.newContext({viewport:{width:vp.width,height:vp.height}});
    await ctx.addInitScript((tk)=>{try{localStorage.setItem('auth_token',tk)}catch{}},t);
    const p=await ctx.newPage();
    await p.goto(`${BASE}/tutorial`,{waitUntil:'networkidle',timeout:20000}).catch(()=>{});
    await p.waitForTimeout(3500);
    // dismiss mulligan: click 취소 (cancel = keep hand)
    const cancel=p.getByRole('button',{name:'취소'});
    if(await cancel.count()) await cancel.first().click().catch(()=>{});
    await p.waitForTimeout(1200);
    // skip tutorial overlay
    const skip=p.getByRole('button',{name:'건너뛰기'});
    if(await skip.count()) await skip.first().click().catch(()=>{});
    await p.waitForTimeout(2000);
    // select first hand card to reveal type badge + full description + use button
    const firstCard=p.locator('.grid button').filter({hasText:/마나|피해|회복|설치|뽑|거리/}).first();
    try{ await firstCard.click({timeout:1500}); await p.waitForTimeout(600);}catch{}
    // viewport-only screenshot = what actually fits on one screen
    await p.screenshot({path:`${OUT}/ingame-${vp.tag}.png`,fullPage:false});
    await p.screenshot({path:`${OUT}/ingame-${vp.tag}-full.png`,fullPage:true});
    console.log('captured ingame-'+vp.tag);
    await ctx.close();
  }
  await b.close();
}
main().then(()=>process.exit(0)).catch(e=>{console.error(e);process.exit(1)});
