import type { WebSocket } from 'ws';
import type { PlayerID, GameState } from '../type/gameState';
import type {
  AnswerMulliganPayload,
  PlayerActionPayload,
  PlayerInputPayload,
  ReadyPayload,
  ServerToClientMessage,
} from '../type/wsProtocol';
import type { DeckList } from '../type/deck';
import { roomsService } from '../services/rooms';
import { decksService } from '../services/decks';
import { GameEngine } from '../type/gameEngine';
import {
  buildEngineContextFromDecks,
  createInitialGameState,
  type PlayerDeckConfig,
} from '../state/gameInit';
import type { SocketManager } from './socketManager';

export type WsClient = WebSocket & { roomCode?: string; userId?: string };

type RoomEngine = {
  roomId: string;
  engine: GameEngine;
  players: PlayerID[];
  initializedPlayers: Set<PlayerID>;
};

type RoomMap = Map<string, RoomEngine>;

export class GameRoomManager {
  private readonly rooms: RoomMap = new Map();
  private readonly userReady: Map<PlayerID, boolean> = new Map();

  constructor(private readonly socketManager: SocketManager) {}

  addClient(roomId: string, socket: WsClient, userId?: string) {
    this.socketManager.joinRoom(roomId, socket, userId);
  }

  removeClient(socket: WsClient) {
    this.socketManager.leave(socket);
  }

  async handleReady(
    roomId: string,
    payload: ReadyPayload & { userId: PlayerID },
  ): Promise<void> {
    const room = await this.ensureRoom(roomId);
    if (!room) return;
    this.userReady.set(payload.userId, true);
    console.log('준비완료 메시지 수신', roomId, this.userReady);

    if (this.userReady.size === room.players.length) {
      await room.engine.markReady();
    }
  }

  async handlePlayerAction(
    roomId: string,
    playerId: PlayerID,
    action: PlayerActionPayload,
  ): Promise<void> {
    const room = await this.ensureRoom(roomId);
    if (!room) return;
    await room.engine.handlePlayerAction(playerId, action);
  }

  async handleAnswerMulligan(
    roomId: string,
    playerId: PlayerID,
    payload: AnswerMulliganPayload,
  ): Promise<void> {
    const room = await this.ensureRoom(roomId);
    if (!room) return;
    await room.engine.handleAnswerMulligan(playerId, payload);
  }

  async handlePlayerInput(
    roomId: string,
    playerId: PlayerID,
    payload: PlayerInputPayload,
  ): Promise<void> {
    const room = await this.ensureRoom(roomId);
    if (!room) return;
    await room.engine.handlePlayerInput(playerId, payload);
  }

  private async ensureRoom(roomId: string): Promise<RoomEngine | null> {
    const existing = this.rooms.get(roomId);
    if (existing) return existing;

    const roomRow = await roomsService.byCode(roomId);
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

    const engine = GameEngine.create({
      roomId,
      players,
      initialState,
      ctx,
    });

    const roomEngine: RoomEngine = {
      roomId,
      engine,
      players,
      initializedPlayers: new Set<PlayerID>(),
    };
    this.attachEngineCallbacks(roomEngine);
    this.rooms.set(roomId, roomEngine);
    return roomEngine;
  }

  private attachEngineCallbacks(room: RoomEngine) {
    const { roomId, engine } = room;

    engine.onStatePatch((targetPlayer, payload) => {
      const msg: ServerToClientMessage = {
        event: 'state_patch',
        data: payload,
      };
      console.log(
        `[onStatePatch] roomId=${roomId} targetPlayer=${targetPlayer ?? 'ALL'} version=${payload.version}`,
      );
      if (targetPlayer) {
        if (!room.initializedPlayers.has(targetPlayer)) {
          const initMsg: ServerToClientMessage = {
            event: 'game_init',
            data: {
              state: payload.fogged_state,
              version: payload.version,
            },
          };
          console.log(
            `[onStatePatch] Sending game_init to player ${targetPlayer} in room ${roomId}`,
          );
          this.socketManager.sendTo(roomId, targetPlayer, initMsg);
          room.initializedPlayers.add(targetPlayer);
        }
        console.log(
          `[onStatePatch] Sending state_patch to player ${targetPlayer} in room ${roomId}`,
        );
        this.socketManager.sendTo(roomId, targetPlayer, msg);
      } else {
        room.players.forEach((pid) => {
          if (!room.initializedPlayers.has(pid)) {
            const initMsg: ServerToClientMessage = {
              event: 'game_init',
              data: {
                state: payload.fogged_state,
                version: payload.version,
              },
            };
            console.log(
              `[onStatePatch] Broadcasting game_init to player ${pid} in room ${roomId}`,
            );
            this.socketManager.sendTo(roomId, pid, initMsg);
            room.initializedPlayers.add(pid);
          }
        });
        console.log(
          `[onStatePatch] Broadcasting state_patch to all players in room ${roomId}`,
        );
        this.socketManager.broadcast(roomId, msg);
      }
    });

    engine.onAskMulligan((targetPlayer, payload) => {
      if (!targetPlayer) return;
      const msg: ServerToClientMessage = {
        event: 'ask_mulligan',
        data: payload,
      };
      console.log(
        `[onAskMulligan] Sending ask_mulligan to player ${targetPlayer} in room ${roomId}`,
      );
      this.socketManager.sendTo(roomId, targetPlayer, msg);
    });

    engine.onRequestInput((targetPlayer, payload) => {
      if (!targetPlayer) return;
      const msg: ServerToClientMessage = {
        event: 'request_input',
        data: payload,
      };
      this.socketManager.sendTo(roomId, targetPlayer, msg);
    });

    engine.onGameOver((payload) => {
      const msg: ServerToClientMessage = {
        event: 'game_over',
        data: payload,
      };
      this.socketManager.broadcast(roomId, msg);
      this.rooms.delete(roomId);
    });

    engine.onInvalidAction((targetPlayer, payload) => {
      if (!targetPlayer) return;
      const msg: ServerToClientMessage = {
        event: 'invalid_action',
        data: payload,
      };
      this.socketManager.sendTo(roomId, targetPlayer, msg);
    });
  }
}
