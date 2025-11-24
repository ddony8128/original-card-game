import { describe, it, expect, vi } from 'vitest';
import type { GameState, PlayerID, CardID } from '../../type/gameState';
import type { EngineContext, CardMeta } from '../context';
import type { DeckList } from '../../type/deck';
import { GameEngineAdapter } from '../../type/gameEngine';
import {
  createInitialGameState,
  type PlayerDeckConfig,
} from '../../state/gameInit';

// supabase 클라이언트를 실제로 만들지 않도록, 다른 테스트들과 동일한 mock을 사용한다.
// (gameInit.ts가 cardsService를 import하면서 supabase를 끌고 들어오기 때문에 필요)
vi.mock(
  '../../lib/supabase',
  async () => await import('../../test/__mocks__/supabase.js'),
);

const P1: PlayerID = 'p1';
const P2: PlayerID = 'p2';

const dummyCards: Record<CardID, CardMeta> = {
  'c01-001': {
    id: 'c01-001',
    name: '마나 보조 배터리',
    manaCost: 0,
    kind: 'instant',
    effectJson: {
      type: 'instant',
      triggers: [
        {
          trigger: 'onCast',
          effects: [{ type: 'mana_gain', value: 1, target: 'self' }],
        },
      ],
    },
  },
  'c01-002': {
    id: 'c01-002',
    name: '마나가 담긴 찌르기',
    manaCost: 0,
    kind: 'instant',
    effectJson: {
      type: 'instant',
      triggers: [
        {
          trigger: 'onCast',
          effects: [
            { type: 'damage', range: 1, value: 2, target: 'near_enemy' },
          ],
        },
      ],
    },
  },
  'c01-003': {
    id: 'c01-003',
    name: '운기조식',
    manaCost: 0,
    kind: 'instant',
    effectJson: {
      type: 'instant',
      triggers: [
        {
          trigger: 'onCast',
          effects: [{ type: 'heal', value: 3, target: 'self' }],
        },
      ],
    },
  },
  'c01-004': {
    id: 'c01-004',
    name: '각력 강화',
    manaCost: 0,
    kind: 'instant',
    effectJson: {
      type: 'instant',
      triggers: [
        {
          trigger: 'onCast',
          effects: [
            {
              type: 'move',
              value: 1,
              target: 'self',
              direction: 'choose',
            },
          ],
        },
      ],
    },
  },
  'c01-005': {
    id: 'c01-005',
    name: '침입자 감지',
    manaCost: 0,
    kind: 'ritual',
    effectJson: {
      type: 'ritual',
      install: { range: 2 },
      triggers: [
        {
          trigger: 'onDestroy',
          effects: [
            { type: 'draw', value: 1, target: 'self' },
            { type: 'damage', value: 2, target: 'enemy' },
          ],
        },
      ],
    },
  },
  'c01-006': {
    id: 'c01-006',
    name: '마력탄',
    manaCost: 1,
    kind: 'instant',
    effectJson: {
      type: 'instant',
      triggers: [
        {
          trigger: 'onCast',
          effects: [
            { type: 'damage', range: 2, value: 3, target: 'near_enemy' },
          ],
        },
      ],
    },
  },
  'c01-007': {
    id: 'c01-007',
    name: '치킨 게임',
    manaCost: 1,
    kind: 'instant',
    effectJson: {
      type: 'instant',
      triggers: [
        {
          trigger: 'onCast',
          effects: [
            {
              type: 'discard',
              value: 8,
              method: 'deck_random',
              target: 'enemy',
            },
            {
              type: 'draw_cata',
              value: 1,
              target: 'self',
            },
          ],
        },
      ],
    },
  },
  'c01-008': {
    id: 'c01-008',
    name: '독서의 시간',
    manaCost: 1,
    kind: 'instant',
    effectJson: {
      type: 'instant',
      triggers: [
        {
          trigger: 'onCast',
          effects: [
            { type: 'draw', value: 2, target: 'self' },
            {
              type: 'discard',
              value: 1,
              method: 'hand_choose',
              target: 'self',
            },
          ],
        },
      ],
    },
  },
  'c01-009': {
    id: 'c01-009',
    name: '마력 저격',
    manaCost: 1,
    kind: 'instant',
    effectJson: {
      type: 'instant',
      triggers: [
        {
          trigger: 'onCast',
          effects: [
            { type: 'damage', range: 4, value: 2, target: 'near_enemy' },
          ],
        },
      ],
    },
  },
  'c01-010': {
    id: 'c01-010',
    name: '설치형 저주인형',
    manaCost: 1,
    kind: 'ritual',
    effectJson: {
      type: 'ritual',
      install: { range: 2 },
      triggers: [
        {
          trigger: 'onTurnEnd',
          effects: [{ type: 'damage', value: 1, target: 'enemy' }],
        },
        {
          trigger: 'onDestroy',
          effects: [{ type: 'damage', value: 1, target: 'enemy' }],
        },
      ],
    },
  },
  'c01-030': {
    id: 'c01-030',
    name: '궁극의 흑마법',
    manaCost: 5,
    kind: 'ritual',
    effectJson: {
      type: 'ritual',
      install: { range: 3 },
      triggers: [
        {
          trigger: 'onUsePerTurn',
          effects: [
            {
              type: 'discard',
              value: 5,
              method: 'deck_top',
              target: 'self',
            },
            {
              type: 'damage',
              value: 5,
              target: 'enemy',
            },
          ],
        },
      ],
    },
  },
  'c01-901': {
    id: 'c01-901',
    name: '이건 그냥 장난일 뿐이야',
    manaCost: 0,
    kind: 'ritual',
    effectJson: {
      type: 'catastrophe',
      triggers: [
        {
          trigger: 'onDrawn',
          effects: [
            { type: 'damage', value: 1, target: 'self' },
            {
              type: 'draw_cata',
              value: 1,
              target: 'self',
              condition: 'if_cata_deck_empty_not',
            },
          ],
        },
      ],
    },
  },
  'c01-902': {
    id: 'c01-902',
    name: '해치웠나!?',
    manaCost: 0,
    kind: 'ritual',
    effectJson: {
      type: 'catastrophe',
      triggers: [
        {
          trigger: 'onDrawn',
          effects: [{ type: 'heal', value: 5, target: 'enemy' }],
        },
      ],
    },
  },
  'c01-903': {
    id: 'c01-903',
    name: '브레스! 피해욧!',
    manaCost: 0,
    kind: 'ritual',
    effectJson: {
      type: 'catastrophe',
      triggers: [
        {
          trigger: 'onDrawn',
          effects: [
            {
              type: 'damage',
              value: 3,
              target: 'self',
              condition: 'if_self_deck_empty',
            },
            {
              type: 'burn',
              value: 1,
              method: 'deck_top',
              target: 'self',
              condition: 'if_self_deck_empty_not',
            },
          ],
        },
      ],
    },
  },
  'c01-904': {
    id: 'c01-904',
    name: '쓰레기! 버려욧!',
    manaCost: 0,
    kind: 'ritual',
    effectJson: {
      type: 'catastrophe',
      triggers: [
        {
          trigger: 'onDrawn',
          effects: [
            {
              type: 'discard',
              value: 2,
              method: 'deck_top',
              target: 'self',
              condition: 'if_self_hand_empty',
            },
            {
              type: 'discard',
              value: 2,
              method: 'hand_random',
              target: 'self',
              condition: 'if_self_hand_empty_not',
            },
          ],
        },
      ],
    },
  },
  'c01-905': {
    id: 'c01-905',
    name: '마력 역류',
    manaCost: 0,
    kind: 'ritual',
    effectJson: {
      type: 'catastrophe',
      triggers: [
        {
          trigger: 'onDrawn',
          effects: [
            {
              type: 'damage',
              // count(rituals_installed)는 executor에서 해석
              // value를 문자열로 두고, 실행기에서 rituals 개수로 치환
              value: 'count(rituals_installed)' as any,
              target: 'self',
            },
          ],
        },
      ],
    },
  },
};

const ctx: EngineContext = {
  lookupCard: (id) => dummyCards[id] ?? null,
};

describe('GameEngineAdapter core playground (GameRoomManager-style init)', () => {
  it('GameRoomManager와 유사한 방식으로 엔진을 초기화한다', async () => {
    const roomCode = 'test-room';
    const players: PlayerID[] = [P1, P2];

    // GameRoomManager.ensureRoom 과 비슷하게 덱 구성
    // 실제 게임 룰처럼: 메인 덱 16장(8종 x 2장), 재앙 덱 4장(2종 x 2장)
    const deckConfigs: PlayerDeckConfig[] = [
      {
        playerId: P1,
        main: [
          { id: 'c01-001', count: 2 },
          { id: 'c01-002', count: 2 },
          { id: 'c01-003', count: 2 },
          { id: 'c01-004', count: 2 },
          { id: 'c01-006', count: 2 },
          { id: 'c01-007', count: 2 },
          { id: 'c01-008', count: 2 },
          { id: 'c01-009', count: 2 },
        ],
        cata: [
          { id: 'c01-901', count: 2 },
          { id: 'c01-902', count: 2 },
        ],
      },
      {
        playerId: P2,
        main: [
          { id: 'c01-001', count: 2 },
          { id: 'c01-002', count: 2 },
          { id: 'c01-003', count: 2 },
          { id: 'c01-004', count: 2 },
          { id: 'c01-006', count: 2 },
          { id: 'c01-007', count: 2 },
          { id: 'c01-008', count: 2 },
          { id: 'c01-009', count: 2 },
        ],
        cata: [
          { id: 'c01-903', count: 2 },
          { id: 'c01-904', count: 2 },
        ],
      },
    ];

    const decksByPlayer = new Map<PlayerID, DeckList>();
    const cataByPlayer = new Map<PlayerID, DeckList>();

    deckConfigs.forEach((cfg) => {
      decksByPlayer.set(cfg.playerId, cfg.main);
      cataByPlayer.set(cfg.playerId, cfg.cata);
    });

    // 실제 서버에서와 동일한 초기 상태 생성 로직
    const initialState: GameState = createInitialGameState(deckConfigs);

    const engine = GameEngineAdapter.create({
      roomCode,
      players,
      initialState,
      ctx,
    });

    const statePatches: any[] = [];
    const mulligans: any[] = [];

    engine.onStatePatch((_targetPlayer, payload) => {
      statePatches.push(payload);
      console.log('[state_patch]', _targetPlayer, payload);
    });

    engine.onAskMulligan((_targetPlayer, payload) => {
      mulligans.push(payload);
      console.log('[ask_mulligan]', _targetPlayer, payload);
    });

    engine.onRequestInput((_targetPlayer, payload) => {
      console.log('[request_input]', _targetPlayer, payload);
    });

    engine.onGameOver((payload) => {
      console.log('[game_over]', payload);
    });

    engine.onInvalidAction((_targetPlayer, payload) => {
      console.log('[invalid_action]', _targetPlayer, payload);
    });

    // GameRoomManager.handleReady → room.engine.markReady() 와 동일한 진입점
    await engine.markReady();

    expect(engine.roomCode).toBe(roomCode);
    expect(engine.players).toEqual(players);
    expect(statePatches.length).toBeGreaterThan(0);
    expect(mulligans.length).toBe(players.length);
  });
});
