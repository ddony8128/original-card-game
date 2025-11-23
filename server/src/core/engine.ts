import {
  GamePhase,
  type GameState,
  type FoggedGameState,
  type PlayerID,
  type CardID,
  type CardInstance,
} from '../type/gameState';
import type {
  DiffPatch,
  GameOverPayload,
  RequestInputPayload,
  StatePatchPayload,
  AskMulliganPayload,
  AnswerMulliganPayload,
  PlayerActionPayload,
  PlayerInputPayload,
} from '../type/wsProtocol';
import type { EngineContext } from './context';
import { EffectStack } from './effectStack';
import type {
  Effect,
  MoveEffect,
  TurnEndEffect,
  TurnStartEffect,
  InstallAfterSelectionEffect,
  CastExecuteEffect,
  TriggeredEffect,
} from './effectTypes';
import type { RequestInputKind } from '../type/wsProtocol';
import { ObserverRegistry } from './observers';
import { parseCardEffectJson, type EffectTrigger } from './effects/schema';
import { executeEffects } from './effects/executor';

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
  roomId: string;
  players: PlayerID[];
}

export class GameEngineCore {
  readonly roomId: string;
  readonly players: PlayerID[];
  readonly ctx: Required<EngineContext>;
  private bottomSidePlayerId: PlayerID | null = null;

  state: GameState;
  private readonly effectStack: EffectStack;
  private readonly observers: ObserverRegistry;
  private burnedThisAction = new Set<CardID>();
  private version = 1;
  private readyPlayers = false; // 모든 플레이어가 ready 되었는지 확인
  private pendingInput: {
    playerId: PlayerID;
    kind: RequestInputKind;
    type: 'install_position' | 'cast_target' | 'hand_discard';
    cardId?: CardID;
    count?: number;
  } | null = null;

  constructor(
    initialState: GameState,
    ctx: EngineContext,
    roomId: string,
    players: PlayerID[],
  ) {
    this.state = initialState;
    this.effectStack = new EffectStack();
    this.observers = new ObserverRegistry();
    this.roomId = roomId;
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
    return new GameEngineCore(initialState, ctx, config.roomId, config.players);
  }

  markReady(): EngineResult[] {
    // 모든 플레이어 ready → 게임 초기화
    if (this.readyPlayers) return [];
    this.initializeGame();

    this.state.phase = GamePhase.WAITING_FOR_MULLIGAN;

    const results: EngineResult[] = [];

    // 초기 상태 패치
    results.push(...this.buildStatePatchForAll());
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
      const ps = this.state.players[pid];
      this.shuffle(ps.deck);
      this.shuffle(this.state.catastropheDeck);
      const drawCount = idx === firstIdx ? 2 : 3;
      for (let i = 0; i < drawCount; i += 1) {
        this.bringCardToHand(pid);
      }
      ps.mulliganSelected = false;
    });
  }

  async handlePlayerAction(
    playerId: PlayerID,
    action: PlayerActionPayload,
  ): Promise<EngineResult[]> {
    if (this.state.phase === GamePhase.GAME_OVER) {
      return [
        {
          kind: 'invalid_action',
          targetPlayer: playerId,
          invalidReason: 'game_over',
        },
      ];
    }

    if (this.state.activePlayer !== playerId) {
      return [
        {
          kind: 'invalid_action',
          targetPlayer: playerId,
          invalidReason: 'not_your_turn',
        },
      ];
    }

    const act = action.action;

    switch (act) {
      case 'move':
        return this.handleMove(playerId, {
          to: (action as any).to as [number, number],
        });
      case 'end_turn':
        return this.handleEndTurn(playerId);
      case 'use_card':
        return this.handleUseCard(
          playerId,
          (action as any).cardInstance as CardInstance,
          (action as any).target as [number, number] | undefined,
        );
      case 'use_ritual':
        // TODO: 카드 메타/ritual 효과 이용한 install/cast/use_ritual 구현
        return [
          {
            kind: 'invalid_action',
            targetPlayer: playerId,
            invalidReason: 'not_implemented',
          },
        ];
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

  // ---- 개별 액션 처리 ----

  private handleMove(
    playerId: PlayerID,
    payload: { to: [number, number] },
  ): EngineResult[] {
    const me = this.state.board.wizards[playerId];
    if (!me) {
      return [
        {
          kind: 'invalid_action',
          targetPlayer: playerId,
          invalidReason: 'no_wizard',
        },
      ];
    }

    const [toR, toC] = payload.to;
    if (!this.isInsideBoard(toR, toC)) {
      return [
        {
          kind: 'invalid_action',
          targetPlayer: playerId,
          invalidReason: 'out_of_board',
        },
      ];
    }

    // 상대 마법사가 있는 칸으로 이동 금지
    const occupiedByOtherWizard = Object.entries(this.state.board.wizards).some(
      ([pid, pos]) => pid !== playerId && pos.r === toR && pos.c === toC,
    );
    if (occupiedByOtherWizard) {
      return [
        {
          kind: 'invalid_action',
          targetPlayer: playerId,
          invalidReason: 'cell_occupied',
        },
      ];
    }

    const playerState = this.state.players[playerId];
    if (playerState.mana < 1) {
      return [
        {
          kind: 'invalid_action',
          targetPlayer: playerId,
          invalidReason: 'not_enough_mana',
        },
      ];
    }

    playerState.mana -= 1;

    const effect: MoveEffect = {
      type: 'MOVE',
      owner: playerId,
      to: { r: toR, c: toC },
    };

    this.effectStack.push(effect);
    const results = this.stepUntilStable();
    return results;
  }

  private handleEndTurn(playerId: PlayerID): EngineResult[] {
    if (this.state.activePlayer !== playerId) {
      return [
        {
          kind: 'invalid_action',
          targetPlayer: playerId,
          invalidReason: 'not_your_turn',
        },
      ];
    }
    const effect: TurnEndEffect = {
      type: 'TURN_END',
      owner: playerId,
    };
    this.effectStack.push(effect);
    return this.stepUntilStable();
  }

  private async handleUseCard(
    playerId: PlayerID,
    cardInstance: CardInstance,
    _target: [number, number] | undefined,
  ): Promise<EngineResult[]> {
    const playerState = this.state.players[playerId];
    if (!playerState) {
      return [
        {
          kind: 'invalid_action',
          targetPlayer: playerId,
          invalidReason: 'unknown_player',
        },
      ];
    }

    const handIndex = playerState.hand.findIndex(
      (ci) => ci.id === cardInstance.id,
    );
    if (handIndex === -1) {
      return [
        {
          kind: 'invalid_action',
          targetPlayer: playerId,
          invalidReason: 'card_not_in_hand',
        },
      ];
    }

    const usedInstance = playerState.hand[handIndex];
    const cardId = usedInstance.cardId;

    const meta = this.ctx.lookupCard(cardId);
    if (!meta) {
      return [
        {
          kind: 'invalid_action',
          targetPlayer: playerId,
          invalidReason: 'unknown_card',
        },
      ];
    }

    if (playerState.mana < meta.manaCost) {
      return [
        {
          kind: 'invalid_action',
          targetPlayer: playerId,
          invalidReason: 'not_enough_mana',
        },
      ];
    }

    // 마나 차감 및 손에서 제거
    playerState.mana -= meta.manaCost;
    playerState.hand.splice(handIndex, 1);

    if (meta.kind === 'ritual') {
      // 설치 가능한 위치 계산 → request_input (좌표는 플레이어 시점 기준으로 변환)
      const absOptions = this.computeInstallPositions(playerId);
      const options = absOptions.map((pos) => this.toViewerPos(pos, playerId));
      this.pendingInput = {
        playerId,
        kind: 'select_install_position',
        type: 'install_position',
        cardId,
      };
      return [
        {
          kind: 'request_input',
          targetPlayer: playerId,
          requestInput: {
            kind: 'select_install_position',
            options,
          },
        },
      ];
    }

    // instant → 즉시 CAST_EXECUTE 효과만 push (타겟팅 등은 TODO)
    const effect: CastExecuteEffect = {
      type: 'CAST_EXECUTE',
      owner: playerId,
      cardId,
    };
    this.effectStack.push(effect);
    const results = this.stepUntilStable();

    // burn되지 않은 instant 카드는 사용 후 grave로 이동
    if (!this.burnedThisAction.has(cardId)) {
      playerState.grave.push(usedInstance);
    }
    this.burnedThisAction.clear();

    return results;
  }

  // ---- 멀리건 / 입력 처리 (스켈레톤) ----

  async handleAnswerMulligan(
    playerId: PlayerID,
    payload: AnswerMulliganPayload,
  ): Promise<EngineResult[]> {
    const playerState = this.state.players[playerId];
    if (!playerState) {
      return [
        {
          kind: 'invalid_action',
          targetPlayer: playerId,
          invalidReason: 'unknown_player',
        },
      ];
    }

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
    this.shuffle(playerState.deck);
    for (let i = 0; i < returned.length; i += 1) {
      this.drawCardNoTriggers(playerId);
    }
    playerState.mulliganSelected = true;

    const allDone = this.players.every(
      (pid) => this.state.players[pid].mulliganSelected,
    );
    if (!allDone) {
      return this.buildStatePatchForAll();
    }

    // 모든 플레이어 멀리건 종료 → 첫 턴 시작
    const effect: TurnStartEffect = {
      type: 'TURN_START',
      owner: this.state.activePlayer,
    };
    this.effectStack.push(effect);
    this.state.phase = GamePhase.WAITING_FOR_PLAYER_ACTION;
    return this.stepUntilStable();
  }

  async handlePlayerInput(
    playerId: PlayerID,
    payload: PlayerInputPayload,
  ): Promise<EngineResult[]> {
    if (!this.pendingInput || this.pendingInput.playerId !== playerId) {
      return [
        {
          kind: 'invalid_action',
          targetPlayer: playerId,
          invalidReason: 'no_pending_input',
        },
      ];
    }

    const pending = this.pendingInput;
    this.pendingInput = null;

    if (pending.type === 'install_position') {
      const pos = payload.answer as { r: number; c: number } | [number, number];
      const viewR = Array.isArray(pos) ? pos[0] : pos.r;
      const viewC = Array.isArray(pos) ? pos[1] : pos.c;
      const { r, c } = this.fromViewerPos({ r: viewR, c: viewC }, playerId);
      if (!this.isInsideBoard(r, c)) {
        return [
          {
            kind: 'invalid_action',
            targetPlayer: playerId,
            invalidReason: 'invalid_position',
          },
        ];
      }

      const cardId = pending.cardId;
      if (!cardId) {
        return [
          {
            kind: 'invalid_action',
            targetPlayer: playerId,
            invalidReason: 'invalid_card',
          },
        ];
      }

      const effect: InstallAfterSelectionEffect = {
        type: 'INSTALL_AFTER_SELECTION',
        owner: playerId,
        cardId,
        pos: { r, c },
      };
      this.effectStack.push(effect);
      return this.stepUntilStable();
    }

    if (pending.type === 'hand_discard') {
      const answerIds = Array.isArray(payload.answer)
        ? (payload.answer as CardID[])
        : [payload.answer as CardID];
      const player = this.state.players[playerId];
      if (player) {
        answerIds.forEach((cid) => {
          const idx = player.hand.findIndex((ci) => ci.cardId === cid);
          if (idx >= 0) {
            const [card] = player.hand.splice(idx, 1);
            player.grave.push(card);
          }
        });
      }
      return this.stepUntilStable();
    }

    // TODO: cast_target 등 다른 입력 타입 처리
    return this.buildStatePatchForAll();
  }

  // ---- 메인 스택 처리 루프 ----

  private stepUntilStable(): EngineResult[] {
    const results: EngineResult[] = [];
    const localDiff: DiffPatch = { animations: [], log: [] };

    while (!this.effectStack.isEmpty()) {
      const effect = this.effectStack.pop();
      if (!effect) break;
      this.resolveEffect(effect, localDiff);
      if (this.checkGameOver()) {
        const gameOver = this.buildGameOver();
        results.push({
          kind: 'game_over',
          gameOver,
        });
        this.state.phase = GamePhase.GAME_OVER;
        break;
      }
    }

    if (localDiff.animations.length > 0 || localDiff.log.length > 0) {
      results.push(...this.buildStatePatchForAll(localDiff));
    } else {
      results.push(...this.buildStatePatchForAll());
    }

    return results;
  }

  private resolveEffect(effect: Effect, diff: DiffPatch) {
    switch (effect.type) {
      case 'MOVE': {
        const move = effect as MoveEffect;
        const wizard = this.state.board.wizards[effect.owner];
        if (wizard) {
          const from = [wizard.r, wizard.c] as [number, number];
          wizard.r = move.to.r;
          wizard.c = move.to.c;
          diff.animations.push({
            kind: 'move',
            player: effect.owner,
            from,
            to: [move.to.r, move.to.c],
          });
          diff.log.push(
            `플레이어 ${effect.owner}가 (${from[0]},${from[1]}) → (${move.to.r},${move.to.c}) 이동`,
          );
        }
        break;
      }
      case 'TURN_END': {
        const turnEnd = effect as TurnEndEffect;
        diff.log.push(`플레이어 ${turnEnd.owner} 턴 종료`);
        // 리추얼 onTurnEnd 트리거 실행
        this.state.board.rituals
          .filter((r) => r.owner === turnEnd.owner)
          .forEach((r) => {
            this.executeCardTrigger(r.cardId, 'onTurnEnd', turnEnd.owner, diff);
          });
        // 다음 턴 플레이어로 변경
        {
          const currentIdx = this.players.indexOf(this.state.activePlayer);
          const nextIdx = (currentIdx + 1) % this.players.length;
          const nextPlayer = this.players[nextIdx];
          const changeEffect: Effect = {
            type: 'CHANGE_TURN',
            owner: nextPlayer,
          } as Effect;
          this.effectStack.push(changeEffect);
        }
        break;
      }
      case 'TURN_START': {
        const ts = effect as TurnStartEffect;
        const p = this.state.players[ts.owner];
        // 최대 마나 증가 및 현재 마나 회복 (간단한 규칙)
        p.maxMana += 1;
        p.mana = p.maxMana;
        diff.log.push(
          `플레이어 ${ts.owner} 턴 시작 (마나 ${p.mana}/${p.maxMana})`,
        );
        // 일반 드로우 1장
        this.drawCardNoTriggers(ts.owner, diff);
        // onTurnStart 트리거 호출
        this.enqueueTriggeredEffects('onTurnStart', {
          playerId: ts.owner,
        });
        break;
      }
      case 'CHANGE_TURN': {
        this.state.turn += 1;
        this.state.activePlayer = effect.owner;
        this.state.phase = GamePhase.WAITING_FOR_PLAYER_ACTION;
        // 턴 시작 처리
        const ts: TurnStartEffect = { type: 'TURN_START', owner: effect.owner };
        this.effectStack.push(ts);
        break;
      }
      case 'INSTALL_AFTER_SELECTION': {
        const inst = effect as InstallAfterSelectionEffect;
        const id = `ritual_${this.ctx.now()}_${Math.floor(this.ctx.random() * 100000)}`;
        this.state.board.rituals.push({
          id,
          cardId: inst.cardId,
          owner: inst.owner,
          pos: inst.pos,
          usedThisTurn: false,
        });
        diff.animations.push({
          kind: 'ritual_place',
          player: inst.owner,
        });
        diff.log.push(
          `플레이어 ${inst.owner}가 (${inst.pos.r},${inst.pos.c}) 위치에 리추얼을 설치`,
        );
        // 리추얼 카드의 onTurnEnd/onDestroy 트리거를 ObserverRegistry에 등록 (필요 시)
        const meta = this.ctx.lookupCard(inst.cardId);
        if (meta && meta.effectJson) {
          const parsed = parseCardEffectJson(meta.effectJson);
          if (parsed) {
            parsed.triggers.forEach((t, index) => {
              if (t.trigger === 'onTurnEnd' || t.trigger === 'onDestroy') {
                this.observers.register({
                  id: `${inst.cardId}:${t.trigger}:${index}:${id}`,
                  owner: inst.owner,
                  cardId: inst.cardId,
                  trigger: t.trigger,
                  effectRef: t,
                });
              }
            });
          }
        }
        break;
      }
      case 'CAST_EXECUTE': {
        const cast = effect as CastExecuteEffect;
        diff.log.push(
          `플레이어 ${cast.owner}가 인스턴트 카드를 사용 (id=${cast.cardId})`,
        );
        // effect_json의 onCast 트리거 실행
        this.executeCardTrigger(cast.cardId, 'onCast', cast.owner, diff);
        break;
      }
      case 'TRIGGERED_EFFECT': {
        const trig = effect as TriggeredEffect;
        // TODO: trig.effectRef + trig.context를 이용해 effectJson 실행
        // 현재는 로그만 남긴다.
        diff.log.push(
          `TriggeredEffect 실행: card=${trig.cardId}, trigger=${trig.trigger}`,
        );
        break;
      }
      default:
        // 아직 구현되지 않은 Effect 타입
        break;
    }
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
      winner: this.state.winner ?? null,
      reason: 'hp_zero',
    };
  }

  private buildStatePatchForAll(diff?: DiffPatch): EngineResult[] {
    const results: EngineResult[] = [];
    this.version += 1;
    const baseDiff: DiffPatch = diff ?? { animations: [], log: [] };

    this.players.forEach((pid) => {
      const fog = this.toFoggedState(pid);
      const viewerDiff: DiffPatch = {
        animations: baseDiff.animations.map((anim) => {
          const transformed = { ...anim };
          if (anim.from) {
            const [r, c] = anim.from;
            const pos = this.toViewerPos({ r, c }, pid);
            transformed.from = [pos.r, pos.c];
          }
          if (anim.to) {
            const [r, c] = anim.to;
            const pos = this.toViewerPos({ r, c }, pid);
            transformed.to = [pos.r, pos.c];
          }
          return transformed;
        }),
        log: [...baseDiff.log],
      };

      const statePatch: StatePatchPayload = {
        version: this.version,
        fogged_state: fog,
        diff_patch: viewerDiff,
      };
      results.push({
        kind: 'state_patch',
        targetPlayer: pid,
        statePatch,
      });
    });

    return results;
  }

  // ---- FoggedGameState 변환 (간단 버전) ----

  private toFoggedState(viewer: PlayerID): FoggedGameState {
    const meState = this.state.players[viewer];
    const opponentEntry = Object.entries(this.state.players).find(
      ([id]) => id !== viewer,
    );
    const opponentState = opponentEntry?.[1];

    const { width, height } = this.state.board;

    console.log('meState', {
      meState,
    });
    console.log('opponentState', {
      opponentState,
    });

    const wizards: FoggedGameState['board']['wizards'] = {} as any;
    Object.entries(this.state.board.wizards).forEach(([pid, pos]) => {
      const translated = this.toViewerPos(pos, viewer);

      console.log('translated', {
        r: translated.r,
        c: translated.c,
      });

      (wizards as any)[pid] = { r: translated.r, c: translated.c };
    });

    const rituals = this.state.board.rituals.map((r) => {
      const translated = this.toViewerPos(r.pos, viewer);
      return {
        id: r.id,
        cardId: r.cardId,
        owner: r.owner,
        pos: translated,
        usedThisTurn: !!r.usedThisTurn,
      };
    });

    return {
      phase: this.state.phase,
      turn: this.state.turn,
      activePlayer: this.state.activePlayer,
      winner: this.state.winner ?? null,
      board: {
        width,
        height,
        wizards,
        rituals,
      },
      me: {
        hp: meState?.hp ?? 0,
        maxHp: meState?.maxHp ?? meState?.hp ?? 0,
        mana: meState?.mana ?? 0,
        maxMana: meState?.maxMana ?? 0,
        hand: meState?.hand ?? [],
        handCount: meState?.hand.length ?? 0,
        deckCount: meState?.deck.length ?? 0,
        graveCount: meState?.grave.length ?? 0,
      },
      opponent: {
        hp: opponentState?.hp ?? 0,
        maxHp: opponentState?.maxHp ?? opponentState?.hp ?? 0,
        mana: opponentState?.mana ?? 0,
        maxMana: opponentState?.maxMana ?? 0,
        handCount: opponentState?.hand.length ?? 0,
        deckCount: opponentState?.deck.length ?? 0,
        graveCount: opponentState?.grave.length ?? 0,
      },
      catastrophe: {
        deckCount: this.state.catastropheDeck.length,
        graveCount: this.state.catastropheGrave.length,
      },
      lastActions: this.state.logs.slice(-10),
    };
  }

  // ---- 유틸리티 ----

  private isInsideBoard(r: number, c: number): boolean {
    return (
      r >= 0 &&
      c >= 0 &&
      r < this.state.board.height &&
      c < this.state.board.width
    );
  }

  private isBottomSide(viewer: PlayerID): boolean {
    if (!this.bottomSidePlayerId) return true;
    return viewer === this.bottomSidePlayerId;
  }

  private toViewerPos(
    pos: { r: number; c: number },
    viewer: PlayerID,
  ): { r: number; c: number } {
    const { height } = this.state.board;
    if (this.isBottomSide(viewer)) return pos;
    return { r: height - 1 - pos.r, c: pos.c };
  }

  private fromViewerPos(
    pos: { r: number; c: number },
    viewer: PlayerID,
  ): { r: number; c: number } {
    const { height } = this.state.board;
    if (this.isBottomSide(viewer)) return pos;
    return { r: height - 1 - pos.r, c: pos.c };
  }

  private shuffle<T>(arr: T[]) {
    const rand = this.ctx.random;
    for (let i = arr.length - 1; i > 0; i -= 1) {
      const j = Math.floor(rand() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
  }

  // 덱에서 순서대로 카드를 가져오는 행위, 드로우가 아님 (멀리건 / 드로우 내부에서 활용)
  private bringCardToHand(playerId: PlayerID): CardInstance | null {
    const p = this.state.players[playerId];
    if (!p) return null;
    if (p.deck.length === 0) return null;
    const card = p.deck.shift()!;
    p.hand.push(card);
    return card;
  }

  private drawCardNoTriggers(playerId: PlayerID, diff?: DiffPatch) {
    const p = this.state.players[playerId];
    if (!p) return;
    if (p.deck.length === 0) {
      // TODO: discard → deck 리셔플 및 catastrophe 드로우 처리
      return;
    }
    const card = p.deck.shift()!;
    p.hand.push(card);
    if (diff) {
      diff.animations.push({ kind: 'draw', player: playerId });
      diff.log.push(`플레이어 ${playerId} 드로우`);
    }
  }

  private computeInstallPositions(
    playerId: PlayerID,
  ): { r: number; c: number }[] {
    const positions: { r: number; c: number }[] = [];
    const { width, height, rituals } = this.state.board;
    const occupied = new Set<string>();
    rituals.forEach((r) => {
      occupied.add(`${r.pos.r},${r.pos.c}`);
    });
    for (let r = 0; r < height; r += 1) {
      for (let c = 0; c < width; c += 1) {
        const key = `${r},${c}`;
        if (occupied.has(key)) continue;
        positions.push({ r, c });
      }
    }
    return positions;
  }

  private enqueueTriggeredEffects(trigger: string, context: unknown) {
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

  private executeCardTrigger(
    cardId: CardID,
    trigger: EffectTrigger,
    actor: PlayerID,
    diff: DiffPatch,
  ) {
    const meta = this.ctx.lookupCard(cardId);
    if (!meta || !meta.effectJson) return;
    const parsed = parseCardEffectJson(meta.effectJson);
    if (!parsed) return;
    const t = parsed.triggers.find((tr) => tr.trigger === trigger);
    if (!t) return;
    executeEffects(
      t.effects,
      {
        engine: this,
        actor,
        source: parsed,
        diff,
      } as any,
      cardId,
    );
  }
}
