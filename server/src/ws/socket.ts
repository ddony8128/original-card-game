import http from 'node:http';
import { WebSocketServer } from 'ws';
import { SocketManager } from './socketManager';
import type { FoggedGameState } from '../type/gameState';
import { GamePhase } from '../type/gameState';

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
    // 초기 FoggedGameState 전송 (연결 즉시)
    const initialFog: FoggedGameState = {
      phase: GamePhase.WAITING_FOR_MULLIGAN,
      turn: 1,
      activePlayer: 'player1',
      winner: null,
      board: {
        width: 5,
        height: 5,
        wizards: {
          player1: { r: 4, c: 2 },
          player2: { r: 0, c: 2 },
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
    try {
      socket.send(JSON.stringify({ event: 'game_start', data: initialFog }));
    } catch {
      // ignore
    }

    socket.on('message', (buf) => {
      try {
        const { event, data } = JSON.parse(buf.toString()) as {
          event: string;
          data: any;
        };

        if (event === 'join_room') {
          const { roomCode, userId } = data as {
            roomCode: string;
            userId?: string;
          };
          manager.joinRoom(roomCode, socket, userId);
          broadcast(roomCode, {
            event: 'room_update',
            data: { status: 'joined' },
          });
          return;
        }

        if (event === 'check') {
          // 요청 보낸 대상에게 즉시 응답
          try {
            socket.send(
              JSON.stringify({ event: 'check_back', data: { ok: true } }),
            );
          } catch {
            // ignore
          }
          // 5초 후 방 전체에 phase 변경 브로드캐스트
          const roomCode = socket.roomCode;
          if (roomCode) {
            const phases: GamePhase[] = [
              GamePhase.WAITING_FOR_MULLIGAN,
              GamePhase.RESOLVING,
              GamePhase.WAITING_FOR_PLAYER_ACTION,
              GamePhase.WAITING_FOR_PLAYER_INPUT,
              GamePhase.GAME_OVER,
            ];
            setTimeout(() => {
              const next = phases[Math.floor(Math.random() * phases.length)];
              broadcast(roomCode, { event: 'change_phase', data: next });
            }, 5000);
          }
          return;
        }

        if (!socket.roomCode) return;
        const roomCode = socket.roomCode;

        switch (event) {
          case 'start_game':
            broadcast(roomCode, {
              event: 'state_update',
              data: { status: 'started' },
            });
            broadcast(roomCode, {
              event: 'turn_change',
              data: { currentPlayer: 'player1' },
            });
            break;
          case 'player_action':
            broadcast(roomCode, { event: 'card_effect', data });
            break;
          case 'end_turn':
            broadcast(roomCode, { event: 'turn_change', data: { next: true } });
            break;
          case 'surrender':
            broadcast(roomCode, {
              event: 'game_over',
              data: { winnerId: data?.opponentId ?? null },
            });
            break;
          case 'direct_to_player': {
            const { toUserId, payload } = data as {
              toUserId: string;
              payload: unknown;
            };
            if (toUserId)
              sendTo(roomCode, toUserId, {
                event: 'state_update',
                data: payload,
              });
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
      manager.leave(socket);
    });
  });

  return { broadcast, sendTo };
}
