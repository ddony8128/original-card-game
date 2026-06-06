import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const API='http://localhost:3000', BASE='http://localhost:5173', USER='uitest_screens', PASS='test1234!';
const OUT=new URL('../screenshots/',import.meta.url).pathname.replace(/^\/([A-Za-z]:)/,'$1');
async function token(){await fetch(`${API}/api/auth/register`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:USER,password:PASS})}).catch(()=>{});const r=await fetch(`${API}/api/auth/login`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:USER,password:PASS})});return (await r.json()).token;}
async function run(b,t,locale){
  const path = locale==='en' ? '/en/tutorial' : '/tutorial';
  const ctx=await b.newContext({viewport:{width:1440,height:900}});
  await ctx.addInitScript((tk)=>{try{localStorage.setItem('auth_token',tk)}catch{}},t);
  const p=await ctx.newPage();
  await p.goto(`${BASE}${path}`,{waitUntil:'networkidle',timeout:20000}).catch(()=>{});
  await p.waitForTimeout(3500);
  for(const name of ['취소','Cancel']){const b2=p.getByRole('button',{name});if(await b2.count()){await b2.first().click().catch(()=>{});break;}}
  await p.waitForTimeout(1000);
  for(const name of ['건너뛰기','Skip']){const b2=p.getByRole('button',{name});if(await b2.count()){await b2.first().click().catch(()=>{});break;}}
  // play first hand card to generate cast/mana/damage logs, then end turn so AI acts
  await p.waitForTimeout(1500);
  const card=p.locator('.grid button').first();
  try{await card.click({timeout:1500});await p.waitForTimeout(400);
    for(const name of ['사용','Use']){const u=p.getByRole('button',{name});if(await u.count()){await u.first().click().catch(()=>{});break;}}
  }catch{}
  await p.waitForTimeout(2500);
  await p.screenshot({path:`${OUT}/log-${locale}.png`,fullPage:false});
  console.log('captured log-'+locale);
  await ctx.close();
}
async function main(){
  mkdirSync(OUT,{recursive:true});
  const t=await token();
  const b=await chromium.launch();
  await run(b,t,'ko');
  await run(b,t,'en');
  await b.close();
}
main().then(()=>process.exit(0)).catch(e=>{console.error(e);process.exit(1)});
