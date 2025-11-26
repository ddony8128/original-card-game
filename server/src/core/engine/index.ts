import {
  GamePhase,
  type GameState,
  type PlayerID,
  type CardID,
  type CardInstance,
} from '../../type/gameState';
import type {
  DiffPatch,
  GameOverPayload,
  RequestInputPayload,
  StatePatchPayload,
  AskMulliganPayload,
  AnswerMulliganPayload,
  PlayerActionPayload,
  PlayerInputPayload,
} from '../../type/wsProtocol';
import type { EngineContext } from '../context';
import { EffectStack } from '../effects/effectStack';
import type { TurnStartEffect, InstallEffect } from '../effects/effectTypes';
import type { RequestInputKind } from '../../type/wsProtocol';
import { ObserverRegistry } from '../observers';
import {
  parseCardEffectJson,
  type EffectTrigger,
  buildEffectsFromConfigs,
  type BuildEffectsOptions,
} from '../effects/schema';
import { fromViewerPos, shuffle, canInstallAt } from './boardUtils';
import { buildStatePatchForAllView } from './view';
import {
  handleMoveAction,
  handleEndTurnAction,
  handleUseCardAction,
} from './actionHandlers';
import { resolveEffect } from './effectResolver';

export type EngineResultKind =
  | 'state_patch'
  | 'request_input'
  | 'ask_mulligan'
  | 'game_over'
  | 'invalid_action';

export interface EngineResult {
  kind: EngineResultKind;
  targetPlayer?: PlayerID | null;
  statePatch?: StatePatchPayload;
  requestInput?: RequestInputPayload;
  askMulligan?: AskMulliganPayload;
  gameOver?: GameOverPayload;
  invalidReason?: string;
}

export interface EngineConfig {
  roomCode: string;
  players: PlayerID[];
}

export class GameEngineCore {
  readonly roomCode: string;
  readonly players: PlayerID[];
  readonly ctx: Required<EngineContext>;
  bottomSidePlayerId: PlayerID | null = null;

  state: GameState;
  readonly effectStack: EffectStack;
  readonly observers: ObserverRegistry;
  private version = 1; // state patch마다 1씩 증가
  private initialized = false; // 게임 초기화 여부, 중복 초기화 방지
  pendingInput: {
    playerId: PlayerID;
    kind: RequestInputKind;
    cardId?: CardID;
    cardInstance?: CardInstance;
    count?: number;
    installRange?: number;
    /** 선택형 damage 용: 데미지 수치 */
    damageValue?: number | string;
    /**
     * request_input 으로 클라이언트에 전달할 선택지 목록.
     * (예: discard 대상 카드 id 리스트, 설치 가능 좌표 등)
     */
    options?: unknown[];
  } | null = null;

  constructor(
    initialState: GameState,
    ctx: EngineContext,
    roomCode: string,
    players: PlayerID[],
  ) {
    this.state = initialState;
    this.effectStack = new EffectStack();
    this.observers = new ObserverRegistry();
    this.roomCode = roomCode;
    this.players = players;

    this.ctx = {
      lookupCard: ctx.lookupCard,
      random: ctx.random ?? Math.random,
      now: ctx.now ?? Date.now,
      log: ctx.log ?? (() => {}),
    };
  }

  static create(
    initialState: GameState,
    ctx: EngineContext,
    config: EngineConfig,
  ): GameEngineCore {
    return new GameEngineCore(
      initialState, // GamePhase.INITIALIZING
      ctx,
      config.roomCode,
      config.players,
    );
  }

  async markReady(): Promise<EngineResult[]> {
    // 모든 플레이어 ready → 게임 초기화

    if (this.initialized) return [];
    this.initializeGame();
    this.initialized = true;

    this.state.phase = GamePhase.WAITING_FOR_MULLIGAN;

    const results: EngineResult[] = [];

    // 초기 상태 패치
    results.push(...(await this.buildStatePatchForAll()));
    this.players.forEach((pid) => {
      const player = this.state.players[pid];
      const initialHand = [...player.hand];
      const payload: AskMulliganPayload = {
        initialHand,
      };
      results.push({
        kind: 'ask_mulligan',
        targetPlayer: pid,
        askMulligan: payload,
      });
    });

    return results;
  }

  private initializeGame() {
    // 선후공 랜덤 결정
    const firstIdx = Math.floor(this.ctx.random() * this.players.length);
    const firstPlayer = this.players[firstIdx];
    // 화면 기준 아래쪽 플레이어는 항상 players[0]으로 고정
    // (호스트를 항상 아래에서 보게 하기 위함)
    this.bottomSidePlayerId = this.players[0] ?? firstPlayer;
    this.state.turn = 1;
    this.state.activePlayer = firstPlayer;

    // 각 플레이어 덱 셔플 및 초기 드로우
    this.players.forEach((pid, idx) => {
      const playerState = this.state.players[pid];
      shuffle(playerState.deck, this.ctx.random);
      shuffle(this.state.catastropheDeck, this.ctx.random);
      const drawCount = idx === firstIdx ? 2 : 3;
      for (let i = 0; i < drawCount; i += 1) {
        this.bringCardToHand(pid);
      }
      playerState.mulliganSelected = false;
    });
  }

  async handlePlayerAction(
    playerId: PlayerID,
    action: PlayerActionPayload,
  ): Promise<EngineResult[]> {
    const gameOverCheck = this.checkPhaseNot(
      [GamePhase.GAME_OVER],
      playerId,
      'game_over',
    );
    if (gameOverCheck) return gameOverCheck;

    const notStartedCheck = this.checkPhaseNot(
      [GamePhase.INITIALIZING, GamePhase.WAITING_FOR_MULLIGAN],
      playerId,
      'game_not_started',
    );
    if (notStartedCheck) return notStartedCheck;

    const invalidPhaseCheck = this.checkPhase(
      GamePhase.WAITING_FOR_PLAYER_ACTION,
      playerId,
      'invalid_phase',
    );
    if (invalidPhaseCheck) return invalidPhaseCheck;
    if (this.state.activePlayer !== playerId) {
      return [
        {
          kind: 'invalid_action',
          targetPlayer: playerId,
          invalidReason: 'not_your_turn',
        },
      ];
    }

    const actionType = action.action;

    switch (actionType) {
      case 'move':
        return await handleMoveAction(this, playerId, {
          to: (action as any).to as [number, number],
        });
      case 'end_turn':
        return await handleEndTurnAction(this, playerId);
      case 'use_card':
        return await handleUseCardAction(
          this,
          playerId,
          (action as any).cardInstance as CardInstance,
          (action as any).target as [number, number] | undefined,
        );
      case 'use_ritual':
        // 보드 위에 설치된 자신의 ritual 을 1턴 1회 사용(onUsePerTurn)하는 액션
        return await this.handleUseRitualAction(playerId, action as any);
      default:
        return [
          {
            kind: 'invalid_action',
            targetPlayer: playerId,
            invalidReason: 'unknown_action',
          },
        ];
    }
  }

  // ---- 검증 헬퍼 함수 ----

  /**
   * invalid_action EngineResult 생성
   */
  invalidAction(playerId: PlayerID, reason: string): EngineResult[] {
    return [
      {
        kind: 'invalid_action',
        targetPlayer: playerId,
        invalidReason: reason,
      },
    ];
  }

  /**
   * 조건이 false면 invalid_action 반환, true면 null 반환
   * @returns null이면 통과, 아니면 invalid_action EngineResult 반환
   */
  require(
    condition: boolean,
    playerId: PlayerID,
    reason: string,
  ): EngineResult[] | null {
    return condition ? null : this.invalidAction(playerId, reason);
  }

  /**
   * 현재 phase가 예상한 phase인지 확인
   * @returns null이면 통과, 아니면 invalid_action EngineResult 반환
   */
  checkPhase(
    expectedPhase: GamePhase,
    playerId: PlayerID,
    invalidReason: string,
  ): EngineResult[] | null {
    return this.require(
      this.state.phase === expectedPhase,
      playerId,
      invalidReason,
    );
  }

  /**
   * 현재 phase가 예상하지 않은 phase 중 하나인지 확인
   * @returns null이면 통과, 아니면 invalid_action EngineResult 반환
   */
  checkPhaseNot(
    unexpectedPhases: GamePhase[],
    playerId: PlayerID,
    invalidReason: string,
  ): EngineResult[] | null {
    return this.require(
      !unexpectedPhases.includes(this.state.phase),
      playerId,
      invalidReason,
    );
  }

  // ---- 멀리건 입력 처리 ----

  async handleAnswerMulligan(
    playerId: PlayerID,
    payload: AnswerMulliganPayload,
  ): Promise<EngineResult[]> {
    const phaseCheck = this.checkPhase(
      GamePhase.WAITING_FOR_MULLIGAN,
      playerId,
      'not_mulligan_phase',
    );
    if (phaseCheck) return phaseCheck;
    const playerState = this.state.players[playerId];
    const checkPlayerExists = this.require(
      !!playerState,
      playerId,
      'unknown_player',
    );
    if (checkPlayerExists) return checkPlayerExists;

    // 선택한 손패를 덱으로 돌려보내고 다시 섞은 뒤 동일 개수 드로우
    const indices = [...payload.replaceIndices].sort((a, b) => b - a);
    const returned: typeof playerState.hand = [];
    indices.forEach((idx) => {
      if (idx >= 0 && idx < playerState.hand.length) {
        const [card] = playerState.hand.splice(idx, 1);
        returned.push(card);
      }
    });
    playerState.deck.push(...returned);
    shuffle(playerState.deck, this.ctx.random);
    for (let i = 0; i < returned.length; i += 1) {
      this.bringCardToHand(playerId);
    }
    playerState.mulliganSelected = true;

    const allDone = this.players.every(
      (pid) => this.state.players[pid].mulliganSelected,
    );
    if (!allDone) {
      return await this.buildStatePatchForAll();
    }

    // 모든 플레이어 멀리건 종료 → 첫 턴 시작
    const effect: TurnStartEffect = {
      type: 'TURN_START',
      owner: this.state.activePlayer,
    };
    this.effectStack.push(effect);
    // stepUntilStable에서 RESOLVING으로 설정하고 효과 처리
    return await this.stepUntilStable();
  }

  async handlePlayerInput(
    playerId: PlayerID,
    payload: PlayerInputPayload,
  ): Promise<EngineResult[]> {
    const phaseCheck = this.checkPhase(
      GamePhase.WAITING_FOR_PLAYER_INPUT,
      playerId,
      'not_input_phase',
    );
    if (phaseCheck) return phaseCheck;
    const checkPendingInputExists = this.require(
      !!this.pendingInput && this.pendingInput.playerId === playerId,
      playerId,
      'no_pending_input',
    );
    if (checkPendingInputExists) return checkPendingInputExists;
    // require 체크 후에는 pendingInput이 null이 아님을 보장
    if (!this.pendingInput)
      return this.invalidAction(playerId, 'no_pending_input');

    const pending = this.pendingInput;
    this.pendingInput = null;

    if (
      pending.kind.type === 'map' &&
      pending.kind.kind === 'select_install_position'
    ) {
      const pos = payload.answer as { r: number; c: number } | [number, number];
      const viewR = Array.isArray(pos) ? pos[0] : pos.r;
      const viewC = Array.isArray(pos) ? pos[1] : pos.c;
      const { r, c } = fromViewerPos(
        this.state.board,
        this.bottomSidePlayerId,
        { r: viewR, c: viewC },
        playerId,
      );

      const cardId = pending.cardId;
      const checkCardIdExists = this.require(
        !!cardId,
        playerId,
        'invalid_card',
      );
      if (checkCardIdExists) return checkCardIdExists;
      // require 체크 후에는 cardId가 undefined가 아님을 보장
      if (!cardId) return this.invalidAction(playerId, 'invalid_card');

      // 설치 가능한 위치인지 검증 (canInstallAt 사용)
      const checkCanInstall = this.require(
        canInstallAt(
          this.state.board,
          playerId,
          { r, c },
          pending.installRange,
        ),
        playerId,
        'invalid_position',
      );
      if (checkCanInstall) return checkCanInstall;

      const effect: InstallEffect = {
        type: 'INSTALL',
        owner: playerId,
        object:
          pending.cardInstance ??
          ({
            id: `install_${playerId}_${cardId}`,
            cardId,
          } as CardInstance),
        pos: { r, c },
      };
      this.effectStack.push(effect);
      // stepUntilStable에서 RESOLVING으로 설정하고 효과 처리
      return await this.stepUntilStable();
    }

    // 이 이하의 입력 종류는 모두 "입력 해석 전용 이펙트"로 변환하여
    // 실제 상태 변경은 resolveEffect 에서만 일어나도록 통일한다.
    this.effectStack.push({
      type: 'RESOLVE_PLAYER_INPUT',
      owner: playerId,
      kind: pending.kind as any,
      answer: payload.answer,
      meta: pending,
    } as any);
    return await this.stepUntilStable();
  }

  // ---- 메인 스택 처리 루프 ----

  async stepUntilStable(): Promise<EngineResult[]> {
    const results: EngineResult[] = [];
    const localDiff: DiffPatch = { animations: [], log: [] };

    // effect stack이 비어있지 않으면 RESOLVING 상태로 시작
    const wasResolving = !this.effectStack.isEmpty();
    if (wasResolving) {
      this.state.phase = GamePhase.RESOLVING;
    }

    while (!this.effectStack.isEmpty()) {
      const effect = this.effectStack.pop();
      if (!effect) break;
      await resolveEffect(this, effect, localDiff);
      if (this.checkGameOver()) {
        const gameOver = this.buildGameOver();
        results.push({
          kind: 'game_over',
          gameOver,
        });
        this.state.phase = GamePhase.GAME_OVER;
        break;
      }
      // 효과 처리 중에 플레이어 입력 대기 상태로 전환되면
      // 즉시 스택 처리를 중단하고 request_input 을 돌려준다.
      if (this.pendingInput) {
        break;
      }
    }

    // effect stack 처리가 끝났고, 게임이 끝나지 않았으면
    // pendingInput이 없으면 WAITING_FOR_PLAYER_ACTION으로 복귀
    if (this.state.phase !== GamePhase.GAME_OVER && !this.pendingInput) {
      this.state.phase = GamePhase.WAITING_FOR_PLAYER_ACTION;
    }

    if (localDiff.animations.length > 0 || localDiff.log.length > 0) {
      results.push(...(await this.buildStatePatchForAll(localDiff)));
    } else {
      results.push(...(await this.buildStatePatchForAll()));
    }

    // 효과 처리 도중 플레이어 입력이 필요한 상황이 발생했다면
    // 별도의 request_input 이벤트를 발생시킨다.
    if (this.pendingInput) {
      const { playerId, kind, options } = this.pendingInput;
      results.push({
        kind: 'request_input',
        targetPlayer: playerId,
        requestInput: {
          kind,
          options: options ?? [],
        },
      });
    }

    return results;
  }

  private checkGameOver(): boolean {
    const alive = Object.entries(this.state.players).filter(
      ([_, p]) => p.hp > 0,
    );
    if (alive.length <= 1) {
      this.state.phase = GamePhase.GAME_OVER;
      this.state.winner = alive[0]?.[0] ?? null;
      return true;
    }
    return false;
  }

  private buildGameOver(): GameOverPayload {
    return {
      winner: this.state.winner ?? 'draw',
      reason: 'hp_zero',
    };
  }

  /**
   * 리추얼 하나가 파괴될 때 호출되는 헬퍼.
   *
   * - 보드에서 해당 리추얼 제거
   * - owner 의 resolveStack 에 카드 인스턴스 적재
   * - onDestroy 트리거 이펙트들을 effectStack 에 올림
   * - 마지막에 THROW_RESOLVE_STACK 가 카드의 최종 목적지를 결정하도록 한다.
   *
   * actor: 트리거를 누구 관점에서 실행할지 (예: 상대 마법사가 밟아서 파괴된 경우)
   * invertSelfEnemy: true 이면, 효과 내부의 target 이 self/enemy 일 때 서로 뒤집어서 실행
   */
  async destroyRitual(params: {
    owner: PlayerID;
    ritualId: string;
    diff: DiffPatch;
    actor: PlayerID;
    invertSelfEnemy?: boolean;
  }): Promise<void> {
    const { owner, ritualId, diff, actor, invertSelfEnemy } = params;
    const rituals = this.state.board.rituals;
    const idx = rituals.findIndex(
      (r) => r.id === ritualId && r.owner === owner,
    );
    if (idx < 0) return;

    const ritual = rituals[idx];
    rituals.splice(idx, 1);

    const ownerState = this.state.players[owner];
    if (!ownerState) return;

    // owner 의 resolveStack 에 카드 인스턴스를 적재 (dest 미지정)
    ownerState.resolveStack.push({
      card: {
        id: ritual.id,
        cardId: ritual.cardId,
      },
    });

    // onDestroy 트리거 이펙트들을 enqueue (필요 시 self/enemy 타겟 뒤집기)
    const meta = await this.ctx.lookupCard(ritual.cardId);
    if (meta && meta.effectJson) {
      const parsed = parseCardEffectJson(meta.effectJson);
      if (parsed) {
        const t = parsed.triggers.find((tr) => tr.trigger === 'onDestroy');
        if (t) {
          const effects = buildEffectsFromConfigs(
            t.effects,
            actor,
            ritual.cardId,
            {
              invertSelfEnemy: !!invertSelfEnemy,
            },
          );
          if (effects.length > 0) {
            this.effectStack.push(effects);
          }
        }
      }
    }

    // 마지막에 THROW_RESOLVE_STACK 가 ritual 카드를 무덤으로 보낸다.
    this.effectStack.push({
      type: 'THROW_RESOLVE_STACK',
      owner,
    } as any);
  }

  private async buildStatePatchForAll(
    diff?: DiffPatch,
  ): Promise<EngineResult[]> {
    const { nextVersion, patches } = await buildStatePatchForAllView({
      state: this.state,
      players: this.players,
      version: this.version,
      bottomSidePlayerId: this.bottomSidePlayerId,
      diff,
      ctx: this.ctx,
    });
    this.version = nextVersion;

    return patches.map((p) => ({
      kind: 'state_patch',
      targetPlayer: p.playerId,
      statePatch: p.statePatch,
    }));
  }

  // ---- 유틸리티 ----

  // 덱에서 순서대로 카드를 가져오는 행위, 드로우가 아님 (멀리건 / 드로우 내부에서 활용)
  private bringCardToHand(playerId: PlayerID): CardInstance | null {
    const p = this.state.players[playerId];
    if (!p) return null;
    if (p.deck.length === 0) return null;
    const card = p.deck.shift()!;
    p.hand.push(card);
    return card;
  }

  drawCardNoTriggers(playerId: PlayerID, diff?: DiffPatch) {
    const p = this.state.players[playerId];
    if (!p) return;

    // 먼저 일반 덱에서 시도
    let card = this.bringCardToHand(playerId);

    // 덱이 비어있으면 덱을 복원한 후 재앙덱에서 드로우
    if (!card) {
      if (p.grave.length > 0) {
        shuffle(p.grave, this.ctx.random);
        p.deck = p.grave.splice(0, p.grave.length);
        // diff?.animations.push({ kind: 'shuffle', player: playerId });
        diff?.log.push(`플레이어 ${playerId}의 덱을 묘지에서 복원`);
      }

      // 재앙덱이 비어있으면 재앙 묘지에서 셔플하여 재앙덱으로 복원
      if (this.state.catastropheDeck.length === 0) {
        if (this.state.catastropheGrave.length > 0) {
          shuffle(this.state.catastropheGrave, this.ctx.random);
          this.state.catastropheDeck = this.state.catastropheGrave.splice(
            0,
            this.state.catastropheGrave.length,
          );
          // diff?.animations.push({ kind: 'shuffle_catastrophe', player: playerId });
          diff?.log.push(`재앙 덱을 묘지에서 복원`);
        }
      }

      const catastropheCard = this.state.catastropheDeck.shift();
      if (catastropheCard) {
        // 재앙 카드는 손패에 넣음
        // -> TODO : 재앙 카드의 onDrawn 트리거가 실행된 후 바로 묘지로 이동하도록 수정.
        p.hand.push(catastropheCard);
        card = catastropheCard;
        if (diff) {
          diff.log.push(
            `플레이어 ${playerId}가 재앙 카드를 뽑았습니다. (${catastropheCard.cardId})`,
          );
        }
      }
    }

    if (card && diff) {
      diff.animations.push({ kind: 'draw', player: playerId });
      diff.log.push(`플레이어 ${playerId} 드로우`);
    }
  }

  enqueueTriggeredEffects(trigger: string, context: unknown) {
    const effects = this.observers.collectTriggeredEffects(
      trigger as any,
      {
        playerId: (context as any).playerId,
        ...((context as any) ?? {}),
      } as any,
    );
    if (effects.length > 0) {
      this.effectStack.push(effects);
    }
  }

  async enqueueCardTriggerEffects(
    cardId: CardID,
    trigger: EffectTrigger,
    actor: PlayerID,
    diff: DiffPatch,
    options?: BuildEffectsOptions,
  ) {
    const meta = await this.ctx.lookupCard(cardId);
    if (!meta || !meta.effectJson) return;
    const parsed = parseCardEffectJson(meta.effectJson);
    if (!parsed) return;

    const t = parsed.triggers.find((tr) => tr.trigger === trigger);
    // 기본 트리거 이펙트들
    let effectConfigs = t?.effects ?? [];

    // ritual 카드의 경우, effectJson.install 정보를 기반으로 INSTALL 이펙트를 추가로 생성한다.
    // - install.range 값을 그대로 InstallEffectConfig.range 로 전달한다.
    if (trigger === 'onCast' && parsed.type === 'ritual' && parsed.install) {
      effectConfigs = [
        ...effectConfigs,
        {
          type: 'install',
          object: cardId,
          range: parsed.install.range,
        } as any,
      ];
    }

    if (!effectConfigs.length) return;

    const effects = buildEffectsFromConfigs(
      effectConfigs,
      actor,
      cardId,
      options,
    );
    if (effects.length > 0) {
      this.effectStack.push(effects);
    }
  }

  async handleUseRitualAction(
    playerId: PlayerID,
    action: PlayerActionPayload,
  ): Promise<EngineResult[]> {
    const checkIsActivePlayer = this.require(
      this.state.activePlayer === playerId,
      playerId,
      'not_your_turn',
    );
    if (checkIsActivePlayer) return checkIsActivePlayer;

    const ritualId = (action as any).ritualId as string | undefined;
    const checkRitualIdExists = this.require(
      !!ritualId,
      playerId,
      'invalid_ritual',
    );
    if (checkRitualIdExists) return checkRitualIdExists;
    if (!ritualId) return this.invalidAction(playerId, 'invalid_ritual');

    const ritual = this.state.board.rituals.find(
      (r) => r.id === ritualId && r.owner === playerId,
    );
    const checkRitualExists = this.require(
      !!ritual,
      playerId,
      'invalid_ritual',
    );
    if (checkRitualExists) return checkRitualExists;
    if (!ritual) return this.invalidAction(playerId, 'invalid_ritual');

    // 1턴 1회 사용 체크
    const checkNotUsedThisTurn = this.require(
      !ritual.usedThisTurn,
      playerId,
      'ritual_already_used',
    );
    if (checkNotUsedThisTurn) return checkNotUsedThisTurn;

    ritual.usedThisTurn = true;

    // onUsePerTurn 트리거 이펙트를 스택에 올린다.
    const diff: DiffPatch = { animations: [], log: [] };
    await this.enqueueCardTriggerEffects(
      ritual.cardId,
      'onUsePerTurn',
      playerId,
      diff,
    );

    return await this.stepUntilStable();
  }
}
