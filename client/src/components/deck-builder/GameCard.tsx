import type { Card } from "@/types/deck";

type GameCardProps = {
  card: Card;
  count?: number;
  onClick?: () => void;
};

export function GameCard({ card, count = 0, onClick }: GameCardProps) {
  return (
    <button
      onClick={onClick}
      className="border p-3 rounded bg-card hover:bg-accent text-left w-full"
    >
      <div className="flex justify-between items-center mb-1">
        <span className="font-bold">{card.name}</span>
        <span className="text-sm">{count > 0 ? `x${count}` : null}</span>
      </div>
      <p className="text-sm text-muted-foreground">{card.description}</p>
      <p className="text-xs text-primary mt-1">마나 {card.manaCost}</p>
    </button>
  );
}

export default GameCard;


