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
import { chooseAIAction } from '../ai/heuristic';
import { getProfile } from '../ai/profiles';

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
      description_ko: null,
      type: 'instant',
      mana: s.mana ?? 0,
      token: false,
      effectJson: s.effectJson ?? null,
    };
  };
}

const zeroRand = () => 0;

const dmg = (
  value: number | string,
  target: 'enemy' | 'near_enemy' | 'self',
  extra: { range?: number } = {},
) => ({ type: 'damage' as const, value, target, ...extra });
const onCast = (...effects: unknown[]) => ({
  type: 'instant' as const,
  triggers: [{ trigger: 'onCast' as const, effects }],
});

describe('getProfile', () => {
  it('returns default for unknown/undefined profile ids', () => {
    expect(getProfile().id).toBe('default');
    expect(getProfile('nope').id).toBe('default');
    expect(getProfile('default').id).toBe('default');
  });

  it('returns the named profiles', () => {
    expect(getProfile('bruiser').id).toBe('bruiser');
    expect(getProfile('disruptor').id).toBe('disruptor');
    expect(getProfile('control').id).toBe('control');
  });

  it('encodes the documented playstyle params', () => {
    // bruiser: aggressive melee rush — no preferredDistance, only the finisher held.
    expect(getProfile('bruiser').holdUntilKill).toEqual(['c01-024']);
    expect(getProfile('bruiser').preferredDistance).toBeUndefined();
    // disruptor: spam engine cards, keep distance 2 (less aimless kiting).
    expect(getProfile('disruptor').spamPriority).toEqual([
      'c01-007',
      'c01-021',
    ]);
    expect(getProfile('disruptor').preferredDistance).toBe(2);
    // control: lowered aggression threshold to 4 (slightly less passive early).
    expect(getProfile('control').aggressionManaThreshold).toBe(4);
    expect(getProfile('control').prioritizeRituals).toBe(true);
    expect(getProfile('control').cycleCards).toEqual([
      'c01-027',
      'c01-029',
      'c01-003',
      'c01-008',
    ]);
  });
});

describe('default profile == current behavior', () => {
  // Passing the default profile (or none) must reproduce the legacy ladder.
  it('plays a lethal in-range damage card (same as no-profile call)', () => {
    const state = makeState({
      p1: { mana: 5, hand: [card('h1', 'bolt')] },
      p2: { hp: 3 },
    });
    const getMeta = makeGetMetaRich({
      bolt: { mana: 2, effectJson: onCast(dmg(3, 'enemy')) },
    });
    const withDefault = chooseAIAction(
      state,
      P1,
      getMeta,
      zeroRand,
      getProfile('default'),
    );
    const noProfile = chooseAIAction(state, P1, getMeta, zeroRand);
    expect(withDefault).toEqual(noProfile);
    expect(
      withDefault.kind === 'use_card' && withDefault.cardInstance.cardId,
    ).toBe('bolt');
  });

  it('still plays an in-range damage card under default profile', () => {
    const state = makeState({
      p1: { mana: 5, hand: [card('h1', 'spark')] },
    });
    const getMeta = makeGetMetaRich({
      spark: { mana: 2, effectJson: onCast(dmg(3, 'near_enemy', { range: 2 })) },
    });
    const action = chooseAIAction(
      state,
      P1,
      getMeta,
      zeroRand,
      getProfile('default'),
    );
    expect(action.kind === 'use_card' && action.cardInstance.cardId).toBe(
      'spark',
    );
  });
});

describe('bruiser profile (aggressive melee rush)', () => {
  // c01-002 마나담긴찌르기: near_enemy range1 dmg2 — freely used (no longer held).
  // c01-024 병 주고 약 주기: the finisher, held until kill-angle.
  const bruiserGetMeta = makeGetMetaRich({
    'c01-002': {
      mana: 0,
      effectJson: onCast(dmg(2, 'near_enemy', { range: 1 })),
    },
    'c01-024': {
      mana: 0,
      effectJson: onCast(dmg(2, 'near_enemy', { range: 1 })),
    },
  });

  it('FREELY plays its melee card c01-002 in range even when not a kill-angle', () => {
    // adjacent (dist 1), opp healthy: bruiser no longer holds melee -> attacks.
    const state = makeState({
      p1: { mana: 5, hand: [card('h1', 'c01-002')] },
      p2: { hp: 20 },
      wizards: { [P1]: { r: 2, c: 2 }, [P2]: { r: 1, c: 2 } },
    });
    const action = chooseAIAction(
      state,
      P1,
      bruiserGetMeta,
      zeroRand,
      getProfile('bruiser'),
    );
    expect(action.kind === 'use_card' && action.cardInstance.cardId).toBe(
      'c01-002',
    );
  });

  it('HOLDS the finisher c01-024 until it is a kill-angle', () => {
    // opp healthy, finisher in range but held (not a kill-angle).
    const state = makeState({
      p1: { mana: 5, hand: [card('h1', 'c01-024')] },
      p2: { hp: 20 },
      wizards: { [P1]: { r: 2, c: 2 }, [P2]: { r: 1, c: 2 } },
    });
    const action = chooseAIAction(
      state,
      P1,
      bruiserGetMeta,
      zeroRand,
      getProfile('bruiser'),
    );
    expect(
      action.kind === 'use_card' && action.cardInstance.cardId === 'c01-024',
    ).toBe(false);
  });

  it('DOES play the finisher c01-024 when it is a kill-angle', () => {
    const state = makeState({
      p1: { mana: 5, hand: [card('h1', 'c01-024')] },
      p2: { hp: 2 },
      wizards: { [P1]: { r: 2, c: 2 }, [P2]: { r: 1, c: 2 } }, // dist 1, in range
    });
    const action = chooseAIAction(
      state,
      P1,
      bruiserGetMeta,
      zeroRand,
      getProfile('bruiser'),
    );
    expect(action.kind === 'use_card' && action.cardInstance.cardId).toBe(
      'c01-024',
    );
  });

  it('CLOSES distance into melee range when holding an out-of-range melee card', () => {
    // dist 3 > range 1: bruiser has no preferredDistance -> it advances to engage.
    const state = makeState({
      p1: { mana: 5, hand: [card('h1', 'c01-002')] },
      p2: { hp: 20 },
      wizards: { [P1]: { r: 4, c: 2 }, [P2]: { r: 1, c: 2 } }, // dist 3
    });
    const action = chooseAIAction(
      state,
      P1,
      bruiserGetMeta,
      zeroRand,
      getProfile('bruiser'),
    );
    expect(action.kind).toBe('move');
    if (action.kind === 'move') {
      // moves strictly closer to opp at (1,2).
      const d = Math.abs(action.to.r - 1) + Math.abs(action.to.c - 2);
      expect(d).toBeLessThan(3);
    }
  });
});

describe('disruptor profile (spamPriority)', () => {
  // c01-007 치킨게임, c01-021 게임개같이하네 — play whenever affordable, no kill-angle.
  const getMeta = makeGetMetaRich({
    'c01-007': {
      mana: 1,
      effectJson: onCast({ type: 'draw', value: 1, target: 'self' }),
    },
    'c01-021': {
      mana: 4,
      effectJson: onCast({ type: 'draw', value: 1, target: 'self' }),
    },
    bolt: { mana: 2, effectJson: onCast(dmg(3, 'enemy')) },
  });

  it('prioritizes c01-007 over a normal in-range damage card', () => {
    const state = makeState({
      p1: { mana: 5, hand: [card('h1', 'bolt'), card('h2', 'c01-007')] },
      p2: { hp: 20 },
    });
    const action = chooseAIAction(
      state,
      P1,
      getMeta,
      zeroRand,
      getProfile('disruptor'),
    );
    expect(action.kind === 'use_card' && action.cardInstance.cardId).toBe(
      'c01-007',
    );
  });

  it('prioritizes c01-021 when affordable', () => {
    const state = makeState({
      p1: { mana: 5, hand: [card('h1', 'bolt'), card('h2', 'c01-021')] },
      p2: { hp: 20 },
    });
    const action = chooseAIAction(
      state,
      P1,
      getMeta,
      zeroRand,
      getProfile('disruptor'),
    );
    expect(action.kind === 'use_card' && action.cardInstance.cardId).toBe(
      'c01-021',
    );
  });

  it('does NOT spam over a kill-angle (lethal still wins)', () => {
    // bolt is lethal (enemy hp 3) -> commit the kill instead of spamming.
    const state = makeState({
      p1: { mana: 5, hand: [card('h1', 'bolt'), card('h2', 'c01-007')] },
      p2: { hp: 3 },
    });
    const action = chooseAIAction(
      state,
      P1,
      getMeta,
      zeroRand,
      getProfile('disruptor'),
    );
    expect(action.kind === 'use_card' && action.cardInstance.cardId).toBe(
      'bolt',
    );
  });

  it('HEALS at critical HP instead of spamming a disruption card', () => {
    // hp 3 / maxHp 20 -> emergency-heal rung fires BEFORE spamPriority.
    const healGetMeta = makeGetMetaRich({
      'c01-007': {
        mana: 1,
        effectJson: onCast({ type: 'draw', value: 1, target: 'self' }),
      },
      heal: { mana: 2, effectJson: onCast({ type: 'heal', value: 5, target: 'self' }) },
    });
    const state = makeState({
      p1: {
        mana: 5,
        hp: 3,
        maxHp: 20,
        hand: [card('h1', 'c01-007'), card('h2', 'heal')],
      },
      p2: { hp: 20 },
    });
    const action = chooseAIAction(
      state,
      P1,
      healGetMeta,
      zeroRand,
      getProfile('disruptor'),
    );
    expect(action.kind === 'use_card' && action.cardInstance.cardId).toBe(
      'heal',
    );
  });

  it('still commits a kill-angle even when at critical HP (lethal beats heal)', () => {
    // hp 3 critical, but bolt is lethal on enemy hp 3 -> KILL, do not heal.
    const killGetMeta = makeGetMetaRich({
      bolt: { mana: 2, effectJson: onCast(dmg(5, 'enemy')) },
      heal: { mana: 2, effectJson: onCast({ type: 'heal', value: 5, target: 'self' }) },
    });
    const state = makeState({
      p1: {
        mana: 5,
        hp: 3,
        maxHp: 20,
        hand: [card('h1', 'bolt'), card('h2', 'heal')],
      },
      p2: { hp: 3 },
    });
    const action = chooseAIAction(
      state,
      P1,
      killGetMeta,
      zeroRand,
      getProfile('disruptor'),
    );
    expect(action.kind === 'use_card' && action.cardInstance.cardId).toBe(
      'bolt',
    );
  });
});

describe('control profile (rituals + aggression threshold)', () => {
  // c01-020 지맥(ritual), c01-026 운석(damage), c01-003 운기조식(cycle heal/draw).
  const getMeta = makeGetMetaRich({
    'c01-020': {
      mana: 4,
      effectJson: {
        type: 'ritual',
        install: { range: 1 },
        triggers: [
          {
            trigger: 'onTurnStart',
            effects: [{ type: 'mana_gain', value: 1, target: 'self' }],
          },
        ],
      },
    },
    'c01-026': { mana: 5, effectJson: onCast(dmg(10, 'near_enemy', { range: 4 })) },
    'c01-003': {
      mana: 1,
      effectJson: onCast(
        { type: 'heal', value: 2, target: 'self' },
        { type: 'draw', value: 1, target: 'self' },
      ),
    },
  });

  it('prioritizes installing a ritual over a damage card (not kill-angle)', () => {
    const state = makeState({
      p1: {
        mana: 5,
        maxMana: 5,
        hand: [card('h1', 'c01-026'), card('h2', 'c01-020')],
      },
      p2: { hp: 30 },
    });
    const action = chooseAIAction(
      state,
      P1,
      getMeta,
      zeroRand,
      getProfile('control'),
    );
    expect(action.kind === 'use_card' && action.cardInstance.cardId).toBe(
      'c01-020',
    );
  });

  it('holds offense until maxMana reaches threshold (4): keeps distance / cycles', () => {
    // maxMana 3 < 4 -> do NOT commit the in-range damage card. Cycle instead.
    const state = makeState({
      p1: {
        mana: 3,
        maxMana: 3,
        hand: [card('h1', 'c01-026'), card('h2', 'c01-003')],
      },
      p2: { hp: 30 },
    });
    // make c01-026 affordable for the test (mana low but treat threshold logic):
    const cheapGetMeta = makeGetMetaRich({
      'c01-026': { mana: 3, effectJson: onCast(dmg(10, 'near_enemy', { range: 4 })) },
      'c01-003': {
        mana: 1,
        effectJson: onCast(
          { type: 'heal', value: 2, target: 'self' },
          { type: 'draw', value: 1, target: 'self' },
        ),
      },
    });
    const action = chooseAIAction(
      state,
      P1,
      cheapGetMeta,
      zeroRand,
      getProfile('control'),
    );
    // must NOT be the damage card (offense held below threshold).
    expect(
      action.kind === 'use_card' && action.cardInstance.cardId === 'c01-026',
    ).toBe(false);
    // should cycle with c01-003.
    expect(action.kind === 'use_card' && action.cardInstance.cardId).toBe(
      'c01-003',
    );
  });

  it('commits offense once maxMana >= threshold', () => {
    const state = makeState({
      p1: { mana: 5, maxMana: 5, hand: [card('h1', 'c01-026')] },
      p2: { hp: 30 },
      wizards: { [P1]: { r: 2, c: 2 }, [P2]: { r: 0, c: 2 } }, // dist 2 <= range 4
    });
    const action = chooseAIAction(
      state,
      P1,
      getMeta,
      zeroRand,
      getProfile('control'),
    );
    expect(action.kind === 'use_card' && action.cardInstance.cardId).toBe(
      'c01-026',
    );
  });
});
