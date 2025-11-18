import type { CardID, PlayerID } from '../type/gameState';

export type CardKind = 'instant' | 'ritual';

export interface CardMeta {
  id: CardID;
  name: string;
  manaCost: number;
  kind: CardKind;
  // RDB에 저장된 effect JSON (엔진은 구조만 알고 내용은 해석하지 않음)
  effectJson: unknown;
}

// 엔진 코어는 동기 조회를 가정하고, 외부에서 미리 캐시/로딩해 주는 형태로 사용한다.
export type LookupCardFn = (id: CardID) => CardMeta | null;

export interface EngineContext {
  lookupCard: LookupCardFn;
  /**
   * 무작위가 필요할 때 사용하는 함수 (예: 선후공 결정, 셔플 등)
   * 기본값: Math.random
   */
  random?: () => number;
  /**
   * 타임스탬프가 필요할 때 사용하는 함수
   * 기본값: Date.now
   */
  now?: () => number;
  /**
   * 서버 로그 혹은 리플레이용 로그 함수
   */
  log?: (playerId: PlayerID | null, message: string) => void;
}


