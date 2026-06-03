import { useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/shared/lib/utils';
import type { ClientSideActionLog } from '@/shared/types/game';

interface GameLogProps {
  logs: ClientSideActionLog[] | undefined;
}

export function GameLog({ logs }: GameLogProps) {
  const items = logs ?? [];
  const bottomRef = useRef<HTMLDivElement>(null);

  // 새 로그가 쌓이면 항상 최신(맨 아래)이 보이도록 스크롤한다.
  useEffect(() => {
    bottomRef.current?.scrollIntoView?.({ block: 'nearest' });
  }, [items.length]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">게임 로그</CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-32">
          {items.length === 0 ? (
            <div className="text-muted-foreground py-4 text-center text-xs">
              게임 로그가 없습니다
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
                    <span className="font-semibold">턴 {log.turn}</span> - {log.text}
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
