import type { DeckCard } from "@/shared/types/deck";
import { GameCard } from "./GameCard";
import { ScrollArea } from "@/components/ui/scroll-area";
import { X } from "lucide-react";
import { cn } from "@/shared/lib/utils";

interface DeckPanelProps {
  deckCards: DeckCard[];
  onRemoveCard: (cardId: string) => void;
  maxMainSize: number;
  maxCataSize: number;
  // 재앙 카드 식별용: catastrophe 카드 id 집합
  cataIds?: Set<string>;
}

export const DeckPanel = ({ deckCards, onRemoveCard, maxMainSize, maxCataSize, cataIds }: DeckPanelProps) => {
  const totalCards = deckCards.reduce((sum, card) => sum + card.count, 0);

  const mainCards = deckCards.filter(c => !cataIds?.has(c.id));
  const cataCards = deckCards.filter(c => cataIds?.has(c.id));
  const mainCount = mainCards.reduce((s, c) => s + c.count, 0);
  const cataCount = cataCards.reduce((s, c) => s + c.count, 0);

  const isComplete = mainCount === maxMainSize && cataCount === maxCataSize;
  const isOverLimit = mainCount > maxMainSize || cataCount > maxCataSize;

  return (
    <div className="flex flex-col h-full bg-card rounded-lg border border-border overflow-hidden">
      {/* Header */}
      <div className="p-4 bg-linear-to-r from-primary/20 to-primary/10 border-b border-border">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-foreground">나의 덱</h2>
          <div className={cn(
            "text-2xl font-bold px-4 py-2 rounded-lg",
            isComplete && "bg-accent text-accent-foreground shadow-[0_0_20px_hsl(45_100%_55%/0.4)]",
            isOverLimit && "bg-destructive text-destructive-foreground",
            !isComplete && !isOverLimit && "bg-secondary text-foreground"
          )}>
            메인 {mainCount}/{maxMainSize} · 재앙 {cataCount}/{maxCataSize}
          </div>
        </div>
        {isOverLimit && (
          <p className="text-sm text-destructive mt-2">덱의 최대 장수를 초과했습니다!</p>
        )}
      </div>

      {/* Main Deck Cards */}
      <ScrollArea className="flex-1 p-4">
        {deckCards.length === 0 ? (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            <p className="text-center">
              카드를 클릭하여<br />덱에 추가하세요
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="text-sm font-semibold text-muted-foreground mb-1">메인 카드</div>
            {mainCards
              .sort((a, b) => (a.mana ?? 0) - (b.mana ?? 0))
              .map((card) => (
                <div key={card.id} className="relative group">
                  <div className="grid grid-cols-[1fr_auto] gap-3 items-center">
                    <div className="min-w-0">
                      <GameCard card={card} count={card.count} />
                    </div>
                    <button
                      onClick={() => onRemoveCard(card.id)}
                      className={cn(
                        "p-2 rounded-lg bg-destructive/20 hover:bg-destructive text-destructive-foreground",
                        "transition-all opacity-0 group-hover:opacity-100",
                        "hover:shadow-lg"
                      )}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}

            <div className="text-sm font-semibold text-muted-foreground mt-6 mb-1">재앙 카드</div>
            {cataCards.length === 0 ? (
              <div className="text-xs text-muted-foreground">재앙 카드를 선택하지 않았습니다.</div>
            ) : (
              cataCards
                .sort((a, b) => (a.mana ?? 0) - (b.mana ?? 0))
                .map((card) => (
                  <div key={card.id} className="relative group">
                    <div className="grid grid-cols-[1fr_auto] gap-3 items-center">
                      <div className="min-w-0">
                        <GameCard card={card} count={card.count} />
                      </div>
                      <button
                        onClick={() => onRemoveCard(card.id)}
                        className={cn(
                          "p-2 rounded-lg bg-destructive/20 hover:bg-destructive text-destructive-foreground",
                          "transition-all opacity-0 group-hover:opacity-100",
                          "hover:shadow-lg"
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
      <div className="p-4 bg-secondary/50 border-t border-border">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">평균 마나 비용</span>
          <span className="font-bold text-foreground">
            {deckCards.length > 0
              ? (
                  deckCards.reduce((sum, card) => sum + (card.mana ?? 0) * card.count, 0) /
                  totalCards
                ).toFixed(1)
              : "0.0"}
          </span>
        </div>
      </div>
    </div>
  );
};
