import { useEffect, useState } from 'react';

export type TimerTier = 'normal' | 'warning' | 'danger';

export const DEFAULT_TURN_SECONDS = 90;
const WARNING_AT = 30;
const DANGER_AT = 10;

/** 남은 시간(초)에 따른 색 단계. 순수 함수(테스트 용이). */
export function getTimerTier(remaining: number): TimerTier {
  if (remaining <= DANGER_AT) return 'danger';
  if (remaining <= WARNING_AT) return 'warning';
  return 'normal';
}

/**
 * 턴별 시각용 카운트다운. `turnKey` 가 바뀔 때마다 다시 시작한다.
 * 서버 강제 타임아웃과는 무관한 화면 표시 전용이다.
 */
export function useTurnTimer(
  turnKey: string | number,
  durationSec: number = DEFAULT_TURN_SECONDS,
) {
  const [remaining, setRemaining] = useState(durationSec);

  useEffect(() => {
    setRemaining(durationSec);
    const id = setInterval(() => {
      setRemaining((r) => (r > 0 ? r - 1 : 0));
    }, 1000);
    return () => clearInterval(id);
  }, [turnKey, durationSec]);

  return { remaining, tier: getTimerTier(remaining) };
}
