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
    p.on('console',m=>{if(m.type()==='error')console.log('  [console.error]',m.text().slice(0,100));});
    await p.goto(`${BASE}/tutorial`,{waitUntil:'networkidle',timeout:20000}).catch(e=>console.log('goto err',String(e).slice(0,80)));
    await p.waitForTimeout(4000);
    await p.screenshot({path:`${OUT}/tutorial-${vp.tag}.png`,fullPage:true});
    console.log('captured tutorial-'+vp.tag);
    await ctx.close();
  }
  await b.close();
}
main().then(()=>process.exit(0)).catch(e=>{console.error(e);process.exit(1)});
