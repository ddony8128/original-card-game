import { describe, it, expect, vi } from 'vitest';
vi.mock('../lib/supabase', async () => await import('./__mocks__/supabase.js'));
import { decksService } from '../services/decks';
import { __getTables } from './__mocks__/supabase.js';

describe('decksService.validateAndHydrate', () => {
  it('should hydrate given valid lists', async () => {
    const cards = __getTables().cards;
    // eslint-disable-next-line no-console
    console.log('seed cards count:', cards.length);
    const main = [
      { id: 'c01-001', count: 2 },
      { id: 'c01-002', count: 2 },
      { id: 'c01-003', count: 2 },
      { id: 'c01-004', count: 2 },
      { id: 'c01-005', count: 2 },
      { id: 'c01-006', count: 2 },
      { id: 'c01-002', count: 2 },
      { id: 'c01-003', count: 2 },
    ];
    const cata = [
      { id: 'c99-001', count: 1 },
      { id: 'c99-002', count: 1 },
      { id: 'c99-003', count: 1 },
      { id: 'c99-004', count: 1 },
    ];
    const { main: hm, cata: hc } = await decksService.validateAndHydrate(
      main,
      cata,
    );
    expect(hm.length).toBe(8);
    expect(hc.length).toBe(4);
  });
});
