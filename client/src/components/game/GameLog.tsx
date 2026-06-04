import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/shared/lib/utils';
import type { ClientSideActionLog } from '@/shared/types/game';

interface GameLogProps {
  logs: ClientSideActionLog[] | undefined;
}

export function GameLog({ logs }: GameLogProps) {
  const { t } = useTranslation();
  const items = logs ?? [];
  const bottomRef = useRef<HTMLDivElement>(null);

  // 새 로그가 쌓이면 항상 최신(맨 아래)이 보이도록 스크롤을 최하단에 고정한다.
  // Radix ScrollArea 는 별도 viewport 엘리먼트가 스크롤되므로, scrollIntoView 대신
  // 그 viewport 의 scrollTop 을 직접 끝으로 보낸다(그래야 확실히 바닥에 붙는다).
  useEffect(() => {
    const viewport = bottomRef.current?.closest(
      '[data-radix-scroll-area-viewport]',
    ) as HTMLElement | null;
    if (viewport) viewport.scrollTop = viewport.scrollHeight;
  }, [items.length]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">{t('game.gameLog')}</CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-32">
          {items.length === 0 ? (
            <div className="text-muted-foreground py-4 text-center text-xs">
              {t('game.emptyGameLog')}
            </div>
          ) : (
            <div className="space-y-1">
              {items.map((log, index) => {
                const isLatest = index === items.length - 1;
                return (
                  <div
                    key={index}
                    className={cn(
                      'text-xs',
                      isLatest
                        ? 'animate-log-appear text-foreground border-primary/60 bg-primary/5 rounded border-l-2 px-1.5 py-0.5 font-medium'
                        : 'text-muted-foreground',
                    )}
                  >
                    <span className="font-semibold">{t('game.logTurn', { turn: log.turn })}</span> - {log.text}
                  </div>
                );
              })}
              <div ref={bottomRef} />
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
