import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { Card as DeckCard } from '@/shared/types/deck';
import { GameCard } from '@/components/deck-builder/GameCard';
import { ScrollArea } from '@/components/ui/scroll-area';

interface DiscardPileModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cards: DeckCard[];
  title: string;
}

export function DiscardPileModal({ open, onOpenChange, cards, title }: DiscardPileModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[80vh] max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            {title} ({cards.length}장)
          </DialogTitle>
        </DialogHeader>
        <ScrollArea className="h-[60vh] pr-4">
          {cards.length === 0 ? (
            <div className="text-muted-foreground py-8 text-center">버린 카드가 없습니다</div>
          ) : (
            <div className="grid grid-cols-3 gap-3 md:grid-cols-4">
              {[...cards].reverse().map((card, index) => (
                <GameCard key={`${card.id}-${index}`} card={card} />
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
