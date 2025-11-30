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

/**
 * 서버 HTTP 인스턴스에 게임용 WebSocket 엔드포인트를 부착하는 헬퍼.
 *
 * - 경로: `/api/match/socket`
 * - 클라이언트 → 서버 프로토콜: `ClientToServerMessage` (event + data)
 * - 서버 → 외부 호출용: `broadcast`, `sendTo` 헬퍼를 반환
 *
 * 실제 게임 로직/인증/검증은 `GameRoomManager` 가 담당하고,
 * 이 파일은 **소켓 수명 관리 + JSON 파싱 + 이벤트 라우팅** 만 신경쓴다.
 */
export type WsApi = {
  /** 방 코드 기준 전체 브로드캐스트 */
  broadcast: (roomCode: string, data: unknown) => void;
  /** 특정 방 안의 특정 유저에게만 단일 송신 */
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

  // 새 WS 연결이 수립될 때마다 호출
  wss.on('connection', (socket: SocketClient) => {
    // 클라이언트 → 서버 메시지 처리
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

        // 1) ready: 방 입장 & 게임 준비 여부 알림
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

        // ready 이전에는 roomCode/userId 정보가 없으므로, 그 외 이벤트는 무시
        if (!socket.roomCode || !socket.userId) return;
        const roomCode = socket.roomCode;
        const userId = socket.userId as string;

        // 2) 이후 이벤트는 socket 에 기록된 roomCode/userId 기준으로 라우팅
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
        // JSON 파싱 실패 등 잘못된 메시지는 조용히 무시
      }
    });

    // 연결이 끊기면 room membership 정리
    socket.on('close', () => {
      socketManager.leave(socket);
    });
  });

  return { broadcast, sendTo };
}
