import { Card } from '@/components/ui/card';

interface OpponentHandProps {
  cardCount: number;
}

export function OpponentHand({ cardCount }: OpponentHandProps) {
  return (
    <div className="flex flex-wrap justify-center gap-1">
      {Array.from({ length: cardCount }).map((_, i) => (
        <Card
          key={i}
          className="from-muted to-muted/50 flex h-9 w-7 items-center justify-center border bg-linear-to-br"
        >
          <div className="text-sm">🃏</div>
        </Card>
      ))}
    </div>
  );
}
