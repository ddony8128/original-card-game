import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { PlayerID } from '../type/gameState';
import { GamePhase } from '../type/gameState';
import type {
  AnswerMulliganPayload,
  ServerToClientMessage,
} from '../type/wsProtocol';
import type { SocketClient, SocketManager } from '../ws/socketManager';

// --- Supabase 의존을 막기 위한 서비스 모킹 ---
//
// 솔로 게임은 사람 덱(16/4)을 로드해 AI 가 그 클론을 사용한다.
// 따라서 decksService.getById 가 유효한 16/4 덱을 돌려주고,
// cardsService.listAll 이 그 덱이 참조하는 카드들의 메타를 돌려줘야 한다.

// 메인 4종(합 16) + 재앙 1종(4). 휴리스틱이 쓸 수 있도록 mana 가 0 인 카드를 둔다.
const MAIN_DECK = [
  { id: 'm_zero', count: 4 },
  { id: 'm_one', count: 4 },
  { id: 'm_two', count: 4 },
  { id: 'm_three', count: 4 },
];
const CATA_DECK = [{ id: 'c_quake', count: 4 }];

const CARD_ROWS = [
  // mana 0 카드: 효과 없음(effect_json null) → 사용해도 입력요청 없이 안전.
  {
    id: 'm_zero',
    name_dev: 'zero',
    name_ko: '제로',
    description_ko: null,
    type: 'instant' as const,
    mana: 0,
    token: false,
    effect_json: null,
  },
  {
    id: 'm_one',
    name_dev: 'one',
    name_ko: '원',
    description_ko: null,
    type: 'instant' as const,
    mana: 1,
    token: false,
    effect_json: null,
  },
  {
    id: 'm_two',
    name_dev: 'two',
    name_ko: '투',
    description_ko: null,
    type: 'instant' as const,
    mana: 2,
    token: false,
    effect_json: null,
  },
  {
    id: 'm_three',
    name_dev: 'three',
    name_ko: '쓰리',
    description_ko: null,
    type: 'instant' as const,
    mana: 3,
    token: false,
    effect_json: null,
  },
  {
    id: 'c_quake',
    name_dev: 'quake',
    name_ko: '지진',
    description_ko: null,
    type: 'catastrophe' as const,
    mana: null,
    token: false,
    effect_json: null,
  },
];

vi.mock('../services/decks', () => {
  return {
    decksService: {
      getById: vi.fn(async (deckId: string) => {
        if (deckId === 'missing') return null;
        return {
          id: deckId,
          user_id: 'human-1',
          name: 'solo deck',
          main_cards: MAIN_DECK,
          cata_cards: CATA_DECK,
          deleted: false,
        };
      }),
    },
  };
});

vi.mock('../services/cards', () => {
  return {
    cardsService: {
      listAll: vi.fn(async () => CARD_ROWS),
      getByIds: vi.fn(async () => []),
      getById: vi.fn(async () => null),
    },
  };
});

import { SoloGameManager, AI_PLAYER_ID } from '../ws/soloGameManager';
import { resetCardCatalog } from '../core/resources/cardCatalog';

class FakeSocketManager
  implements Pick<SocketManager, 'joinRoom' | 'leave' | 'broadcast' | 'sendTo'>
{
  public joined: Array<{ room: string; userId?: string }> = [];
  public broadcasts: Array<{ room: string; msg: ServerToClientMessage }> = [];
  public directed: Array<{
    room: string;
    userId: string;
    msg: ServerToClientMessage;
  }> = [];

  joinRoom(roomCode: string, _socket: unknown, userId?: string): void {
    this.joined.push({ room: roomCode, userId });
  }
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

const human: PlayerID = 'human-1';

// SoloGameManager 내부 방 맵에서 엔진을 꺼내 검사용으로 접근한다.
type TestRoom = {
  soloId: string;
  // any 로 두어 await 사이 상태 변이에 대한 과도한 narrowing 을 방지한다.
  engine: { state: { activePlayer: PlayerID; phase: GamePhase; turn: number } };
};

function getRoom(manager: SoloGameManager): TestRoom {
  const rooms = (
    manager as unknown as {
      rooms: Map<string, { soloId: string; engine: any }>;
    }
  ).rooms;
  const entries = Array.from(rooms.values());
  expect(entries.length).toBeGreaterThanOrEqual(1);
  return entries[entries.length - 1] as TestRoom;
}

/** narrowing 을 피해 현재 phase 를 읽는다(await 후 재조회용). */
function phaseOf(room: TestRoom): GamePhase {
  return room.engine.state.phase;
}
function activeOf(room: TestRoom): PlayerID {
  return room.engine.state.activePlayer;
}

describe('솔로(싱글플레이 vs AI) WebSocket 통합 플로우', () => {
  beforeEach(() => {
    // 다른 테스트가 빈 카탈로그를 적재했을 수 있으므로, 우리 카드들로 다시 적재한다.
    resetCardCatalog();
  });

  it('start_solo → game_init + ask_mulligan → 멀리건 후 사람 액션 단계에 도달한다', async () => {
    const fakeManager = new FakeSocketManager();
    const manager = new SoloGameManager(
      fakeManager as unknown as SocketManager,
    );
    const socket = {} as SocketClient;

    await manager.handleStartSolo(socket, { userId: human, deckId: 'deck-1' });

    // 솔로 소켓 표시 + WS 방 참여
    expect(socket.solo).toBe(true);
    expect(socket.userId).toBe(human);
    expect(socket.roomCode).toBeTruthy();

    // 사람은 game_init 을 한 번 받아야 한다.
    const initMsgs = fakeManager.directed.filter(
      (d) => d.msg.event === 'game_init' && d.userId === human,
    );
    expect(initMsgs.length).toBe(1);

    // 사람에게 ask_mulligan 이 전달되어야 한다.
    const askMulligan = fakeManager.directed.filter(
      (d) => d.msg.event === 'ask_mulligan' && d.userId === human,
    );
    expect(askMulligan.length).toBeGreaterThanOrEqual(1);

    // AI 대상 이벤트는 사람 소켓으로 새어 나가면 안 된다.
    const aiLeaks = fakeManager.directed.filter(
      (d) => d.userId === AI_PLAYER_ID,
    );
    expect(aiLeaks.length).toBe(0);

    const room = getRoom(manager);
    // 사람이 선공이거나(AI 멀리건 자동응답 후) 곧 사람 차례여야 한다.
    // 멀리건 단계가 끝나려면 사람도 응답해야 한다.
    const mulligan: AnswerMulliganPayload = { replaceIndices: [] };
    await manager.handleAnswerMulligan(room.soloId, mulligan);

    // 게임이 끝나지 않았다면, 멀리건 종료 후 절대로 AI 가 멈춰 있으면 안 된다.
    if (phaseOf(room) !== GamePhase.GAME_OVER) {
      expect(activeOf(room)).toBe(human);
      expect(phaseOf(room)).toBe(GamePhase.WAITING_FOR_PLAYER_ACTION);
    }
  });

  it('사람이 end_turn 하면 AI 가 자기 턴을 진행하고 제어가 사람에게 돌아온다(hang 없음)', async () => {
    const fakeManager = new FakeSocketManager();
    const manager = new SoloGameManager(
      fakeManager as unknown as SocketManager,
    );
    const socket = {} as SocketClient;

    await manager.handleStartSolo(socket, { userId: human, deckId: 'deck-1' });
    const room = getRoom(manager);

    const mulligan: AnswerMulliganPayload = { replaceIndices: [] };
    await manager.handleAnswerMulligan(room.soloId, mulligan);

    // 사람 차례임을 확인한 뒤 턴 종료.
    expect(activeOf(room)).toBe(human);
    const versionBefore = fakeManager.directed.length;

    await manager.handlePlayerAction(room.soloId, { action: 'end_turn' });

    // 이 호출이 반환된 것 자체가 "hang 없음"의 증거다.
    // 게임오버가 아니라면 제어가 반드시 사람에게 돌아와 있어야 한다.
    if (phaseOf(room) !== GamePhase.GAME_OVER) {
      expect(activeOf(room)).toBe(human);
    }

    // AI 활동을 반영한 state_patch 가 사람에게 추가로 전달되었어야 한다.
    const afterPatches = fakeManager.directed
      .slice(versionBefore)
      .filter((d) => d.msg.event === 'state_patch' && d.userId === human);
    expect(afterPatches.length).toBeGreaterThanOrEqual(1);

    // 핵심 불변식: maybeRunAITurn 이 끝났을 때 게임오버가 아니면
    // 절대로 activePlayer === AI 로 남아 있으면 안 된다.
    if (phaseOf(room) !== GamePhase.GAME_OVER) {
      expect(activeOf(room)).not.toBe(AI_PLAYER_ID);
    }
  });

  it('여러 턴을 반복해도 스텝 cap 안에서 hang 없이 진행된다', async () => {
    const fakeManager = new FakeSocketManager();
    const manager = new SoloGameManager(
      fakeManager as unknown as SocketManager,
    );
    const socket = {} as SocketClient;

    await manager.handleStartSolo(socket, { userId: human, deckId: 'deck-1' });
    const room = getRoom(manager);
    await manager.handleAnswerMulligan(room.soloId, { replaceIndices: [] });

    // 사람이 10턴 연속 end_turn 을 눌러도 매번 즉시 제어가 돌아와야 한다.
    for (let i = 0; i < 10; i += 1) {
      if (phaseOf(room) === GamePhase.GAME_OVER) break;
      await manager.handlePlayerAction(room.soloId, { action: 'end_turn' });
      // 게임오버가 아니라면 AI 가 턴을 붙들고 있으면 안 된다.
      if (phaseOf(room) !== GamePhase.GAME_OVER) {
        expect(activeOf(room)).toBe(human);
      }
    }
  });

  it('덱이 없으면 조용히 종료한다(throw 없음, 방 미생성)', async () => {
    const fakeManager = new FakeSocketManager();
    const manager = new SoloGameManager(
      fakeManager as unknown as SocketManager,
    );
    const socket = {} as SocketClient;

    await expect(
      manager.handleStartSolo(socket, { userId: human, deckId: 'missing' }),
    ).resolves.toBeUndefined();

    expect(socket.solo).toBeUndefined();
    const rooms = (
      manager as unknown as { rooms: Map<string, unknown> }
    ).rooms;
    expect(rooms.size).toBe(0);
  });
});
