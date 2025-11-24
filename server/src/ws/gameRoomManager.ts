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
import type { DeckList } from '../type/deck';
import { roomsService, type RoomRow } from '../services/rooms';
import { decksService } from '../services/decks';
import { GameEngineAdapter } from '../type/gameEngine';
import {
  buildEngineContextFromDecks,
  createInitialGameState,
  type PlayerDeckConfig,
} from '../state/gameInit';
import type { SocketManager, SocketClient } from './socketManager';

type RoomEngine = {
  roomCode: string;
  engine: GameEngineAdapter;
  players: PlayerID[];
  initializedPlayers: Set<PlayerID>;
  // game_init 메시지 전송 여부 확인 용도
  readyPlayers: Set<PlayerID>;
  // 게임 시작 조건 확인 용도
};

export class GameRoomManager {
  private readonly roomEngines: Map<string, RoomEngine> = new Map();
  // roomCode -> RoomEngine

  constructor(private readonly socketManager: SocketManager) {}

  private warnNoExistingRoom(roomCode: string, userId: PlayerID) {
    console.warn('[GameRoomManager] Non-existing room', {
      roomCode,
      userId,
    });
  }

  private warnNonParticipant(roomCode: string, userId: PlayerID) {
    console.warn('[GameRoomManager] Non-participant sent message', {
      roomCode,
      userId,
    });
  }

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

  async handleReady(
    socket: SocketClient,
    payload: ReadyPayload,
  ): Promise<void> {
    const { roomCode, userId } = payload;

    // 1) DB에서 방 정보를 조회해 참가자(호스트/게스트)인지 먼저 검증
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

    // 2) 유효한 참가자에 대해서만 엔진/RoomEngine 생성
    // ensureRoom 함수 내부에서 DB를 조회해 players 배열도 추가함
    const room = await this.ensureRoom(roomCode, roomRow);
    if (!room) return;

    // 유효한 참가자만 WS 방에 참여시키고 메타데이터 설정
    socket.userId = userId;
    socket.roomCode = roomCode;
    this.socketManager.joinRoom(roomCode, socket, userId);

    room.readyPlayers.add(userId as PlayerID);
    console.log(
      '[GameRoomManager] 준비완료 메시지 수신',
      roomCode,
      Array.from(room.readyPlayers),
    );

    if (room.readyPlayers.size === room.players.length) {
      await room.engine.markReady();
    }
  }

  async handlePlayerAction(
    roomCode: string,
    playerId: PlayerID,
    action: PlayerActionPayload,
  ): Promise<void> {
    const room = await this.getValidRoomOrWarn(roomCode, playerId);
    if (!room) return;
    await room.engine.handlePlayerAction(playerId, action);
  }

  async handleAnswerMulligan(
    roomCode: string,
    playerId: PlayerID,
    payload: AnswerMulliganPayload,
  ): Promise<void> {
    const room = await this.getValidRoomOrWarn(roomCode, playerId);
    if (!room) return;
    await room.engine.handleAnswerMulligan(playerId, payload);
  }

  async handlePlayerInput(
    roomCode: string,
    playerId: PlayerID,
    payload: PlayerInputPayload,
  ): Promise<void> {
    const room = await this.getValidRoomOrWarn(roomCode, playerId);
    if (!room) return;
    await room.engine.handlePlayerInput(playerId, payload);
  }

  // roomEngine 있으면 반환, 없으면 초기화 후 반환
  // 1) gameState 초기화
  // 2) 엔진에 콜백함수 붙여주기
  private async ensureRoom(
    roomCode: string,
    roomRowCache?: RoomRow,
  ): Promise<RoomEngine | null> {
    const existing = this.roomEngines.get(roomCode);
    if (existing) return existing;

    let roomRow: RoomRow | undefined | null = roomRowCache;

    if (!roomRow) {
      roomRow = await roomsService.byCode(roomCode);
    }
    if (!roomRow) return null;

    const players: PlayerID[] = [roomRow.host_id];
    if (roomRow.guest_id) players.push(roomRow.guest_id);

    if (players.length === 0) return null;

    const decksByPlayer = new Map<PlayerID, DeckList>();
    const cataByPlayer = new Map<PlayerID, DeckList>();
    const deckConfigs: PlayerDeckConfig[] = [];

    if (roomRow.host_deck_id) {
      const hostDeck = await decksService.getById(roomRow.host_deck_id);
      if (hostDeck) {
        decksByPlayer.set(roomRow.host_id, hostDeck.main_cards);
        cataByPlayer.set(roomRow.host_id, hostDeck.cata_cards);
        deckConfigs.push({
          playerId: roomRow.host_id,
          main: hostDeck.main_cards,
          cata: hostDeck.cata_cards,
        });
      }
    }

    if (roomRow.guest_id && roomRow.guest_deck_id) {
      const guestDeck = await decksService.getById(roomRow.guest_deck_id);
      if (guestDeck) {
        decksByPlayer.set(roomRow.guest_id, guestDeck.main_cards);
        cataByPlayer.set(roomRow.guest_id, guestDeck.cata_cards);
        deckConfigs.push({
          playerId: roomRow.guest_id,
          main: guestDeck.main_cards,
          cata: guestDeck.cata_cards,
        });
      }
    }

    const initialState: GameState = createInitialGameState(
      players,
      decksByPlayer,
      cataByPlayer,
    );
    const ctx = await buildEngineContextFromDecks(deckConfigs);

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

  private attachEngineCallbacks(room: RoomEngine) {
    const { roomCode, engine } = room;

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
      console.log(
        `[onStatePatch] Sending game_init to player ${pid} in room ${roomCode}`,
      );
      this.socketManager.sendTo(roomCode, pid, initMsg);
      room.initializedPlayers.add(pid);
      return true;
    };

    // 엔진의 state_patch에 대해
    // 초기화 메시지면 game_init 전송
    // 아니면 state_patch 전송
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
          if (sendInitIfNeeded(targetPlayer, payload)) return;
          console.log(
            `[onStatePatch] Sending state_patch to player ${targetPlayer} in room ${roomCode}`,
          );
          this.socketManager.sendTo(roomCode, targetPlayer, msg);
          return;
        }

        // 모든 플레이어에 대해 전송
        room.players.forEach((pid) => {
          sendInitIfNeeded(pid, payload);
        });
        this.socketManager.broadcast(roomCode, msg);
        console.log(
          `[onStatePatch] Broadcasting state_patch to all players in room ${roomCode}`,
        );
        return;
      },
    );

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
        console.log(
          `[onAskMulligan] Sending ask_mulligan to player ${targetPlayer} in room ${roomCode}`,
        );
        this.socketManager.sendTo(roomCode, targetPlayer, msg);
      },
    );

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

    engine.onGameOver((payload: GameOverPayload) => {
      const msg: ServerToClientMessage = {
        event: 'game_over',
        data: payload,
      };
      this.socketManager.broadcast(roomCode, msg);
      this.roomEngines.delete(roomCode);
    });

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
