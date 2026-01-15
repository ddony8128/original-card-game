import type { GameEngineCore } from '../engine/gameEngineCore';
import type {
  DamageEffect,
  HealEffect,
  DiscardEffect,
  BurnEffect,
  DrawCataEffect,
} from './effectTypes';

/**
 * damage 계열 카드 효과에 붙은 condition 해석
 */
export function checkDamageCondition(
  engine: GameEngineCore,
  effect: DamageEffect,
): boolean {
  const { owner, condition } = effect;
  if (!condition) return true;

  const self = engine.state.players[owner];
  if (!self) return false;

  switch (condition) {
    case 'if_self_deck_empty':
      return self.deck.length === 0;
    case 'if_self_deck_empty_not':
      return self.deck.length > 0;
    default:
      return true;
  }
}

/**
 * heal 계열 카드 효과에 붙은 condition 해석
 */
export function checkHealCondition(
  _engine: GameEngineCore,
  effect: HealEffect,
  targetHp: number,
): boolean {
  const { condition, target } = effect;
  if (!condition) return true;

  switch (condition) {
    case 'if_enemy_dead_not':
      // enemy가 이미 죽었으면 발동하지 않음
      if (target === 'enemy') {
        return targetHp > 0;
      }
      return true;
    default:
      return true;
  }
}

/**
 * discard 계열 카드 효과에 붙은 condition 해석
 */
export function checkDiscardCondition(
  _engine: GameEngineCore,
  effect: DiscardEffect,
  handSize: number,
): boolean {
  const { condition } = effect;
  if (!condition) return true;

  switch (condition) {
    case 'if_self_hand_empty':
      return handSize === 0;
    case 'if_self_hand_empty_not':
      return handSize > 0;
    default:
      return true;
  }
}

/**
 * burn 계열 카드 효과에 붙은 condition 해석
 */
export function checkBurnCondition(
  engine: GameEngineCore,
  effect: BurnEffect,
): boolean {
  const { owner, condition } = effect;
  if (!condition) return true;

  const self = engine.state.players[owner];
  if (!self) return false;

  switch (condition) {
    case 'if_self_deck_empty_not':
      return self.deck.length > 0;
    default:
      return true;
  }
}

/**
 * draw_cata 계열 카드 효과에 붙은 condition 해석
 */
export function checkDrawCataCondition(
  engine: GameEngineCore,
  effect: DrawCataEffect,
): boolean {
  const { condition } = effect;
  if (!condition) return true;

  switch (condition) {
    case 'if_cata_deck_empty_not':
      return engine.state.catastropheDeck.length > 0;
    default:
      return true;
  }
}
