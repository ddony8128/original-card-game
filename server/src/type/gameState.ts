export type PlayerID = string;
export type CardID = string;

export type GameLogEntry = {
  turn: number;
  text: string;
  timestamp?: number;
};

export enum GamePhase {
  INITIALIZING = 'INITIALIZING',
  WAITING_FOR_MULLIGAN = 'WAITING_FOR_MULLIGAN',
  RESOLVING = 'RESOLVING',
  WAITING_FOR_PLAYER_ACTION = 'WAITING_FOR_PLAYER_ACTION',
  WAITING_FOR_PLAYER_INPUT = 'WAITING_FOR_PLAYER_INPUT',
  GAME_OVER = 'GAME_OVER',
}

export interface RitualInstance {
  id: string;
  cardId: CardID;
  owner: PlayerID;
  pos: { r: number; c: number };
  usedThisTurn?: boolean;
}

export type ResolveDest = 'grave' | 'cata_grave' | 'board' | 'burn' | 'hand';

export interface ResolveStackEntry {
  card: CardInstance;
  dest?: ResolveDest;
}

export interface PlayerState {
  hp: number;
  maxHp: number;
  maxMana: number;
  mana: number;
  deck: CardInstance[];
  grave: CardInstance[];
  hand: CardInstance[];
  handLimit: number;
  mulliganSelected?: boolean;
  /**
   * 현재 해석(Resolve) 중인 카드 인스턴스들을 임시로 쌓아 두는 스택.
   * - THROW_RESOLVE_STACK 이펙트에서 pop 되어 최종 위치로 이동한다.
   */
  resolveStack: ResolveStackEntry[];
}

export interface GameState {
  phase: GamePhase;
  turn: number;
  activePlayer: PlayerID;
  winner?: PlayerID | null;
  board: {
    width: number;
    height: number;
    wizards: Record<PlayerID, { r: number; c: number }>;
    rituals: RitualInstance[];
  };
  players: Record<PlayerID, PlayerState>;
  catastropheDeck: CardInstance[];
  catastropheGrave: CardInstance[];
  logs: GameLogEntry[];
}

export type ClientSideActionLog = {
  turn: number;
  text: string;
  actor?: PlayerID;
  timestamp?: number;
};

export interface PublicRitual {
  id: string;
  cardId: CardID;
  owner: PlayerID;
  pos: { r: number; c: number };
  usedThisTurn: boolean;
}

export type CardInstanceId = string;

export interface CardInstance {
  id: CardInstanceId;
  cardId: CardID;
  //  name: string;
  //  mana: number;
  //  type: 'instant' | 'ritual';
  //  description: string;
}
// 일단 메타 정보는 따로 제공하거나 클라이언트에서 캐시.
// CardID만 전달.

export interface PublicHandCard {
  id: CardID;
  name: string;
  mana: number;
  type: 'instant' | 'ritual' | 'catastrophe' | 'summon' | 'item';
  description: string;
}

export interface FoggedGameState {
  phase: GamePhase;
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
    /** 현재 내 resolveStack (카드 인스턴스만 노출, dest 정보는 서버 전용) */
    resolveStack: CardInstance[];
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
    /** 상대 resolveStack (카드 인스턴스만 노출) */
    resolveStack: CardInstance[];
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
