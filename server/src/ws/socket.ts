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
import { GameRoomManager } from './gameRoomManager';
import type { SocketClient } from './socketManager';

export type WsApi = {
  broadcast: (roomCode: string, data: unknown) => void;
  sendTo: (roomCode: string, userId: string, data: unknown) => void;
};

export function attachWebSocket(server: http.Server): WsApi {
  const wss = new WebSocketServer({ server, path: '/api/match/socket' });

  const socketManager = new SocketManager();
  const roomManager = new GameRoomManager(socketManager);

  function broadcast(roomCode: string, data: unknown) {
    socketManager.broadcast(roomCode, data);
  }

  function sendTo(roomCode: string, userId: string, data: unknown) {
    socketManager.sendTo(roomCode, userId, data);
  }

  wss.on('connection', (socket: SocketClient) => {
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
          const { roomCode, userId } = data as ReadyPayload;
          if (!roomCode || !userId) return;
          // 참가자 여부 검증 및 방 참여/ready 처리는 GameRoomManager에서 수행
          void roomManager
            .handleReady(socket, { roomCode, userId })
            .catch((err) =>
              console.error('[WS] handleReady error', {
                err,
                roomCode,
                userId,
              }),
            );
          return;
        }

        if (!socket.roomCode || !socket.userId) return;
        const roomCode = socket.roomCode;
        const userId = socket.userId as string;

        switch (event) {
          case 'player_action': {
            const action = data as PlayerActionPayload;
            void roomManager
              .handlePlayerAction(roomCode, userId, action)
              .catch((err) =>
                console.error('[WS] handlePlayerAction error', {
                  err,
                  roomCode,
                  userId,
                }),
              );
            break;
          }
          case 'answer_mulligan': {
            const payload = data as AnswerMulliganPayload;
            void roomManager
              .handleAnswerMulligan(roomCode, userId, payload)
              .catch((err) =>
                console.error('[WS] handleAnswerMulligan error', {
                  err,
                  roomCode,
                  userId,
                }),
              );
            break;
          }
          case 'player_input': {
            const payload = data as PlayerInputPayload;
            void roomManager
              .handlePlayerInput(roomCode, userId, payload)
              .catch((err) =>
                console.error('[WS] handlePlayerInput error', {
                  err,
                  roomCode,
                  userId,
                }),
              );
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
      socketManager.leave(socket);
    });
  });

  return { broadcast, sendTo };
}
