import { describe, it, expect, vi } from 'vitest';
import { reviewsService } from '../services/reviews';
import { __getTables } from './__mocks__/supabase.js';

vi.mock('../lib/supabase', async () => await import('./__mocks__/supabase.js'));

describe('reviewsService', () => {
  it('create inserts a new review row and returns it', async () => {
    const tables = __getTables();
    const beforeCount = tables.reviews.length;

    const writerId = 'user-1';
    const text = '아주 재미있는 카드 게임입니다.';

    const row = await reviewsService.create(writerId, text);

    expect(row).toBeDefined();
    expect(row.writer_id).toBe(writerId);
    expect(row.review).toBe(text);
    expect(typeof row.id).toBe('string');

    const afterCount = tables.reviews.length;
    expect(afterCount).toBe(beforeCount + 1);

    const stored = tables.reviews[afterCount - 1];
    expect(stored.writer_id).toBe(writerId);
    expect(stored.review).toBe(text);
  });
});
