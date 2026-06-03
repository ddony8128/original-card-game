import type { CardMeta } from '../context';
import {
  parseCardEffectJson,
  type EffectConfig,
  type DamageEffectConfig,
  type HealEffectConfig,
  type DrawEffectConfig,
  type TriggerConfig,
} from '../effects/schema';

/**
 * AI 휴리스틱이 사용하는 순수 평가 함수 모음.
 *
 * 모든 함수는 입력을 변형하지 않으며(부수효과 없음), 게임 규칙(reachability,
 * invertSelfEnemy 기반 ritual onDestroy 해석 등)을 그대로 반영한다.
 */

export interface Pos {
  r: number;
  c: number;
}

/** 두 좌표 사이의 맨해튼 거리. */
export function manhattan(a: Pos, b: Pos): number {
  return Math.abs(a.r - b.r) + Math.abs(a.c - b.c);
}

/** CardMeta(effectJson) → 특정 trigger의 EffectConfig 배열을 모두 평탄화해 반환. */
function effectsForTrigger(
  meta: CardMeta | null,
  trigger: TriggerConfig['trigger'],
): EffectConfig[] {
  if (!meta) return [];
  const parsed = parseCardEffectJson(meta.effectJson);
  if (!parsed) return [];
  const out: EffectConfig[] = [];
  for (const t of parsed.triggers) {
    if (t.trigger === trigger) out.push(...t.effects);
  }
  return out;
}

/**
 * damage 이펙트의 value 를 숫자로 환산한다.
 * - 숫자면 그대로.
 * - `'count(rituals_installed)'` → AI 자신의 보드 ritual 개수.
 * - 그 외 문자열 → 0.
 */
function damageValue(value: number | string, ownRitualCount: number): number {
  if (typeof value === 'number') return value;
  if (value === 'count(rituals_installed)') return ownRitualCount;
  return 0;
}

/**
 * (규칙 A) onCast damage 이펙트 하나가, 현재 거리(dist)에서 caster=AI 기준으로
 * 상대 wizard를 실제로 타격하는지 여부를 판정한다.
 *
 * - target:'self'         → 자해, 공격 아님 → false
 * - target:'enemy', range/selectMode 없음 → 항상 명중 → true
 * - target:'near_enemy', range 숫자        → dist <= range 일 때만 명중
 * - selectMode:'choose_target', range 숫자 → dist <= range 일 때만 명중
 */
export function damageHitsOpponent(
  cfg: DamageEffectConfig,
  dist: number,
): boolean {
  if (cfg.target === 'self') return false;

  const hasRange = typeof cfg.range === 'number';
  const isSelect = cfg.selectMode === 'choose_target';

  // 직접 enemy 타겟이고 range/select 가 없으면 무조건 명중.
  if (cfg.target === 'enemy' && !hasRange && !isSelect) return true;

  // near_enemy 또는 choose_target → range 안에 있어야 명중.
  if (cfg.target === 'near_enemy' || isSelect) {
    if (!hasRange) return false;
    return dist <= (cfg.range as number);
  }

  // enemy + range 만 있고 selectMode 없음: 사거리 게이트 적용.
  if (cfg.target === 'enemy' && hasRange) {
    return dist <= (cfg.range as number);
  }

  return false;
}

/**
 * (규칙 A) 카드의 onCast 효과 중, 현재 거리에서 상대에게 실제로 들어가는
 * enemy-damage 값의 합(hitDamage)을 계산한다.
 */
export function onCastHitDamage(
  meta: CardMeta | null,
  dist: number,
  ownRitualCount: number,
): number {
  let total = 0;
  for (const eff of effectsForTrigger(meta, 'onCast')) {
    if (eff.type !== 'damage') continue;
    const d = eff as DamageEffectConfig;
    if (damageHitsOpponent(d, dist)) {
      total += damageValue(d.value, ownRitualCount);
    }
  }
  return total;
}

/**
 * 이 카드가 (거리와 무관하게) onCast enemy-damage 이펙트를 갖고 있는지.
 * s거리만 좁히면 명중 가능한 "데미지 카드"인지 판정하는 데 사용한다.
 */
export function hasAnyOffensiveOnCast(meta: CardMeta | null): boolean {
  for (const eff of effectsForTrigger(meta, 'onCast')) {
    if (eff.type !== 'damage') continue;
    const d = eff as DamageEffectConfig;
    if (d.target === 'enemy' || d.target === 'near_enemy') return true;
  }
  return false;
}

/**
 * (규칙 A) 거리만 좁히면 명중 가능한 카드의 최대 사거리.
 * - 직접 enemy(무조건 명중)면 Infinity.
 * - range 가 있으면 그 range.
 * 명중 가능한 enemy-damage 가 없으면 -Infinity.
 */
export function maxOffensiveRange(meta: CardMeta | null): number {
  let best = -Infinity;
  for (const eff of effectsForTrigger(meta, 'onCast')) {
    if (eff.type !== 'damage') continue;
    const d = eff as DamageEffectConfig;
    if (d.target === 'self') continue;
    const hasRange = typeof d.range === 'number';
    const isSelect = d.selectMode === 'choose_target';
    if (d.target === 'enemy' && !hasRange && !isSelect) {
      best = Infinity;
    } else if (hasRange) {
      best = Math.max(best, d.range as number);
    }
  }
  return best;
}

/**
 * onCast heal target:'self' 효과의 총합(AI 자기 회복량).
 */
export function onCastSelfHeal(meta: CardMeta | null): number {
  let total = 0;
  for (const eff of effectsForTrigger(meta, 'onCast')) {
    if (eff.type !== 'heal') continue;
    const h = eff as HealEffectConfig;
    if (h.target === 'self') total += h.value;
  }
  return total;
}

export interface StepOnRitualEval {
  /** AI(밟은 쪽)가 입는 피해. */
  aiDamage: number;
  /** 상대(ritual 소유자)가 입는 피해. */
  oppDamage: number;
}

/**
 * (규칙 B) AI가 상대 ritual 칸을 밟아 파괴할 때의 onDestroy 손익.
 *
 * 엔진은 stepper 시점에서 self/enemy 를 INVERT 하므로(invertSelfEnemy):
 * - onDestroy damage target:'enemy' → AI(밟은 쪽)가 value 만큼 피해 (AI에게 손해)
 * - onDestroy damage target:'self'  → 상대(소유자)가 value 만큼 피해 (AI에게 이득)
 *
 * (cardsSimulation: onDestroy damage value:5 target:'self' 인 ritual을 상대가 밟으면
 *  소유자가 5 피해, 밟은 쪽은 무피해 — 이를 그대로 반영한다.)
 */
export function evalStepOnRitual(
  meta: CardMeta | null,
  ownRitualCount = 0,
): StepOnRitualEval {
  let aiDamage = 0;
  let oppDamage = 0;
  for (const eff of effectsForTrigger(meta, 'onDestroy')) {
    if (eff.type !== 'damage') continue;
    const d = eff as DamageEffectConfig;
    const v = damageValue(d.value, ownRitualCount);
    if (d.target === 'enemy') aiDamage += v;
    else if (d.target === 'self') oppDamage += v;
  }
  return { aiDamage, oppDamage };
}

/**
 * (규칙 C) 상대 ritual이 매 턴 AI에게 가하는 지속 피해량.
 * onTurnStart / onTurnEnd 의 damage target:'enemy' 값의 합.
 */
export function ongoingHarm(meta: CardMeta | null, ownRitualCount = 0): number {
  let total = 0;
  for (const trigger of ['onTurnStart', 'onTurnEnd'] as const) {
    for (const eff of effectsForTrigger(meta, trigger)) {
      if (eff.type !== 'damage') continue;
      const d = eff as DamageEffectConfig;
      if (d.target === 'enemy') total += damageValue(d.value, ownRitualCount);
    }
  }
  return total;
}

/**
 * (규칙 D) 소유 ritual의 onUsePerTurn 이 상대에게 가하는 피해량(use_ritual 가치).
 */
export function ritualUseEnemyDamage(
  meta: CardMeta | null,
  ownRitualCount = 0,
): number {
  let total = 0;
  for (const eff of effectsForTrigger(meta, 'onUsePerTurn')) {
    if (eff.type !== 'damage') continue;
    const d = eff as DamageEffectConfig;
    if (d.target === 'enemy') total += damageValue(d.value, ownRitualCount);
  }
  return total;
}

/**
 * 소유 ritual 을 매 턴 사용(onUsePerTurn)했을 때의 종합 가치.
 *
 * 데미지뿐 아니라 자기 회복/드로우(예: 지력 흡수=회복, 균형의 수호자=드로우+회복)도
 * 이득으로 본다. value > 0 이면 사용할 가치가 있는 ritual 이다.
 */
export function ritualUseValue(
  meta: CardMeta | null,
  ownRitualCount = 0,
): number {
  let value = 0;
  for (const eff of effectsForTrigger(meta, 'onUsePerTurn')) {
    if (eff.type === 'damage') {
      const d = eff as DamageEffectConfig;
      const v = damageValue(d.value, ownRitualCount);
      value += d.target === 'self' ? -v : v;
    } else if (eff.type === 'heal') {
      const h = eff as HealEffectConfig;
      value += h.target === 'self' ? h.value : -h.value;
    } else if (eff.type === 'draw') {
      const dr = eff as DrawEffectConfig;
      if (dr.target === 'self') value += dr.value;
    }
  }
  return value;
}

/**
 * 카드가 "순수 자해" 인지(onCast 효과가 전부 self 데미지뿐) 판정한다.
 * 유틸 카드 분류(규칙 7)에서 이런 카드는 제외한다.
 */
export function isPureSelfHarm(meta: CardMeta | null): boolean {
  const effects = effectsForTrigger(meta, 'onCast');
  if (effects.length === 0) return false;
  let sawSelfDamage = false;
  for (const eff of effects) {
    if (eff.type === 'damage') {
      const d = eff as DamageEffectConfig;
      if (d.target === 'self') {
        sawSelfDamage = true;
        continue;
      }
      // enemy/near_enemy 데미지가 있으면 자해 카드가 아니다.
      return false;
    }
    // 데미지 외의 효과(heal/draw/install/mana 등)가 있으면 자해 카드가 아니다.
    return false;
  }
  return sawSelfDamage;
}

/**
 * 카드가 유틸 카드(규칙 7)인지 — enemy-damage 카드도 아니고 순수 자해도 아닌,
 * 그 외 효과(draw / heal / install / mana / discard / burn 등)를 가진 카드.
 */
export function isUtilityCard(meta: CardMeta | null): boolean {
  const effects = effectsForTrigger(meta, 'onCast');
  if (effects.length === 0) return false;
  if (hasAnyOffensiveOnCast(meta)) return false;
  if (isPureSelfHarm(meta)) return false;
  return true;
}
