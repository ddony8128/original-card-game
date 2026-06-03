import { GamePhase } from '../type/gameState';
import type { PlayerID } from '../type/gameState';
import type {
  AnswerMulliganPayload,
  AskMulliganPayload,
  GameOverPayload,
  InvalidActionPayload,
  PlayerActionPayload,
  PlayerInputPayload,
  RequestInputPayload,
  ServerToClientMessage,
  StatePatchPayload,
  StartSoloPayload,
} from '../type/wsProtocol';
import { decksService } from '../services/decks';
import { GameEngineAdapter } from '../core/engine/gameEngineAdapter';
import type { GameEngineCore } from '../core/engine/gameEngineCore';
import {
  buildEngineContextFromDecks,
  createInitialGameState,
  type PlayerDeckConfig,
} from '../state/gameInit';
import { getCardMeta } from '../core/resources/cardCatalog';
import { chooseAIAction } from '../core/ai/heuristic';
import { getProfile, type AIProfile } from '../core/ai/profiles';
import { getPveStage } from '../core/resources/pveStages';
import { pveProgressService } from '../services/pveProgress';
import type { DeckList } from '../type/deck';
import type { LegalAction } from '../core/ai/legalActions';
import { toViewerPos } from '../core/engine/boardUtils';
import type { SocketManager, SocketClient } from './socketManager';

/** 솔로(싱글플레이) 게임에서 AI 플레이어를 식별하는 고정 ID. DB 유저가 아니다. */
export const AI_PLAYER_ID = '__AI__';

/** AI 턴 드라이버가 한 턴 안에서 수행할 수 있는 최대 스텝(무한 루프 방지). */
const MAX_AI_STEPS = 30;

// 솔로 방 하나의 메타정보.
type SoloRoom = {
  soloId: string;
  engine: GameEngineAdapter;
  humanId: PlayerID;
  socket: SocketClient;
  /** game_init 메시지를 사람에게 한 번만 보내기 위한 플래그. */
  initialized: boolean;
  /** AI 휴리스틱 프로필. tutorial 은 default, pve 는 스테이지 프로필. */
  aiProfile: AIProfile;
  /** pve 모드일 때 대상 스테이지 id(클리어 기록 등 후속 단계용). tutorial 이면 undefined. */
  stageId?: string;
};

/**
 * 싱글플레이("솔로") 게임 vs 휴리스틱 AI 를 서버 메모리에서 관리하는 객체.
 *
 * - DB 방 row / AI 유저를 만들지 않고, 메모리상의 soloId 로만 식별한다.
 * - 2인용 GameRoomManager 경로와 완전히 분리되어 있다.
 * - AI 턴 드라이버는 절대 hang/throw 하지 않도록(스텝 cap + end_turn fallback + try/catch)
 *   설계되어 있다. 견고함이 최우선이다.
 */
export class SoloGameManager {
  private readonly rooms = new Map<string, SoloRoom>();
  private counter = 0;

  constructor(private readonly socketManager: SocketManager) {}

  /** 사람 userId 와 내부 카운터로 충돌 없는 솔로 방 id 를 생성한다. */
  private nextSoloId(userId: string): string {
    this.counter += 1;
    return `solo_${userId}_${this.counter}`;
  }

  /**
   * 솔로 게임 시작.
   * - 사람 덱을 로드(없으면 warn + return)
   * - tutorial(기본): AI 는 사람 덱의 클론 + default 프로필을 사용(항상 유효한 카드 보장)
   * - pve: AI 는 스테이지 덱 + 스테이지 프로필을 사용(스테이지 없으면 warn + return)
   * - 엔진/콜백 구성 후 markReady → AI 멀리건 자동 응답 → AI 선공이면 즉시 진행
   */
  async handleStartSolo(
    socket: SocketClient,
    payload: StartSoloPayload,
  ): Promise<void> {
    const { userId, deckId } = payload;
    const mode = payload.mode ?? 'tutorial';

    const deck = await decksService.getById(deckId);
    if (!deck) {
      console.warn('[SoloGameManager] deck not found', { userId, deckId });
      return;
    }

    // AI 덱/프로필 결정.
    // - tutorial: 사람 덱의 클론 + default 프로필(유효성 보장, 기존 동작).
    // - pve: 스테이지 덱 + 스테이지 프로필.
    let aiMain: DeckList = deck.main_cards;
    let aiCata: DeckList = deck.cata_cards;
    let aiProfile: AIProfile = getProfile();
    let stageId: string | undefined;
    // 스테이지가 보스 시작 HP 를 지정하면(하드 스테이지) AI 만 해당 HP 로 시작한다.
    let aiHp: number | undefined;

    if (mode === 'pve') {
      const stage = getPveStage(payload.stageId ?? '');
      if (!stage) {
        console.warn('[SoloGameManager] pve stage not found', {
          userId,
          stageId: payload.stageId,
        });
        return;
      }
      aiMain = stage.deck.main;
      aiCata = stage.deck.cata;
      aiProfile = getProfile(stage.profileId);
      stageId = stage.id;
      aiHp = stage.aiHp;
    }

    const soloId = this.nextSoloId(userId);

    // 사람은 자신의 덱, AI 는 tutorial=사람 덱 클론 / pve=스테이지 덱을 사용한다.
    const playerDeckConfigs: PlayerDeckConfig[] = [
      { playerId: userId, main: deck.main_cards, cata: deck.cata_cards },
      {
        playerId: AI_PLAYER_ID,
        main: aiMain,
        cata: aiCata,
      },
    ];

    const initialState = createInitialGameState(playerDeckConfigs);
    // 하드 스테이지: 보스 AI 만 더 높은 HP 로 시작시킨다(사람은 기본값 유지).
    // heal/percent 로직 일관성을 위해 hp 와 maxHp 를 모두 덮어쓴다.
    if (aiHp !== undefined) {
      const aiState = initialState.players[AI_PLAYER_ID];
      if (aiState) {
        aiState.hp = aiHp;
        aiState.maxHp = aiHp;
      }
    }
    const ctx = await buildEngineContextFromDecks(playerDeckConfigs);
    const engine = GameEngineAdapter.create({
      roomCode: soloId,
      players: [userId, AI_PLAYER_ID],
      initialState,
      ctx,
    });

    socket.userId = userId;
    socket.roomCode = soloId;
    socket.solo = true;
    this.socketManager.joinRoom(soloId, socket, userId);

    const room: SoloRoom = {
      soloId,
      engine,
      humanId: userId,
      socket,
      initialized: false,
      aiProfile,
      stageId,
    };
    this.rooms.set(soloId, room);
    this.attachEngineCallbacks(room);

    // 멀리건/상태 패치 콜백이 모두 연결된 뒤 게임을 시작한다.
    await engine.markReady();
    // AI 멀리건은 즉시 자동 응답(교체 없음).
    await engine.handleAnswerMulligan(AI_PLAYER_ID, { replaceIndices: [] });
    // AI 가 선공이면 곧바로 AI 턴을 진행한다.
    await this.maybeRunAITurn(soloId);
  }

  // ---- 사람 액션 핸들러 (socket.ts 에서 solo 소켓에 대해 호출) ----

  async handlePlayerAction(
    soloId: string,
    action: PlayerActionPayload,
  ): Promise<void> {
    const room = this.rooms.get(soloId);
    if (!room) return;
    await room.engine.handlePlayerAction(room.humanId, action);
    await this.maybeRunAITurn(soloId);
  }

  async handleAnswerMulligan(
    soloId: string,
    payload: AnswerMulliganPayload,
  ): Promise<void> {
    const room = this.rooms.get(soloId);
    if (!room) return;
    await room.engine.handleAnswerMulligan(room.humanId, payload);
    await this.maybeRunAITurn(soloId);
  }

  async handlePlayerInput(
    soloId: string,
    payload: PlayerInputPayload,
  ): Promise<void> {
    const room = this.rooms.get(soloId);
    if (!room) return;
    await room.engine.handlePlayerInput(room.humanId, payload);
    await this.maybeRunAITurn(soloId);
  }

  /**
   * AI 턴 드라이버. **절대 hang 하지 않음을 보장한다.**
   * - 스텝 cap(MAX_AI_STEPS) 으로 무한 루프 차단
   * - 매 스텝 try/catch 로 감싸 실패 시 end_turn 으로 강제 종료
   * - 루프 종료 후에도 AI 턴이면 안전망으로 end_turn 강제
   */
  private async maybeRunAITurn(soloId: string): Promise<void> {
    const room = this.rooms.get(soloId);
    if (!room) return;
    const { engine } = room;

    let steps = 0;
    while (
      engine.state.activePlayer === AI_PLAYER_ID &&
      engine.state.phase !== GamePhase.GAME_OVER &&
      steps++ < MAX_AI_STEPS
    ) {
      try {
        const core = engine.getCore();
        // AI 가 입력 대기 중이면 드라이버가 직접 안전한 기본값으로 답한다.
        if (core.pendingInput && core.pendingInput.playerId === AI_PLAYER_ID) {
          await engine.handlePlayerInput(AI_PLAYER_ID, {
            answer: defaultAnswer(core.pendingInput),
          });
          continue;
        }
        // 사람이 입력해야 하는 상황(예: AI 카드가 사람 선택을 요구)이면
        // 제어를 사람에게 넘긴다. 사람이 응답하면 maybeRunAITurn 이 다시 이어간다.
        if (core.pendingInput) break;

        const action = chooseAIAction(
          engine.state,
          AI_PLAYER_ID,
          getCardMeta,
          Math.random,
          room.aiProfile,
        );
        if (action.kind === 'end_turn') {
          await engine.handlePlayerAction(AI_PLAYER_ID, { action: 'end_turn' });
          break;
        }
        await engine.handlePlayerAction(
          AI_PLAYER_ID,
          toActionPayload(engine, action),
        );
      } catch (err) {
        console.warn('[solo] AI step failed, ending AI turn', err);
        try {
          await engine.handlePlayerAction(AI_PLAYER_ID, { action: 'end_turn' });
        } catch {
          // end_turn 마저 실패해도 루프를 빠져나가 안전망으로 처리한다.
        }
        break;
      }
    }

    // 안전망: 루프를 빠져나왔는데 여전히 AI 턴이면(게임오버 아님) 강제 종료한다.
    // 단, 스텝 cap 직후 AI 입력이 남아 있을 수 있으므로 먼저 비운 뒤 end_turn 한다.
    // 사람 입력 대기 상태(사람 카드 선택 등)면 종료하지 않고 제어를 사람에게 남긴다.
    let drain = 0;
    while (
      engine.state.activePlayer === AI_PLAYER_ID &&
      engine.state.phase !== GamePhase.GAME_OVER &&
      drain++ < 5
    ) {
      const core = engine.getCore();
      if (core.pendingInput && core.pendingInput.playerId === AI_PLAYER_ID) {
        try {
          await engine.handlePlayerInput(AI_PLAYER_ID, {
            answer: defaultAnswer(core.pendingInput),
          });
        } catch {
          break;
        }
        continue;
      }
      // 사람이 응답해야 하는 입력이 남아 있으면 종료하지 않는다.
      if (core.pendingInput) break;
      try {
        await engine.handlePlayerAction(AI_PLAYER_ID, { action: 'end_turn' });
      } catch {
        break;
      }
    }
  }

  /**
   * 솔로 엔진 이벤트 → 사람 소켓 메시지 변환.
   * AI 대상 이벤트는 사람에게 노출하지 않는다.
   */
  private attachEngineCallbacks(room: SoloRoom): void {
    const { soloId, engine, humanId } = room;

    const sendInitIfNeeded = (payload: StatePatchPayload): boolean => {
      if (room.initialized) return false;
      const initMsg: ServerToClientMessage = {
        event: 'game_init',
        data: {
          state: payload.fogged_state,
          version: payload.version,
        },
      };
      this.socketManager.sendTo(soloId, humanId, initMsg);
      room.initialized = true;
      return true;
    };

    // state_patch: AI 대상 패치는 무시, 사람에게는 최초 1회 game_init 후 state_patch.
    engine.onStatePatch(
      (
        targetPlayer: PlayerID | null | undefined,
        payload: StatePatchPayload,
      ) => {
        if (targetPlayer === AI_PLAYER_ID) return;
        const msg: ServerToClientMessage = {
          event: 'state_patch',
          data: payload,
        };
        if (sendInitIfNeeded(payload)) return;
        this.socketManager.sendTo(soloId, humanId, msg);
      },
    );

    // ask_mulligan: 사람에게만 전달(AI 멀리건은 handleStartSolo 가 자동 응답).
    engine.onAskMulligan(
      (
        targetPlayer: PlayerID | null | undefined,
        payload: AskMulliganPayload,
      ) => {
        if (targetPlayer !== humanId) return;
        const msg: ServerToClientMessage = {
          event: 'ask_mulligan',
          data: payload,
        };
        this.socketManager.sendTo(soloId, humanId, msg);
      },
    );

    // request_input: 사람에게만 전달(AI 입력은 드라이버가 직접 처리).
    engine.onRequestInput(
      (
        targetPlayer: PlayerID | null | undefined,
        payload: RequestInputPayload,
      ) => {
        if (targetPlayer !== humanId) return;
        const msg: ServerToClientMessage = {
          event: 'request_input',
          data: payload,
        };
        this.socketManager.sendTo(soloId, humanId, msg);
      },
    );

    // game_over: 사람에게 전달 후 방 정리.
    engine.onGameOver((payload: GameOverPayload) => {
      const msg: ServerToClientMessage = {
        event: 'game_over',
        data: payload,
      };
      this.socketManager.sendTo(soloId, humanId, msg);

      // PvE(스테이지 지정)에서 사람이 이겼으면 클리어를 기록한다.
      // 튜토리얼(stageId 없음)은 아무 것도 기록하지 않는다.
      // ws 경로를 막지 않도록 fire-and-forget 으로 처리한다(절대 throw 하지 않음).
      if (room.stageId && payload.winner === humanId) {
        pveProgressService
          .markCleared(humanId, room.stageId)
          .catch((err) => {
            console.warn('[SoloGameManager] markCleared failed', {
              soloId,
              humanId,
              stageId: room.stageId,
              err,
            });
          });
      }

      this.rooms.delete(soloId);
    });

    // invalid_action: 사람 대상만 전달.
    engine.onInvalidAction(
      (
        targetPlayer: PlayerID | null | undefined,
        payload: InvalidActionPayload,
      ) => {
        if (targetPlayer !== humanId) return;
        const msg: ServerToClientMessage = {
          event: 'invalid_action',
          data: payload,
        };
        this.socketManager.sendTo(soloId, humanId, msg);
      },
    );
  }
}

/**
 * 휴리스틱이 고른 LegalAction(절대 좌표 기준) 을 엔진이 기대하는
 * PlayerActionPayload(AI 시점 viewer 좌표) 로 변환한다.
 */
function toActionPayload(
  engine: GameEngineAdapter,
  action: LegalAction,
): PlayerActionPayload {
  switch (action.kind) {
    case 'move': {
      const core = engine.getCore();
      const viewer = toViewerPos(
        engine.state.board,
        core.bottomSidePlayerId,
        action.to,
        AI_PLAYER_ID,
      );
      return { action: 'move', to: [viewer.r, viewer.c] };
    }
    case 'use_card':
      return { action: 'use_card', cardInstance: action.cardInstance };
    case 'use_ritual':
      return { action: 'use_ritual', ritualId: action.ritualId };
    case 'end_turn':
    default:
      return { action: 'end_turn' };
  }
}

/**
 * AI 입력 요청에 대한 방어적 기본 답변.
 *
 * - option 류: count 만큼 앞에서 선택(기본 1). 단일 선택이면 첫 옵션.
 * - 옵션이 없으면 null.
 *
 * 루프의 try/catch + 스텝 cap 덕분에 답이 틀려도 한 스텝을 낭비할 뿐 hang 하지 않는다.
 */
function defaultAnswer(pendingInput: GameEngineCore['pendingInput']): unknown {
  if (!pendingInput) return null;
  const options = pendingInput.options;
  if (Array.isArray(options) && options.length > 0) {
    const count = pendingInput.count ?? 1;
    if (count > 1) {
      return options.slice(0, Math.min(count, options.length));
    }
    return options[0];
  }
  return null;
}
