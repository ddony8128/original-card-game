import type { PlayerID, GameState } from '../type/gameState';
import type {
  AnswerMulliganPayload,
  PlayerActionPayload,
  PlayerInputPayload,
  ReadyPayload,
  ServerToClientMessage,
  StatePatchPayload,
  AskMulliganPayload,
  RequestInputPayload,
  GameOverPayload,
  InvalidActionPayload,
} from '../type/wsProtocol';
import { roomsService, type RoomRow } from '../services/rooms';
import { decksService } from '../services/decks';
import { GameEngineAdapter } from '../type/gameEngine';
import {
  buildEngineContextFromDecks,
  createInitialGameState,
  type PlayerDeckConfig,
} from '../state/gameInit';
import type { SocketManager, SocketClient } from './socketManager';

// 각 게임 방에 대한 메타정보 타입
type RoomEngine = {
  roomCode: string;
  engine: GameEngineAdapter; // 실제 게임 엔진 인스턴스
  players: PlayerID[]; // 방 참가자 목록(순서 보장)
  initializedPlayers: Set<PlayerID>; // game_init 메시지 전송 여부 추적
  readyPlayers: Set<PlayerID>; // 준비 완료된 플레이어 추적 (게임 시작 조건)
};

/**
 * 실제 게임 방 관리를 담당하는 객체.
 * - 엔진/방 초기화 및 엔진의 콜백 설정
 * - 플레이어별/전체에게 엔진에서 온 이벤트를 웹소켓으로 전달
 */
export class GameRoomManager {
  // roomCode별 엔진/메타정보 저장
  private readonly roomEngines: Map<string, RoomEngine> = new Map();

  constructor(private readonly socketManager: SocketManager) {}

  // === 내부 경고 로그 ===
  private warnNoExistingRoom(roomCode: string, userId: PlayerID) {
    // 존재하지 않는 방 접근 시 경고
    console.warn('[GameRoomManager] Non-existing room', {
      roomCode,
      userId,
    });
  }

  private warnNonParticipant(roomCode: string, userId: PlayerID) {
    // 방 참가자가 아닌 사용자가 메시지 보냈을 때의 경고
    console.warn('[GameRoomManager] Non-participant sent message', {
      roomCode,
      userId,
    });
  }

  /**
   * 방&참가자 유효성 검증.
   * - 방이 없으면 warn + null
   * - 참가자가 아니면 warn + null
   * - 아니면 RoomEngine 반환
   */
  private async getValidRoomOrWarn(
    roomCode: string,
    playerId: PlayerID,
  ): Promise<RoomEngine | null> {
    const room = await this.ensureRoom(roomCode);
    if (!room) {
      this.warnNoExistingRoom(roomCode, playerId);
      return null;
    }
    if (!room.players.includes(playerId)) {
      this.warnNonParticipant(roomCode, playerId);
      return null;
    }
    return room;
  }

  /**
   * 클라이언트의 ready(게임 시작 참여) 요청 처리
   * - DB에서 방/참가자 검증(비정상 접근 차단)
   * - RoomEngine 생성+참여자 tracking
   * - 모두 ready 상태면 엔진에 markReady() 호출(게임 진행 시작)
   */
  async handleReady(
    socket: SocketClient,
    payload: ReadyPayload,
  ): Promise<void> {
    const { roomCode, userId } = payload;

    // DB에서 방 정보를 조회해 참가자(호스트/게스트) 여부 검증
    const roomRow: RoomRow | null = await roomsService.byCode(roomCode);
    if (!roomRow) {
      this.warnNoExistingRoom(roomCode, userId);
      return;
    }
    const isParticipant =
      roomRow.host_id === userId ||
      (!!roomRow.guest_id && roomRow.guest_id === userId);
    if (!isParticipant) {
      this.warnNonParticipant(roomCode, userId);
      return;
    }

    // 엔진/RoomEngine 세팅, 유효한 참가자만 WS 방에 참여
    // ensureRoom은 DB 조회 및 players 배열 업데이트
    const room = await this.ensureRoom(roomCode, roomRow);
    if (!room) return;

    // 소켓에 유저/방 정보 명시적으로 기록
    socket.userId = userId;
    socket.roomCode = roomCode;
    this.socketManager.joinRoom(roomCode, socket, userId);

    // 준비 완료 표시 후, 모두 준비시 markReady
    room.readyPlayers.add(userId as PlayerID);

    if (room.readyPlayers.size === room.players.length) {
      await room.engine.markReady();
    }
  }

  /**
   * 일반 플레이어 액션 전달 핸들러
   * 이동, 턴 종료, 카드 사용, 마법진 사용
   * 유효성 검증 후 엔진으로 액션 위임
   */
  async handlePlayerAction(
    roomCode: string,
    playerId: PlayerID,
    action: PlayerActionPayload,
  ): Promise<void> {
    const room = await this.getValidRoomOrWarn(roomCode, playerId);
    if (!room) return;
    await room.engine.handlePlayerAction(playerId, action);
  }

  /**
   * 멀리건 답변 처리 핸들러 (유효성 검증 및 엔진 위임)
   */
  async handleAnswerMulligan(
    roomCode: string,
    playerId: PlayerID,
    payload: AnswerMulliganPayload,
  ): Promise<void> {
    const room = await this.getValidRoomOrWarn(roomCode, playerId);
    if (!room) return;
    await room.engine.handleAnswerMulligan(playerId, payload);
  }

  /**
   * 효과를 받을 카드 선택, 이동 위치 선택 등 사용자 입력 처리 핸들러
   */
  async handlePlayerInput(
    roomCode: string,
    playerId: PlayerID,
    payload: PlayerInputPayload,
  ): Promise<void> {
    const room = await this.getValidRoomOrWarn(roomCode, playerId);
    if (!room) return;
    await room.engine.handlePlayerInput(playerId, payload);
  }

  /**
   * 방 엔진 조회 & 필요시 새로 초기화
   * 1) 이미 있으면 반환
   * 2) 없으면
   *   - DB에서 방 row/덱 정보 가져와 플레이어별 DeckConfig 준비
   *   - 게임 상태/EngineContext 준비
   *   - 엔진/RoomEngine 및 콜백 연결
   * 3) roomEngines에 등록 후 반환
   */
  private async ensureRoom(
    roomCode: string,
    roomRowCache?: RoomRow,
  ): Promise<RoomEngine | null> {
    const existing = this.roomEngines.get(roomCode);
    if (existing) return existing;

    let roomRow: RoomRow | undefined | null = roomRowCache;

    // DB에서 room 정보 확보
    if (!roomRow) {
      roomRow = await roomsService.byCode(roomCode);
    }
    if (!roomRow) return null;

    // 방 참가자 구성
    const players: PlayerID[] = [roomRow.host_id];
    if (roomRow.guest_id) players.push(roomRow.guest_id);

    if (players.length === 0) return null;

    // 각 플레이어의 덱 정보 취합 (호스트/게스트 분리)
    const playerDeckConfigs: PlayerDeckConfig[] = [];

    if (roomRow.host_deck_id) {
      const hostDeck = await decksService.getById(roomRow.host_deck_id);
      if (hostDeck) {
        playerDeckConfigs.push({
          playerId: roomRow.host_id,
          main: hostDeck.main_cards,
          cata: hostDeck.cata_cards,
        });
      }
    }

    if (roomRow.guest_id && roomRow.guest_deck_id) {
      const guestDeck = await decksService.getById(roomRow.guest_deck_id);
      if (guestDeck) {
        playerDeckConfigs.push({
          playerId: roomRow.guest_id,
          main: guestDeck.main_cards,
          cata: guestDeck.cata_cards,
        });
      }
    }

    // 초기 상태/컨텍스트 준비
    const initialState: GameState = createInitialGameState(playerDeckConfigs);
    const ctx = await buildEngineContextFromDecks(playerDeckConfigs);

    // RoomEngine 객체 생성 및 콜백 연동
    const roomEngine: RoomEngine = {
      roomCode,
      engine: GameEngineAdapter.create({
        roomCode,
        players,
        initialState,
        ctx,
      }),
      players,
      initializedPlayers: new Set<PlayerID>(),
      readyPlayers: new Set<PlayerID>(),
    };
    this.attachEngineCallbacks(roomEngine);
    this.roomEngines.set(roomCode, roomEngine);
    return roomEngine;
  }

  /**
   * 방 엔진에서 이벤트(상태변경/입력요청 등) 발생시
   * 각 이벤트를 적절한 WS 메시지로 변환하여 송신
   */
  private attachEngineCallbacks(room: RoomEngine) {
    const { roomCode, engine } = room;

    /**
     * 최초 patch(`game_init` 메시지) 한 번만 보장용 내부 함수
     * 이미 보냈다면 false, 아니면 game_init 송신 후 true
     */
    const sendInitIfNeeded = (
      pid: PlayerID,
      payload: StatePatchPayload,
    ): boolean => {
      if (room.initializedPlayers.has(pid)) return false;
      const initMsg: ServerToClientMessage = {
        event: 'game_init',
        data: {
          state: payload.fogged_state,
          version: payload.version,
        },
      };
      this.socketManager.sendTo(roomCode, pid, initMsg);
      room.initializedPlayers.add(pid);
      return true;
    };

    // === 상태 변경 patch 이벤트 ===
    // - 초기화 단계면 game_init(딱 1번)
    // - 이후엔 state_patch
    engine.onStatePatch(
      (
        targetPlayer: PlayerID | null | undefined,
        payload: StatePatchPayload,
      ) => {
        const msg: ServerToClientMessage = {
          event: 'state_patch',
          data: payload,
        };
        if (targetPlayer) {
          // 단일 플레이어 대상: game_init 아직 안보냈으면 그걸 보냄
          if (sendInitIfNeeded(targetPlayer, payload)) return;
          this.socketManager.sendTo(roomCode, targetPlayer, msg);
          return;
        }

        // 전체 대상: 모두에게 game_init 1번, 그 뒤로 state_patch
        room.players.forEach((pid) => {
          sendInitIfNeeded(pid, payload);
        });
        this.socketManager.broadcast(roomCode, msg);
        return;
      },
    );

    // === 멀리건 요청 ===
    engine.onAskMulligan(
      (
        targetPlayer: PlayerID | null | undefined,
        payload: AskMulliganPayload,
      ) => {
        if (!targetPlayer) return;
        const msg: ServerToClientMessage = {
          event: 'ask_mulligan',
          data: payload,
        };
        this.socketManager.sendTo(roomCode, targetPlayer, msg);
      },
    );

    // === 추가 입력 요청 ===
    engine.onRequestInput(
      (
        targetPlayer: PlayerID | null | undefined,
        payload: RequestInputPayload,
      ) => {
        if (!targetPlayer) return;
        const msg: ServerToClientMessage = {
          event: 'request_input',
          data: payload,
        };
        this.socketManager.sendTo(roomCode, targetPlayer, msg);
      },
    );

    // === 게임 종료 ===
    // 종료 시 전체 broadcast 및 엔진/메타정보 해제(cleanup)
    engine.onGameOver((payload: GameOverPayload) => {
      const msg: ServerToClientMessage = {
        event: 'game_over',
        data: payload,
      };
      this.socketManager.broadcast(roomCode, msg);
      this.roomEngines.delete(roomCode);
    });

    // === 잘못된 액션(예외) 알림 ===
    engine.onInvalidAction(
      (
        targetPlayer: PlayerID | null | undefined,
        payload: InvalidActionPayload,
      ) => {
        if (!targetPlayer) return;
        const msg: ServerToClientMessage = {
          event: 'invalid_action',
          data: payload,
        };
        this.socketManager.sendTo(roomCode, targetPlayer, msg);
      },
    );
  }
}
