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
  mana: number;
  type: 'instant' | 'ritual';
  description: string;
}

export type ClientSideActionLog = {
  turn: number;
  actor: PlayerID;
  text: string;
  timestamp?: number;
};

export interface FoggedGameState {
  phase:
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
