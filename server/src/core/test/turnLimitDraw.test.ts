import { describe, it, expect, vi } from 'vitest';
import { GamePhase, type PlayerID, type CardID } from '../../type/gameState';
import type { EngineContext, CardMeta } from '../context';
import type { GameOverPayload } from '../../type/wsProtocol';
import { GameEngineAdapter } from '../engine/gameEngineAdapter';
import {
  createInitialGameState,
  type PlayerDeckConfig,
} from '../../state/gameInit';
import { MAX_GAME_TURNS } from '../rules/constants';

// gameInit 이 cardsService→supabase 를 끌고 오므로 다른 테스트와 동일하게 mock.
vi.mock(
  '../../lib/supabase',
  async () => await import('../../test/__mocks__/supabase.js'),
);

const P1: PlayerID = 'p1';
const P2: PlayerID = 'p2';

// 데미지원이 전혀 없는 무해한 카드(마나만 얻음). 덱을 크게 줘서 80턴 내 덱아웃도
// 일어나지 않게 한다 → 아무도 죽지 않아 반드시 턴 상한 무승부가 발동.
const battery: CardMeta = {
  id: 'c01-001',
  name_dev: 'mana_battery',
  name_ko: '마나 보조 배터리',
  name_en: 'Mana Battery',
  description_ko: null,
  description_en: null,
  type: 'instant',
  mana: 0,
  token: false,
  effectJson: {
    type: 'instant',
    triggers: [
      { trigger: 'onCast', effects: [{ type: 'mana_gain', value: 1, target: 'self' }] },
    ],
  },
};

const ctx: EngineContext = {
  lookupCard: async (id: CardID) => (id === 'c01-001' ? battery : null),
  random: () => 0.5,
};

describe('turn-limit draw rule', () => {
  it('승부가 안 나면 MAX_GAME_TURNS 초과 시 무승부(winner=null, reason=turn_limit)', async () => {
    const decks: PlayerDeckConfig[] = [
      { playerId: P1, main: [{ id: 'c01-001', count: 120 }], cata: [{ id: 'c01-001', count: 4 }] },
      { playerId: P2, main: [{ id: 'c01-001', count: 120 }], cata: [{ id: 'c01-001', count: 4 }] },
    ];
    const engine = GameEngineAdapter.create({
      roomCode: 'turnlimit',
      players: [P1, P2],
      initialState: createInitialGameState(decks),
      ctx,
    });

    let gameOver: GameOverPayload | null = null;
    engine.onGameOver((p) => {
      gameOver = p;
    });

    await engine.markReady();
    await engine.handleAnswerMulligan(P1, { replaceIndices: [] });
    await engine.handleAnswerMulligan(P2, { replaceIndices: [] });

    // 둘 다 매 턴 그냥 패스. 데미지원이 없으니 80턴을 넘기면 무승부가 되어야 한다.
    // (손패 한도 초과 등으로 생기는 입력 요청은 기본값으로 답해 진행을 막지 않는다.)
    let guard = 0;
    while (engine.state.phase !== GamePhase.GAME_OVER && guard++ < 500) {
      const core = engine.getCore();
      const pi = core.pendingInput;
      if (pi) {
        const count = pi.count ?? 1;
        const opts = pi.options;
        const answer =
          Array.isArray(opts) && opts.length > 0
            ? count > 1
              ? opts.slice(0, Math.min(count, opts.length))
              : opts[0]
            : count > 1
              ? []
              : null;
        await engine.handlePlayerInput(pi.playerId, { answer });
        continue;
      }
      await engine.handlePlayerAction(engine.state.activePlayer, {
        action: 'end_turn',
      });
    }

    expect(engine.state.phase).toBe(GamePhase.GAME_OVER);
    expect(engine.state.winner).toBeNull();
    expect(engine.state.turn).toBeGreaterThan(MAX_GAME_TURNS);
    expect(gameOver).not.toBeNull();
    expect(gameOver!.winner).toBe('draw');
    expect(gameOver!.reason).toBe('turn_limit');
  });
});
