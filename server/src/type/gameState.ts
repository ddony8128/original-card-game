export type PlayerID = string;
export type CardID = string;

export type GameLogEntry = {
  turn: number;
  text: string;
  timestamp?: number;
};

export enum GamePhase {
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
    graveCount: number;
  };
  opponent: {
    hp: number;
    maxHp: number;
    mana: number;
    maxMana: number;
    handCount: number;
    deckCount: number;
    graveCount: number;
  };
  catastrophe: {
    deckCount: number;
    graveCount: number;
  };
  lastActions?: ClientSideActionLog[];
}
