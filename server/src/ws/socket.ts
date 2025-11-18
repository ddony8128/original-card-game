import http from 'node:http';
import { WebSocketServer } from 'ws';
import { SocketManager } from './socketManager';
import type { FoggedGameState } from '../type/gameState';
import { GamePhase } from '../type/gameState';
import type {
  ClientToServerEvent,
  ClientToServerMessage,
  ReadyPayload,
  PlayerActionPayload,
} from '../type/wsProtocol';
import type { ServerToClientMessage } from '../type/wsProtocol';

type WsClient = import('ws').WebSocket & { roomCode?: string; userId?: string };

export type WsApi = {
  broadcast: (roomCode: string, data: unknown) => void;
  sendTo: (roomCode: string, userId: string, data: unknown) => void;
};

export function attachWebSocket(server: http.Server): WsApi {
  const wss = new WebSocketServer({ server, path: '/api/match/socket' });

  const manager = new SocketManager();

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
          socket.userId = userId;
          manager.joinRoom(roomId, socket, userId);

          // TODO: 양쪽 플레이어 모두 ready가 되었을 때만 보내도록 개선
          const initialFog: FoggedGameState = {
            phase: GamePhase.WAITING_FOR_MULLIGAN,
            turn: 1,
            activePlayer: userId ?? 'player1',
            winner: null,
            board: {
              width: 5,
              height: 5,
              wizards: {
                [userId ?? 'player1']: { r: 4, c: 2 },
              },
              rituals: [],
            },
            me: {
              hp: 20,
              mana: 0,
              maxMana: 0,
              hand: [],
              handCount: 0,
              deckCount: 0,
              graveCount: 0,
            },
            opponent: {
              hp: 20,
              mana: 0,
              maxMana: 0,
              handCount: 0,
              deckCount: 0,
              graveCount: 0,
            },
            catastrophe: {
              deckCount: 0,
              graveCount: 0,
            },
            lastActions: [],
          };

          const msg: ServerToClientMessage = {
            event: 'game_init',
            data: {
              state: initialFog,
              version: 1,
            },
          };

          try {
            socket.send(JSON.stringify(msg));
          } catch {
            // ignore
          }
          return;
        }

        if (!socket.roomCode) return;
        const roomCode = socket.roomCode;

        switch (event) {
          case 'player_action': {
            const action = data as PlayerActionPayload;
            // TODO: 실제 엔진에 위임하여 state_patch / request_input / game_over 생성
            // 임시: 받은 액션을 그대로 로그에 남기는 state_patch 더미 전송
            const patchMessage: ServerToClientMessage = {
              event: 'state_patch',
              data: {
                version: Date.now(),
                fogged_state: {
                  phase: GamePhase.WAITING_FOR_PLAYER_ACTION,
                  turn: 1,
                  activePlayer: socket.userId ?? 'player1',
                  winner: null,
                  board: {
                    width: 5,
                    height: 5,
                    wizards: {
                      [socket.userId ?? 'player1']: { r: 4, c: 2 },
                    },
                    rituals: [],
                  },
                  me: {
                    hp: 20,
                    mana: 1,
                    maxMana: 1,
                    hand: [],
                    handCount: 0,
                    deckCount: 0,
                    graveCount: 0,
                  },
                  opponent: {
                    hp: 20,
                    mana: 0,
                    maxMana: 0,
                    handCount: 0,
                    deckCount: 0,
                    graveCount: 0,
                  },
                  catastrophe: {
                    deckCount: 0,
                    graveCount: 0,
                  },
                  lastActions: [
                    {
                      turn: 1,
                      text: JSON.stringify(action),
                      timestamp: Date.now(),
                    },
                  ],
                },
                diff_patch: {
                  animations: [],
                  log: ['dummy player_action processed'],
                },
              },
            };

            broadcast(roomCode, patchMessage);
            break;
          }
          case 'answer_mulligan':
          case 'player_input':
            // TODO: 엔진 구현 후 처리
            break;
          default:
            break;
        }
      } catch {
        // ignore malformed
      }
    });

    socket.on('close', () => {
      manager.leave(socket);
    });
  });

  return { broadcast, sendTo };
}
