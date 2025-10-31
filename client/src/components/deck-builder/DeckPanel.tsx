import { Button } from "@/components/ui/button";
import type { DeckCard } from "@/types/deck";

type DeckPanelProps = {
  deckCards: DeckCard[];
  onCardRemove?: (cardId: string) => void;
  onRemoveCard?: (cardId: string) => void;
  onDeckSave?: () => void;
  maxDeckSize?: number;
};

export function DeckPanel({
  deckCards,
  onCardRemove,
  onRemoveCard,
  onDeckSave,
  maxDeckSize,
}: DeckPanelProps) {
  const handleRemove = (id: string) => {
    if (onCardRemove) return onCardRemove(id);
    if (onRemoveCard) return onRemoveCard(id);
  };

  const total = deckCards.reduce((sum, c) => sum + c.count, 0);

  return (
    <div className="bg-card border border-border rounded-lg p-4 space-y-3 min-h-0">
      <div className="flex items-center justify-between">
        <h2 className="font-bold">
          현재 덱 {maxDeckSize ? `(${total}/${maxDeckSize})` : `(${total})`}
        </h2>
        {onDeckSave && (
          <Button size="sm" onClick={onDeckSave}>
            저장
          </Button>
        )}
      </div>

      {deckCards.length === 0 && (
        <p className="text-sm text-muted-foreground">카드를 추가하세요.</p>
      )}

      <div className="space-y-2 overflow-auto">
        {deckCards.map((c) => (
          <div key={c.id} className="flex justify-between items-center">
            <span>
              {c.name} <span className="text-muted-foreground">x{c.count}</span>
            </span>
            {(onCardRemove || onRemoveCard) && (
              <Button variant="outline" size="sm" onClick={() => handleRemove(c.id)}>
                -1
              </Button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default DeckPanel;


