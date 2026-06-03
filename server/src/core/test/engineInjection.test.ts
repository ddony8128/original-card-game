import { describe, it, expect } from 'vitest';
import { GamePhase, type GameState, type PlayerID } from '../../type/gameState';
import type { EngineContext } from '../context';
import {
  GameEngineCore,
  type EngineResult,
} from '../engine/gameEngineCore';
import type { ActionHandler } from '../engine/defaultScripts';

const P1: PlayerID = 'p1';
const P2: PlayerID = 'p2';

const ctx: EngineContext = {
  lookupCard: async () => Promise.resolve(null),
};

/**
 * handlePlayerAction 의 dispatch 단계까지 도달하기 위한 최소 상태를 만든다.
 * (phase = WAITING_FOR_PLAYER_ACTION, activePlayer = P1)
 */
function makeMinimalState(): GameState {
  return {
    phase: GamePhase.WAITING_FOR_PLAYER_ACTION,
    activePlayer: P1,
    // handleMoveAction 이 board.wizards 를 읽으므로 빈 보드를 둔다.
    board: { wizards: {} },
  } as unknown as GameState;
}

describe('GameEngineCore action handler injection', () => {
  it('주입된 actionHandlers 가 기본 핸들러 대신 사용된다', async () => {
    const sentinel: EngineResult[] = [
      {
        kind: 'invalid_action',
        targetPlayer: P1,
        invalidReason: 'INJECTED_MOVE_SENTINEL',
      },
    ];

    let injectedCalled = false;
    const customMove: ActionHandler = async (_engine, _pid, _action) => {
      injectedCalled = true;
      return sentinel;
    };

    const engine = GameEngineCore.create(makeMinimalState(), ctx, {
      roomCode: 'inject-room',
      players: [P1, P2],
      actionHandlers: { move: customMove },
    });

    const results = await engine.handlePlayerAction(P1, {
      action: 'move',
      to: [0, 1],
    });

    // 주입된 핸들러가 호출되었고, 기본 handleMoveAction(검증 후 'no_wizard'
    // 등을 반환)이 아니라 우리가 넣은 sentinel 이 그대로 반환되어야 한다.
    expect(injectedCalled).toBe(true);
    expect(results).toEqual(sentinel);
  });

  it('주입하지 않은 종류는 기본 핸들러로 fallback 한다', async () => {
    // end_turn 만 sentinel 로 덮어쓰고 move 는 주입하지 않는다.
    const engine = GameEngineCore.create(makeMinimalState(), ctx, {
      roomCode: 'inject-room',
      players: [P1, P2],
      actionHandlers: {
        end_turn: async () => [
          {
            kind: 'invalid_action',
            targetPlayer: P1,
            invalidReason: 'INJECTED_END_TURN_SENTINEL',
          },
        ],
      },
    });

    // move 는 주입하지 않았으므로 기본 handleMoveAction 이 실행된다.
    // 최소 상태에는 board.wizards 가 없으므로 'no_wizard' 를 반환한다.
    // (sentinel 이 아니라 기본 핸들러의 검증 결과여야 한다.)
    const results = await engine.handlePlayerAction(P1, {
      action: 'move',
      to: [0, 1],
    });
    expect(results).toEqual([
      {
        kind: 'invalid_action',
        targetPlayer: P1,
        invalidReason: 'no_wizard',
      },
    ]);
  });

  it('핸들러가 없는 미지원 action 은 unknown_action 을 반환한다', async () => {
    const engine = GameEngineCore.create(makeMinimalState(), ctx, {
      roomCode: 'inject-room',
      players: [P1, P2],
    });

    const results = await engine.handlePlayerAction(P1, {
      action: 'no_such_action',
    });
    expect(results).toEqual([
      {
        kind: 'invalid_action',
        targetPlayer: P1,
        invalidReason: 'unknown_action',
      },
    ]);
  });
});
