// 004 밸런스 조정을 DB(원본)에 직접 적용한다.
// PostgREST(서비스 키)로 cards 테이블의 7개 행을 cards.json 값과 동기화.
// 실행 전 현재 값을 백업 출력(롤백 대비)하고, 적용 후 재조회로 검증한다.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '..');

// .env 파싱
const envText = fs.readFileSync(path.join(root, '.env'), 'utf-8');
const env = {};
for (const line of envText.split(/\r?\n/)) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].trim();
}
const URL = (env.SUPABASE_URL || '').replace(/\/$/, '');
const KEY = env.SUPABASE_SERVICE_KEY;
if (!URL || !KEY) {
  console.error('SUPABASE_URL / SUPABASE_SERVICE_KEY 누락');
  process.exit(1);
}

const IDS = ['c01-002', 'c01-011', 'c01-012', 'c01-015', 'c01-017', 'c01-026', 'c01-028'];

// cards.json 에서 적용할 값(effect_json + 설명) 로드
const cards = JSON.parse(fs.readFileSync(path.join(root, 'resources/cards.json'), 'utf-8'));
const byId = Object.fromEntries(cards.map((c) => [c.id, c]));

const headers = {
  apikey: KEY,
  Authorization: `Bearer ${KEY}`,
  'Content-Type': 'application/json',
};

async function getRows() {
  const q = `id=in.(${IDS.join(',')})&select=id,name_ko,effect_json,description_ko`;
  const r = await fetch(`${URL}/rest/v1/cards?${q}`, { headers });
  if (!r.ok) throw new Error(`GET ${r.status}: ${await r.text()}`);
  return r.json();
}

async function patch(id) {
  const c = byId[id];
  // DB cards 테이블에는 영어 컬럼이 없다(영어는 cards.json/클라에서 처리). effect_json + description_ko 만 동기화.
  const body = {
    effect_json: c.effect_json,
    description_ko: c.description_ko,
  };
  const r = await fetch(`${URL}/rest/v1/cards?id=eq.${id}`, {
    method: 'PATCH',
    headers: { ...headers, Prefer: 'return=representation' },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`PATCH ${id} ${r.status}: ${await r.text()}`);
  const rows = await r.json();
  return rows[0];
}

function dmgVals(effect) {
  const s = JSON.stringify(effect);
  return (s.match(/"value":(\d+)/g) || []).join(',');
}

async function main() {
  console.log('=== BEFORE (백업) ===');
  const before = await getRows();
  before.sort((a, b) => a.id.localeCompare(b.id));
  for (const c of before) {
    console.log(`${c.id} ${c.name_ko} | values=[${dmgVals(c.effect_json)}] | ${c.description_ko}`);
  }

  console.log('\n=== APPLYING ===');
  for (const id of IDS) {
    const row = await patch(id);
    console.log(`PATCHED ${id} -> values=[${dmgVals(row.effect_json)}]`);
  }

  console.log('\n=== AFTER (검증) ===');
  const after = await getRows();
  after.sort((a, b) => a.id.localeCompare(b.id));
  for (const c of after) {
    console.log(`${c.id} ${c.name_ko} | values=[${dmgVals(c.effect_json)}] | ${c.description_ko}`);
  }
}

main().then(() => process.exit(0)).catch((e) => {
  console.error('FAILED:', e.message);
  process.exit(1);
});
