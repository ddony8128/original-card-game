import { getTimerTier } from '@/features/game/hooks/useTurnTimer';

describe('getTimerTier (턴 타이머 색 단계)', () => {
  it('30초 초과는 normal', () => {
    expect(getTimerTier(90)).toBe('normal');
    expect(getTimerTier(31)).toBe('normal');
  });

  it('10초 초과 30초 이하는 warning', () => {
    expect(getTimerTier(30)).toBe('warning');
    expect(getTimerTier(11)).toBe('warning');
  });

  it('10초 이하는 danger', () => {
    expect(getTimerTier(10)).toBe('danger');
    expect(getTimerTier(0)).toBe('danger');
  });
});
