import fs from 'node:fs';
import path from 'node:path';

/**
 * 기본 덱(기본 덱) 리소스.
 *
 * 신규 가입 시 자동으로 생성되는 스타터 덱 정의이며, 변하지 않는 설정이므로
 * 레포의 `server/resources/defaultDeck.json` 을 한 번만 메모리에 적재해 제공한다.
 */

export interface DefaultDeckEntry {
  id: string;
  count: number;
}

export interface DefaultDeck {
  name: string;
  main: DefaultDeckEntry[];
  cata: DefaultDeckEntry[];
}

// defaultDeck.json 은 server/resources/defaultDeck.json 에 있다. __dirname 은 실행 환경에 따라 다르다.
// (cardResource.ts / pveStages.ts 와 동일한 사유 — 두 후보 중 존재하는 경로 사용)
const DEFAULT_DECK_JSON_CANDIDATES = [
  path.join(__dirname, '../../../resources/defaultDeck.json'),
  path.join(__dirname, '../../../../resources/defaultDeck.json'),
];

function resolveDefaultDeckJsonPath(): string {
  for (const candidate of DEFAULT_DECK_JSON_CANDIDATES) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return DEFAULT_DECK_JSON_CANDIDATES[0];
}

let cached: DefaultDeck | null = null;

function ensureLoaded(): DefaultDeck {
  if (cached === null) {
    const raw = fs.readFileSync(resolveDefaultDeckJsonPath(), 'utf-8');
    cached = JSON.parse(raw) as DefaultDeck;
  }
  return cached;
}

export function getDefaultDeck(): DefaultDeck {
  return ensureLoaded();
}

/** 테스트용: 적재 상태 초기화. */
export function resetDefaultDeck(): void {
  cached = null;
}
