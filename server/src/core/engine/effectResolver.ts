import type { DiffPatch } from '../../type/wsProtocol';
import type { GameEngineCore } from './gameEngineCore';
import type {
  Effect,
  MoveEffect,
  TurnEndEffect,
  TurnStartEffect,
  InstallEffect,
  CastExecuteEffect,
  TriggeredEffect,
  ManaPayEffect,
  ManaGainEffect,
  DamageEffect,
  HealEffect,
  DrawEffect,
  DrawCataEffect,
  ThrowResolveStackEffect,
  DiscardEffect,
  BurnEffect,
} from '../effects/effectTypes';
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

/**
 * Effect 한 개를 실제 게임 상태 변경으로 해석하는 실행기.
 *
 * - `GameEngineCore.stepUntilStable` 에서 EffectStack 에서 pop 한 Effect 를 넘겨 받는다.
 * - 상태 변경 / 애니메이션 / 로그를 모두 `diff` 에 누적하고,
 *   필요하면 추가 Effect 들을 다시 EffectStack 에 push 하면서 연쇄 처리를 만든다.
 * - 카드 effectJson(onCast / onDrawn / onDestroy 등)은 여기에서만 실제로 처리된다.
 */
export async function resolveEffect(
  engine: GameEngineCore,
  effect: Effect,
  diff: DiffPatch,
) {
  switch (effect.type) {
    case 'MANA_PAY': {
      await resolveManaPay(engine, effect as ManaPayEffect, diff);
      break;
    }
    case 'MANA_GAIN': {
      await resolveManaGain(engine, effect as ManaGainEffect, diff);
      break;
    }
    case 'MOVE': {
      await resolveMove(engine, effect as MoveEffect, diff);
      break;
    }
    case 'TURN_END': {
      await resolveTurnEnd(engine, effect as TurnEndEffect, diff);
      break;
    }
    case 'TURN_START': {
      await resolveTurnStart(engine, effect as TurnStartEffect, diff);
      break;
    }
    case 'CHANGE_TURN': {
      await resolveChangeTurn(engine, effect, diff);
      break;
    }
    case 'INSTALL': {
      await resolveInstall(engine, effect as InstallEffect, diff);
      break;
    }
    case 'CAST_EXECUTE': {
      await resolveCastExecute(engine, effect as CastExecuteEffect, diff);
      break;
    }
    case 'DAMAGE': {
      await resolveDamage(engine, effect as DamageEffect, diff);
      break;
    }
    case 'HEAL': {
      await resolveHeal(engine, effect as HealEffect, diff);
      break;
    }
    case 'DRAW': {
      await resolveDraw(engine, effect as DrawEffect, diff);
      break;
    }
    case 'DRAW_CATA': {
      await resolveDrawCata(engine, effect as DrawCataEffect, diff);
      break;
    }
    case 'DISCARD': {
      await resolveDiscard(engine, effect as DiscardEffect, diff);
      break;
    }
    case 'THROW_RESOLVE_STACK': {
      await resolveThrowResolveStack(
        engine,
        effect as ThrowResolveStackEffect,
        diff,
      );
      break;
    }
    case 'BURN': {
      await resolveBurn(engine, effect as BurnEffect, diff);
      break;
    }
    case 'TRIGGERED_EFFECT': {
      await resolveTriggeredEffect(engine, effect as TriggeredEffect, diff);
      break;
    }
    case 'RESOLVE_PLAYER_INPUT': {
      await resolvePlayerInput(engine, effect as any, diff);
      break;
    }
    default:
      // 아직 구현되지 않은 Effect 타입
      break;
  }
}
