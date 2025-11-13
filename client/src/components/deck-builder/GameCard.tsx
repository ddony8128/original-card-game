import type { Card } from "@/shared/types/deck";
import { cn } from "@/shared/lib/utils";

interface GameCardProps {
  card: Card;
  onClick?: () => void;
  count?: number;
}

const manaColors = {
  1: "bg-[hsl(var(--mana-1))]",
  2: "bg-[hsl(var(--mana-2))]",
  3: "bg-[hsl(var(--mana-3))]",
  4: "bg-[hsl(var(--mana-4))]",
  5: "bg-[hsl(var(--mana-5))]"
};

export const GameCard = ({ card, onClick, count }: GameCardProps) => {
  const manaValue = (card.mana ?? 0);
  const manaColor = manaColors[Math.min(manaValue, 5) as keyof typeof manaColors];
  
  return (
    <div
      onClick={onClick}
      className={cn(
        "relative bg-card rounded-lg overflow-hidden cursor-pointer transition-all duration-300",
        "hover:scale-105 hover:shadow-[0_8px_24px_hsl(260_80%_40%/0.3)]",
        "border border-border shadow-[0_4px_12px_hsl(240_80%_10%/0.4)]",
        "group"
      )}
    >
      {/* Mana Cost Badge */}
      <div className={cn(
        "absolute top-2 left-2 w-10 h-10 rounded-full flex items-center justify-center",
        "font-bold text-lg text-white shadow-lg z-10",
        manaColor
      )}>
        {manaValue}
      </div>

      {/* Count Badge */}
      {count !== undefined && count > 0 && (
        <div className="absolute top-2 right-2 w-8 h-8 rounded-full bg-primary flex items-center justify-center font-bold text-sm text-primary-foreground shadow-lg z-10">
          {count}
        </div>
      )}

      {/* Card Image Area */}
      <div className={cn(
        "h-32 bg-linear-to-br",
        "from-slate-600 to-slate-700",
        "flex items-center justify-center relative overflow-hidden"
      )}>
        <div className="absolute inset-0 bg-linear-to-t from-card/80 to-transparent" />
      </div>

      {/* Card Content */}
      <div className="p-3 space-y-2">
        <h3 className="font-bold text-sm text-foreground truncate">{card.name_ko}</h3>
        <p className="text-xs text-muted-foreground line-clamp-2 min-h-8">
          {card.description_ko}
        </p>
      </div>

      {/* Hover Glow Effect */}
      <div className="absolute inset-0 bg-linear-to-t from-primary/0 via-primary/0 to-primary/0 group-hover:from-primary/10 group-hover:via-primary/5 transition-all duration-300 pointer-events-none" />
    </div>
  );
};
