import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ClientSideActionLog, PlayerID } from '@/shared/types/game';
import { cn } from '@/shared/lib/utils';
import { useCardMetaStore } from '@/shared/store/cardMetaStore';
import { renderLogEntry } from '@/shared/lib/renderLogEntry';

/** 배너가 화면에 머무는 시간(ms). 페이드 인/아웃 포함 체감 ~2.4초. */
const BANNER_MS = 2400;

/**
 * 강조(주황/빨강) 처리할 "재앙/피해/소멸" 계열 로그 코드.
 * 구조화 로그로 전환되어 언어와 무관하게 code 기준으로 톤을 결정한다.
 */
const DANGER_CODES = new Set([
  'cata_draw_cast',
  'cata_card_to_grave',
  'cata_deck_restore',
  'triggered_effect',
  'damage',
  'damage_at',
  'card_burned_full',
  'burn_from_hand',
  'burn_from_deck',
  'burn_deck_random',
  'burn_deck_top',
]);
/** 회복(초록) 계열 로그 코드. */
const HEAL_CODES = new Set(['heal']);

type BannerTone = 'danger' | 'heal' | 'neutral';

function toneForCode(code: string): BannerTone {
  if (HEAL_CODES.has(code)) return 'heal';
  if (DANGER_CODES.has(code)) return 'danger';
  return 'neutral';
}

interface EventBannerProps {
  /** 구조화 클라이언트 로그 배열. */
  logs: ClientSideActionLog[];
  myId: PlayerID | undefined;
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
export function EventBanner({ logs, myId, paused = false }: EventBannerProps) {
  const { t } = useTranslation();
  const getCardMeta = useCardMetaStore((s) => s.getById);
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
    if (!latest) return;

    const text = renderLogEntry(latest, { myId, t, getCardMeta });
    if (!text) return;

    keyRef.current += 1;
    setActive({ id: keyRef.current, text, tone: toneForCode(latest.code) });
  }, [logs, paused, myId, t, getCardMeta]);

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
