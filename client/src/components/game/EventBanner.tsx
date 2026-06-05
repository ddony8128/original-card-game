import { useEffect, useRef, useState } from 'react';
import type { ClientSideActionLog } from '@/shared/types/game';
import { cn } from '@/shared/lib/utils';

/** 배너가 화면에 머무는 시간(ms). 페이드 인/아웃 포함 체감 ~2.4초. */
const BANNER_MS = 2400;

/**
 * 강조(주황/빨강) 처리할 "재앙/피해/소멸" 계열 키워드.
 * perspectiveLogs 는 서버에서 이미 한국어로 치환된 텍스트이므로 한국어 키워드로 매칭한다.
 * (영어 빌드여도 로그 본문은 서버 한국어 텍스트이므로 동일하게 동작한다.)
 */
const DANGER_KEYWORDS = ['재앙', '발동', '피해', '소멸', 'burn'];
/** 회복(초록) 계열 키워드. */
const HEAL_KEYWORDS = ['회복'];

type BannerTone = 'danger' | 'heal' | 'neutral';

function toneForText(text: string): BannerTone {
  if (HEAL_KEYWORDS.some((k) => text.includes(k))) return 'heal';
  if (DANGER_KEYWORDS.some((k) => text.includes(k))) return 'danger';
  return 'neutral';
}

interface EventBannerProps {
  /** Game.tsx 의 perspectiveLogs (나/상대 시점으로 치환된 로그 배열). */
  logs: ClientSideActionLog[];
  /** true 면 배너를 띄우지 않는다(게임 종료 시). */
  paused?: boolean;
}

/**
 * "방금 무슨 일이 일어났는지"를 화면 중앙 상단에 잠깐 띄우는 토스트형 배너.
 *
 * - logs 배열이 늘어나면(새 로그 도착) 가장 최근 1건을 페이드로 띄웠다가 사라진다.
 * - 재앙/피해/소멸 키워드 포함 시 주황/빨강, 회복 시 초록으로 강조한다.
 * - pointer-events-none / fixed 라서 레이아웃·조작에 영향을 주지 않는다.
 * - AnimationLayer(z-50)/CardPlaySpotlight(z-50) 보다 위(z-[60])에 위치하되,
 *   모달(멀리건/입력)은 시야를 가리지 않도록 화면 "상단"에 배치한다.
 */
export function EventBanner({ logs, paused = false }: EventBannerProps) {
  const [active, setActive] = useState<{ id: number; text: string; tone: BannerTone } | null>(null);
  // 이미 처리한 로그 개수. 첫 렌더(기존 누적 로그)는 띄우지 않기 위해 -1 로 시작한다.
  const seenCountRef = useRef<number>(-1);
  // 빠르게 도착하는 로그를 구분하기 위한 단조 증가 키.
  const keyRef = useRef<number>(0);

  useEffect(() => {
    const count = logs.length;

    // 최초 진입: 기존 누적 로그는 배너로 띄우지 않고 기준선만 잡는다.
    if (seenCountRef.current === -1) {
      seenCountRef.current = count;
      return;
    }

    // 새로 추가된 로그가 없으면 무시.
    if (count <= seenCountRef.current) {
      seenCountRef.current = count;
      return;
    }

    seenCountRef.current = count;

    if (paused) return;

    // 새로 추가된 라인들 중 "가장 최근 1건"만 띄운다(빠른 연속 도착 시 최신 우선).
    const latest = logs[count - 1];
    if (!latest || !latest.text) return;

    keyRef.current += 1;
    setActive({ id: keyRef.current, text: latest.text, tone: toneForText(latest.text) });
  }, [logs, paused]);

  useEffect(() => {
    if (!active) return;
    const timer = setTimeout(() => setActive(null), BANNER_MS);
    return () => clearTimeout(timer);
  }, [active]);

  // paused 로 전환되면(게임 종료) 즉시 감춘다.
  useEffect(() => {
    if (paused) setActive(null);
  }, [paused]);

  if (!active) return null;

  const toneClass =
    active.tone === 'danger'
      ? 'border-rose-500/70 bg-rose-950/85 text-rose-50 shadow-[0_0_24px_rgba(244,63,94,0.45)]'
      : active.tone === 'heal'
        ? 'border-emerald-500/70 bg-emerald-950/85 text-emerald-50 shadow-[0_0_24px_rgba(16,185,129,0.4)]'
        : 'border-primary/50 bg-card/90 text-foreground shadow-2xl';

  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-[12%] z-[60] flex justify-center px-4"
      aria-live="polite"
      role="status"
    >
      <div
        // key 로 매 이벤트마다 재마운트시켜 fade-in 애니메이션을 재생한다.
        key={active.id}
        className={cn(
          'animate-in fade-in-0 slide-in-from-top-2 max-w-[90vw] rounded-full border-2 px-5 py-2 text-center text-sm font-semibold backdrop-blur sm:text-base',
          toneClass,
        )}
      >
        {active.text}
      </div>
    </div>
  );
}
