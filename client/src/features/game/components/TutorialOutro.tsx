import { useTranslation } from 'react-i18next';
import { useLangNavigate } from '@/i18n/nav';
import { Hammer, Sparkles } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useGameFogStore } from '@/shared/store/gameStore';

/**
 * 튜토리얼 전투가 끝나면(승/패 무관) 나만의 덱을 만들도록 안내하는 아웃트로 카드.
 * /tutorial 라우트에서 <Game solo /> 옆에 렌더되어 스토어의 게임 종료 상태를 읽는다.
 * 게임 종료 전에는 아무것도 렌더하지 않는다.
 */
export function TutorialOutro() {
  const { t } = useTranslation();
  const navigate = useLangNavigate();
  const fogged = useGameFogStore((s) => s.fogged);

  const isGameOver = fogged?.phase === 'GAME_OVER' || Boolean(fogged?.winner);
  if (!isGameOver) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 px-4">
      <Card className="border-amber-400/60 shadow-amber-500/40 w-full max-w-md text-center shadow-2xl">
        <CardHeader className="space-y-2">
          <div className="flex justify-center text-amber-300">
            <Sparkles className="h-10 w-10 drop-shadow-[0_0_12px_rgba(252,211,77,0.8)]" />
          </div>
          <CardTitle className="text-2xl text-amber-300 drop-shadow-[0_0_12px_rgba(252,211,77,0.6)]">
            {t('tutorial.outroTitle')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <p className="text-muted-foreground text-sm leading-relaxed">
            {t('tutorial.outroBody')}
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button
              size="lg"
              className="flex-1 bg-amber-500 font-semibold text-amber-950 hover:bg-amber-400"
              onClick={() => navigate('/deck-builder')}
            >
              <Hammer className="mr-2 h-4 w-4" />
              {t('tutorial.outroBuildDeck')}
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="flex-1 font-semibold"
              onClick={() => navigate('/lobby')}
            >
              {t('tutorial.outroLobby')}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
