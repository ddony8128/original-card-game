import fs from 'node:fs';
import path from 'node:path';

/**
 * PvE 스테이지 리소스.
 *
 * 스테이지(이름/AI 덱/AI 프로필)는 변하지 않는 설정이므로 레포의
 * `server/resources/pveStages.json` 을 한 번만 메모리에 적재해 제공한다.
 * 프로필은 id(문자열)만 들고 있고, 실제 동작은 AI 모듈(heuristic 프로필 레지스트리)이 정의한다.
 */

export interface DeckEntry {
  id: string;
  count: number;
}

export interface PveStage {
  id: string;
  name: string;
  /** AI 행동 프로필 식별자(heuristic 프로필 레지스트리 키). */
  profileId: string;
  deck: {
    main: DeckEntry[];
    cata: DeckEntry[];
  };
}

// pveStages.json 은 server/resources/pveStages.json 에 있다. __dirname 은 실행 환경에 따라 다르다.
// (cardResource.ts 와 동일한 사유 — 두 후보 중 존재하는 경로 사용)
const STAGES_JSON_CANDIDATES = [
  path.join(__dirname, '../../../resources/pveStages.json'),
  path.join(__dirname, '../../../../resources/pveStages.json'),
];

function resolveStagesJsonPath(): string {
  for (const candidate of STAGES_JSON_CANDIDATES) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return STAGES_JSON_CANDIDATES[0];
}

let cached: PveStage[] | null = null;

function ensureLoaded(): PveStage[] {
  if (cached === null) {
    const raw = fs.readFileSync(resolveStagesJsonPath(), 'utf-8');
    cached = JSON.parse(raw) as PveStage[];
  }
  return cached;
}

export function getPveStages(): PveStage[] {
  return ensureLoaded();
}

export function getPveStage(id: string): PveStage | null {
  return ensureLoaded().find((s) => s.id === id) ?? null;
}

/** 테스트용: 적재 상태 초기화. */
export function resetPveStages(): void {
  cached = null;
}
