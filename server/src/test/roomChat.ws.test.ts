import { describe, it, expect, vi } from 'vitest';
import type { PlayerID } from '../type/gameState';
import type { ChatBroadcastPayload, ServerToClientMessage } from '../type/wsProtocol';
import type { SocketClient } from '../ws/socketManager';

// --- Supabase 의존을 막기 위한 서비스 모킹 ---

vi.mock('../services/rooms', () => {
  const room = {
    id: 'room-1',
    host_id: 'host-1',
    guest_id: 'guest-1',
    code: 'ROOM1',
    status: 'waiting' as const,
    host_deck_id: 'deck-host',
    guest_deck_id: 'deck-guest',
  };
  return {
    roomsService: {
      byCode: vi.fn(async (code: string) => (code === 'ROOM1' ? room : null)),
    },
  };
});

vi.mock('../services/decks', () => {
  return {
    decksService: {
      getById: vi.fn(async () => null),
    },
  };
});

vi.mock('../services/cards', () => {
  return {
    cardsService: {
      listAll: vi.fn(async () => []),
      getByIds: vi.fn(async () => []),
      getById: vi.fn(async () => null),
    },
  };
});

vi.mock('../services/users', () => {
  return {
    usersService: {
      findById: vi.fn(async (id: string) => ({
        id,
        username: id === 'host-1' ? 'Alice' : 'Bob',
        password: 'x',
      })),
    },
  };
});

import { GameRoomManager } from '../ws/gameRoomManager';
import { SocketManager } from '../ws/socketManager';

/**
 * 실제 SocketManager 를 사용해 두 소켓이 같은 방에 채팅 참여했을 때
 * broadcast 가 양쪽 소켓 모두에게 전달되는지 검증한다.
 */
class FakeWebSocket {
  static OPEN = 1;
  OPEN = 1;
  readyState = 1;
  public sent: ServerToClientMessage[] = [];
  send(payload: string) {
    this.sent.push(JSON.parse(payload) as ServerToClientMessage);
  }
}

const roomCode = 'ROOM1';
const p1: PlayerID = 'host-1';
const p2: PlayerID = 'guest-1';

describe('대기실 채팅 (join_chat / chat)', () => {
  it('join_chat 후 chat 을 보내면 같은 방의 모든 소켓이 chat 브로드캐스트를 받는다', async () => {
    // 실제 SocketManager 사용 (broadcast 전파 경로까지 검증)
    const socketManager = new SocketManager();
    const roomManager = new GameRoomManager(socketManager);

    const s1 = new FakeWebSocket() as unknown as SocketClient;
    const s2 = new FakeWebSocket() as unknown as SocketClient;

    // 두 소켓 모두 채팅 참여 (ready/엔진 미발동)
    await roomManager.handleJoinChat(s1, { roomCode, userId: p1 });
    await roomManager.handleJoinChat(s2, { roomCode, userId: p2 });

    // host 가 채팅 전송
    await roomManager.handleChat(roomCode, p1, '  hello world  ');

    const received1 = (s1 as unknown as FakeWebSocket).sent;
    const received2 = (s2 as unknown as FakeWebSocket).sent;

    // 두 소켓 모두 chat 이벤트 1건 수신
    expect(received1).toHaveLength(1);
    expect(received2).toHaveLength(1);

    const msg = received2[0];
    expect(msg.event).toBe('chat');
    const data = msg.data as ChatBroadcastPayload;
    // 보낸 사람의 userId / 조회된 username / trim 된 text 검증
    expect(data.userId).toBe(p1);
    expect(data.username).toBe('Alice');
    expect(data.text).toBe('hello world');
  });

  it('빈 메시지는 무시되어 브로드캐스트되지 않는다', async () => {
    const socketManager = new SocketManager();
    const roomManager = new GameRoomManager(socketManager);

    const s1 = new FakeWebSocket() as unknown as SocketClient;
    await roomManager.handleJoinChat(s1, { roomCode, userId: p1 });

    await roomManager.handleChat(roomCode, p1, '   ');

    expect((s1 as unknown as FakeWebSocket).sent).toHaveLength(0);
  });
});
