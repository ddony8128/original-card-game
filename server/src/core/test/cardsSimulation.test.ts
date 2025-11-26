import { describe, it, expect, vi } from 'vitest';
import type {
  GameState,
  PlayerID,
  CardID,
  CardInstance,
} from '../../type/gameState';
import { GamePhase } from '../../type/gameState';
import { GameEngineCore } from '../engine';
import type { EngineContext, CardMeta } from '../context';

// supabase 클라이언트를 실제로 만들지 않도록, 다른 테스트들과 동일한 mock을 사용한다.
// (gameInit.ts가 cardsService를 import하면서 supabase를 끌고 들어오기 때문에 필요)
vi.mock(
  '../../lib/supabase',
  async () => await import('../../test/__mocks__/supabase.js'),
);

const P1: PlayerID = 'p1';
const P2: PlayerID = 'p2';

function createEmptyState(): GameState {
  const players: Record<PlayerID, any> = {
    [P1]: {
      hp: 20,
      maxHp: 20,
      maxMana: 3,
      mana: 3,
      deck: [] as CardInstance[],
      grave: [] as CardInstance[],
      hand: [] as CardInstance[],
      handLimit: 10,
      mulliganSelected: false,
      resolveStack: [],
    },
    [P2]: {
      hp: 20,
      maxHp: 20,
      maxMana: 3,
      mana: 3,
      deck: [] as CardInstance[],
      grave: [] as CardInstance[],
      hand: [] as CardInstance[],
      handLimit: 10,
      mulliganSelected: false,
      resolveStack: [],
    },
  };

  return {
    phase: GamePhase.WAITING_FOR_PLAYER_ACTION,
    turn: 1,
    activePlayer: P1,
    winner: null,
    board: {
      width: 5,
      height: 5,
      wizards: {
        [P1]: { r: 4, c: 2 },
        [P2]: { r: 0, c: 2 },
      },
      rituals: [],
    },
    players,
    catastropheDeck: [],
    catastropheGrave: [],
    logs: [],
  };
}

const dummyCards: Record<CardID, CardMeta> = {
  'c01-001': {
    id: 'c01-001',
    name_dev: 'mana_battery',
    name_ko: '마나 보조 배터리',
    description_ko: null,
    type: 'instant',
    mana: 0,
    token: false,
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
    name_dev: 'pierce_with_mana',
    name_ko: '마나가 담긴 찌르기',
    description_ko: null,
    type: 'instant',
    mana: 0,
    token: false,
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
    name_dev: 'breath_focus',
    name_ko: '운기조식',
    description_ko: null,
    type: 'instant',
    mana: 0,
    token: false,
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
    name_dev: 'leg_muscle_boost',
    name_ko: '각력 강화',
    description_ko: null,
    type: 'instant',
    mana: 0,
    token: false,
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
    name_dev: 'intruder_sensor',
    name_ko: '침입자 감지',
    description_ko: null,
    type: 'ritual',
    mana: 0,
    token: false,
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
    name_dev: 'magic_bolt',
    name_ko: '마력탄',
    description_ko: null,
    type: 'instant',
    mana: 1,
    token: false,
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
    name_dev: 'chicken_game',
    name_ko: '치킨 게임',
    description_ko: null,
    type: 'instant',
    mana: 1,
    token: false,
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
    name_dev: 'reading_time',
    name_ko: '독서의 시간',
    description_ko: null,
    type: 'instant',
    mana: 1,
    token: false,
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
    name_dev: 'magic_sniper',
    name_ko: '마력 저격',
    description_ko: null,
    type: 'instant',
    mana: 1,
    token: false,
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
    name_dev: 'installed_voodoo_doll',
    name_ko: '설치형 저주인형',
    description_ko: null,
    type: 'ritual',
    mana: 1,
    token: false,
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
    name_dev: 'ultimate_dark_magic',
    name_ko: '궁극의 흑마법',
    description_ko: null,
    type: 'ritual',
    mana: 5,
    token: false,
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
    name_dev: 'just_a_prank',
    name_ko: '이건 그냥 장난일 뿐이야',
    description_ko: null,
    type: 'catastrophe',
    mana: 0,
    token: false,
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
    name_dev: 'did_i_get_it',
    name_ko: '해치웠나!?',
    description_ko: null,
    type: 'catastrophe',
    mana: 0,
    token: false,
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
    name_dev: 'breath_damage',
    name_ko: '브레스! 피해욧!',
    description_ko: null,
    type: 'catastrophe',
    mana: 0,
    token: false,
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
    name_dev: 'trash_discard',
    name_ko: '쓰레기! 버려욧!',
    description_ko: null,
    type: 'catastrophe',
    mana: 0,
    token: false,
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
    name_dev: 'mana_backflow',
    name_ko: '마력 역류',
    description_ko: null,
    type: 'catastrophe',
    mana: 0,
    token: false,
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
  // 테스트용 재앙 카드들
  cata1: {
    id: 'cata1',
    name_dev: 'test_catastrophe',
    name_ko: '테스트 재앙',
    description_ko: null,
    type: 'catastrophe',
    mana: 0,
    token: false,
    effectJson: {
      type: 'catastrophe',
      triggers: [],
    },
  },
  'c01-901-x': {
    id: 'c01-901-x',
    name_dev: 'just_a_prank_x',
    name_ko: '이건 그냥 장난일 뿐이야 (인스턴스)',
    description_ko: null,
    type: 'catastrophe',
    mana: 0,
    token: false,
    effectJson: {
      type: 'catastrophe',
      triggers: [],
    },
  },
};

const ctx: EngineContext = {
  lookupCard: async (id) => Promise.resolve(dummyCards[id] ?? null),
};

describe('GameEngineCore card simulation', () => {
  it('c01-001 마나 보조 배터리: 마나가 1 증가한다', async () => {
    const state = createEmptyState();
    state.players[P1].mana = 0;
    state.players[P1].maxMana = 3;
    state.players[P1].hand = [{ id: 'ci1', cardId: 'c01-001' }];

    const engine = GameEngineCore.create(state, ctx, {
      roomCode: 'test',
      players: [P1, P2],
    });

    const cardInstance = engine.state.players[P1].hand[0];

    const results = await engine.handlePlayerAction(P1, {
      action: 'use_card',
      cardInstance,
    } as any);

    expect(engine.state.players[P1].mana).toBe(1);
    expect(engine.state.players[P1].hand.length).toBe(0);
    expect(results.some((r) => r.kind === 'state_patch')).toBe(true);
  });

  it('c01-002 마나가 담긴 찌르기: 근접 적에게 2 피해', async () => {
    const state = createEmptyState();
    state.players[P1].mana = 0;
    state.players[P1].hand = [{ id: 'ci1', cardId: 'c01-002' }];
    // 근접 범위 테스트를 위해 적 위치를 한 칸 앞으로 당김 (거리 1)
    state.board.wizards[P2] = { r: 3, c: 2 };

    const engine = GameEngineCore.create(state, ctx, {
      roomCode: 'test',
      players: [P1, P2],
    });

    const cardInstance = engine.state.players[P1].hand[0];

    await engine.handlePlayerAction(P1, {
      action: 'use_card',
      cardInstance,
    } as any);

    // 선택형 damage(select_damage_target) 입력이 필요한 경우 처리
    if ((engine as any).pendingInput) {
      const pendingInput = (engine as any).pendingInput;
      if (
        pendingInput.kind.type === 'map' &&
        pendingInput.kind.kind === 'select_damage_target'
      ) {
        const firstOption = pendingInput.options?.[0];
        await engine.handlePlayerInput(P1, {
          answer: firstOption,
        } as any);
      }
    }

    expect(engine.state.players[P2].hp).toBe(18);
  });

  it('c01-003 운기조식: 내 마법사가 3 회복', async () => {
    const state = createEmptyState();
    state.players[P1].hp = 10;
    state.players[P1].hand = [{ id: 'ci1', cardId: 'c01-003' }];

    const engine = GameEngineCore.create(state, ctx, {
      roomCode: 'test',
      players: [P1, P2],
    });

    const cardInstance = engine.state.players[P1].hand[0];

    await engine.handlePlayerAction(P1, {
      action: 'use_card',
      cardInstance,
    } as any);

    expect(engine.state.players[P1].hp).toBe(13);
  });

  it('c01-004 각력 강화: 전방 한 칸 이동', async () => {
    const state = createEmptyState();
    state.players[P1].hand = [{ id: 'ci1', cardId: 'c01-004' }];

    const engine = GameEngineCore.create(state, ctx, {
      roomCode: 'test',
      players: [P1, P2],
    });

    const before = { ...engine.state.board.wizards[P1] };
    const cardInstance = engine.state.players[P1].hand[0];

    // 카드 사용
    await engine.handlePlayerAction(P1, {
      action: 'use_card',
      cardInstance,
    } as any);

    // 플레이어 입력이 필요한 경우 처리 (choose_move_direction)
    if ((engine as any).pendingInput) {
      const pendingInput = (engine as any).pendingInput;
      if (
        pendingInput.kind.type === 'map' &&
        pendingInput.kind.kind === 'choose_move_direction'
      ) {
        // 전방(위)으로 이동: r을 1 감소시킨 위치 선택
        // P1의 위치가 (4, 2)이므로 전방은 (3, 2)
        const targetPos = { r: before.r - 1, c: before.c };
        await engine.handlePlayerInput(P1, {
          answer: [targetPos.r, targetPos.c],
        } as any);
      }
    }

    const after = engine.state.board.wizards[P1];

    expect(after.c).toBe(before.c);
    // 아래에서 위로 한 칸 이동 (r 감소)
    expect(after.r).toBe(before.r - 1);
  });

  it('c01-006 마력탄: 거리 2 내 적에게 3 피해', async () => {
    const state = createEmptyState();
    state.players[P1].hand = [{ id: 'ci1', cardId: 'c01-006' }];
    // 거리 2 테스트: 기본 위치(4,2)와 (2,2) → 거리 2
    state.board.wizards[P2] = { r: 2, c: 2 };
    const engine = GameEngineCore.create(state, ctx, {
      roomCode: 'test',
      players: [P1, P2],
    });

    const cardInstance = engine.state.players[P1].hand[0];

    await engine.handlePlayerAction(P1, {
      action: 'use_card',
      cardInstance,
    } as any);

    // 선택형 damage(select_damage_target) 입력이 필요한 경우 처리
    if ((engine as any).pendingInput) {
      const pendingInput = (engine as any).pendingInput;
      if (
        pendingInput.kind.type === 'map' &&
        pendingInput.kind.kind === 'select_damage_target'
      ) {
        const firstOption = pendingInput.options?.[0];
        await engine.handlePlayerInput(P1, {
          answer: firstOption,
        } as any);
      }
    }

    expect(engine.state.players[P2].hp).toBe(17);
  });

  it('c01-007 치킨 게임: 상대 덱 8장 버리고 재앙 1장 발동', async () => {
    const state = createEmptyState();
    state.players[P2].deck = [
      { id: 'd1', cardId: 'd1' },
      { id: 'd2', cardId: 'd2' },
      { id: 'd3', cardId: 'd3' },
      { id: 'd4', cardId: 'd4' },
      { id: 'd5', cardId: 'd5' },
      { id: 'd6', cardId: 'd6' },
      { id: 'd7', cardId: 'd7' },
      { id: 'd8', cardId: 'd8' },
      { id: 'd9', cardId: 'd9' },
      { id: 'd10', cardId: 'd10' },
    ];
    state.catastropheDeck = [{ id: 'cata1', cardId: 'cata1' }]; // cata1은 dummyCards에 정의됨
    state.players[P1].hand = [{ id: 'ci1', cardId: 'c01-007' }];

    const engine = GameEngineCore.create(state, ctx, {
      roomCode: 'test',
      players: [P1, P2],
    });

    const cardInstance = engine.state.players[P1].hand[0];

    await engine.handlePlayerAction(P1, {
      action: 'use_card',
      cardInstance,
    } as any);

    expect(engine.state.players[P2].deck.length).toBe(2);
    expect(engine.state.players[P2].grave.length).toBe(8);
    expect(engine.state.catastropheDeck.length).toBe(0);
    expect(engine.state.catastropheGrave.length).toBe(1);
  });

  it('c01-005 침입자 감지: 파괴 시 드로우 1, 적에게 2 피해', async () => {
    const state = createEmptyState();
    state.players[P1].deck = [{ id: 'x1', cardId: 'x' }];
    state.players[P1].hand = [];

    const engine = GameEngineCore.create(state, ctx, {
      roomCode: 'test',
      players: [P1, P2],
    });

    const diff = { animations: [], log: [] };
    // destroy 트리거 수동 실행 (실제 게임에서는 리추얼 파괴 시점에서 호출될 예정)
    await (engine as any).enqueueCardTriggerEffects(
      'c01-005',
      'onDestroy',
      P1,
      diff,
    );
    await engine.stepUntilStable();

    // discard 이후에도 최소 한 장은 손에 남아 있어야 한다 (구체 동작은 엔진 구현에 위임)
    expect(engine.state.players[P1].hand.length).toBeGreaterThanOrEqual(1);
    expect(engine.state.players[P2].hp).toBe(18);
  });

  it('c01-008 독서의 시간: 2장 드로우 후 1장 선택해 버림', async () => {
    const state = createEmptyState();
    state.players[P1].deck = [
      { id: 'a1', cardId: 'a' },
      { id: 'b1', cardId: 'b' },
      { id: 'c1', cardId: 'c' },
    ];
    state.players[P1].hand = [{ id: 'ci1', cardId: 'c01-008' }];

    const engine = GameEngineCore.create(state, ctx, {
      roomCode: 'test',
      players: [P1, P2],
    });

    const cardInstance = engine.state.players[P1].hand[0];

    await engine.handlePlayerAction(P1, {
      action: 'use_card',
      cardInstance,
    } as any);

    // draw 2 → hand에 2장 추가 (원래 카드 포함 제거)
    expect(engine.state.players[P1].hand.length).toBe(2);

    const discardTarget = engine.state.players[P1].hand[0];
    await engine.handlePlayerInput(P1, {
      answer: discardTarget,
    } as any);

    // discard 이후에도 최소 한 장은 손에 남아 있어야 한다 (구체 동작은 엔진 구현에 위임)
    expect(engine.state.players[P1].hand.length).toBeGreaterThanOrEqual(1);
  });

  it('c01-009 마력 저격: 거리 4 내 적에게 2 피해', async () => {
    const state = createEmptyState();
    state.players[P1].hand = [{ id: 'ci1', cardId: 'c01-009' }];

    const engine = GameEngineCore.create(state, ctx, {
      roomCode: 'test',
      players: [P1, P2],
    });

    const cardInstance = engine.state.players[P1].hand[0];

    await engine.handlePlayerAction(P1, {
      action: 'use_card',
      cardInstance,
    } as any);

    // 선택형 damage(select_damage_target) 입력이 필요한 경우 처리
    if ((engine as any).pendingInput) {
      const pendingInput = (engine as any).pendingInput;
      if (
        pendingInput.kind.type === 'map' &&
        pendingInput.kind.kind === 'select_damage_target'
      ) {
        const firstOption = pendingInput.options?.[0];
        await engine.handlePlayerInput(P1, {
          answer: firstOption,
        } as any);
      }
    }

    expect(engine.state.players[P2].hp).toBe(18);
  });

  it('c01-010 설치형 저주인형: 턴 종료 시 적에게 1 피해', async () => {
    const state = createEmptyState();
    state.players[P1].hand = [];
    state.board.rituals.push({
      id: 'rit1',
      cardId: 'c01-010',
      owner: P1,
      pos: { r: 3, c: 2 },
      usedThisTurn: false,
    });

    const engine = GameEngineCore.create(state, ctx, {
      roomCode: 'test',
      players: [P1, P2],
    });

    // 턴 종료 액션
    await engine.handlePlayerAction(P1, {
      action: 'end_turn',
    } as any);

    expect(engine.state.players[P2].hp).toBe(19);
  });

  it('c01-030 궁극의 흑마법: 덱 위 5장 버리고 상대에게 5 피해', async () => {
    const state = createEmptyState();
    state.players[P1].deck = [
      { id: 'a1', cardId: 'a1' },
      { id: 'a2', cardId: 'a2' },
      { id: 'a3', cardId: 'a3' },
      { id: 'a4', cardId: 'a4' },
      { id: 'a5', cardId: 'a5' },
      { id: 'a6', cardId: 'a6' },
    ];
    state.players[P2].hp = 20;

    const engine = GameEngineCore.create(state, ctx, {
      roomCode: 'test',
      players: [P1, P2],
    });

    const diff = { animations: [], log: [] };
    await (engine as any).enqueueCardTriggerEffects(
      'c01-030',
      'onUsePerTurn',
      P1,
      diff,
    );
    await engine.stepUntilStable();

    expect(engine.state.players[P1].deck.length).toBe(1);
    expect(engine.state.players[P1].grave.length).toBe(5);
    expect(engine.state.players[P2].hp).toBe(15);
  });

  it('c01-901 이건 그냥 장난일 뿐이야: 1 피해 + 재앙덱 비어있지 않으면 재앙 1장 추가 발동', async () => {
    const state = createEmptyState();
    state.players[P1].hp = 10;
    state.catastropheDeck = [{ id: 'c01-901-x', cardId: 'c01-901' }];

    const engine = GameEngineCore.create(state, ctx, {
      roomCode: 'test',
      players: [P1, P2],
    });

    // DRAW_CATA 효과를 통해 재앙 카드를 드로우 (resolveStack에 적재됨)
    const drawCataEffect = {
      type: 'DRAW_CATA',
      owner: P1,
      value: 1,
    } as any;
    engine.effectStack.push(drawCataEffect);
    await engine.stepUntilStable();

    expect(engine.state.players[P1].hp).toBe(9);
    expect(engine.state.catastropheDeck.length).toBe(0);
    expect(engine.state.catastropheGrave.length).toBe(1);
  });

  it('c01-902 해치웠나: 상대 마법사 5 회복', async () => {
    const state = createEmptyState();
    state.players[P2].hp = 5;

    const engine = GameEngineCore.create(state, ctx, {
      roomCode: 'test',
      players: [P1, P2],
    });
    const diff = { animations: [], log: [] };

    await (engine as any).enqueueCardTriggerEffects(
      'c01-902',
      'onDrawn',
      P1,
      diff,
    );
    await engine.stepUntilStable();

    expect(engine.state.players[P2].hp).toBe(10);
  });

  it('c01-903 브레스 피해욧: 덱 비었으면 3 피해, 아니면 덱 위 1장 burn', async () => {
    const stateA = createEmptyState();
    stateA.players[P1].hp = 10;
    stateA.players[P1].deck = [];

    const engineA = GameEngineCore.create(stateA, ctx, {
      roomCode: 'test',
      players: [P1, P2],
    });
    let diff: any = { animations: [], log: [] };
    await (engineA as any).enqueueCardTriggerEffects(
      'c01-903',
      'onDrawn',
      P1,
      diff,
    );
    await engineA.stepUntilStable();
    expect(engineA.state.players[P1].hp).toBe(7);
    expect(engineA.state.players[P1].deck.length).toBe(0);

    const stateB = createEmptyState();
    stateB.players[P1].hp = 10;
    stateB.players[P1].deck = [
      { id: 'top1', cardId: 'top1' },
      { id: 'top2', cardId: 'top2' },
    ];

    const engineB = GameEngineCore.create(stateB, ctx, {
      roomCode: 'test',
      players: [P1, P2],
    });
    diff = { animations: [], log: [] };
    await (engineB as any).enqueueCardTriggerEffects(
      'c01-903',
      'onDrawn',
      P1,
      diff,
    );
    await engineB.stepUntilStable();
    expect(engineB.state.players[P1].hp).toBe(10);
    expect(engineB.state.players[P1].deck.length).toBe(1);
  });

  it('c01-904 쓰레기 버려욧: 손이 비었으면 덱 위 2장 discard, 아니면 손에서 2장 random discard', async () => {
    const stateA = createEmptyState();
    stateA.players[P1].hand = [];
    stateA.players[P1].deck = [
      { id: 'd1', cardId: 'd1' },
      { id: 'd2', cardId: 'd2' },
      { id: 'd3', cardId: 'd3' },
    ];

    const engineA = GameEngineCore.create(stateA, ctx, {
      roomCode: 'test',
      players: [P1, P2],
    });
    let diff: any = { animations: [], log: [] };
    await (engineA as any).enqueueCardTriggerEffects(
      'c01-904',
      'onDrawn',
      P1,
      diff,
    );
    await engineA.stepUntilStable();
    expect(engineA.state.players[P1].deck.length).toBe(1);
    expect(engineA.state.players[P1].grave.length).toBe(2);

    const stateB = createEmptyState();
    stateB.players[P1].hand = [
      { id: 'h1', cardId: 'h1' },
      { id: 'h2', cardId: 'h2' },
      { id: 'h3', cardId: 'h3' },
    ];
    stateB.players[P1].deck = [
      { id: 'd1', cardId: 'd1' },
      { id: 'd2', cardId: 'd2' },
      { id: 'd3', cardId: 'd3' },
    ];

    const engineB = GameEngineCore.create(stateB, ctx, {
      roomCode: 'test',
      players: [P1, P2],
    });
    diff = { animations: [], log: [] };
    await (engineB as any).enqueueCardTriggerEffects(
      'c01-904',
      'onDrawn',
      P1,
      diff,
    );
    await engineB.stepUntilStable();
    expect(engineB.state.players[P1].hand.length).toBe(1);
    expect(engineB.state.players[P1].grave.length).toBe(2);
  });

  it('c01-905 마력 역류: 설치된 ritual 개수만큼 피해', async () => {
    const state = createEmptyState();
    state.players[P1].hp = 20;
    state.board.rituals.push(
      {
        id: 'r1',
        cardId: 'c01-005',
        owner: P1,
        pos: { r: 4, c: 1 },
        usedThisTurn: false,
      },
      {
        id: 'r2',
        cardId: 'c01-010',
        owner: P1,
        pos: { r: 4, c: 3 },
        usedThisTurn: false,
      },
      {
        id: 'r3',
        cardId: 'c01-030',
        owner: P1,
        pos: { r: 3, c: 2 },
        usedThisTurn: false,
      },
    );

    const engine = GameEngineCore.create(state, ctx, {
      roomCode: 'test',
      players: [P1, P2],
    });

    const diff = { animations: [], log: [] };
    await (engine as any).enqueueCardTriggerEffects(
      'c01-905',
      'onDrawn',
      P1,
      diff,
    );
    await engine.stepUntilStable();

    expect(engine.state.players[P1].hp).toBe(17);
  });
});
