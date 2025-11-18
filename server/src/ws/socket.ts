import http from 'node:http';
import { WebSocketServer } from 'ws';
import { SocketManager } from './socketManager';
import type {
  ClientToServerEvent,
  ClientToServerMessage,
  ReadyPayload,
  PlayerActionPayload,
  AnswerMulliganPayload,
  PlayerInputPayload,
} from '../type/wsProtocol';
import { GameRoomManager, type WsClient } from './gameRoomManager';

export type WsApi = {
  broadcast: (roomCode: string, data: unknown) => void;
  sendTo: (roomCode: string, userId: string, data: unknown) => void;
};

export function attachWebSocket(server: http.Server): WsApi {
  const wss = new WebSocketServer({ server, path: '/api/match/socket' });

  const manager = new SocketManager();
  const roomManager = new GameRoomManager(manager);

  function broadcast(roomCode: string, data: unknown) {
    manager.broadcast(roomCode, data);
  }

  function sendTo(roomCode: string, userId: string, data: unknown) {
    manager.sendTo(roomCode, userId, data);
  }

  wss.on('connection', (socket: WsClient) => {
    socket.on('message', (buf) => {
      try {
        const raw = JSON.parse(buf.toString()) as
          | ClientToServerMessage
          | {
              event: ClientToServerEvent | string;
              data: unknown;
            };

        const event = (raw as ClientToServerMessage).event;
        const data = (raw as ClientToServerMessage).data;

        if (event === 'ready') {
          const { roomId, userId } = data as ReadyPayload;
          if (!roomId || !userId) return;
          socket.userId = userId;
          socket.roomCode = roomId;
          roomManager.addClient(roomId, socket, userId);
          void roomManager.handleReady(roomId, {
            roomId,
            userId,
          });
          return;
        }

        if (!socket.roomCode || !socket.userId) return;
        const roomCode = socket.roomCode;
        const userId = socket.userId as string;

        switch (event) {
          case 'player_action': {
            const action = data as PlayerActionPayload;
            void roomManager.handlePlayerAction(roomCode, userId, action);
            break;
          }
          case 'answer_mulligan': {
            const payload = data as AnswerMulliganPayload;
            void roomManager.handleAnswerMulligan(roomCode, userId, payload);
            break;
          }
          case 'player_input': {
            const payload = data as PlayerInputPayload;
            void roomManager.handlePlayerInput(roomCode, userId, payload);
            break;
          }
          default:
            break;
        }
      } catch {
        // ignore malformed
      }
    });

    socket.on('close', () => {
      roomManager.removeClient(socket);
    });
  });

  return { broadcast, sendTo };
}
