import { useTranslation } from 'react-i18next';
import type { FoggedGameState } from '@/shared/types/game';
import { cn } from '@/shared/lib/utils';
import { useTurnTimer } from '@/features/game/hooks/useTurnTimer';

interface GameHeaderProps {
  turn: FoggedGameState['turn'];
  isMyTurn: boolean;
}

const tierColor: Record<string, string> = {
  normal: 'text-emerald-400',
  warning: 'text-amber-400',
  danger: 'text-rose-400 animate-pulse',
};

export function GameHeader({ turn, isMyTurn }: GameHeaderProps) {
  const { t } = useTranslation();
  const { remaining, tier } = useTurnTimer(`${turn}-${isMyTurn}`);

  return (
    <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 sm:gap-3">
      <span
        className={cn(
          'rounded-full px-3 py-1 text-sm font-bold whitespace-nowrap shadow-sm transition-colors sm:px-4',
          isMyTurn
            ? 'bg-primary text-primary-foreground ring-primary/40 ring-2'
            : 'bg-secondary text-secondary-foreground',
        )}
      >
        {isMyTurn ? t('game.myTurn') : t('game.opponentTurn')}
      </span>
      <span className="text-muted-foreground text-sm whitespace-nowrap">{t('game.turnLabel', { turn })}</span>
      <span
        className={cn('font-mono text-sm font-bold whitespace-nowrap tabular-nums', tierColor[tier])}
        aria-label={t('game.turnTimer')}
      >
        ⏱ {remaining}s
      </span>
    </div>
  );
}
