import type { CardID, PlayerID } from '../../type/gameState';
import type {
  Effect,
  ManaGainEffect,
  DamageEffect,
  HealEffect,
  DrawEffect,
  DrawCataEffect,
  DiscardEffect,
  BurnEffect,
  InstallEffect,
  MoveEffect,
} from './effectTypes';

export type EffectTrigger =
  | 'onCast'
  | 'onTurnEnd'
  | 'onDestroy'
  | 'onTurnStart'
  | 'onUsePerTurn'
  | 'onDrawn';

export type EffectTarget = 'self' | 'enemy' | 'near_enemy';

export type EffectCondition =
  | 'if_self_deck_empty'
  | 'if_self_deck_empty_not'
  | 'if_self_hand_empty'
  | 'if_self_hand_empty_not'
  | 'if_enemy_dead_not'
  | 'if_cata_deck_empty_not';

export interface ManaGainEffectConfig {
  type: 'mana_gain';
  value: number;
  target: 'self' | 'enemy';
}

export interface DamageEffectConfig {
  type: 'damage';
  value: number | string;
  target: 'enemy' | 'near_enemy' | 'self';
  range?: number;
  condition?: EffectCondition;
}

export interface HealEffectConfig {
  type: 'heal';
  value: number;
  target: 'self' | 'enemy';
  condition?: EffectCondition;
}

export interface MoveEffectConfig {
  type: 'move';
  value: number;
  target: 'self';
  direction: 'choose' | 'forward';
}

export interface DrawEffectConfig {
  type: 'draw';
  value: number;
  target: 'self' | 'enemy';
}

export interface DrawCataEffectConfig {
  type: 'draw_cata';
  value: number;
  target: 'self';
  condition?: EffectCondition;
}

export interface DiscardEffectConfig {
  type: 'discard';
  value: number;
  target: 'enemy' | 'self';
  method: 'deck_random' | 'deck_top' | 'hand_choose' | 'hand_random';
  condition?: EffectCondition;
}

export interface BurnEffectConfig {
  type: 'burn';
  target: 'self' | 'enemy';
  method?: 'deck_random' | 'deck_top' | 'this';
  value?: number;
  condition?: EffectCondition;
}

export interface InstallEffectConfig {
  type: 'install';
  object: string;
  target: 'self';
  range?: number;
}

export type EffectConfig =
  | ManaGainEffectConfig
  | DamageEffectConfig
  | HealEffectConfig
  | MoveEffectConfig
  | DrawEffectConfig
  | DrawCataEffectConfig
  | DiscardEffectConfig
  | BurnEffectConfig
  | InstallEffectConfig;

export interface TriggerConfig {
  trigger: EffectTrigger;
  effects: EffectConfig[];
}

export interface CardEffectInstallConfig {
  range?: number;
}

export interface CardEffectJson {
  type: 'instant' | 'ritual' | 'catastrophe';
  triggers: TriggerConfig[];
  install?: CardEffectInstallConfig;
}

export function parseCardEffectJson(raw: unknown): CardEffectJson | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  if (
    obj.type !== 'instant' &&
    obj.type !== 'ritual' &&
    obj.type !== 'catastrophe'
  )
    return null;
  if (!Array.isArray(obj.triggers)) return null;
  const triggers: TriggerConfig[] = [];
  for (const t of obj.triggers as unknown[]) {
    if (!t || typeof t !== 'object') continue;
    const tt = t as Record<string, unknown>;
    if (
      tt.trigger !== 'onCast' &&
      tt.trigger !== 'onTurnEnd' &&
      tt.trigger !== 'onDestroy' &&
      tt.trigger !== 'onTurnStart' &&
      tt.trigger !== 'onUsePerTurn' &&
      tt.trigger !== 'onDrawn'
    ) {
      continue;
    }
    if (!Array.isArray(tt.effects)) continue;
    const effects: EffectConfig[] = [];
    for (const e of tt.effects as unknown[]) {
      if (!e || typeof e !== 'object') continue;
      const ee = e as Record<string, unknown>;
      const type = ee.type;
      switch (type) {
        case 'mana_gain':
        case 'damage':
        case 'heal':
        case 'move':
        case 'draw':
        case 'draw_cata':
        case 'discard':
        case 'burn':
        case 'install':
          effects.push(ee as unknown as EffectConfig);
          break;
        default:
          break;
      }
    }
    triggers.push({
      trigger: tt.trigger as EffectTrigger,
      effects,
    });
  }

  return {
    type: obj.type,
    triggers,
    install: obj.install as CardEffectInstallConfig | undefined,
  };
}

export function buildEffectsFromConfigs(
  configs: EffectConfig[],
  actor: PlayerID,
  cardId?: CardID,
): Effect[] {
  const effects: Effect[] = [];

  configs.forEach((cfg) => {
    switch (cfg.type) {
      case 'mana_gain': {
        const c = cfg as ManaGainEffectConfig;
        const eff: ManaGainEffect = {
          type: 'MANA_GAIN',
          owner: actor,
          value: c.value,
          target: c.target,
        };
        effects.push(eff);
        break;
      }
      case 'damage': {
        const c = cfg as DamageEffectConfig;
        const eff: DamageEffect = {
          type: 'DAMAGE',
          owner: actor,
          value: c.value,
          target: c.target,
          range: c.range,
          condition: c.condition,
        };
        effects.push(eff);
        break;
      }
      case 'heal': {
        const c = cfg as HealEffectConfig;
        const eff: HealEffect = {
          type: 'HEAL',
          owner: actor,
          value: c.value,
          target: c.target,
          condition: c.condition,
        };
        effects.push(eff);
        break;
      }
      case 'draw': {
        const c = cfg as DrawEffectConfig;
        const eff: DrawEffect = {
          type: 'DRAW',
          owner: actor,
          value: c.value,
          target: c.target,
        };
        effects.push(eff);
        break;
      }
      case 'draw_cata': {
        const c = cfg as DrawCataEffectConfig;
        const eff: DrawCataEffect = {
          type: 'DRAW_CATA',
          owner: actor,
          value: c.value,
          condition: c.condition,
        };
        effects.push(eff);
        break;
      }
      case 'discard': {
        const c = cfg as DiscardEffectConfig;
        const eff: DiscardEffect = {
          type: 'DISCARD',
          owner: actor,
          value: c.value,
          target: c.target,
          method: c.method,
          condition: c.condition,
        };
        effects.push(eff);
        break;
      }
      case 'burn': {
        const c = cfg as BurnEffectConfig;
        const eff: BurnEffect = {
          type: 'BURN',
          owner: actor,
          target: c.target,
          method: c.method,
          value: c.value,
          condition: c.condition,
          cardId,
        };
        effects.push(eff);
        break;
      }
      case 'install': {
        const c = cfg as InstallEffectConfig;
        const eff: InstallEffect = {
          type: 'INSTALL',
          owner: actor,
          object: c.object,
          range: c.range,
        };
        effects.push(eff);
        break;
      }
      case 'move': {
        const c = cfg as MoveEffectConfig;
        // 현재는 forward 한 칸 이동만 지원 (기존 executor.applyMove와 동일한 제한)
        const eff: MoveEffect = {
          type: 'MOVE',
          owner: actor,
          direction: c.direction ?? 'forward',
          value: c.value,
        };
        effects.push(eff);
        break;
      }
      default:
        break;
    }
  });

  return effects;
}
