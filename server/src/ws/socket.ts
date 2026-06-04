import http from 'node:http';
import { WebSocketServer } from 'ws';
import { SocketManager } from './socketManager';
import type {
  ClientToServerEvent,
  ClientToServerMessage,
  ReadyPayload,
  StartSoloPayload,
  JoinChatPayload,
  ChatPayload,
  PlayerActionPayload,
  AnswerMulliganPayload,
  PlayerInputPayload,
  SetSoloSpeedPayload,
} from '../type/wsProtocol';
import { GameRoomManager } from './gameRoomManager';
import { SoloGameManager } from './soloGameManager';
import type { SocketClient } from './socketManager';
import { registerInvalidStrike } from './abuseGuard';

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
  const soloManager = new SoloGameManager(socketManager);

  function broadcast(roomCode: string, data: unknown) {
    socketManager.broadcast(roomCode, data);
  }

  function sendTo(roomCode: string, userId: string, data: unknown) {
    socketManager.sendTo(roomCode, userId, data);
  }

  // 새 WS 연결이 수립될 때마다 호출
  wss.on('connection', (socket: SocketClient) => {
    // 허용되지 않은 입력(파싱 실패/미인증 플러딩/알 수 없는 이벤트)이 임계치를
    // 넘으면 단순 무시가 아니라 연결을 차단한다.
    const registerStrike = () => {
      if (registerInvalidStrike(socket)) {
        console.warn('[WS] 허용되지 않은 메시지 누적, 연결 차단', {
          userId: socket.userId,
          roomCode: socket.roomCode,
        });
        socket.close();
      }
    };

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
          if (!roomCode || !userId) {
            registerStrike();
            return;
          }
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

        // 2) join_chat: 대기실 채팅용 방 입장 (ready 와 분리, 게임 시작 미발동)
        //    ready 처럼 roomCode/userId 기록 이전에도 허용한다.
        if (event === 'join_chat') {
          const { roomCode, userId } = data as JoinChatPayload;
          if (!roomCode || !userId) {
            registerStrike();
            return;
          }
          void roomManager
            .handleJoinChat(socket, { roomCode, userId })
            .catch((err) =>
              console.error('[WS] handleJoinChat error', {
                err,
                roomCode,
                userId,
              }),
            );
          return;
        }

        // 3) start_solo: 싱글플레이(vs AI) 시작. ready 처럼 인증(roomCode 기록) 이전에도 허용한다.
        if (event === 'start_solo') {
          const { userId, deckId, mode, stageId, aiSpeed } =
            data as StartSoloPayload;
          if (!userId || !deckId) {
            registerStrike();
            return;
          }
          void soloManager
            .handleStartSolo(socket, { userId, deckId, mode, stageId, aiSpeed })
            .catch((err) =>
              console.error('[WS] handleStartSolo error', {
                err,
                userId,
                deckId,
              }),
            );
          return;
        }

        // ready/join_chat 이전에는 roomCode/userId 정보가 없으므로, 그 외 이벤트는 차단 카운트 후 무시
        if (!socket.roomCode || !socket.userId) {
          registerStrike();
          return;
        }
        const roomCode = socket.roomCode;
        const userId = socket.userId as string;

        // 2) 이후 이벤트는 socket 에 기록된 roomCode/userId 기준으로 라우팅
        switch (event) {
          case 'player_action': {
            const action = data as PlayerActionPayload;
            const promise = socket.solo
              ? soloManager.handlePlayerAction(roomCode, action)
              : roomManager.handlePlayerAction(roomCode, userId, action);
            void promise.catch((err) =>
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
            const promise = socket.solo
              ? soloManager.handleAnswerMulligan(roomCode, payload)
              : roomManager.handleAnswerMulligan(roomCode, userId, payload);
            void promise.catch((err) =>
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
            const promise = socket.solo
              ? soloManager.handlePlayerInput(roomCode, payload)
              : roomManager.handlePlayerInput(roomCode, userId, payload);
            void promise.catch((err) =>
              console.error('[WS] handlePlayerInput error', {
                err,
                roomCode,
                userId,
              }),
            );
            break;
          }
          case 'set_solo_speed': {
            // 진행 중인 솔로 게임의 AI 속도를 실시간 변경(검증/대상 탐색은 매니저가 담당).
            const payload = data as SetSoloSpeedPayload;
            if (socket.solo) {
              soloManager.setSpeed(socket, payload.aiSpeed);
            }
            break;
          }
          case 'chat': {
            const payload = data as ChatPayload;
            void roomManager
              .handleChat(roomCode, userId, payload.text)
              .catch((err) =>
                console.error('[WS] handleChat error', {
                  err,
                  roomCode,
                  userId,
                }),
              );
            break;
          }
          default:
            registerStrike();
            break;
        }
      } catch {
        // JSON 파싱 실패 등 잘못된 메시지는 차단 카운트 후 무시
        registerStrike();
      }
    });

    // 연결이 끊기면 room membership 정리
    socket.on('close', () => {
      socketManager.leave(socket);
    });
  });

  return { broadcast, sendTo };
}
