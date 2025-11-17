import { Card, CardContent } from '@/components/ui/card';
import { BookOpen, Flame } from 'lucide-react';

interface DeckInfoProps {
  deckCount: number;
  graveCount: number;
  label?: string;
}

export function DeckInfo({ deckCount, graveCount, label = '덱 정보' }: DeckInfoProps) {
  return (
    <div className="space-y-2">
      <div className="text-muted-foreground text-sm font-medium">{label}</div>
      <div className="grid grid-cols-2 gap-2">
        <Card>
          <CardContent className="px-3 pt-4 pb-3">
            <div className="mb-1 flex items-center gap-2">
              <BookOpen className="text-primary h-4 w-4" />
              <div className="text-lg font-bold">{deckCount}</div>
            </div>
            <div className="text-muted-foreground text-xs">덱</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="px-3 pt-4 pb-3">
            <div className="mb-1 flex items-center gap-2">
              <Flame className="h-4 w-4 text-orange-500" />
              <div className="text-lg font-bold">{graveCount}</div>
            </div>
            <div className="text-muted-foreground text-xs">버린 카드</div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

interface CatastropheDeckInfoProps {
  deckCount: number;
  graveCount: number;
}

export function CatastropheDeckInfo({ deckCount, graveCount }: CatastropheDeckInfoProps) {
  return (
    <div className="flex justify-center">
      <Card className="w-full max-w-xs">
        <CardContent className="px-3 pt-4 pb-3">
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Flame className="h-4 w-4 text-orange-500" />
              <div className="text-muted-foreground text-sm font-medium">재앙 덱 (공유)</div>
            </div>
            <div className="text-lg font-bold">{deckCount}</div>
          </div>
          <div className="text-muted-foreground text-xs">버린 카드: {graveCount}</div>
        </CardContent>
      </Card>
    </div>
  );
}
