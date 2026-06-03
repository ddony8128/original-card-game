import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';

interface GameOverOverlayProps {
  isWin: boolean;
  isLose: boolean;
  onReview: () => void;
  onLobby: () => void;
}

export function GameOverOverlay({ isWin, isLose, onReview, onLobby }: GameOverOverlayProps) {
  const { t } = useTranslation();
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="bg-card text-card-foreground border-primary/60 shadow-primary/40 mx-4 max-w-md rounded-2xl border p-8 text-center shadow-2xl">
        <div className="mb-4 text-4xl font-extrabold tracking-tight">
          {isWin && (
            <span className="text-emerald-400 drop-shadow-[0_0_15px_rgba(16,185,129,0.8)]">
              {t('game.win')}
            </span>
          )}
          {isLose && (
            <span className="text-rose-400 drop-shadow-[0_0_15px_rgba(244,63,94,0.8)]">
              {t('game.lose')}
            </span>
          )}
          {!isWin && !isLose && (
            <span className="text-amber-300 drop-shadow-[0_0_15px_rgba(252,211,77,0.8)]">
              {t('game.draw')}
            </span>
          )}
        </div>
        <p className="text-muted-foreground mb-6 text-sm">{t('game.gameOverDesc')}</p>
        <div className="flex gap-3">
          <Button
            variant="outline"
            size="lg"
            className="flex-1 font-semibold"
            onClick={onReview}
          >
            {t('game.goReview')}
          </Button>
          <Button
            size="lg"
            className="bg-primary text-primary-foreground flex-1 animate-pulse font-semibold"
            onClick={onLobby}
          >
            {t('game.backToLobby')}
          </Button>
        </div>
      </div>
    </div>
  );
}
