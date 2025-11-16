import { describe, it, expect } from 'vitest';
import { isDeckList, coerceDeckList } from '../type/deck';

describe('deck type validators', () => {
  it('entry validation via isDeckList', () => {
    expect(isDeckList([{ id: 'c01-001', count: 2 }])).toBe(true);
    expect(isDeckList([{ id: 'x', count: 1, type: 'instant' }])).toBe(true);
    // invalid shapes
    expect(isDeckList([{ id: 1, count: 2 }])).toBe(false);
    expect(isDeckList([{ id: 'x', count: '2' }])).toBe(false);
    expect(isDeckList([{ id: 'x', count: 2, type: 'wrong' }])).toBe(false);
  });

  it('isDeckList and coerceDeckList', () => {
    const raw = JSON.stringify([{ id: 'a', count: 1 }]);
    expect(isDeckList([{ id: 'a', count: 1 }])).toBe(true);
    const list = coerceDeckList(raw);
    expect(Array.isArray(list)).toBe(true);
    expect(list[0]).toMatchObject({ id: 'a', count: 1 });
    expect(() => coerceDeckList('not json')).toThrow();
    expect(() => coerceDeckList([{ id: 'a' }])).toThrow();
  });
});
