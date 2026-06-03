import { describe, it, expect, vi, beforeEach } from 'vitest';

const listAll = vi.fn();
vi.mock('../../services/cards', () => ({
  cardsService: {
    listAll: (...args: unknown[]) => listAll(...args),
  },
}));

import {
  ensureCardCatalog,
  getCardMeta,
  resetCardCatalog,
  isCardCatalogLoaded,
} from '../resources/cardCatalog';

const sampleRow = {
  id: 'c1',
  name_dev: 'alpha',
  name_ko: '가',
  description_ko: null,
  type: 'instant' as const,
  mana: 1,
  token: false,
  effect_json: null,
};

describe('cardCatalog 리소스 (B-2 카드 리소스화)', () => {
  beforeEach(() => {
    resetCardCatalog();
    listAll.mockReset();
  });

  it('카탈로그를 1회만 로드하고 이후 메모리에서 동기 조회한다', async () => {
    listAll.mockResolvedValue([sampleRow]);

    expect(isCardCatalogLoaded()).toBe(false);
    await ensureCardCatalog();
    await ensureCardCatalog(); // 두 번째는 DB 재조회 없이 캐시 사용

    expect(listAll).toHaveBeenCalledTimes(1);
    expect(isCardCatalogLoaded()).toBe(true);
    expect(getCardMeta('c1')?.name_ko).toBe('가');
    expect(getCardMeta('nope')).toBeNull();
  });

  it('동시 호출(여러 게임 동시 시작)에도 DB 를 한 번만 조회한다', async () => {
    listAll.mockResolvedValue([sampleRow]);

    await Promise.all([
      ensureCardCatalog(),
      ensureCardCatalog(),
      ensureCardCatalog(),
    ]);

    expect(listAll).toHaveBeenCalledTimes(1);
  });
});
