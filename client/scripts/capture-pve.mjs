import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const API='http://localhost:3000', BASE='http://localhost:5173', USER='uitest_screens', PASS='test1234!';
const OUT=new URL('../screenshots/',import.meta.url).pathname.replace(/^\/([A-Za-z]:)/,'$1');
async function token(){await fetch(`${API}/api/auth/register`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:USER,password:PASS})}).catch(()=>{});const r=await fetch(`${API}/api/auth/login`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:USER,password:PASS})});return (await r.json()).token;}
async function main(){
  mkdirSync(OUT,{recursive:true});
  const t=await token();
  const b=await chromium.launch();
  for(const [loc,path] of [['ko','/pve'],['en','/en/pve']]){
    const ctx=await b.newContext({viewport:{width:1280,height:1000}});
    await ctx.addInitScript((tk)=>{try{localStorage.setItem('auth_token',tk)}catch{}},t);
    const p=await ctx.newPage();
    await p.goto(`${BASE}${path}`,{waitUntil:'networkidle',timeout:20000}).catch(()=>{});
    await p.waitForTimeout(2500);
    await p.screenshot({path:`${OUT}/pve-${loc}.png`,fullPage:true});
    console.log('captured pve-'+loc);
    await ctx.close();
  }
  await b.close();
}
main().then(()=>process.exit(0)).catch(e=>{console.error(e);process.exit(1)});
