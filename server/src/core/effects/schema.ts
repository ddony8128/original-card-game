import type { CardID } from '../../type/gameState';

export type EffectTrigger =
  | 'onCast'
  | 'onTurnEnd'
  | 'onDestroy'
  | 'onTurnStart'
  | 'onUsePerTurn'
  | 'onDrawn';

export type EffectTarget = 'self' | 'enemy' | 'near_enemy';

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
  condition?: string;
}

export interface HealEffectConfig {
  type: 'heal';
  value: number;
  target: 'self' | 'enemy';
  condition?: string;
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
  condition?: string;
}

export interface DiscardEffectConfig {
  type: 'discard';
  value: number;
  target: 'enemy' | 'self';
  method: 'deck_random' | 'deck_top' | 'hand_choose' | 'hand_random';
  condition?: string;
}

export interface BurnEffectConfig {
  type: 'burn';
  target: 'self' | 'enemy';
  method?: 'deck_random' | 'deck_top' | 'this';
  value?: number;
  condition?: string;
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


