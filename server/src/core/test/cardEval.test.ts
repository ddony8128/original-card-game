import { describe, it, expect } from 'vitest';
import type { CardMeta } from '../context';
import {
  manhattan,
  damageHitsOpponent,
  onCastHitDamage,
  onCastSelfHeal,
  evalStepOnRitual,
  ongoingHarm,
  ritualUseEnemyDamage,
  ritualUseValue,
  hasAnyOffensiveOnCast,
  maxOffensiveRange,
  isUtilityCard,
} from '../ai/cardEval';
import type { DamageEffectConfig } from '../effects/schema';

function meta(effectJson: unknown): CardMeta {
  return {
    id: 'x',
    name_dev: 'x',
    name_ko: 'x',
    description_ko: null,
    type: 'instant',
    mana: 1,
    token: false,
    effectJson,
  };
}

const dmg = (
  value: number | string,
  target: 'enemy' | 'near_enemy' | 'self',
  extra: { range?: number; selectMode?: 'choose_target' } = {},
): DamageEffectConfig => ({ type: 'damage', value, target, ...extra });

const onCast = (...effects: unknown[]) => ({
  type: 'instant' as const,
  triggers: [{ trigger: 'onCast', effects }],
});

describe('manhattan', () => {
  it('computes L1 distance', () => {
    expect(manhattan({ r: 0, c: 0 }, { r: 2, c: 3 })).toBe(5);
    expect(manhattan({ r: 4, c: 4 }, { r: 4, c: 4 })).toBe(0);
  });
});

describe('damageHitsOpponent (rule A)', () => {
  it('self damage never hits opponent', () => {
    expect(damageHitsOpponent(dmg(3, 'self'), 1)).toBe(false);
  });
  it('direct enemy with no range always hits', () => {
    expect(damageHitsOpponent(dmg(3, 'enemy'), 99)).toBe(true);
  });
  it('near_enemy hits only within range', () => {
    expect(damageHitsOpponent(dmg(3, 'near_enemy', { range: 2 }), 2)).toBe(true);
    expect(damageHitsOpponent(dmg(3, 'near_enemy', { range: 2 }), 3)).toBe(false);
  });
  it('near_enemy without range never hits', () => {
    expect(damageHitsOpponent(dmg(3, 'near_enemy'), 0)).toBe(false);
  });
  it('choose_target with range is range-gated', () => {
    const e = dmg(3, 'enemy', { selectMode: 'choose_target', range: 3 });
    expect(damageHitsOpponent(e, 3)).toBe(true);
    expect(damageHitsOpponent(e, 4)).toBe(false);
  });
});

describe('onCastHitDamage', () => {
  it('sums hittable enemy-damage effects', () => {
    const m = meta(onCast(dmg(2, 'enemy'), dmg(3, 'near_enemy', { range: 2 })));
    expect(onCastHitDamage(m, 2, 0)).toBe(5);
    expect(onCastHitDamage(m, 3, 0)).toBe(2); // near_enemy out of range
  });
  it('count(rituals_installed) resolves to AI own ritual count', () => {
    const m = meta(onCast(dmg('count(rituals_installed)', 'enemy')));
    expect(onCastHitDamage(m, 1, 3)).toBe(3);
  });
  it('unknown string value resolves to 0', () => {
    const m = meta(onCast(dmg('count(whatever)', 'enemy')));
    expect(onCastHitDamage(m, 1, 5)).toBe(0);
  });
  it('returns 0 for null/non-damage effectJson', () => {
    expect(onCastHitDamage(meta(null), 1, 0)).toBe(0);
    expect(
      onCastHitDamage(meta(onCast({ type: 'draw', value: 1, target: 'self' })), 1, 0),
    ).toBe(0);
  });
});

describe('onCastSelfHeal', () => {
  it('sums self heal values only', () => {
    const m = meta(
      onCast(
        { type: 'heal', value: 4, target: 'self' },
        { type: 'heal', value: 2, target: 'enemy' },
      ),
    );
    expect(onCastSelfHeal(m)).toBe(4);
  });
});

describe('evalStepOnRitual (rule B)', () => {
  it('onDestroy target:enemy harms the AI stepper', () => {
    const m = meta({
      type: 'ritual',
      triggers: [{ trigger: 'onDestroy', effects: [dmg(5, 'enemy')] }],
    });
    expect(evalStepOnRitual(m)).toEqual({ aiDamage: 5, oppDamage: 0 });
  });
  it('onDestroy target:self harms the ritual owner (good for AI)', () => {
    const m = meta({
      type: 'ritual',
      triggers: [{ trigger: 'onDestroy', effects: [dmg(5, 'self')] }],
    });
    expect(evalStepOnRitual(m)).toEqual({ aiDamage: 0, oppDamage: 5 });
  });
});

describe('ongoingHarm (rule C)', () => {
  it('sums onTurnStart/onTurnEnd enemy damage', () => {
    const m = meta({
      type: 'ritual',
      triggers: [
        { trigger: 'onTurnEnd', effects: [dmg(1, 'enemy')] },
        { trigger: 'onTurnStart', effects: [dmg(2, 'enemy')] },
      ],
    });
    expect(ongoingHarm(m)).toBe(3);
  });
  it('ignores self-target ongoing damage', () => {
    const m = meta({
      type: 'ritual',
      triggers: [{ trigger: 'onTurnEnd', effects: [dmg(1, 'self')] }],
    });
    expect(ongoingHarm(m)).toBe(0);
  });
});

describe('ritualUseEnemyDamage (rule D)', () => {
  it('sums onUsePerTurn enemy damage', () => {
    const m = meta({
      type: 'ritual',
      triggers: [{ trigger: 'onUsePerTurn', effects: [dmg(2, 'enemy')] }],
    });
    expect(ritualUseEnemyDamage(m)).toBe(2);
  });
});

describe('classification helpers', () => {
  it('hasAnyOffensiveOnCast detects enemy/near_enemy damage', () => {
    expect(hasAnyOffensiveOnCast(meta(onCast(dmg(1, 'enemy'))))).toBe(true);
    expect(
      hasAnyOffensiveOnCast(meta(onCast(dmg(1, 'near_enemy', { range: 1 })))),
    ).toBe(true);
    expect(hasAnyOffensiveOnCast(meta(onCast(dmg(1, 'self'))))).toBe(false);
  });
  it('maxOffensiveRange is Infinity for direct enemy, range otherwise', () => {
    expect(maxOffensiveRange(meta(onCast(dmg(1, 'enemy'))))).toBe(Infinity);
    expect(
      maxOffensiveRange(meta(onCast(dmg(1, 'near_enemy', { range: 4 })))),
    ).toBe(4);
    expect(maxOffensiveRange(meta(onCast(dmg(1, 'self'))))).toBe(-Infinity);
  });
  it('isUtilityCard true for draw/heal/install/mana, false for damage/self-harm', () => {
    expect(
      isUtilityCard(meta(onCast({ type: 'draw', value: 1, target: 'self' }))),
    ).toBe(true);
    expect(
      isUtilityCard(meta(onCast({ type: 'heal', value: 2, target: 'self' }))),
    ).toBe(true);
    expect(isUtilityCard(meta(onCast(dmg(2, 'enemy'))))).toBe(false);
    expect(isUtilityCard(meta(onCast(dmg(2, 'self'))))).toBe(false); // pure self-harm
    expect(isUtilityCard(meta(null))).toBe(false);
  });
});

describe('ritualUseValue (유익한 ritual 사용 판단)', () => {
  const meta = (effects: unknown[]): any => ({
    id: 'r', name_dev: 'r', name_ko: 'r', description_ko: null,
    type: 'ritual', mana: 0, token: false,
    effectJson: { type: 'ritual', triggers: [{ trigger: 'onUsePerTurn', effects }] },
  });
  it('적 데미지 ritual 은 양수', () => {
    expect(ritualUseValue(meta([{ type: 'damage', value: 3, target: 'enemy' }]))).toBe(3);
  });
  it('자기 회복 ritual 도 양수(지력 흡수류)', () => {
    expect(ritualUseValue(meta([{ type: 'heal', value: 3, target: 'self' }]))).toBe(3);
  });
  it('드로우+회복 ritual 도 양수(균형의 수호자류)', () => {
    expect(ritualUseValue(meta([
      { type: 'draw', value: 1, target: 'self' },
      { type: 'heal', value: 1, target: 'self' },
    ]))).toBe(2);
  });
  it('자기 피해만 있으면 음수', () => {
    expect(ritualUseValue(meta([{ type: 'damage', value: 2, target: 'self' }]))).toBe(-2);
  });
});
