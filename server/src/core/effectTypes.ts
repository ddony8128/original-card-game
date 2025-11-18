import type { PlayerID, CardID } from '../type/gameState';

export type EffectType =
  | 'TURN_START'
  | 'TURN_END'
  | 'CHANGE_TURN'
  | 'DRAW'
  | 'DRAW_CATA'
  | 'MOVE'
  | 'INSTALL_START'
  | 'INSTALL_AFTER_SELECTION'
  | 'CAST_START'
  | 'CAST_EXECUTE'
  | 'USE_RITUAL_START'
  | 'DAMAGE'
  | 'HEAL'
  | 'DISCARD'
  | 'BURN'
  | 'CHECK_GAME_OVER'
  | 'TRIGGERED_EFFECT';

export interface BaseEffect {
  type: EffectType;
  owner: PlayerID;
}

export interface MoveEffect extends BaseEffect {
  type: 'MOVE';
  to: { r: number; c: number };
}

export interface InstallAfterSelectionEffect extends BaseEffect {
  type: 'INSTALL_AFTER_SELECTION';
  cardId: CardID;
  pos: { r: number; c: number };
}

export interface CastExecuteEffect extends BaseEffect {
  type: 'CAST_EXECUTE';
  cardId: CardID;
}

export interface TurnStartEffect extends BaseEffect {
  type: 'TURN_START';
}

export interface TurnEndEffect extends BaseEffect {
  type: 'TURN_END';
}

export interface ChangeTurnEffect extends BaseEffect {
  type: 'CHANGE_TURN';
  nextPlayer: PlayerID;
}

export interface TriggeredEffect extends BaseEffect {
  type: 'TRIGGERED_EFFECT';
  cardId: CardID;
  trigger: string;
  effectRef: unknown;
  context?: unknown;
}

// 필요시 세부 Effect 타입을 더 정의할 수 있지만,
// 현재 단계에서는 최소한의 정보만 사용한다.

export type Effect =
  | BaseEffect
  | MoveEffect
  | TurnStartEffect
  | TurnEndEffect
  | ChangeTurnEffect
  | InstallAfterSelectionEffect
  | CastExecuteEffect
  | TriggeredEffect;

export interface EngineLogEntry {
  turn: number;
  text: string;
  actor?: PlayerID | null;
  timestamp?: number;
}


