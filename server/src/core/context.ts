import type { CardID, PlayerID } from '../type/gameState';
import type { DeckCardType } from '../type/deck';

/**
 * 게임 엔진이 외부(REST/Supabase 등)에 의존하지 않고도
 * 카드 메타 정보를 조회할 수 있도록 하는 최소한의 인터페이스 정의.
 *
 * - 실제 구현(`buildEngineContextFromDecks`)은 Supabase에서 필요한 카드들만 미리 읽어와
 *   메모리 캐시(Map)로 감싼 lookup 함수를 만들어 주입한다.
 */
export interface CardMeta {
  id: CardID;
  name_dev: string;
  name_ko: string;
  description_ko: string | null;
  type: DeckCardType;
  mana: number | null;
  token: boolean;
  // RDB에 저장된 effect JSON (런타임에 parseCardEffectJson 함수로 파싱하여 사용)
  effectJson: unknown;
}

// 엔진 코어는 비동기 조회를 사용하며, 내부적으로 캐시를 먼저 확인하고 없으면 DB에서 조회한다.
export type LookupCardFn = (id: CardID) => Promise<CardMeta | null>;

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
