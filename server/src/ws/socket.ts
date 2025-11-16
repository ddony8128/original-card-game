import http from 'node:http';
import { WebSocketServer } from 'ws';

type WsClient = import('ws').WebSocket & { roomCode?: string; userId?: string };

export type WsApi = {
  broadcast: (roomCode: string, data: unknown) => void;
  sendTo: (roomCode: string, userId: string, data: unknown) => void;
};

export function attachWebSocket(server: http.Server): WsApi {
  const wss = new WebSocketServer({ server, path: '/api/match/socket' });

  const rooms = new Map<string, Set<WsClient>>();
  const roomUsers = new Map<string, Map<string, Set<WsClient>>>();

  function broadcast(roomCode: string, data: unknown) {
    const clients = rooms.get(roomCode);
    if (!clients) return;
    const payload = JSON.stringify(data);
    clients.forEach((client) => {
      if (client.readyState === client.OPEN) client.send(payload);
    });
  }

  function sendTo(roomCode: string, userId: string, data: unknown) {
    const users = roomUsers.get(roomCode);
    if (!users) return;
    const targets = users.get(userId);
    if (!targets) return;
    const payload = JSON.stringify(data);
    targets.forEach((client) => {
      if (client.readyState === client.OPEN) client.send(payload);
    });
  }

  wss.on('connection', (socket: WsClient) => {
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
          socket.roomCode = roomCode;
          if (userId) socket.userId = userId;
          if (!rooms.has(roomCode)) rooms.set(roomCode, new Set());
          rooms.get(roomCode)!.add(socket);
          if (!roomUsers.has(roomCode)) roomUsers.set(roomCode, new Map());
          if (userId) {
            const map = roomUsers.get(roomCode)!;
            if (!map.has(userId)) map.set(userId, new Set());
            map.get(userId)!.add(socket);
          }
          broadcast(roomCode, {
            event: 'room_update',
            data: { status: 'joined' },
          });
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
      const roomCode = socket.roomCode;
      if (roomCode) {
        if (rooms.has(roomCode)) {
          rooms.get(roomCode)!.delete(socket);
          if (rooms.get(roomCode)!.size === 0) rooms.delete(roomCode);
        }
        const userId = socket.userId;
        if (userId && roomUsers.has(roomCode)) {
          const map = roomUsers.get(roomCode)!;
          if (map.has(userId)) {
            map.get(userId)!.delete(socket);
            if (map.get(userId)!.size === 0) map.delete(userId);
          }
          if (map.size === 0) roomUsers.delete(roomCode);
        }
      }
    });
  });

  return { broadcast, sendTo };
}
