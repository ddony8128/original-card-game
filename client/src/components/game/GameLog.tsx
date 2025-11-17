import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { ClientSideActionLog } from '@/shared/types/game';

interface GameLogProps {
  logs: ClientSideActionLog[] | undefined;
}

export function GameLog({ logs }: GameLogProps) {
  const items = logs ?? [];

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
              {items.map((log, index) => (
                <div key={index} className="text-muted-foreground text-xs">
                  <span className="font-semibold">턴 {log.turn}</span> - {log.text}
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
