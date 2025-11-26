import type { Card } from '@/shared/types/deck';
import { cn } from '@/shared/lib/utils';

interface GameCardProps {
  card: Card;
  onClick?: () => void;
  count?: number;
}

const manaColors = {
  1: 'bg-[hsl(var(--mana-1))]',
  2: 'bg-[hsl(var(--mana-2))]',
  3: 'bg-[hsl(var(--mana-3))]',
  4: 'bg-[hsl(var(--mana-4))]',
  5: 'bg-[hsl(var(--mana-5))]',
};

export const GameCard = ({ card, onClick, count }: GameCardProps) => {
  const manaValue = card.mana ?? 0;
  const manaColor = manaColors[Math.min(manaValue, 5) as keyof typeof manaColors];

  return (
    <div
      onClick={onClick}
      className={cn(
        'bg-card relative cursor-pointer overflow-hidden rounded-lg transition-all duration-300',
        'hover:scale-105 hover:shadow-[0_8px_24px_hsl(260_80%_40%/0.3)]',
        'border-border border shadow-[0_4px_12px_hsl(240_80%_10%/0.4)]',
        'group',
      )}
    >
      {/* Mana Cost Badge */}
      <div
        className={cn(
          'absolute top-2 left-2 flex h-10 w-10 items-center justify-center rounded-full',
          'z-10 text-lg font-bold text-white shadow-lg',
          manaColor,
        )}
      >
        {manaValue}
      </div>

      {/* Count Badge */}
      {count !== undefined && count > 0 && (
        <div className="bg-primary text-primary-foreground absolute top-2 right-2 z-10 flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold shadow-lg">
          {count}
        </div>
      )}

      {/* Card Image Area */}
      <div
        className={cn(
          'h-32 bg-linear-to-br',
          'from-slate-600 to-slate-700',
          'relative flex items-center justify-center overflow-hidden',
        )}
      >
        <div className="from-card/80 absolute inset-0 bg-linear-to-t to-transparent" />
      </div>

      {/* Card Content */}
      <div className="space-y-2 p-3">
        <h3 className="text-foreground line-clamp-1 text-sm font-bold">{card.name_ko}</h3>
        <p className="text-muted-foreground line-clamp-3 min-h-[3.5rem] text-xs">
          {card.description_ko}
        </p>
      </div>

      {/* Hover Glow Effect */}
      <div className="from-primary/0 via-primary/0 to-primary/0 group-hover:from-primary/10 group-hover:via-primary/5 pointer-events-none absolute inset-0 bg-linear-to-t transition-all duration-300" />
    </div>
  );
};
