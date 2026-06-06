// ---- Fog of war friendly public game state types ----
export type PlayerID = string;
export type CardID = string;

export type CardInstanceId = string;

export interface CardInstance {
  id: CardInstanceId;
  cardId: CardID;
}

export interface PublicRitual {
  id: string;
  cardId: CardID;
  owner: PlayerID;
  pos: { r: number; c: number };
  usedThisTurn: boolean;
}

export interface PublicHandCard {
  id: CardID;
  name: string;
  /** 영어 이름(언어 전환용). 서버 cardMetas 가 ko/en 둘 다 전달한다. */
  nameEn?: string;
  mana: number;
  type: 'instant' | 'ritual' | 'catastrophe' | 'summon' | 'item';
  description: string;
  /** 영어 설명(언어 전환용). */
  descriptionEn?: string;
}

export type ClientSideActionLog = {
  turn: number;
  actor: PlayerID;
  /** 구조화 로그 코드. `gamelog.<code>` i18n 키로 렌더한다. */
  code: string;
  /** 보간 변수. 플레이어 id(`p`/`p2`), cardId(`c`), 수치(`amount`), 좌표 등 원본 값. */
  params?: Record<string, string | number>;
  timestamp?: number;
};

export interface FoggedGameState {
  phase:
    | 'INITIALIZING'
    | 'WAITING_FOR_MULLIGAN'
    | 'RESOLVING'
    | 'WAITING_FOR_PLAYER_ACTION'
    | 'WAITING_FOR_PLAYER_INPUT'
    | 'GAME_OVER';
  turn: number;
  activePlayer: PlayerID;
  winner?: PlayerID | null;

  board: {
    width: number;
    height: number;
    wizards: Record<PlayerID, { r: number; c: number }>;
    rituals: PublicRitual[];
  };

  me: {
    hp: number;
    maxHp: number;
    mana: number;
    maxMana: number;
    hand: CardInstance[];
    handCount: number;
    deckCount: number;
    grave: CardInstance[];
    graveCount: number;
  };

  opponent: {
    hp: number;
    maxHp: number;
    mana: number;
    maxMana: number;
    handCount: number;
    deckCount: number;
    grave: CardInstance[];
    graveCount: number;
  };

  catastrophe: {
    deckCount: number;
    grave: CardInstance[];
    graveCount: number;
  };

  /** 묘지 및 resolve stack에 있는 카드들의 메타 정보 */
  cardMetas?: PublicHandCard[];

  lastActions?: ClientSideActionLog[];
}
