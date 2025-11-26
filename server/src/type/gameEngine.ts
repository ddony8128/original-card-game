import type { PlayerID, GameState } from './gameState';
import type {
  AskMulliganPayload,
  GameOverPayload,
  InvalidActionPayload,
  PlayerActionPayload,
  PlayerInputPayload,
  RequestInputPayload,
  StatePatchPayload,
} from './wsProtocol';
import {
  GameEngineCore,
  type EngineConfig,
  type EngineResult,
} from '../core/engine';
import type { EngineContext } from '../core/context';

/**
 * GameEngineCore 를 WebSocket 과 무관한 콜백 기반 인터페이스로 감싼 래퍼.
 *
 * - 내부에서는 순수 상태 머신인 GameEngineCore 만 알고
 * - 외부에는 onStatePatch / onRequestInput / onGameOver 등 콜백만 노출한다.
 */

export interface GameEngineEventHandlers {
  onStatePatch?: (
    targetPlayer: PlayerID | null | undefined,
    payload: StatePatchPayload,
  ) => void;
  onAskMulligan?: (
    targetPlayer: PlayerID | null | undefined,
    payload: AskMulliganPayload,
  ) => void;
  onRequestInput?: (
    targetPlayer: PlayerID | null | undefined,
    payload: RequestInputPayload,
  ) => void;
  onGameOver?: (payload: GameOverPayload) => void;
  onInvalidAction?: (
    targetPlayer: PlayerID | null | undefined,
    payload: InvalidActionPayload,
  ) => void;
}

export interface GameEngineInstanceConfig extends EngineConfig {
  initialState: GameState;
  ctx: EngineContext;
}

export class GameEngineAdapter {
  private readonly core: GameEngineCore;
  readonly roomCode: string;
  readonly players: PlayerID[];

  private handlers: GameEngineEventHandlers = {};

  private constructor(core: GameEngineCore) {
    this.core = core;
    this.roomCode = core.roomCode;
    this.players = core.players;
  }

  static create(config: GameEngineInstanceConfig): GameEngineAdapter {
    const { initialState, ctx, ...engineConfig } = config;
    const core = GameEngineCore.create(initialState, ctx, engineConfig);
    return new GameEngineAdapter(core);
  }

  // read-only 노출

  get state(): GameState {
    return this.core.state;
  }

  getCore(): GameEngineCore {
    return this.core;
  }

  // ---- 콜백 등록 ----

  onStatePatch(handler: GameEngineEventHandlers['onStatePatch']) {
    this.handlers.onStatePatch = handler ?? undefined;
  }

  onAskMulligan(handler: GameEngineEventHandlers['onAskMulligan']) {
    this.handlers.onAskMulligan = handler ?? undefined;
  }

  onRequestInput(handler: GameEngineEventHandlers['onRequestInput']) {
    this.handlers.onRequestInput = handler ?? undefined;
  }

  onGameOver(handler: GameEngineEventHandlers['onGameOver']) {
    this.handlers.onGameOver = handler ?? undefined;
  }

  onInvalidAction(handler: GameEngineEventHandlers['onInvalidAction']) {
    this.handlers.onInvalidAction = handler ?? undefined;
  }

  // ---- 외부에서 사용하는 주요 메서드 ----

  /**
   * 플레이어가 ready 를 눌렀을 때 호출.
   */
  async markReady(): Promise<void> {
    const results = await this.core.markReady();
    this.dispatchResults(results);
  }

  /**
   * 일반적인 player_action 처리 (이동, 턴 종료, 카드 사용 등).
   */
  async handlePlayerAction(
    playerId: PlayerID,
    action: PlayerActionPayload,
  ): Promise<void> {
    console.log('[GameEngine] handlePlayerAction', playerId, action);
    const results = await this.core.handlePlayerAction(playerId, action);
    this.dispatchResults(results);
  }

  /**
   * 멀리건 응답 처리.
   */
  async handleAnswerMulligan(
    playerId: PlayerID,
    payload: { replaceIndices: number[] },
  ) {
    console.log('[GameEngine] handleAnswerMulligan', playerId, payload);
    const results = await this.core.handleAnswerMulligan(playerId, payload);
    this.dispatchResults(results);
  }

  /**
   * request_input 에 대한 일반 응답 처리.
   */
  async handlePlayerInput(
    playerId: PlayerID,
    payload: PlayerInputPayload,
  ): Promise<void> {
    console.log('[GameEngine] handlePlayerInput', playerId, payload);
    const results = await this.core.handlePlayerInput(playerId, payload);
    this.dispatchResults(results);
  }

  // ---- 내부: EngineResult → 콜백 변환 ----

  private dispatchResults(results: EngineResult[]) {
    for (const r of results) {
      switch (r.kind) {
        case 'state_patch':
          if (r.statePatch && this.handlers.onStatePatch) {
            console.log(
              '[GameEngine] dispatchResults state_patch',
              r.targetPlayer,
              r.statePatch,
            );
            this.handlers.onStatePatch(r.targetPlayer ?? null, r.statePatch);
          }
          break;
        case 'ask_mulligan':
          if (r.askMulligan && this.handlers.onAskMulligan) {
            console.log(
              '[GameEngine] dispatchResults ask_mulligan',
              r.targetPlayer,
              r.askMulligan,
            );
            this.handlers.onAskMulligan(r.targetPlayer ?? null, r.askMulligan);
          }
          break;
        case 'request_input':
          if (r.requestInput && this.handlers.onRequestInput) {
            console.log(
              '[GameEngine] dispatchResults request_input',
              r.targetPlayer,
              r.requestInput,
            );
            this.handlers.onRequestInput(
              r.targetPlayer ?? null,
              r.requestInput,
            );
          }
          break;
        case 'game_over':
          if (r.gameOver && this.handlers.onGameOver) {
            console.log('[GameEngine] dispatchResults game_over', r.gameOver);
            this.handlers.onGameOver(r.gameOver);
          }
          break;
        case 'invalid_action':
          if (this.handlers.onInvalidAction) {
            console.log(
              '[GameEngine] dispatchResults invalid_action',
              r.targetPlayer,
              r.invalidReason,
            );
            const payload: InvalidActionPayload = {
              reason: (r.invalidReason ??
                'invalid_action') as InvalidActionPayload['reason'],
            };
            this.handlers.onInvalidAction(r.targetPlayer ?? null, payload);
          }
          break;
        default:
          // 알 수 없는 결과 타입은 무시
          break;
      }
    }
  }
}
