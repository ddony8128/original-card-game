import type { Card } from './deck';

export interface Position {
  x: number;
  y: number;
}

export interface GameState {
  deck: Card[];
  hand: Card[];
  discardPile: Card[];
  playedCards: Card[];
  mana: number;
  maxMana: number;
  hp: number;
  maxHp: number;
  playerPosition: Position;
  opponentPosition: Position;
}
