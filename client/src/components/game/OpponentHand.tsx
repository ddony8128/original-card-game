import { Card } from '@/components/ui/card';

interface OpponentHandProps {
  cardCount: number;
}

export function OpponentHand({ cardCount }: OpponentHandProps) {
  return (
    <div className="flex justify-center gap-2">
      {Array.from({ length: cardCount }).map((_, i) => (
        <Card
          key={i}
          className="from-muted to-muted/50 flex h-24 w-16 items-center justify-center border-2 bg-linear-to-br"
        >
          <div className="text-2xl">🃏</div>
        </Card>
      ))}
    </div>
  );
}
