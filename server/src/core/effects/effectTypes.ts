import type { PlayerID, CardID } from '../../type/gameState';

export type EffectType =
  // 턴/플로우 제어
  | 'TURN_START'
  | 'TURN_END'
  | 'CHANGE_TURN'
  | 'CHECK_GAME_OVER'
  // 마나
  | 'MANA_PAY'
  | 'MANA_GAIN'
  // 이동/설치
  | 'MOVE'
  | 'INSTALL_START'
  | 'INSTALL_AFTER_SELECTION'
  | 'INSTALL'
  // 카드 사용/리추얼 사용
  | 'CAST_START'
  | 'CAST_EXECUTE'
  | 'USE_RITUAL_START'
  // 카드 효과 기반
  | 'DRAW'
  | 'DRAW_CATA'
  | 'DAMAGE'
  | 'HEAL'
  | 'DISCARD'
  | 'BURN'
  // 트리거
  | 'TRIGGERED_EFFECT';

export interface BaseEffect {
  type: EffectType;
  owner: PlayerID;
}

// ---- 엔진 내부용 Effect ----

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

export interface MoveEffect extends BaseEffect {
  type: 'MOVE';
  // 플레이어 액션 이동에서 사용하는 절대 좌표
  to?: { r: number; c: number };
  // 카드 효과 기반 이동에서 사용하는 필드 (optional)
  direction?: 'choose' | 'forward';
  value?: number;
}

export interface InstallAfterSelectionEffect extends BaseEffect {
  type: 'INSTALL_AFTER_SELECTION';
  cardId: CardID;
  pos: { r: number; c: number };
}

export interface InstallEffect extends BaseEffect {
  type: 'INSTALL';
  object: string;
  range?: number;
}

export interface CastExecuteEffect extends BaseEffect {
  type: 'CAST_EXECUTE';
  cardId: CardID;
}

export interface TriggeredEffect extends BaseEffect {
  type: 'TRIGGERED_EFFECT';
  cardId: CardID;
  trigger: string;
  effectRef: unknown;
  context?: unknown;
}

export interface ManaPayEffect extends BaseEffect {
  type: 'MANA_PAY';
  amount: number;
}

export interface ManaGainEffect extends BaseEffect {
  type: 'MANA_GAIN';
  value: number;
  target: 'self' | 'enemy';
}

// ---- 카드 효과 기반 Effect ----

export interface DamageEffect extends BaseEffect {
  type: 'DAMAGE';
  value: number | string;
  target: 'enemy' | 'near_enemy' | 'self';
  range?: number;
  condition?: string;
}

export interface HealEffect extends BaseEffect {
  type: 'HEAL';
  value: number;
  target: 'self' | 'enemy';
  condition?: string;
}

export interface DrawEffect extends BaseEffect {
  type: 'DRAW';
  value: number;
  target: 'self' | 'enemy';
}

export interface DrawCataEffect extends BaseEffect {
  type: 'DRAW_CATA';
  value: number;
  condition?: string;
}

export interface DiscardEffect extends BaseEffect {
  type: 'DISCARD';
  value: number;
  target: 'enemy' | 'self';
  method: 'deck_random' | 'deck_top' | 'hand_choose' | 'hand_random';
  condition?: string;
}

export interface BurnEffect extends BaseEffect {
  type: 'BURN';
  target: 'self' | 'enemy';
  method?: 'deck_random' | 'deck_top' | 'this';
  value?: number;
  condition?: string;
  /** 카드 효과로 사용된 경우, 소스 카드 id (필요 시 burn this 등에서 사용) */
  cardId?: CardID;
}

// ---- 통합 Effect union ----

export type Effect =
  | BaseEffect
  | TurnStartEffect
  | TurnEndEffect
  | ChangeTurnEffect
  | MoveEffect
  | InstallAfterSelectionEffect
  | InstallEffect
  | CastExecuteEffect
  | TriggeredEffect
  | ManaPayEffect
  | ManaGainEffect
  | DamageEffect
  | HealEffect
  | DrawEffect
  | DrawCataEffect
  | DiscardEffect
  | BurnEffect;

export interface EngineLogEntry {
  turn: number;
  text: string;
  actor?: PlayerID | null;
  timestamp?: number;
}
