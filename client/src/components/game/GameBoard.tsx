import type { Position } from "@/types/game";
import { cn } from "@/lib/utils";

interface GameBoardProps {
  playerPosition: Position;
  opponentPosition: Position;
  selectedPosition: Position | null;
  onCellClick: (position: Position) => void;
}

export function GameBoard({
  playerPosition,
  opponentPosition,
  selectedPosition,
  onCellClick,
}: GameBoardProps) {
  const isPlayerPosition = (x: number, y: number) =>
    playerPosition.x === x && playerPosition.y === y;

  const isOpponentPosition = (x: number, y: number) =>
    opponentPosition.x === x && opponentPosition.y === y;

  const isSelectedPosition = (x: number, y: number) =>
    selectedPosition?.x === x && selectedPosition?.y === y;

  const isAdjacentToPlayer = (x: number, y: number) => {
    const dx = Math.abs(playerPosition.x - x);
    const dy = Math.abs(playerPosition.y - y);
    return (dx === 1 && dy === 0) || (dx === 0 && dy === 1);
  };

  return (
    <div className="inline-grid grid-cols-5 gap-2 p-4 bg-card rounded-lg border">
      {Array.from({ length: 25 }, (_, i) => {
        const y = Math.floor(i / 5);
        const x = i % 5;
        const isPlayer = isPlayerPosition(x, y);
        const isOpponent = isOpponentPosition(x, y);
        const isSelected = isSelectedPosition(x, y);
        const isAdjacent = isAdjacentToPlayer(x, y);

        return (
          <button
            key={`${x}-${y}`}
            onClick={() => onCellClick({ x, y })}
            className={cn(
              "w-16 h-16 rounded-lg border-2 transition-all duration-200",
              "hover:border-primary/50 hover:scale-105",
              isPlayer &&
                "bg-linear-to-br from-blue-500 to-blue-600 border-blue-400 shadow-lg shadow-blue-500/50",
              isOpponent &&
                "bg-linear-to-br from-red-500 to-red-600 border-red-400 shadow-lg shadow-red-500/50",
              !isPlayer &&
                !isOpponent &&
                isSelected &&
                "border-primary bg-primary/10",
              !isPlayer &&
                !isOpponent &&
                !isSelected &&
                isAdjacent &&
                "border-primary/30 bg-primary/5",
              !isPlayer && !isOpponent && !isSelected && !isAdjacent && "border-border"
            )}
          >
            {isPlayer && (
              <div className="text-2xl font-bold text-white">👤</div>
            )}
            {isOpponent && (
              <div className="text-2xl font-bold text-white">🤖</div>
            )}
          </button>
        );
      })}
    </div>
  );
}
