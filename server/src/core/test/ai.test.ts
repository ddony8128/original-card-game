import { describe, it, expect } from 'vitest';
import {
  GamePhase,
  type GameState,
  type PlayerID,
  type PlayerState,
  type CardInstance,
  type RitualInstance,
} from '../../type/gameState';
import type { CardMeta } from '../context';
import { legalActions } from '../ai/legalActions';
import { chooseAIAction } from '../ai/heuristic';

const P1: PlayerID = 'p1';
const P2: PlayerID = 'p2';

function makePlayer(overrides: Partial<PlayerState> = {}): PlayerState {
  return {
    hp: 20,
    maxHp: 20,
    maxMana: 5,
    mana: 5,
    deck: [],
    grave: [],
    hand: [],
    handLimit: 6,
    resolveStack: [],
    ...overrides,
  };
}

function makeState(opts: {
  p1?: Partial<PlayerState>;
  p2?: Partial<PlayerState>;
  wizards?: Record<PlayerID, { r: number; c: number }>;
  rituals?: RitualInstance[];
}): GameState {
  return {
    phase: GamePhase.WAITING_FOR_PLAYER_ACTION,
    turn: 1,
    activePlayer: P1,
    winner: null,
    board: {
      width: 5,
      height: 5,
      wizards: opts.wizards ?? {
        [P1]: { r: 2, c: 2 },
        [P2]: { r: 0, c: 2 },
      },
      rituals: opts.rituals ?? [],
    },
    players: {
      [P1]: makePlayer(opts.p1),
      [P2]: makePlayer(opts.p2),
    },
    catastropheDeck: [],
    catastropheGrave: [],
    logs: [],
  };
}

function card(id: string, cardId: string): CardInstance {
  return { id, cardId };
}

// Fake getMeta: maps cardId -> mana cost.
function makeGetMeta(
  costs: Record<string, number | null>,
): (cardId: string) => CardMeta | null {
  return (cardId: string) => {
    if (!(cardId in costs)) return null;
    return {
      id: cardId,
      name_dev: cardId,
      name_ko: cardId,
      description_ko: null,
      type: 'instant',
      mana: costs[cardId],
      token: false,
      effectJson: null,
    };
  };
}

const zeroRand = () => 0;

describe('legalActions', () => {
  it('always includes end_turn', () => {
    const state = makeState({ p1: { mana: 0, hand: [] } });
    const actions = legalActions(state, P1, makeGetMeta({}));
    expect(actions.some((a) => a.kind === 'end_turn')).toBe(true);
  });

  it('offers 4 orthogonal in-board moves when centered with enough mana', () => {
    const state = makeState({
      p1: { mana: 5 },
      wizards: { [P1]: { r: 2, c: 2 }, [P2]: { r: 0, c: 0 } },
    });
    const moves = legalActions(state, P1, makeGetMeta({})).filter(
      (a) => a.kind === 'move',
    );
    expect(moves).toHaveLength(4);
  });

  it('blocks moves that go off the board', () => {
    const state = makeState({
      p1: { mana: 5 },
      // corner: only 2 in-board orthogonal neighbours
      wizards: { [P1]: { r: 0, c: 0 }, [P2]: { r: 4, c: 4 } },
    });
    const moves = legalActions(state, P1, makeGetMeta({})).filter(
      (a) => a.kind === 'move',
    );
    expect(moves).toHaveLength(2);
    for (const m of moves) {
      if (m.kind === 'move') {
        expect(m.to.r).toBeGreaterThanOrEqual(0);
        expect(m.to.c).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('blocks moving onto the opponent wizard', () => {
    const state = makeState({
      p1: { mana: 5 },
      // opponent directly above p1 -> that cell must be excluded
      wizards: { [P1]: { r: 2, c: 2 }, [P2]: { r: 1, c: 2 } },
    });
    const moves = legalActions(state, P1, makeGetMeta({})).filter(
      (a) => a.kind === 'move',
    );
    expect(moves).toHaveLength(3);
    const hasOpponentCell = moves.some(
      (m) => m.kind === 'move' && m.to.r === 1 && m.to.c === 2,
    );
    expect(hasOpponentCell).toBe(false);
  });

  it('blocks all moves when mana < MOVE_MANA_COST', () => {
    const state = makeState({ p1: { mana: 0 } });
    const moves = legalActions(state, P1, makeGetMeta({})).filter(
      (a) => a.kind === 'move',
    );
    expect(moves).toHaveLength(0);
  });

  it('only offers affordable cards', () => {
    const state = makeState({
      p1: {
        mana: 2,
        hand: [card('h1', 'cheap'), card('h2', 'expensive'), card('h3', 'free')],
      },
    });
    const getMeta = makeGetMeta({ cheap: 2, expensive: 3, free: null });
    const cardActions = legalActions(state, P1, getMeta).filter(
      (a) => a.kind === 'use_card',
    );
    const ids = cardActions.map((a) =>
      a.kind === 'use_card' ? a.cardInstance.cardId : '',
    );
    expect(ids).toContain('cheap'); // cost 2 == mana 2
    expect(ids).toContain('free'); // null -> 0
    expect(ids).not.toContain('expensive'); // cost 3 > mana 2
  });

  it('offers rituals only when owned and not used this turn', () => {
    const rituals: RitualInstance[] = [
      { id: 'r1', cardId: 'rc', owner: P1, pos: { r: 3, c: 3 } },
      {
        id: 'r2',
        cardId: 'rc',
        owner: P1,
        pos: { r: 3, c: 4 },
        usedThisTurn: true,
      },
      { id: 'r3', cardId: 'rc', owner: P2, pos: { r: 1, c: 1 } },
    ];
    const state = makeState({ rituals });
    const ritualActions = legalActions(state, P1, makeGetMeta({})).filter(
      (a) => a.kind === 'use_ritual',
    );
    const ids = ritualActions.map((a) =>
      a.kind === 'use_ritual' ? a.ritualId : '',
    );
    expect(ids).toEqual(['r1']);
  });

  it('is read-only over state', () => {
    const state = makeState({
      p1: { mana: 5, hand: [card('h1', 'cheap')] },
    });
    const snapshot = JSON.stringify(state);
    legalActions(state, P1, makeGetMeta({ cheap: 1 }));
    expect(JSON.stringify(state)).toBe(snapshot);
  });
});

describe('chooseAIAction', () => {
  it('picks the most expensive affordable card', () => {
    const state = makeState({
      p1: {
        mana: 5,
        hand: [card('h1', 'cheap'), card('h2', 'pricey'), card('h3', 'mid')],
      },
    });
    const getMeta = makeGetMeta({ cheap: 1, pricey: 4, mid: 2 });
    const action = chooseAIAction(state, P1, getMeta, zeroRand);
    expect(action.kind).toBe('use_card');
    if (action.kind === 'use_card') {
      expect(action.cardInstance.cardId).toBe('pricey');
    }
  });

  it('tie-breaks equal-cost cards with rand', () => {
    const state = makeState({
      p1: {
        mana: 5,
        hand: [card('h1', 'a'), card('h2', 'b')],
      },
    });
    const getMeta = makeGetMeta({ a: 3, b: 3 });
    // rand = 0 -> first equal candidate
    const action0 = chooseAIAction(state, P1, getMeta, () => 0);
    expect(action0.kind === 'use_card' && action0.cardInstance.cardId).toBe('a');
    // rand ~ 0.99 -> second candidate
    const action1 = chooseAIAction(state, P1, getMeta, () => 0.99);
    expect(action1.kind === 'use_card' && action1.cardInstance.cardId).toBe('b');
  });

  it('moves toward the opponent when no affordable card and distance > 1', () => {
    const state = makeState({
      p1: { mana: 5, hand: [] },
      wizards: { [P1]: { r: 4, c: 2 }, [P2]: { r: 0, c: 2 } },
    });
    const action = chooseAIAction(state, P1, makeGetMeta({}), zeroRand);
    expect(action.kind).toBe('move');
    if (action.kind === 'move') {
      // best distance-reducing move heads up toward r=0
      expect(action.to).toEqual({ r: 3, c: 2 });
    }
  });

  it('does not move when card is affordable (card takes priority)', () => {
    const state = makeState({
      p1: { mana: 5, hand: [card('h1', 'x')] },
      wizards: { [P1]: { r: 4, c: 2 }, [P2]: { r: 0, c: 2 } },
    });
    const action = chooseAIAction(state, P1, makeGetMeta({ x: 1 }), zeroRand);
    expect(action.kind).toBe('use_card');
  });

  it('ends turn when nothing affordable and no distance-reducing move', () => {
    // wizards adjacent: any move would keep or increase distance.
    const state = makeState({
      p1: { mana: 5, hand: [] },
      wizards: { [P1]: { r: 2, c: 2 }, [P2]: { r: 2, c: 3 } },
    });
    const action = chooseAIAction(state, P1, makeGetMeta({}), zeroRand);
    expect(action.kind).toBe('end_turn');
  });

  it('ends turn when mana too low to move and no affordable card', () => {
    const state = makeState({
      p1: { mana: 0, hand: [] },
      wizards: { [P1]: { r: 4, c: 2 }, [P2]: { r: 0, c: 2 } },
    });
    const action = chooseAIAction(state, P1, makeGetMeta({}), zeroRand);
    expect(action.kind).toBe('end_turn');
  });

  it('skips move step when there is no opponent wizard', () => {
    const state = makeState({
      p1: { mana: 5, hand: [] },
      wizards: { [P1]: { r: 2, c: 2 } },
    });
    const action = chooseAIAction(state, P1, makeGetMeta({}), zeroRand);
    expect(action.kind).toBe('end_turn');
  });
});
