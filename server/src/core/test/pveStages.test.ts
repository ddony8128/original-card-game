import { describe, it, expect } from 'vitest';
import { getPveStages, getPveStage } from '../resources/pveStages';

describe('pveStages 리소스 (P0-1)', () => {
  it('스테이지 6개를 로드한다(일반 1~3 + 하드 4~6)', () => {
    const stages = getPveStages();
    expect(stages.length).toBe(6);
    expect(stages.map((s) => s.id)).toEqual([
      'stage-1',
      'stage-2',
      'stage-3',
      'stage-4',
      'stage-5',
      'stage-6',
    ]);
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

  it('하드 스테이지(4~6)는 일반 스테이지(1~3)의 프로필을 재사용하고 aiHp=30 이다', () => {
    const pairs: Array<[string, string]> = [
      ['stage-4', 'stage-1'],
      ['stage-5', 'stage-2'],
      ['stage-6', 'stage-3'],
    ];
    for (const [hardId, baseId] of pairs) {
      const hard = getPveStage(hardId);
      const base = getPveStage(baseId);
      expect(hard, hardId).not.toBeNull();
      expect(base, baseId).not.toBeNull();
      // 프로필을 그대로 재사용한다.
      expect(hard?.profileId).toBe(base?.profileId);
      // 보스 AI 시작 HP 는 30(하드).
      expect(hard?.aiHp).toBe(30);
      // 일반 스테이지는 aiHp 를 지정하지 않는다(기본값 사용).
      expect(base?.aiHp).toBeUndefined();
    }
  });

  it('하드 stage-2/3 은 일반 stage-2/3 의 덱을 그대로 재사용한다(난이도는 aiHp 로만 가른다)', () => {
    // stage-1 은 1단계 난이도 완화를 위해 덱을 약화했으므로 stage-4(하드)와 다르다.
    // stage-2/3 계열은 여전히 동일 덱을 공유한다.
    for (const [hardId, baseId] of [
      ['stage-5', 'stage-2'],
      ['stage-6', 'stage-3'],
    ] as Array<[string, string]>) {
      expect(getPveStage(hardId)?.deck).toEqual(getPveStage(baseId)?.deck);
    }
  });
});
