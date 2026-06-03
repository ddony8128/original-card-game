import type { DiffPatch } from '../../type/wsProtocol';
import type { GameEngineCore } from './gameEngineCore';
import type { Effect } from '../effects/effectTypes';
import { resolveManaPay, resolveManaGain } from './resolvers/manaResolvers';
import {
  resolveTurnEnd,
  resolveTurnStart,
  resolveChangeTurn,
} from './resolvers/turnResolvers';
import { resolveMove } from './resolvers/movementResolvers';
import {
  resolveCastExecute,
  resolveInstall,
  resolveThrowResolveStack,
} from './resolvers/castResolvers';
import { resolveDamage, resolveHeal } from './resolvers/combatResolvers';
import {
  resolveDraw,
  resolveDrawCata,
  resolveDiscard,
  resolveBurn,
} from './resolvers/cardFlowResolvers';
import {
  resolveTriggeredEffect,
  resolvePlayerInput,
} from './resolvers/triggerResolvers';

export type EffectResolverFn = (
  engine: GameEngineCore,
  effect: Effect,
  diff: DiffPatch,
) => Promise<void> | void;

const EFFECT_RESOLVERS: Partial<Record<Effect['type'], EffectResolverFn>> = {
  MANA_PAY: resolveManaPay as EffectResolverFn,
  MANA_GAIN: resolveManaGain as EffectResolverFn,
  MOVE: resolveMove as EffectResolverFn,
  TURN_END: resolveTurnEnd as EffectResolverFn,
  TURN_START: resolveTurnStart as EffectResolverFn,
  CHANGE_TURN: resolveChangeTurn as EffectResolverFn,
  INSTALL: resolveInstall as EffectResolverFn,
  CAST_EXECUTE: resolveCastExecute as EffectResolverFn,
  DAMAGE: resolveDamage as EffectResolverFn,
  HEAL: resolveHeal as EffectResolverFn,
  DRAW: resolveDraw as EffectResolverFn,
  DRAW_CATA: resolveDrawCata as EffectResolverFn,
  DISCARD: resolveDiscard as EffectResolverFn,
  THROW_RESOLVE_STACK: resolveThrowResolveStack as EffectResolverFn,
  BURN: resolveBurn as EffectResolverFn,
  TRIGGERED_EFFECT: resolveTriggeredEffect as EffectResolverFn,
  RESOLVE_PLAYER_INPUT: resolvePlayerInput as EffectResolverFn,
};

export async function resolveEffect(
  engine: GameEngineCore,
  effect: Effect,
  diff: DiffPatch,
) {
  const resolver = EFFECT_RESOLVERS[effect.type];
  if (resolver) await resolver(engine, effect, diff);
}
