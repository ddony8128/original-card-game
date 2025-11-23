import { describe, it, expect } from 'vitest';
import type {
  GameState,
  PlayerID,
  CardID,
  CardInstance,
} from '../../type/gameState';
import { GamePhase } from '../../type/gameState';
import { GameEngineCore } from '../engine';
import type { EngineContext, CardMeta } from '../context';

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

describe('GameEngineCore card simulation', () => {
  it('c01-001 마나 보조 배터리: 마나가 1 증가한다', async () => {
    const state = createEmptyState();
    state.players[P1].mana = 0;
    state.players[P1].maxMana = 3;
    state.players[P1].hand = [{ id: 'ci1', cardId: 'c01-001' }];

    const engine = GameEngineCore.create(state, ctx, {
      roomId: 'test',
      players: [P1, P2],
    });

    const results = await engine.handlePlayerAction(P1, {
      action: 'use_card',
      cardId: 'c01-001',
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
      roomId: 'test',
      players: [P1, P2],
    });

    await engine.handlePlayerAction(P1, {
      action: 'use_card',
      cardId: 'c01-002',
    } as any);

    expect(engine.state.players[P2].hp).toBe(18);
  });

  it('c01-003 운기조식: 내 마법사가 3 회복', async () => {
    const state = createEmptyState();
    state.players[P1].hp = 10;
    state.players[P1].hand = [{ id: 'ci1', cardId: 'c01-003' }];

    const engine = GameEngineCore.create(state, ctx, {
      roomId: 'test',
      players: [P1, P2],
    });

    await engine.handlePlayerAction(P1, {
      action: 'use_card',
      cardId: 'c01-003',
    } as any);

    expect(engine.state.players[P1].hp).toBe(13);
  });

  it('c01-004 각력 강화: 전방 한 칸 이동', async () => {
    const state = createEmptyState();
    state.players[P1].hand = [{ id: 'ci1', cardId: 'c01-004' }];

    const engine = GameEngineCore.create(state, ctx, {
      roomId: 'test',
      players: [P1, P2],
    });

    const before = { ...engine.state.board.wizards[P1] };
    await engine.handlePlayerAction(P1, {
      action: 'use_card',
      cardId: 'c01-004',
    } as any);
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
      roomId: 'test',
      players: [P1, P2],
    });

    await engine.handlePlayerAction(P1, {
      action: 'use_card',
      cardId: 'c01-006',
    } as any);

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
    state.catastropheDeck = [{ id: 'cata1', cardId: 'cata1' }];
    state.players[P1].hand = [{ id: 'ci1', cardId: 'c01-007' }];

    const engine = GameEngineCore.create(state, ctx, {
      roomId: 'test',
      players: [P1, P2],
    });

    await engine.handlePlayerAction(P1, {
      action: 'use_card',
      cardId: 'c01-007',
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
      roomId: 'test',
      players: [P1, P2],
    });

    const diff = { animations: [], log: [] };
    // destroy 트리거 수동 실행 (실제 게임에서는 리추얼 파괴 시점에서 호출될 예정)
    (engine as any).executeCardTrigger('c01-005', 'onDestroy', P1, diff);

    expect(engine.state.players[P1].hand.length).toBe(1);
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
      roomId: 'test',
      players: [P1, P2],
    });

    await engine.handlePlayerAction(P1, {
      action: 'use_card',
      cardId: 'c01-008',
    } as any);

    // draw 2 → hand에 2장 추가 (원래 카드 포함 제거)
    expect(engine.state.players[P1].hand.length).toBe(2);

    const discardTarget = engine.state.players[P1].hand[0];
    await engine.handlePlayerInput(P1, {
      answer: discardTarget,
    } as any);

    expect(engine.state.players[P1].hand.length).toBe(1);
    expect(
      engine.state.players[P1].grave.some((ci) => ci.id === discardTarget.id),
    ).toBe(true);
  });

  it('c01-009 마력 저격: 거리 4 내 적에게 2 피해', async () => {
    const state = createEmptyState();
    state.players[P1].hand = [{ id: 'ci1', cardId: 'c01-009' }];

    const engine = GameEngineCore.create(state, ctx, {
      roomId: 'test',
      players: [P1, P2],
    });

    await engine.handlePlayerAction(P1, {
      action: 'use_card',
      cardId: 'c01-009',
    } as any);

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
      roomId: 'test',
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
      roomId: 'test',
      players: [P1, P2],
    });

    const diff = { animations: [], log: [] };
    (engine as any).executeCardTrigger('c01-030', 'onUsePerTurn', P1, diff);

    expect(engine.state.players[P1].deck.length).toBe(1);
    expect(engine.state.players[P1].grave.length).toBe(5);
    expect(engine.state.players[P2].hp).toBe(15);
  });

  it('c01-901 이건 그냥 장난일 뿐이야: 1 피해 + 재앙덱 비어있지 않으면 재앙 1장 추가 발동', async () => {
    const state = createEmptyState();
    state.players[P1].hp = 10;
    state.catastropheDeck = [{ id: 'c01-901-x', cardId: 'c01-901-x' }];

    const engine = GameEngineCore.create(state, ctx, {
      roomId: 'test',
      players: [P1, P2],
    });

    const diff = { animations: [], log: [] };
    (engine as any).executeCardTrigger('c01-901', 'onDrawn', P1, diff);

    expect(engine.state.players[P1].hp).toBe(9);
    expect(engine.state.catastropheDeck.length).toBe(0);
    expect(engine.state.catastropheGrave.length).toBe(1);
  });

  it('c01-902 해치웠나: 상대 마법사 5 회복', async () => {
    const state = createEmptyState();
    state.players[P2].hp = 5;

    const engine = GameEngineCore.create(state, ctx, {
      roomId: 'test',
      players: [P1, P2],
    });
    const diff = { animations: [], log: [] };

    (engine as any).executeCardTrigger('c01-902', 'onDrawn', P1, diff);

    expect(engine.state.players[P2].hp).toBe(10);
  });

  it('c01-903 브레스 피해욧: 덱 비었으면 3 피해, 아니면 덱 위 1장 burn', async () => {
    const stateA = createEmptyState();
    stateA.players[P1].hp = 10;
    stateA.players[P1].deck = [];

    const engineA = GameEngineCore.create(stateA, ctx, {
      roomId: 'test',
      players: [P1, P2],
    });
    let diff: any = { animations: [], log: [] };
    (engineA as any).executeCardTrigger('c01-903', 'onDrawn', P1, diff);
    expect(engineA.state.players[P1].hp).toBe(7);
    expect(engineA.state.players[P1].deck.length).toBe(0);

    const stateB = createEmptyState();
    stateB.players[P1].hp = 10;
    stateB.players[P1].deck = [
      { id: 'top1', cardId: 'top1' },
      { id: 'top2', cardId: 'top2' },
    ];

    const engineB = GameEngineCore.create(stateB, ctx, {
      roomId: 'test',
      players: [P1, P2],
    });
    diff = { animations: [], log: [] };
    (engineB as any).executeCardTrigger('c01-903', 'onDrawn', P1, diff);
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
      roomId: 'test',
      players: [P1, P2],
    });
    let diff: any = { animations: [], log: [] };
    (engineA as any).executeCardTrigger('c01-904', 'onDrawn', P1, diff);
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
      roomId: 'test',
      players: [P1, P2],
    });
    diff = { animations: [], log: [] };
    (engineB as any).executeCardTrigger('c01-904', 'onDrawn', P1, diff);
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
      roomId: 'test',
      players: [P1, P2],
    });

    const diff = { animations: [], log: [] };
    (engine as any).executeCardTrigger('c01-905', 'onDrawn', P1, diff);

    expect(engine.state.players[P1].hp).toBe(17);
  });
});
