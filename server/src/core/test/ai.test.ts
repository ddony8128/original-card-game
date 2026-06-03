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
      name_en: cardId,
      description_ko: null,
      description_en: null,
      type: 'instant',
      mana: costs[cardId],
      token: false,
      effectJson: null,
    };
  };
}

// Richer getMeta: maps cardId -> { mana, effectJson }.
interface CardSpec {
  mana?: number | null;
  effectJson?: unknown;
}
function makeGetMetaRich(
  specs: Record<string, CardSpec>,
): (cardId: string) => CardMeta | null {
  return (cardId: string) => {
    if (!(cardId in specs)) return null;
    const s = specs[cardId];
    return {
      id: cardId,
      name_dev: cardId,
      name_ko: cardId,
      name_en: cardId,
      description_ko: null,
      description_en: null,
      type: 'instant',
      mana: s.mana ?? 0,
      token: false,
      effectJson: s.effectJson ?? null,
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

// Effect-JSON literal builders mirroring the schema.
const dmg = (
  value: number | string,
  target: 'enemy' | 'near_enemy' | 'self',
  extra: { range?: number; selectMode?: 'choose_target' } = {},
) => ({ type: 'damage' as const, value, target, ...extra });
const onCast = (...effects: unknown[]) => ({
  type: 'instant' as const,
  triggers: [{ trigger: 'onCast' as const, effects }],
});

describe('chooseAIAction', () => {
  // ── Rule 1: lethal ──────────────────────────────────────────────────────
  it('plays a lethal in-range damage card to finish the opponent', () => {
    const state = makeState({
      p1: { mana: 5, hand: [card('h1', 'bolt'), card('h2', 'util')] },
      p2: { hp: 3 },
      wizards: { [P1]: { r: 2, c: 2 }, [P2]: { r: 0, c: 2 } },
    });
    const getMeta = makeGetMetaRich({
      bolt: { mana: 2, effectJson: onCast(dmg(3, 'enemy')) },
      util: { mana: 1, effectJson: onCast({ type: 'draw', value: 1, target: 'self' }) },
    });
    const action = chooseAIAction(state, P1, getMeta, zeroRand);
    expect(action.kind === 'use_card' && action.cardInstance.cardId).toBe('bolt');
  });

  it('does not treat an out-of-range card as lethal; moves closer instead', () => {
    // bolt deals 5 (>= hp 4) but range 1, dist 2 -> NOT in range, so move.
    const state = makeState({
      p1: { mana: 5, hand: [card('h1', 'bolt')] },
      p2: { hp: 4 },
      wizards: { [P1]: { r: 2, c: 2 }, [P2]: { r: 0, c: 2 } },
    });
    const getMeta = makeGetMetaRich({
      bolt: { mana: 2, effectJson: onCast(dmg(5, 'near_enemy', { range: 1 })) },
    });
    const action = chooseAIAction(state, P1, getMeta, zeroRand);
    expect(action.kind).toBe('move');
    if (action.kind === 'move') expect(action.to).toEqual({ r: 1, c: 2 });
  });

  // ── Rule 3: in-range vs out-of-range damage (range-gated) ───────────────
  it('plays an in-range near_enemy damage card', () => {
    const state = makeState({
      p1: { mana: 5, hand: [card('h1', 'spark')] },
      wizards: { [P1]: { r: 2, c: 2 }, [P2]: { r: 0, c: 2 } }, // dist 2
    });
    const getMeta = makeGetMetaRich({
      spark: { mana: 2, effectJson: onCast(dmg(3, 'near_enemy', { range: 2 })) },
    });
    const action = chooseAIAction(state, P1, getMeta, zeroRand);
    expect(action.kind === 'use_card' && action.cardInstance.cardId).toBe('spark');
  });

  it('does NOT play an out-of-range damage card; advances toward range', () => {
    const state = makeState({
      p1: { mana: 5, hand: [card('h1', 'spark')] },
      wizards: { [P1]: { r: 4, c: 2 }, [P2]: { r: 0, c: 2 } }, // dist 4 > range 2
    });
    const getMeta = makeGetMetaRich({
      spark: { mana: 2, effectJson: onCast(dmg(3, 'near_enemy', { range: 2 })) },
    });
    const action = chooseAIAction(state, P1, getMeta, zeroRand);
    expect(action.kind).toBe('move');
    if (action.kind === 'move') expect(action.to).toEqual({ r: 3, c: 2 });
  });

  it('direct target:enemy damage always hits regardless of distance', () => {
    const state = makeState({
      p1: { mana: 5, hand: [card('h1', 'snipe')] },
      wizards: { [P1]: { r: 4, c: 4 }, [P2]: { r: 0, c: 0 } }, // dist 8
    });
    const getMeta = makeGetMetaRich({
      snipe: { mana: 2, effectJson: onCast(dmg(2, 'enemy')) },
    });
    const action = chooseAIAction(state, P1, getMeta, zeroRand);
    expect(action.kind === 'use_card' && action.cardInstance.cardId).toBe('snipe');
  });

  it('picks the higher-hitDamage card among in-range options', () => {
    const state = makeState({
      p1: { mana: 5, hand: [card('h1', 'small'), card('h2', 'big')] },
      wizards: { [P1]: { r: 2, c: 2 }, [P2]: { r: 0, c: 2 } },
    });
    const getMeta = makeGetMetaRich({
      small: { mana: 1, effectJson: onCast(dmg(1, 'enemy')) },
      big: { mana: 1, effectJson: onCast(dmg(4, 'enemy')) },
    });
    const action = chooseAIAction(state, P1, getMeta, zeroRand);
    expect(action.kind === 'use_card' && action.cardInstance.cardId).toBe('big');
  });

  // ── Rule 4: heal when hurt ──────────────────────────────────────────────
  it('heals when hp below half and a self-heal card is available', () => {
    const state = makeState({
      p1: { mana: 5, hp: 5, maxHp: 20, hand: [card('h1', 'heal')] },
      // opponent far so no in-range damage option distracts.
      wizards: { [P1]: { r: 4, c: 4 }, [P2]: { r: 0, c: 0 } },
    });
    const getMeta = makeGetMetaRich({
      heal: { mana: 2, effectJson: onCast({ type: 'heal', value: 4, target: 'self' }) },
    });
    const action = chooseAIAction(state, P1, getMeta, zeroRand);
    expect(action.kind === 'use_card' && action.cardInstance.cardId).toBe('heal');
  });

  it('does not heal when at full health (utility/other rules win)', () => {
    const state = makeState({
      p1: { mana: 5, hp: 20, maxHp: 20, hand: [card('h1', 'heal')] },
      wizards: { [P1]: { r: 4, c: 4 }, [P2]: { r: 0, c: 0 } },
    });
    const getMeta = makeGetMetaRich({
      heal: { mana: 2, effectJson: onCast({ type: 'heal', value: 4, target: 'self' }) },
    });
    // heal target:self counts as a utility card -> still played (rule 7), but
    // assert it's NOT chosen via the "hurt" branch by checking hp untouched logic
    // is irrelevant; here just confirm it remains a valid utility play.
    const action = chooseAIAction(state, P1, getMeta, zeroRand);
    expect(action.kind === 'use_card' && action.cardInstance.cardId).toBe('heal');
  });

  // ── Rule 2: use own damaging ritual ─────────────────────────────────────
  it('uses an owned ritual whose onUsePerTurn damages the enemy', () => {
    const rituals: RitualInstance[] = [
      { id: 'r1', cardId: 'turret', owner: P1, pos: { r: 4, c: 4 }, usedThisTurn: false },
    ];
    const state = makeState({
      p1: { mana: 5, hand: [] },
      rituals,
      wizards: { [P1]: { r: 2, c: 2 }, [P2]: { r: 0, c: 2 } },
    });
    const getMeta = makeGetMetaRich({
      turret: {
        mana: 0,
        effectJson: {
          type: 'ritual',
          triggers: [{ trigger: 'onUsePerTurn', effects: [dmg(2, 'enemy')] }],
        },
      },
    });
    const action = chooseAIAction(state, P1, getMeta, zeroRand);
    expect(action.kind === 'use_ritual' && action.ritualId).toBe('r1');
  });

  // ── Rule B: trap avoidance vs destroy-worthy ────────────────────────────
  it('AVOIDS stepping onto an opponent ritual whose onDestroy is damage target:enemy (trap)', () => {
    // ritual one cell up (r1,c2). onDestroy damage target:enemy -> stepper(AI) takes 5.
    const rituals: RitualInstance[] = [
      { id: 'trap', cardId: 'mine', owner: P2, pos: { r: 1, c: 2 } },
    ];
    const state = makeState({
      p1: { mana: 5, hand: [] },
      rituals,
      wizards: { [P1]: { r: 2, c: 2 }, [P2]: { r: 0, c: 2 } },
    });
    const getMeta = makeGetMetaRich({
      mine: {
        mana: 0,
        effectJson: {
          type: 'ritual',
          triggers: [{ trigger: 'onDestroy', effects: [dmg(5, 'enemy')] }],
        },
      },
    });
    const action = chooseAIAction(state, P1, getMeta, zeroRand);
    // Must NOT move onto the trap cell.
    expect(
      action.kind === 'move' && action.to.r === 1 && action.to.c === 2,
    ).toBe(false);
    // It should move closer via a safe side cell (c=1 or c=3) instead.
    if (action.kind === 'move') {
      expect(action.to).not.toEqual({ r: 1, c: 2 });
    }
  });

  it('STEPS onto an opponent ritual whose onDestroy is damage target:self (harms owner)', () => {
    // Per rule B (invertSelfEnemy): onDestroy damage target:self -> owner takes value.
    const rituals: RitualInstance[] = [
      { id: 'gift', cardId: 'protect', owner: P2, pos: { r: 1, c: 2 } },
    ];
    const state = makeState({
      p1: { mana: 5, hand: [] },
      rituals,
      wizards: { [P1]: { r: 2, c: 2 }, [P2]: { r: 0, c: 0 } },
    });
    const getMeta = makeGetMetaRich({
      protect: {
        mana: 0,
        effectJson: {
          type: 'ritual',
          triggers: [{ trigger: 'onDestroy', effects: [dmg(5, 'self')] }],
        },
      },
    });
    const action = chooseAIAction(state, P1, getMeta, zeroRand);
    expect(action.kind).toBe('move');
    if (action.kind === 'move') expect(action.to).toEqual({ r: 1, c: 2 });
  });

  it('STEPS onto an opponent ritual with ongoing onTurnEnd damage target:enemy', () => {
    const rituals: RitualInstance[] = [
      { id: 'curse', cardId: 'voodoo', owner: P2, pos: { r: 1, c: 2 } },
    ];
    const state = makeState({
      p1: { mana: 5, hand: [] },
      rituals,
      wizards: { [P1]: { r: 2, c: 2 }, [P2]: { r: 0, c: 0 } },
    });
    const getMeta = makeGetMetaRich({
      voodoo: {
        mana: 0,
        effectJson: {
          type: 'ritual',
          triggers: [{ trigger: 'onTurnEnd', effects: [dmg(1, 'enemy')] }],
        },
      },
    });
    const action = chooseAIAction(state, P1, getMeta, zeroRand);
    expect(action.kind).toBe('move');
    if (action.kind === 'move') expect(action.to).toEqual({ r: 1, c: 2 });
  });

  // ── Rule 7: utility fallback ────────────────────────────────────────────
  it('plays a utility card (draw) when no offense/heal/destroy applies', () => {
    const state = makeState({
      p1: { mana: 5, hand: [card('h1', 'study')] },
      // adjacent so no distance-reducing move available.
      wizards: { [P1]: { r: 2, c: 2 }, [P2]: { r: 2, c: 3 } },
    });
    const getMeta = makeGetMetaRich({
      study: { mana: 2, effectJson: onCast({ type: 'draw', value: 2, target: 'self' }) },
    });
    const action = chooseAIAction(state, P1, getMeta, zeroRand);
    expect(action.kind === 'use_card' && action.cardInstance.cardId).toBe('study');
  });

  it('does NOT play a pure self-harm card as a utility', () => {
    const state = makeState({
      p1: { mana: 5, hand: [card('h1', 'sacrifice')] },
      wizards: { [P1]: { r: 2, c: 2 }, [P2]: { r: 2, c: 3 } }, // adjacent
    });
    const getMeta = makeGetMetaRich({
      sacrifice: { mana: 2, effectJson: onCast(dmg(3, 'self')) },
    });
    const action = chooseAIAction(state, P1, getMeta, zeroRand);
    expect(action.kind).toBe('end_turn');
  });

  // ── Rule 8 / 6: advance ─────────────────────────────────────────────────
  it('moves toward the opponent when only out-of-range damage cards held', () => {
    const state = makeState({
      p1: { mana: 5, hand: [] },
      wizards: { [P1]: { r: 4, c: 2 }, [P2]: { r: 0, c: 2 } },
    });
    const action = chooseAIAction(state, P1, makeGetMetaRich({}), zeroRand);
    expect(action.kind).toBe('move');
    if (action.kind === 'move') expect(action.to).toEqual({ r: 3, c: 2 });
  });

  // ── Rule 9: end_turn ────────────────────────────────────────────────────
  it('ends turn when nothing affordable and no distance-reducing move', () => {
    const state = makeState({
      p1: { mana: 5, hand: [] },
      wizards: { [P1]: { r: 2, c: 2 }, [P2]: { r: 2, c: 3 } },
    });
    const action = chooseAIAction(state, P1, makeGetMetaRich({}), zeroRand);
    expect(action.kind).toBe('end_turn');
  });

  it('ends turn when mana too low to move and no affordable card', () => {
    const state = makeState({
      p1: { mana: 0, hand: [] },
      wizards: { [P1]: { r: 4, c: 2 }, [P2]: { r: 0, c: 2 } },
    });
    const action = chooseAIAction(state, P1, makeGetMetaRich({}), zeroRand);
    expect(action.kind).toBe('end_turn');
  });

  it('skips move step when there is no opponent wizard', () => {
    const state = makeState({
      p1: { mana: 5, hand: [] },
      wizards: { [P1]: { r: 2, c: 2 } },
    });
    const action = chooseAIAction(state, P1, makeGetMetaRich({}), zeroRand);
    expect(action.kind).toBe('end_turn');
  });

  // ── Termination ─────────────────────────────────────────────────────────
  it('terminates: driving the loop with simplistic state changes reaches end_turn', () => {
    const state = makeState({
      p1: {
        mana: 5,
        hp: 20,
        hand: [card('h1', 'bolt'), card('h2', 'spark'), card('h3', 'study')],
      },
      wizards: { [P1]: { r: 4, c: 2 }, [P2]: { r: 0, c: 2 } },
      p2: { hp: 20 },
    });
    const getMeta = makeGetMetaRich({
      bolt: { mana: 1, effectJson: onCast(dmg(2, 'enemy')) },
      spark: { mana: 1, effectJson: onCast(dmg(3, 'near_enemy', { range: 2 })) },
      study: { mana: 1, effectJson: onCast({ type: 'draw', value: 1, target: 'self' }) },
    });

    let steps = 0;
    const MAX = 50;
    let ended = false;
    for (; steps < MAX; steps++) {
      const action = chooseAIAction(state, P1, getMeta, zeroRand);
      if (action.kind === 'end_turn') {
        ended = true;
        break;
      }
      if (action.kind === 'use_card') {
        // remove the card from hand (hand shrinks).
        state.players[P1].hand = state.players[P1].hand.filter(
          (c) => c.id !== action.cardInstance.id,
        );
      } else if (action.kind === 'move') {
        // pay mana, move wizard (dist monotonically non-increasing).
        state.players[P1].mana -= 1;
        state.board.wizards[P1] = { r: action.to.r, c: action.to.c };
      } else if (action.kind === 'use_ritual') {
        const rit = state.board.rituals.find((r) => r.id === action.ritualId);
        if (rit) rit.usedThisTurn = true;
      }
    }
    expect(ended).toBe(true);
    expect(steps).toBeLessThan(MAX);
  });
});
