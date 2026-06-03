import fs from 'node:fs';
import path from 'node:path';
import { coerceJson } from '../../type/json';
import type { CardRow } from '../../services/cards';

/**
 * 카드 데이터 리소스.
 *
 * 카드는 더 이상 (일시정지될 수 있는) Supabase DB 에 의존하지 않고,
 * 레포에 포함된 `server/resources/cards.json` 을 단 한 번 메모리에 적재해 제공한다.
 * decks/users/rooms 등 나머지는 여전히 DB 를 사용한다.
 */

// cards.json 은 항상 `server/resources/cards.json` 에 존재한다.
// 단, __dirname 은 실행 환경에 따라 다르다:
//  - 테스트(vitest, TS 소스 직접 실행): src/core/resources  → ../../../resources = server/resources
//  - 런타임(tsc 빌드 결과):           dist/src/core/resources → ../../../../resources = server/resources
//    (include 에 index.ts 와 src/** 가 함께 있어 rootDir 가 server 로 추론되어 dist 아래 src/ 가 한 단계 더 생긴다)
// 두 후보 경로 중 실제 존재하는 파일을 사용한다.
const CARDS_JSON_CANDIDATES = [
  path.join(__dirname, '../../../resources/cards.json'),
  path.join(__dirname, '../../../../resources/cards.json'),
];

function resolveCardsJsonPath(): string {
  for (const candidate of CARDS_JSON_CANDIDATES) {
    if (fs.existsSync(candidate)) return candidate;
  }
  // 둘 다 없으면 첫 후보로 시도(명확한 ENOENT 에러 발생).
  return CARDS_JSON_CANDIDATES[0];
}

let cachedRows: CardRow[] | null = null;

function loadFromFile(): CardRow[] {
  const raw = fs.readFileSync(resolveCardsJsonPath(), 'utf-8');
  const parsed = JSON.parse(raw) as Array<
    Omit<CardRow, 'effect_json'> & { effect_json: unknown }
  >;
  return parsed.map((r) => ({ ...r, effect_json: coerceJson(r.effect_json) }));
}

function ensureLoaded(): CardRow[] {
  if (cachedRows === null) {
    cachedRows = loadFromFile();
  }
  return cachedRows;
}

export function getAllCardRows(): CardRow[] {
  return ensureLoaded();
}

export function getCardRowById(id: string): CardRow | null {
  return ensureLoaded().find((r) => r.id === id) ?? null;
}

export function getCardRowsByIds(ids: string[]): CardRow[] {
  if (ids.length === 0) return [];
  const want = new Set(ids);
  return ensureLoaded().filter((r) => want.has(r.id));
}

/** 테스트용: 카드 행을 직접 주입한다(파일 로드를 대체). */
export function setCardRowsForTest(rows: CardRow[]): void {
  cachedRows = rows.map((r) => ({ ...r }));
}

/** 테스트용: 적재 상태를 초기화한다(다음 접근 시 파일에서 재적재). */
export function resetCardResource(): void {
  cachedRows = null;
}
