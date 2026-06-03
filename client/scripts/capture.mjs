// UI 스크린샷 캡처 하네스 (개발용, 커밋 대상 아님).
// 서버(:3000)와 vite dev(:5173)가 떠 있다고 가정한다.
// 테스트 계정으로 토큰을 받아 localStorage 에 주입한 뒤 각 라우트를 캡처한다.
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const API = 'http://localhost:3000';
const BASE = 'http://localhost:5173';
const USER = 'uitest_screens';
const PASS = 'test1234!';
const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'screenshots');

async function getToken() {
  // 회원가입(이미 있으면 무시) 후 로그인.
  await fetch(`${API}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: USER, password: PASS }),
  }).catch(() => {});
  const res = await fetch(`${API}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: USER, password: PASS }),
  });
  const data = await res.json();
  if (!data.token) throw new Error('no token: ' + JSON.stringify(data));
  return data.token;
}

// 정적/메뉴 라우트 (게임 보드는 2차)
const ROUTES = [
  { name: 'login', path: '/login', auth: false },
  { name: 'notfound', path: '/this-page-does-not-exist', auth: false },
  { name: 'lobby', path: '/lobby', auth: true },
  { name: 'deck-builder', path: '/deck-builder', auth: true },
  { name: 'review', path: '/review', auth: true },
  { name: 'pve-select', path: '/pve', auth: true },
];

const VIEWPORTS = [
  { tag: 'desktop', width: 1440, height: 900 },
  { tag: 'mobile', width: 390, height: 844 },
];

async function main() {
  mkdirSync(OUT, { recursive: true });
  const token = await getToken();
  console.log('token ok');
  const browser = await chromium.launch();
  for (const vp of VIEWPORTS) {
    const ctx = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: 1,
    });
    // 토큰을 모든 페이지 로드 전에 주입
    await ctx.addInitScript((t) => {
      try { window.localStorage.setItem('auth_token', t); } catch (e) { void e; }
    }, token);
    const page = await ctx.newPage();
    for (const r of ROUTES) {
      try {
        await page.goto(`${BASE}${r.path}`, { waitUntil: 'networkidle', timeout: 15000 });
        await page.waitForTimeout(800);
        const file = join(OUT, `${r.name}-${vp.tag}.png`);
        await page.screenshot({ path: file, fullPage: true });
        console.log('captured', `${r.name}-${vp.tag}`);
      } catch (e) {
        console.log('FAIL', r.name, vp.tag, String(e).slice(0, 120));
      }
    }
    await ctx.close();
  }
  await browser.close();
  console.log('done →', OUT);
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
