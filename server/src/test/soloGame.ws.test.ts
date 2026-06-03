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

// PvE 스테이지(stage-1) 덱이 참조하는 실제 카드 id 들. 솔로 엔진은 cardCatalog 를
// 통해 이 메타를 동기 조회하므로, AI 가 스테이지 덱을 들고도 lookup 이 성공하도록
// 메타를 함께 제공한다. effect_json 은 null 로 두어(효과 없음) 입력요청 없이 안전하게
// 진행되도록 한다(no-hang 불변식 유지). 타입/마나는 실제 cards.json 과 동일하게 맞춘다.
type StageRowSpec = {
  id: string;
  type: 'instant' | 'ritual' | 'catastrophe';
  mana: number | null;
};
const STAGE1_ROW_SPECS: StageRowSpec[] = [
  { id: 'c01-001', type: 'instant', mana: 0 },
  { id: 'c01-002', type: 'instant', mana: 0 },
  { id: 'c01-004', type: 'instant', mana: 0 },
  { id: 'c01-008', type: 'instant', mana: 2 },
  { id: 'c01-011', type: 'instant', mana: 2 },
  { id: 'c01-012', type: 'instant', mana: 2 },
  { id: 'c01-014', type: 'ritual', mana: 1 },
  { id: 'c01-017', type: 'instant', mana: 3 },
  { id: 'c01-018', type: 'instant', mana: 3 },
  { id: 'c01-024', type: 'instant', mana: 4 },
  { id: 'c01-901', type: 'catastrophe', mana: null },
  { id: 'c01-905', type: 'catastrophe', mana: null },
];
const STAGE1_CARD_ROWS = STAGE1_ROW_SPECS.map((s) => ({
  id: s.id,
  name_dev: s.id,
  name_ko: s.id,
  description_ko: null,
  type: s.type,
  mana: s.mana,
  token: false,
  effect_json: null,
}));

const ALL_CARD_ROWS = [...CARD_ROWS, ...STAGE1_CARD_ROWS];

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
      listAll: vi.fn(async () => ALL_CARD_ROWS),
      getByIds: vi.fn(async () => []),
      getById: vi.fn(async () => null),
    },
  };
});

// PvE 클리어 기록 서비스는 supabase 에 닿으므로 모킹한다(스파이 가능하도록).
vi.mock('../services/pveProgress', () => {
  return {
    pveProgressService: {
      markCleared: vi.fn(async () => {}),
      getClearedStageIds: vi.fn(async () => []),
    },
  };
});

import { SoloGameManager, AI_PLAYER_ID } from '../ws/soloGameManager';
import { pveProgressService } from '../services/pveProgress';
import { resetCardCatalog } from '../core/resources/cardCatalog';

/** SoloGameManager 내부 방의 엔진에 등록된 onGameOver 콜백을 꺼낸다. */
function getGameOverHandler(
  manager: SoloGameManager,
  soloId: string,
): (payload: { winner: PlayerID | 'draw' | null; reason: string }) => void {
  const rooms = (
    manager as unknown as {
      rooms: Map<string, { engine: { handlers: any } }>;
    }
  ).rooms;
  const room = rooms.get(soloId)!;
  return (room.engine as any).handlers.onGameOver;
}

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
    vi.mocked(pveProgressService.markCleared).mockClear();
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

  it('pve 모드: AI 가 스테이지 덱/프로필을 사용하고 hang 없이 진행된다', async () => {
    const fakeManager = new FakeSocketManager();
    const manager = new SoloGameManager(
      fakeManager as unknown as SocketManager,
    );
    const socket = {} as SocketClient;

    await manager.handleStartSolo(socket, {
      userId: human,
      deckId: 'deck-1',
      mode: 'pve',
      stageId: 'stage-1',
    });

    // 방이 생성되어야 한다.
    const rooms = (
      manager as unknown as {
        rooms: Map<
          string,
          {
            soloId: string;
            stageId?: string;
            aiProfile: { id: string };
            engine: {
              state: {
                players: Record<
                  string,
                  { deck: Array<{ cardId: string }>; hand: Array<{ cardId: string }> }
                >;
                activePlayer: PlayerID;
                phase: GamePhase;
              };
            };
          }
        >;
      }
    ).rooms;
    expect(rooms.size).toBe(1);
    const room = Array.from(rooms.values())[0];

    // 스테이지 메타가 방에 기록된다(후속 클리어 기록용 stageId + 스테이지 프로필).
    expect(room.stageId).toBe('stage-1');
    expect(room.aiProfile.id).toBe('bruiser');

    // AI 플레이어의 엔진 덱/핸드는 스테이지(c01-*) 카드여야 한다. 사람 덱(m_*/c_quake)이 아니다.
    const aiState = room.engine.state.players[AI_PLAYER_ID];
    const aiCardIds = [...aiState.deck, ...aiState.hand].map((c) => c.cardId);
    expect(aiCardIds.length).toBeGreaterThan(0);
    expect(aiCardIds.every((id) => id.startsWith('c01-'))).toBe(true);
    expect(aiCardIds.some((id) => id.startsWith('m_'))).toBe(false);

    // 사람 플레이어는 여전히 자신의 덱(m_*)을 사용한다.
    const humanState = room.engine.state.players[human];
    const humanCardIds = [...humanState.deck, ...humanState.hand].map(
      (c) => c.cardId,
    );
    expect(humanCardIds.every((id) => id.startsWith('m_'))).toBe(true);

    // 멀리건 후 사람이 end_turn → AI 가 스테이지 덱으로 자기 턴을 진행(hang 없음).
    const testRoom = getRoom(manager);
    await manager.handleAnswerMulligan(testRoom.soloId, { replaceIndices: [] });
    if (phaseOf(testRoom) !== GamePhase.GAME_OVER) {
      expect(activeOf(testRoom)).toBe(human);
      await manager.handlePlayerAction(testRoom.soloId, { action: 'end_turn' });
      // game_over 가 아니면 제어가 반드시 사람에게 돌아와 있어야 한다(AI 가 hang 하지 않음).
      if (phaseOf(testRoom) !== GamePhase.GAME_OVER) {
        expect(activeOf(testRoom)).not.toBe(AI_PLAYER_ID);
      }
    }
  });

  it('pve 모드: 스테이지가 없으면 조용히 종료한다(throw 없음, 방 미생성)', async () => {
    const fakeManager = new FakeSocketManager();
    const manager = new SoloGameManager(
      fakeManager as unknown as SocketManager,
    );
    const socket = {} as SocketClient;

    await expect(
      manager.handleStartSolo(socket, {
        userId: human,
        deckId: 'deck-1',
        mode: 'pve',
        stageId: 'no-such-stage',
      }),
    ).resolves.toBeUndefined();

    expect(socket.solo).toBeUndefined();
    const rooms = (
      manager as unknown as { rooms: Map<string, unknown> }
    ).rooms;
    expect(rooms.size).toBe(0);
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

  it('pve: 사람이 이기면 onGameOver 가 markCleared(human, stageId) 를 호출한다', async () => {
    const fakeManager = new FakeSocketManager();
    const manager = new SoloGameManager(
      fakeManager as unknown as SocketManager,
    );
    const socket = {} as SocketClient;

    await manager.handleStartSolo(socket, {
      userId: human,
      deckId: 'deck-1',
      mode: 'pve',
      stageId: 'stage-1',
    });
    const room = getRoom(manager);
    const onGameOver = getGameOverHandler(manager, room.soloId);

    // 사람 승리로 game_over 를 발생시킨다(엔진 콜백을 직접 호출).
    onGameOver({ winner: human, reason: 'hp_zero' });

    expect(pveProgressService.markCleared).toHaveBeenCalledTimes(1);
    expect(pveProgressService.markCleared).toHaveBeenCalledWith(
      human,
      'stage-1',
    );
  });

  it('pve: AI 가 이기면 markCleared 를 호출하지 않는다', async () => {
    const fakeManager = new FakeSocketManager();
    const manager = new SoloGameManager(
      fakeManager as unknown as SocketManager,
    );
    const socket = {} as SocketClient;

    await manager.handleStartSolo(socket, {
      userId: human,
      deckId: 'deck-1',
      mode: 'pve',
      stageId: 'stage-1',
    });
    const room = getRoom(manager);
    const onGameOver = getGameOverHandler(manager, room.soloId);

    onGameOver({ winner: AI_PLAYER_ID, reason: 'hp_zero' });

    expect(pveProgressService.markCleared).not.toHaveBeenCalled();
  });

  it('tutorial(stageId 없음): 사람이 이겨도 markCleared 를 호출하지 않는다', async () => {
    const fakeManager = new FakeSocketManager();
    const manager = new SoloGameManager(
      fakeManager as unknown as SocketManager,
    );
    const socket = {} as SocketClient;

    await manager.handleStartSolo(socket, { userId: human, deckId: 'deck-1' });
    const room = getRoom(manager);
    const onGameOver = getGameOverHandler(manager, room.soloId);

    onGameOver({ winner: human, reason: 'hp_zero' });

    expect(pveProgressService.markCleared).not.toHaveBeenCalled();
  });

  it('markCleared 가 reject 해도 onGameOver 가 throw 하지 않는다(fire-and-forget)', async () => {
    vi.mocked(pveProgressService.markCleared).mockRejectedValueOnce(
      new Error('db down'),
    );
    const fakeManager = new FakeSocketManager();
    const manager = new SoloGameManager(
      fakeManager as unknown as SocketManager,
    );
    const socket = {} as SocketClient;

    await manager.handleStartSolo(socket, {
      userId: human,
      deckId: 'deck-1',
      mode: 'pve',
      stageId: 'stage-1',
    });
    const room = getRoom(manager);
    const onGameOver = getGameOverHandler(manager, room.soloId);

    expect(() => onGameOver({ winner: human, reason: 'hp_zero' })).not.toThrow();
    expect(pveProgressService.markCleared).toHaveBeenCalledTimes(1);
  });
});
