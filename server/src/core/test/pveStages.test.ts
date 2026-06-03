import { describe, it, expect } from 'vitest';
import { getPveStages, getPveStage } from '../resources/pveStages';

describe('pveStages 리소스 (P0-1)', () => {
  it('스테이지 3개를 로드한다', () => {
    const stages = getPveStages();
    expect(stages.length).toBe(3);
    expect(stages.map((s) => s.id)).toEqual(['stage-1', 'stage-2', 'stage-3']);
  });

  it('각 스테이지 덱은 메인 16 / 재앙 4 이다', () => {
    for (const s of getPveStages()) {
      const main = s.deck.main.reduce((a, c) => a + c.count, 0);
      const cata = s.deck.cata.reduce((a, c) => a + c.count, 0);
      expect(main, `${s.id} main`).toBe(16);
      expect(cata, `${s.id} cata`).toBe(4);
      expect(s.profileId.length).toBeGreaterThan(0);
    }
  });

  it('getPveStage 로 단건 조회', () => {
    expect(getPveStage('stage-2')?.name).toBe('게임 개같이 하네');
    expect(getPveStage('nope')).toBeNull();
  });
});
