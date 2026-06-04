import { useEffect, useRef, useState } from 'react';
import { useMeQuery } from '@/features/auth/queries';
import { useGameFogStore } from '@/shared/store/gameStore';
import { useCardMetaStore } from '@/shared/store/cardMetaStore';
import { cn } from '@/shared/lib/utils';

/** 스포트라이트가 화면에 머무는 시간(ms). */
const SPOTLIGHT_MS = 1100;

type SpotlightCard = {
  name: string;
  mana: number;
  description?: string;
};

/**
 * 상대(AI)가 방금 사용한 카드를 화면 중앙에 잠깐 보여주는 비차단 오버레이.
 *
 * - `lastDiff.animations` 에서 `kind === 'card_play'` 이고 owner 가 상대(=내가 아님)인
 *   애니메이션을 찾아, 해당 카드 메타를 띄운다.
 * - pointer-events-none / fixed center 라서 게임 조작을 막지 않는다(PvP 에서도 무해).
 * - 카드 메타가 아직 로드되지 않았으면 조용히 건너뛴다.
 */
export function CardPlaySpotlight() {
  const { data: me } = useMeQuery();
  const myId = me?.id;
  const lastDiff = useGameFogStore((s) => s.lastDiff);
  const getById = useCardMetaStore((s) => s.getById);

  const [card, setCard] = useState<SpotlightCard | null>(null);
  // 동일 diff 객체를 중복 처리하지 않기 위한 가드.
  const lastSeenRef = useRef<unknown>(null);

  useEffect(() => {
    if (!lastDiff || lastDiff === lastSeenRef.current) return;
    lastSeenRef.current = lastDiff;

    const anims = lastDiff.animations ?? [];
    const played = anims.find(
      (a) =>
        a.kind === 'card_play' &&
        typeof a.cardId === 'string' &&
        // owner 가 내가 아니면(=상대/AI) 스포트라이트 대상.
        (myId === undefined || a.owner !== myId),
    );
    if (!played) return;

    const meta = getById(played.cardId as string);
    if (!meta) return; // 메타 미로딩 시 조용히 건너뜀

    setCard({ name: meta.name, mana: meta.mana, description: meta.description });
  }, [lastDiff, myId, getById]);

  useEffect(() => {
    if (!card) return;
    const timer = setTimeout(() => setCard(null), SPOTLIGHT_MS);
    return () => clearTimeout(timer);
  }, [card]);

  if (!card) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center">
      <div
        className={cn(
          'animate-in fade-in-0 zoom-in-95 border-primary/60 bg-card/95 w-64 rounded-xl border-2 p-4 text-center shadow-2xl backdrop-blur',
        )}
      >
        <div className="mb-2 flex items-center justify-between">
          <span className="text-primary text-lg font-bold">{card.name}</span>
          <span className="bg-primary/15 text-primary inline-flex h-7 min-w-7 items-center justify-center rounded-full px-2 text-sm font-bold">
            {card.mana}
          </span>
        </div>
        {card.description ? (
          <p className="text-muted-foreground text-sm leading-snug">
            {card.description}
          </p>
        ) : null}
      </div>
    </div>
  );
}
