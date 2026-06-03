import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { cardsService } from '../services/cards';
import {
  setCardRowsForTest,
  resetCardResource,
} from '../core/resources/cardResource';
import { testCardRows } from './fixtures/cardRows';
vi.mock('../lib/supabase', async () => await import('./__mocks__/supabase.js'));

describe('cardsService', () => {
  beforeEach(() => {
    setCardRowsForTest(testCardRows);
  });
  afterEach(() => {
    resetCardResource();
  });

  it('list without pagination returns all', async () => {
    const { items, total } = await cardsService.list({});
    expect(items.length).toBe(total);
  });

  it('filters by token=false and type=instant', async () => {
    const { items } = await cardsService.list({
      token: false,
      type: 'instant',
    });
    for (const c of items) {
      expect(c.token).toBe(false);
      expect(c.type).toBe('instant');
    }
  });
});
