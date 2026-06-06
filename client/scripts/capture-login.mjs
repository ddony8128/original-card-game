import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const BASE='http://localhost:5173';
const OUT=new URL('../screenshots/',import.meta.url).pathname.replace(/^\/([A-Za-z]:)/,'$1');
async function main(){
  mkdirSync(OUT,{recursive:true});
  const b=await chromium.launch();
  for(const [loc,path] of [['ko','/login'],['en','/en/login']]){
    const ctx=await b.newContext({viewport:{width:1000,height:760}});
    const p=await ctx.newPage();
    await p.goto(`${BASE}${path}`,{waitUntil:'networkidle',timeout:20000}).catch(()=>{});
    await p.waitForTimeout(1500);
    console.log(loc,'document.title =', await p.title());
    await p.screenshot({path:`${OUT}/login-${loc}.png`,fullPage:false});
    await ctx.close();
  }
  await b.close();
}
main().then(()=>process.exit(0)).catch(e=>{console.error(e);process.exit(1)});
