import { describe, it, expect, vi } from 'vitest';
import type { PlayerID } from '../type/gameState';
import type {
  AnswerMulliganPayload,
  ServerToClientMessage,
} from '../type/wsProtocol';
import type { SocketClient, SocketManager } from '../ws/socketManager';

// --- Supabase 의존을 막기 위한 서비스 모킹 ---
// rooms 서비스는 부분 모킹: byCode 는 고정 방을 돌려주고
// finishByCode 는 호출 추적용 스파이로 둔다.

const { finishByCode } = vi.hoisted(() => ({
  finishByCode: vi.fn(async () => ({ room: undefined })),
}));

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
      finishByCode,
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
        username: id,
        password: 'x',
      })),
    },
  };
});

import { GameRoomManager } from '../ws/gameRoomManager';

class FakeSocketManager
  implements Pick<SocketManager, 'joinRoom' | 'leave' | 'broadcast' | 'sendTo'>
{
  public broadcasts: Array<{ room: string; msg: ServerToClientMessage }> = [];
  public directed: Array<{
    room: string;
    userId: string;
    msg: ServerToClientMessage;
  }> = [];

  joinRoom(): void {}
  leave(): void {}

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

const roomCode = 'ROOM1';
const p1: PlayerID = 'host-1';
const p2: PlayerID = 'guest-1';

function getCore(roomManager: GameRoomManager): any {
  const engines = (
    roomManager as unknown as {
      roomEngines: Map<string, { engine: { getCore(): any } }>;
    }
  ).roomEngines;
  const room = engines.get(roomCode);
  if (!room) throw new Error('expected an in-memory engine');
  return room.engine.getCore();
}

/**
 * 게임을 시작한다. forceOver=true 이면 마지막 멀리건 직전에 한 플레이어 HP 를
 * 0 으로 만들어, 멀리건 종료 시 첫 턴 처리(stepUntilStable)에서 game_over 가
 * 자연 발생하도록 한다.
 */
async function startGame(
  roomManager: GameRoomManager,
  forceOver = false,
): Promise<void> {
  const s1 = {} as SocketClient;
  const s2 = {} as SocketClient;
  await roomManager.handleReady(s1, { roomCode, userId: p1 });
  await roomManager.handleReady(s2, { roomCode, userId: p2 });
  const mulligan: AnswerMulliganPayload = { replaceIndices: [] };
  await roomManager.handleAnswerMulligan(roomCode, p1, mulligan);
  if (forceOver) {
    getCore(roomManager).state.players[p2].hp = 0;
  }
  await roomManager.handleAnswerMulligan(roomCode, p2, mulligan);
}

describe('게임 라이프사이클 (C-5 / C-3)', () => {
  it('C-5: HP 0 으로 게임이 자연 종료되면 방 상태를 finished 로 만든다', async () => {
    finishByCode.mockClear();
    const fakeManager = new FakeSocketManager();
    const roomManager = new GameRoomManager(
      fakeManager as unknown as SocketManager,
    );

    await startGame(roomManager, true);

    const gameOver = fakeManager.broadcasts.filter(
      (b) => b.msg.event === 'game_over',
    );
    expect(gameOver.length).toBeGreaterThanOrEqual(1);

    // game_over 콜백에서 방을 finished 로 마무리해야 한다.
    await vi.waitFor(() => {
      expect(finishByCode).toHaveBeenCalledWith(roomCode);
    });
  });

  it('C-3: 한 판이 끝난 뒤 다시 ready 하면 새 게임이 시작된다', async () => {
    const fakeManager = new FakeSocketManager();
    const roomManager = new GameRoomManager(
      fakeManager as unknown as SocketManager,
    );

    // 1st game
    await startGame(roomManager, true);
    expect(
      fakeManager.broadcasts.some((b) => b.msg.event === 'game_over'),
    ).toBe(true);

    // 게임 종료 이후 발생한 이벤트만 따로 보기 위해 버퍼 초기화
    fakeManager.broadcasts.length = 0;
    fakeManager.directed.length = 0;

    // 2nd game: 두 플레이어가 다시 ready → 새 게임 초기화 / 멀리건 요청이 떠야 한다.
    await startGame(roomManager);

    const askMulligan = fakeManager.directed.filter(
      (d) => d.msg.event === 'ask_mulligan',
    );
    expect(askMulligan.length).toBeGreaterThanOrEqual(2);
  });

  it('C-3: in-memory 엔진이 GAME_OVER 로 남아 있어도 다시 ready 하면 새 게임이 시작된다', async () => {
    const fakeManager = new FakeSocketManager();
    const roomManager = new GameRoomManager(
      fakeManager as unknown as SocketManager,
    );

    await startGame(roomManager);

    // game_over 콜백의 roomEngines.delete 를 우회하기 위해, 엔진을 직접 GAME_OVER 로 만든다.
    // (leave / host-delete 경로처럼 in-memory 엔진이 살아남는 상황을 모사)
    getCore(roomManager).state.phase = 'GAME_OVER';

    fakeManager.directed.length = 0;

    await startGame(roomManager);

    const askMulligan = fakeManager.directed.filter(
      (d) => d.msg.event === 'ask_mulligan',
    );
    expect(askMulligan.length).toBeGreaterThanOrEqual(2);
  });
});
