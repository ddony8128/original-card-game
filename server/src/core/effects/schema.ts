import type {
  CardID,
  PlayerID,
  CardInstance,
  CardInstanceId,
} from '../../type/gameState';
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
  /** 선택형 타겟 모드 (예: select_damage_target 사용 시) */
  selectMode?: 'choose_target';
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
  /**
   * burn 동작 방식 (일반 모드)
   * - deck_random / deck_top : 덱에서 N장 소멸
   * - instance : 특정 인스턴스를 소멸 (엔진에서 instanceId 주입)
   *
   * burn this 와 같이 "이 카드 자신"을 태우는 경우에는
   * object: 'this' 를 사용하고, method 는 생략해도 된다.
   */
  method?: 'deck_random' | 'deck_top' | 'instance';
  value?: number;
  condition?: EffectCondition;
  /** burn this 패턴: object가 'this' 이면, 현재 카드 인스턴스를 대상으로 소멸 */
  object?: 'this';
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

export interface BuildEffectsOptions {
  invertSelfEnemy?: boolean;
  /**
   * burn this / 기타 "this" 참조용:
   * 현재 효과를 발생시킨 카드 인스턴스 id
   */
  sourceInstanceId?: CardInstanceId;
}

export function buildEffectsFromConfigs(
  configs: EffectConfig[],
  actor: PlayerID,
  cardId?: CardID,
  options?: BuildEffectsOptions,
): Effect[] {
  const effects: Effect[] = [];

  configs.forEach((cfg) => {
    switch (cfg.type) {
      case 'mana_gain': {
        const c = cfg as ManaGainEffectConfig;
        const target =
          options?.invertSelfEnemy && c.target === 'self'
            ? 'enemy'
            : options?.invertSelfEnemy && c.target === 'enemy'
              ? 'self'
              : c.target;
        const eff: ManaGainEffect = {
          type: 'MANA_GAIN',
          owner: actor,
          value: c.value,
          target,
        };
        effects.push(eff);
        break;
      }
      case 'damage': {
        const c = cfg as DamageEffectConfig;
        const target =
          options?.invertSelfEnemy && c.target === 'self'
            ? 'enemy'
            : options?.invertSelfEnemy && c.target === 'enemy'
              ? 'self'
              : c.target;

        // 이 게임에서는 자동 대상(near_enemy 자동 타격)을 사용하지 않는다.
        // 카드 JSON에 type: damage, target: near_enemy, range: N 이 들어오면
        // 무조건 플레이어 선택형(select_damage_target)으로 처리하기 위해
        // selectMode 를 강제로 'choose_target' 으로 설정한다.
        let selectMode = c.selectMode;
        if (
          !selectMode &&
          c.target === 'near_enemy' &&
          typeof c.range === 'number'
        ) {
          selectMode = 'choose_target';
        }

        const eff: DamageEffect = {
          type: 'DAMAGE',
          owner: actor,
          value: c.value,
          target,
          range: c.range,
          condition: c.condition,
          selectMode,
        };
        effects.push(eff);
        break;
      }
      case 'heal': {
        const c = cfg as HealEffectConfig;
        const target =
          options?.invertSelfEnemy && c.target === 'self'
            ? 'enemy'
            : options?.invertSelfEnemy && c.target === 'enemy'
              ? 'self'
              : c.target;
        const eff: HealEffect = {
          type: 'HEAL',
          owner: actor,
          value: c.value,
          target,
          condition: c.condition,
        };
        effects.push(eff);
        break;
      }
      case 'draw': {
        const c = cfg as DrawEffectConfig;
        const target =
          options?.invertSelfEnemy && c.target === 'self'
            ? 'enemy'
            : options?.invertSelfEnemy && c.target === 'enemy'
              ? 'self'
              : c.target;
        const eff: DrawEffect = {
          type: 'DRAW',
          owner: actor,
          value: c.value,
          target,
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
        const target =
          options?.invertSelfEnemy && c.target === 'self'
            ? 'enemy'
            : options?.invertSelfEnemy && c.target === 'enemy'
              ? 'self'
              : c.target;
        const eff: DiscardEffect = {
          type: 'DISCARD',
          owner: actor,
          value: c.value,
          target,
          method: c.method,
          condition: c.condition,
        };
        effects.push(eff);
        break;
      }
      case 'burn': {
        const c = cfg as BurnEffectConfig;
        const target =
          options?.invertSelfEnemy && c.target === 'self'
            ? 'enemy'
            : options?.invertSelfEnemy && c.target === 'enemy'
              ? 'self'
              : c.target;
        // 기본 method / instanceId
        let method = c.method;
        let instanceId: CardInstanceId | undefined;

        // burn this: object === 'this' 이고, sourceInstanceId 가 주어지면
        // 해당 인스턴스를 소멸 대상으로 지정한다.
        if (c.object === 'this' && options?.sourceInstanceId) {
          method = 'instance';
          instanceId = options.sourceInstanceId;
        }

        const eff: BurnEffect = {
          type: 'BURN',
          owner: actor,
          target,
          method,
          value: c.value,
          condition: c.condition,
          cardId,
          instanceId,
        };
        effects.push(eff);
        break;
      }
      case 'install': {
        const c = cfg as InstallEffectConfig;
        const dummyInstance: CardInstance = {
          id: `install_${actor}_${c.object}`,
          cardId: c.object as CardID,
        };
        const eff: InstallEffect = {
          type: 'INSTALL',
          owner: actor,
          object: dummyInstance,
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
