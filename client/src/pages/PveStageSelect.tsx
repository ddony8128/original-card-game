import { useTranslation } from 'react-i18next';
import { useLangNavigate } from '@/i18n/nav';
import { ArrowLeft, Trophy, Swords, Crown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { usePveStagesQuery, usePveProgressQuery } from '@/features/pve/queries';

export default function PveStageSelect() {
  const navigate = useLangNavigate();
  const { t } = useTranslation();
  const { data: stagesData, isLoading: stagesLoading } = usePveStagesQuery();
  const { data: progress, isLoading: progressLoading } = usePveProgressQuery();

  const isLoading = stagesLoading || progressLoading;
  const stages = stagesData?.stages ?? [];
  const clearedIds = new Set(progress?.clearedStageIds ?? []);
  const allCleared = progress?.allCleared ?? false;
  const clearedCount = clearedIds.size;
  const totalCount = stagesData?.total ?? stages.length;

  return (
    <div className="from-background via-background to-accent/10 min-h-screen bg-linear-to-br p-4 sm:p-6">
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="flex items-center justify-between">
          <Button variant="outline" size="sm" onClick={() => navigate('/lobby')}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            {t('lobby.title')}
          </Button>
        </div>

        <div className="space-y-2 text-center">
          <h1 className="flex items-center justify-center gap-2 text-3xl font-bold">
            <Swords className="h-7 w-7" />
            {t('pve.title')}
          </h1>
          <p className="text-muted-foreground">{t('pve.subtitle')}</p>
        </div>

        {/* 전체 클리어 축하 배너 */}
        {allCleared && (
          <div className="flex items-center justify-center gap-3 rounded-2xl border border-amber-400/60 bg-amber-400/10 p-5 text-center shadow-lg shadow-amber-400/30 ring-2 ring-amber-300/60">
            <Crown className="h-8 w-8 text-amber-300 drop-shadow-[0_0_12px_rgba(252,211,77,0.9)]" />
            <div>
              <p className="text-xl font-extrabold text-amber-300 drop-shadow-[0_0_10px_rgba(252,211,77,0.8)]">
                {t('pve.allClearedBanner')}
              </p>
              <p className="text-muted-foreground text-sm">{t('pve.allClearedSubtitle')}</p>
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="grid gap-4 sm:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-44 w-full rounded-lg" />
            ))}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-3">
            {stages.map((stage, index) => {
              const cleared = clearedIds.has(stage.id);
              return (
                <Card
                  key={stage.id}
                  className={
                    cleared
                      ? 'border-amber-400/70 bg-amber-400/5 shadow-lg shadow-amber-400/30 ring-2 ring-amber-300/60'
                      : ''
                  }
                >
                  <CardContent className="flex h-full flex-col items-center gap-3 p-6 text-center">
                    <span className="text-muted-foreground text-xs font-semibold">
                      {t('pve.stageLabel', { number: index + 1 })}
                    </span>
                    {cleared ? (
                      <Trophy className="h-10 w-10 text-amber-300 drop-shadow-[0_0_12px_rgba(252,211,77,0.9)]" />
                    ) : (
                      <Swords className="text-muted-foreground h-10 w-10" />
                    )}
                    <h2 className="text-lg font-bold">{stage.name}</h2>
                    {cleared && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-400/20 px-3 py-0.5 text-sm font-bold text-amber-300">
                        {t('pve.cleared')}
                      </span>
                    )}
                    <Button
                      className="mt-auto w-full"
                      variant={cleared ? 'outline' : 'default'}
                      onClick={() => navigate(`/pve/play/${stage.id}`)}
                    >
                      {cleared ? t('pve.retry') : t('pve.challenge')}
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {!isLoading && !allCleared && (
          <p className="text-muted-foreground text-center text-sm">
            {t('pve.progressHint', { cleared: clearedCount, total: totalCount })}
          </p>
        )}
      </div>
    </div>
  );
}
