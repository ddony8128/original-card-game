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
  onStatePatch?: (targetPlayer: PlayerID | null | undefined, payload: StatePatchPayload) => void;
  onAskMulligan?: (targetPlayer: PlayerID | null | undefined, payload: AskMulliganPayload) => void;
  onRequestInput?: (targetPlayer: PlayerID | null | undefined, payload: RequestInputPayload) => void;
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

export class GameEngine {
  private readonly core: GameEngineCore;
  readonly roomId: string;
  readonly players: PlayerID[];

  private handlers: GameEngineEventHandlers = {};
  private readonly readyPlayers = new Set<PlayerID>();
  private started = false;

  private constructor(core: GameEngineCore) {
    this.core = core;
    this.roomId = core.roomId;
    this.players = core.players;
  }

  static create(config: GameEngineInstanceConfig): GameEngine {
    const { initialState, ctx, ...engineConfig } = config;
    const core = GameEngineCore.create(initialState, ctx, engineConfig);
    return new GameEngine(core);
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
   * 내부적으로 모든 플레이어가 ready 가 되면 초기화 + 멀리건 요청/상태 패치를 발생시킨다.
   */
  async markReady(playerId: PlayerID): Promise<void> {
    if (this.started) return;
    if (this.readyPlayers.has(playerId)) return;

    this.readyPlayers.add(playerId);
    const results = this.core.markReady(playerId);
    if (this.readyPlayers.size >= this.players.length) {
      this.started = true;
    }
    this.dispatchResults(results);
  }

  /**
   * 일반적인 player_action 처리 (이동, 턴 종료, 카드 사용 등).
   */
  async handlePlayerAction(playerId: PlayerID, action: PlayerActionPayload): Promise<void> {
    const results = await this.core.handlePlayerAction(playerId, action);
    this.dispatchResults(results);
  }

  /**
   * 멀리건 응답 처리.
   */
  async handleAnswerMulligan(playerId: PlayerID, payload: { replaceIndices: number[] }) {
    const results = await this.core.handleAnswerMulligan(playerId, payload);
    this.dispatchResults(results);
  }

  /**
   * request_input 에 대한 일반 응답 처리.
   */
  async handlePlayerInput(playerId: PlayerID, payload: PlayerInputPayload): Promise<void> {
    const results = await this.core.handlePlayerInput(playerId, payload);
    this.dispatchResults(results);
  }

  // ---- 내부: EngineResult → 콜백 변환 ----

  private dispatchResults(results: EngineResult[]) {
    for (const r of results) {
      switch (r.kind) {
        case 'state_patch':
          if (r.statePatch && this.handlers.onStatePatch) {
            this.handlers.onStatePatch(r.targetPlayer ?? null, r.statePatch);
          }
          break;
        case 'ask_mulligan':
          if (r.askMulligan && this.handlers.onAskMulligan) {
            this.handlers.onAskMulligan(r.targetPlayer ?? null, r.askMulligan);
          }
          break;
        case 'request_input':
          if (r.requestInput && this.handlers.onRequestInput) {
            this.handlers.onRequestInput(r.targetPlayer ?? null, r.requestInput);
          }
          break;
        case 'game_over':
          if (r.gameOver && this.handlers.onGameOver) {
            this.handlers.onGameOver(r.gameOver);
          }
          break;
        case 'invalid_action':
          if (this.handlers.onInvalidAction) {
            const payload: InvalidActionPayload = {
              reason: (r.invalidReason ?? 'invalid_action') as InvalidActionPayload['reason'],
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
