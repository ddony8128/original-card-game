import { useTranslation } from 'react-i18next';
import { Heart, Droplet, BookOpen, Flame, Hand, Eye } from 'lucide-react';
import { cn } from '@/shared/lib/utils';

interface StatBarProps {
  label: string;
  hp: number;
  maxHp: number;
  mana: number;
  maxMana: number;
  deckCount: number;
  graveCount: number;
  /** 상대 패널에서만 사용: 보이지 않는 손패 장수 */
  handCount?: number;
  /** 활성 플레이어(현재 턴) 강조 */
  active?: boolean;
  onViewGrave?: () => void;
}

/**
 * 인게임 한 줄 스탯 표시.
 * 기존의 큰 HP/마나/덱/묘지 카드 묶음을 한 줄 칩으로 압축해
 * "한 화면에 들어오게" 만드는 것이 목적이다.
 */
export function StatBar({
  label,
  hp,
  maxHp,
  mana,
  maxMana,
  deckCount,
  graveCount,
  handCount,
  active,
  onViewGrave,
}: StatBarProps) {
  const { t } = useTranslation();
  const hpPct = maxHp > 0 ? Math.max(0, Math.min(100, (hp / maxHp) * 100)) : 0;

  return (
    <div
      className={cn(
        'bg-card text-card-foreground flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border px-3 py-2 shadow-sm',
        active && 'ring-primary/50 ring-2',
      )}
    >
      <span className="text-muted-foreground shrink-0 text-xs font-semibold">{label}</span>

      {/* HP: 숫자 + 가는 게이지 */}
      <div className="flex min-w-[88px] items-center gap-1.5">
        <Heart className="h-4 w-4 shrink-0 text-red-500" />
        <div className="flex flex-col">
          <span className="text-sm font-bold tabular-nums leading-none">
            {hp}
            <span className="text-muted-foreground text-[10px] font-normal">/{maxHp}</span>
          </span>
          <span className="bg-muted mt-0.5 h-1 w-14 overflow-hidden rounded-full">
            <span
              className="block h-full rounded-full bg-red-500 transition-all"
              style={{ width: `${hpPct}%` }}
            />
          </span>
        </div>
      </div>

      {/* 마나 */}
      <div className="flex items-center gap-1">
        <Droplet className="h-4 w-4 shrink-0 text-blue-500" />
        <span className="text-sm font-bold tabular-nums">
          {mana}
          <span className="text-muted-foreground text-[10px] font-normal">/{maxMana}</span>
        </span>
      </div>

      {/* 덱 */}
      <div className="flex items-center gap-1" title={t('game.deck')}>
        <BookOpen className="text-primary h-4 w-4 shrink-0" />
        <span className="text-sm font-bold tabular-nums">{deckCount}</span>
      </div>

      {/* 묘지(클릭 시 보기) */}
      <button
        type="button"
        disabled={!graveCount || !onViewGrave}
        onClick={onViewGrave}
        title={t('game.grave')}
        className={cn(
          'flex items-center gap-1 rounded',
          graveCount && onViewGrave
            ? 'hover:text-primary cursor-pointer'
            : 'cursor-default opacity-70',
        )}
      >
        <Flame className="h-4 w-4 shrink-0 text-orange-500" />
        <span className="text-sm font-bold tabular-nums">{graveCount}</span>
        {graveCount > 0 && onViewGrave && <Eye className="h-3 w-3 opacity-60" />}
      </button>

      {/* 상대 손패 장수 */}
      {typeof handCount === 'number' && (
        <div className="flex items-center gap-1" title={t('game.opponentHandCount', { count: handCount })}>
          <Hand className="text-muted-foreground h-4 w-4 shrink-0" />
          <span className="text-sm font-bold tabular-nums">{handCount}</span>
        </div>
      )}
    </div>
  );
}
