import { describe, it, expect, vi } from 'vitest';
import type { PlayerID } from '../type/gameState';
import type {
  AnswerMulliganPayload,
  PlayerActionPayload,
  ServerToClientMessage,
} from '../type/wsProtocol';
import type { SocketClient, SocketManager } from '../ws/socketManager';

// --- Supabase 의존을 막기 위한 서비스 모킹 ---

vi.mock('../services/rooms', () => {
  const room = {
    id: 'room-1',
    host_id: 'host-1',
    guest_id: 'guest-1',
    code: 'ROOM1',
    status: 'playing' as const,
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
      getById: vi.fn(async (deckId: string) => ({
        id: deckId,
        user_id: deckId.includes('host') ? 'host-1' : 'guest-1',
        name: 'test deck',
        main_cards: [],
        cata_cards: [],
        deleted: false,
      })),
    },
  };
});

vi.mock('../services/cards', () => {
  return {
    cardsService: {
      listAll: vi.fn(async () => []),
    },
  };
});

import { GameRoomManager } from '../ws/gameRoomManager';

class FakeSocketManager
  implements Pick<SocketManager, 'joinRoom' | 'leave' | 'broadcast' | 'sendTo'>
{
  public joined: Array<{ room: string; userId?: string }> = [];
  public leftCount = 0;
  public broadcasts: Array<{ room: string; msg: ServerToClientMessage }> = [];
  public directed: Array<{
    room: string;
    userId: string;
    msg: ServerToClientMessage;
  }> = [];

  joinRoom(roomCode: string, _socket: any, userId?: string | undefined): void {
    this.joined.push({ room: roomCode, userId });
  }

  leave(_socket: any): void {
    this.leftCount += 1;
  }

  broadcast(roomCode: string, data: unknown): void {
    this.broadcasts.push({
      room: roomCode,
      msg: data as ServerToClientMessage,
    });
  }

  sendTo(roomCode: string, userId: string, data: unknown): void {
    this.directed.push({
      room: roomCode,
      userId,
      msg: data as ServerToClientMessage,
    });
  }
}

describe('WebSocket + GameEngine 통합 플로우 (준단위)', () => {
  it('ready → answer_mulligan → player_action 흐름에서 서버 이벤트가 발생한다 (기본 형태만 검증)', async () => {
    // given
    const fakeManager = new FakeSocketManager();
    const roomManager = new GameRoomManager(
      fakeManager as unknown as SocketManager,
    );
    const roomCode = 'ROOM1';
    const p1: PlayerID = 'host-1';
    const p2: PlayerID = 'guest-1';

    const fakeSocket1 = {} as SocketClient;
    const fakeSocket2 = {} as SocketClient;
    fakeSocket1.userId = p1;
    fakeSocket2.userId = p2;
    fakeSocket1.roomCode = roomCode;
    fakeSocket2.roomCode = roomCode;

    // ready 두 번 호출 (엔진 초기화 + 멀리건 요청/상태 패치 발생)
    await roomManager.handleReady(fakeSocket1, { roomCode, userId: p1 });
    await roomManager.handleReady(fakeSocket2, { roomCode, userId: p2 });

    // ask_mulligan 이 각 플레이어에게 한 번씩 전달되었는지만 확인
    const askMulliganMessages = fakeManager.directed.filter(
      (d) => d.msg.event === 'ask_mulligan',
    );
    expect(askMulliganMessages.length).toBeGreaterThanOrEqual(1);

    // 각 플레이어가 멀리건 응답을 보냈다고 가정 (빈 배열로 그대로 유지)
    const mulliganPayload: AnswerMulliganPayload = { replaceIndices: [] };
    await roomManager.handleAnswerMulligan(roomCode, p1, mulliganPayload);
    await roomManager.handleAnswerMulligan(roomCode, p2, mulliganPayload);

    // 이후 한 플레이어가 턴 종료 액션을 보낸다고 가정
    const endTurn: PlayerActionPayload = { action: 'end_turn' };
    await roomManager.handlePlayerAction(roomCode, p1, endTurn);

    // state_patch 가 최소 한 번 이상 특정 플레이어에게 전송되었는지 확인
    const statePatches = fakeManager.directed.filter(
      (d) => d.msg.event === 'state_patch',
    );
    expect(statePatches.length).toBeGreaterThanOrEqual(1);
  });
});
