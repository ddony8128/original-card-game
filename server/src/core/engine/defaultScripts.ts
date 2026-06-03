import type { PlayerID } from '../../type/gameState';
import type {
  PlayerActionPayload,
  PlayerActionKind,
  MoveActionPayload,
  UseCardActionPayload,
  UseRitualActionPayload,
} from '../../type/wsProtocol';
import type { GameEngineCore, EngineResult } from './gameEngineCore';
import type { EffectResolverFn } from './effectResolver';
import { resolveEffect } from './effectResolver';
import {
  handleMoveAction,
  handleEndTurnAction,
  handleUseCardAction,
} from './actionHandlers';

/**
 * 순수 엔진(GameEngineCore)에 외부에서 주입되는 "스크립트 해석기" 레이어의
 * 기본 구현 모음.
 *
 * - defaultEffectResolver: 이펙트 → 상태 변경 매핑 (resolveEffect)
 * - defaultActionHandlers: player_action 종류 → 처리 함수 매핑
 *
 * EngineConfig 에 effectResolver / actionHandlers 를 주입하지 않으면
 * 여기 정의된 기본 구현이 사용되어, 기존 동작이 그대로 보존된다.
 */

/** player_action 한 종류를 처리하는 핸들러 시그니처 */
export type ActionHandler = (
  engine: GameEngineCore,
  playerId: PlayerID,
  action: PlayerActionPayload,
) => Promise<EngineResult[]>;

/** action 종류 → 핸들러 매핑 (일부만 정의 가능) */
export type ActionHandlerMap = Partial<Record<PlayerActionKind, ActionHandler>>;

/** 기본 이펙트 해석기 (기존 직접 import 하던 resolveEffect 와 동일) */
export const defaultEffectResolver: EffectResolverFn = resolveEffect;

/**
 * 기본 액션 핸들러 맵.
 *
 * 각 핸들러는 기존 handlePlayerAction switch 문에서 인라인으로 수행하던
 * payload narrowing 을 그대로 수행하여 기존 동작을 보존한다.
 */
export const defaultActionHandlers: ActionHandlerMap = {
  move: (engine, playerId, action) =>
    handleMoveAction(engine, playerId, {
      to: (action as MoveActionPayload).to,
    }),
  end_turn: (engine, playerId) => handleEndTurnAction(engine, playerId),
  use_card: (engine, playerId, action) => {
    const useCard = action as UseCardActionPayload;
    return handleUseCardAction(
      engine,
      playerId,
      useCard.cardInstance,
      useCard.target,
    );
  },
  use_ritual: (engine, playerId, action) =>
    engine.handleUseRitualAction(playerId, action as UseRitualActionPayload),
};
