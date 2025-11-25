import { cn } from '@/shared/lib/utils';

export type BoardPosition = {
  x: number;
  y: number;
};

interface GameBoardProps {
  playerPosition: BoardPosition;
  opponentPosition: BoardPosition;
  selectedPosition: BoardPosition | null;
  /**
   * 서버에서 내려온 map 타입 request_input 에 대해
   * 선택 가능한 좌표들을 하이라이트하기 위한 옵션.
   * 없거나 비어 있으면 기존 인접 칸 하이라이트 로직을 사용한다.
   */
  highlightPositions?: BoardPosition[];
  onCellClick: (position: BoardPosition) => void;
}

export function GameBoard({
  playerPosition,
  opponentPosition,
  selectedPosition,
  highlightPositions,
  onCellClick,
}: GameBoardProps) {
  const isPlayerPosition = (x: number, y: number) =>
    playerPosition.x === x && playerPosition.y === y;

  const isOpponentPosition = (x: number, y: number) =>
    opponentPosition.x === x && opponentPosition.y === y;

  const isSelectedPosition = (x: number, y: number) =>
    selectedPosition?.x === x && selectedPosition?.y === y;

  const hasHighlight = Array.isArray(highlightPositions) && highlightPositions.length > 0;

  const isHighlightPosition = (x: number, y: number) =>
    hasHighlight ? !!highlightPositions?.some((p) => p.x === x && p.y === y) : false;

  const isAdjacentToPlayer = (x: number, y: number) => {
    const dx = Math.abs(playerPosition.x - x);
    const dy = Math.abs(playerPosition.y - y);
    return (dx === 1 && dy === 0) || (dx === 0 && dy === 1);
  };

  return (
    <div className="bg-card inline-grid grid-cols-5 gap-2 rounded-lg border p-4">
      {Array.from({ length: 25 }, (_, i) => {
        const y = Math.floor(i / 5);
        const x = i % 5;
        const isPlayer = isPlayerPosition(x, y);
        const isOpponent = isOpponentPosition(x, y);
        const isSelected = isSelectedPosition(x, y);
        const isAdjacent = isAdjacentToPlayer(x, y);
        const isHighlight = isHighlightPosition(x, y);

        return (
          <button
            key={`${x}-${y}`}
            onClick={() => onCellClick({ x, y })}
            className={cn(
              'h-16 w-16 rounded-lg border-2 transition-all duration-200',
              'hover:border-primary/50 hover:scale-105',
              isPlayer &&
                'border-blue-400 bg-linear-to-br from-blue-500 to-blue-600 shadow-lg shadow-blue-500/50',
              isOpponent &&
                'border-red-400 bg-linear-to-br from-red-500 to-red-600 shadow-lg shadow-red-500/50',
              !isPlayer && !isOpponent && isSelected && 'border-primary bg-primary/10',
              // map 타입 request_input 이 있을 때는 서버가 준 좌표만 강하게 하이라이트
              !isPlayer &&
                !isOpponent &&
                !isSelected &&
                isHighlight &&
                'border-primary bg-primary/20',
              !isPlayer &&
                !isOpponent &&
                !isSelected &&
                !isHighlight &&
                isAdjacent &&
                'border-primary/30 bg-primary/5',
              !isPlayer && !isOpponent && !isSelected && !isAdjacent && 'border-border',
            )}
          >
            {isPlayer && <div className="text-2xl font-bold text-white">👤</div>}
            {isOpponent && <div className="text-2xl font-bold text-white">🤖</div>}
          </button>
        );
      })}
    </div>
  );
}
