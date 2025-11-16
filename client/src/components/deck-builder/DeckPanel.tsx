import type { DeckCard } from '@/shared/types/deck';
import { GameCard } from './GameCard';
import { ScrollArea } from '@/components/ui/scroll-area';
import { X } from 'lucide-react';
import { cn } from '@/shared/lib/utils';

interface DeckPanelProps {
  deckCards: DeckCard[];
  onRemoveCard: (cardId: string) => void;
  maxMainSize: number;
  maxCataSize: number;
  // 재앙 카드 식별용: catastrophe 카드 id 집합
  cataIds?: Set<string>;
}

export const DeckPanel = ({
  deckCards,
  onRemoveCard,
  maxMainSize,
  maxCataSize,
  cataIds,
}: DeckPanelProps) => {
  const totalCards = deckCards.reduce((sum, card) => sum + card.count, 0);

  const mainCards = deckCards.filter((c) => !cataIds?.has(c.id));
  const cataCards = deckCards.filter((c) => cataIds?.has(c.id));
  const mainCount = mainCards.reduce((s, c) => s + c.count, 0);
  const cataCount = cataCards.reduce((s, c) => s + c.count, 0);

  const isComplete = mainCount === maxMainSize && cataCount === maxCataSize;
  const isOverLimit = mainCount > maxMainSize || cataCount > maxCataSize;

  return (
    <div className="bg-card border-border flex h-full flex-col overflow-hidden rounded-lg border">
      {/* Header */}
      <div className="from-primary/20 to-primary/10 border-border border-b bg-linear-to-r p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-foreground text-xl font-bold">나의 덱</h2>
          <div
            className={cn(
              'rounded-lg px-4 py-2 text-2xl font-bold',
              isComplete &&
                'bg-accent text-accent-foreground shadow-[0_0_20px_hsl(45_100%_55%/0.4)]',
              isOverLimit && 'bg-destructive text-destructive-foreground',
              !isComplete && !isOverLimit && 'bg-secondary text-foreground',
            )}
          >
            메인 {mainCount}/{maxMainSize} · 재앙 {cataCount}/{maxCataSize}
          </div>
        </div>
        {isOverLimit && (
          <p className="text-destructive mt-2 text-sm">덱의 최대 장수를 초과했습니다!</p>
        )}
      </div>

      {/* Main Deck Cards */}
      <ScrollArea className="flex-1 p-4">
        {deckCards.length === 0 ? (
          <div className="text-muted-foreground flex h-full items-center justify-center">
            <p className="text-center">
              카드를 클릭하여
              <br />
              덱에 추가하세요
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="text-muted-foreground mb-1 text-sm font-semibold">메인 카드</div>
            {mainCards
              .sort((a, b) => (a.mana ?? 0) - (b.mana ?? 0))
              .map((card) => (
                <div key={card.id} className="group relative">
                  <div className="grid grid-cols-[1fr_auto] items-center gap-3">
                    <div className="min-w-0">
                      <GameCard card={card} count={card.count} />
                    </div>
                    <button
                      onClick={() => onRemoveCard(card.id)}
                      className={cn(
                        'bg-destructive/20 hover:bg-destructive text-destructive-foreground rounded-lg p-2',
                        'opacity-0 transition-all group-hover:opacity-100',
                        'hover:shadow-lg',
                      )}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}

            <div className="text-muted-foreground mt-6 mb-1 text-sm font-semibold">재앙 카드</div>
            {cataCards.length === 0 ? (
              <div className="text-muted-foreground text-xs">재앙 카드를 선택하지 않았습니다.</div>
            ) : (
              cataCards
                .sort((a, b) => (a.mana ?? 0) - (b.mana ?? 0))
                .map((card) => (
                  <div key={card.id} className="group relative">
                    <div className="grid grid-cols-[1fr_auto] items-center gap-3">
                      <div className="min-w-0">
                        <GameCard card={card} count={card.count} />
                      </div>
                      <button
                        onClick={() => onRemoveCard(card.id)}
                        className={cn(
                          'bg-destructive/20 hover:bg-destructive text-destructive-foreground rounded-lg p-2',
                          'opacity-0 transition-all group-hover:opacity-100',
                          'hover:shadow-lg',
                        )}
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))
            )}
          </div>
        )}
      </ScrollArea>

      {/* Stats Footer */}
      <div className="bg-secondary/50 border-border border-t p-4">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">평균 마나 비용</span>
          <span className="text-foreground font-bold">
            {deckCards.length > 0
              ? (
                  deckCards.reduce((sum, card) => sum + (card.mana ?? 0) * card.count, 0) /
                  totalCards
                ).toFixed(1)
              : '0.0'}
          </span>
        </div>
      </div>
    </div>
  );
};
