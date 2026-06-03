import { useTranslation } from 'react-i18next';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BookOpen, Flame, Eye } from 'lucide-react';

interface DeckInfoProps {
  deckCount: number;
  graveCount: number;
  grave?: Array<{ id: string; cardId: string }>;
  label?: string;
  onViewGrave?: () => void;
}

export function DeckInfo({ deckCount, graveCount, label, onViewGrave }: DeckInfoProps) {
  const { t } = useTranslation();
  return (
    <div className="space-y-2">
      <div className="text-muted-foreground text-sm font-medium">{label ?? t('game.deckInfo')}</div>
      <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 sm:gap-2">
        <Card>
          <CardContent className="px-2 pt-3 pb-2 sm:px-3 sm:pt-4 sm:pb-3">
            <div className="mb-1 flex items-center gap-1 sm:gap-2">
              <BookOpen className="text-primary h-4 w-4 shrink-0" />
              <div className="min-w-0 text-base font-bold tabular-nums sm:text-lg">{deckCount}</div>
            </div>
            <div className="text-muted-foreground text-xs">{t('game.deck')}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="px-2 pt-3 pb-2 sm:px-3 sm:pt-4 sm:pb-3">
            <div className="mb-1 flex items-center justify-between gap-1">
              <div className="flex min-w-0 items-center gap-1 sm:gap-2">
                <Flame className="h-4 w-4 shrink-0 text-orange-500" />
                <div className="min-w-0 text-base font-bold tabular-nums sm:text-lg">{graveCount}</div>
              </div>
              {graveCount > 0 && onViewGrave && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 shrink-0 p-0"
                  onClick={onViewGrave}
                  title={t('game.viewGrave')}
                >
                  <Eye className="h-3 w-3" />
                </Button>
              )}
            </div>
            <div className="text-muted-foreground text-xs">{t('game.grave')}</div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

interface CatastropheDeckInfoProps {
  deckCount: number;
  graveCount: number;
  grave?: Array<{ id: string; cardId: string }>;
  onViewGrave?: () => void;
}

export function CatastropheDeckInfo({
  deckCount,
  graveCount,
  onViewGrave,
}: CatastropheDeckInfoProps) {
  const { t } = useTranslation();
  return (
    <div className="flex justify-center">
      <Card
        className="w-full max-w-xs border-orange-500/40 bg-orange-500/5"
        title={t('game.catastropheTooltip')}
      >
        <CardContent className="px-3 pt-4 pb-3">
          <div className="mb-1 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Flame className="h-4 w-4 text-orange-500" />
              <div className="text-sm font-medium text-orange-500">{t('game.catastropheDeck')}</div>
            </div>
            <div className="text-lg font-bold">{deckCount}</div>
          </div>
          <div className="text-muted-foreground mb-2 text-[11px]">
            {t('game.catastropheAuto')}
          </div>
          <div className="flex items-center justify-between">
            <div className="text-muted-foreground text-xs">{t('game.graveCount', { count: graveCount })}</div>
            {graveCount > 0 && onViewGrave && (
              <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={onViewGrave}>
                <Eye className="mr-1 h-3 w-3" />
                {t('game.view')}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
