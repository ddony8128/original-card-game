import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

// 자기대전 하네스는 실제 카드 카탈로그가 필요하다. Supabase 대신 레포의
// cards.json(39장) 을 그대로 listAll 로 돌려준다.
const CARDS_JSON_PATH = path.join(__dirname, '../../../resources/cards.json');
const realCards = JSON.parse(fs.readFileSync(CARDS_JSON_PATH, 'utf-8'));

vi.mock('../../services/cards', () => {
  return {
    cardsService: {
      listAll: vi.fn(async () => realCards),
      getByIds: vi.fn(async () => []),
      getById: vi.fn(async () => null),
    },
  };
});

import { runSelfPlay, playOneGame, mulberry32 } from '../ai/selfPlay';
import {
  ensureCardCatalog,
  getCardMeta,
  resetCardCatalog,
} from '../resources/cardCatalog';
import { getPveStage } from '../resources/pveStages';
import type { DeckList } from '../../type/deck';

// 스테이지 덱을 SelfPlayPlayer 형태로 변환.
function stageDeck(stageId: string): { main: DeckList; cata: DeckList } {
  const stage = getPveStage(stageId);
  if (!stage) throw new Error(`missing stage ${stageId}`);
  return { main: stage.deck.main, cata: stage.deck.cata };
}

describe('selfPlay harness', () => {
  beforeEach(() => {
    resetCardCatalog();
  });

  it('mulberry32 is deterministic for the same seed', () => {
    const a = mulberry32(123);
    const b = mulberry32(123);
    const seqA = [a(), a(), a()];
    const seqB = [b(), b(), b()];
    expect(seqA).toEqual(seqB);
    for (const v of seqA) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('playOneGame terminates and yields a finite turn count', async () => {
    await ensureCardCatalog();
    const a = { deck: stageDeck('stage-1'), profileId: 'bruiser' };
    const b = { deck: stageDeck('stage-3'), profileId: 'control' };
    const result = await playOneGame(a, b, getCardMeta, 42);
    expect(['A', 'B', 'draw']).toContain(result.winner);
    expect(Number.isFinite(result.turns)).toBe(true);
    expect(result.turns).toBeGreaterThan(0);
  });

  it('playOneGame is reproducible for the same seed', async () => {
    await ensureCardCatalog();
    const a = { deck: stageDeck('stage-2'), profileId: 'disruptor' };
    const b = { deck: stageDeck('stage-1'), profileId: 'bruiser' };
    const r1 = await playOneGame(a, b, getCardMeta, 7);
    const r2 = await playOneGame(a, b, getCardMeta, 7);
    expect(r1).toEqual(r2);
  });

  it('runSelfPlay over 10 games terminates and returns a consistent summary', async () => {
    await ensureCardCatalog();
    const a = { deck: stageDeck('stage-1'), profileId: 'bruiser' };
    const b = { deck: stageDeck('stage-3'), profileId: 'control' };

    const summary = await runSelfPlay(a, b, getCardMeta, 10, 1000);

    expect(summary.games).toBe(10);
    expect(summary.aWins + summary.bWins + summary.draws).toBe(10);
    expect(Number.isFinite(summary.avgTurns)).toBe(true);
    expect(summary.avgTurns).toBeGreaterThan(0);
  });
}, 60000);
