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
  /**
   * 보드 위에 설치된 ritual 정보 (호버 시 카드 정보 표시용).
   * x, y 는 보드 좌표이며, name/description 은 카드 메타에서 가져온 값.
   */
  rituals?: { x: number; y: number; name: string; description?: string; isMine: boolean }[];
  onCellClick: (position: BoardPosition) => void;
}

export function GameBoard({
  playerPosition,
  opponentPosition,
  selectedPosition,
  highlightPositions,
  rituals,
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

  const getRitualInfo = (x: number, y: number) => rituals?.find((r) => r.x === x && r.y === y);

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
        const ritualInfo = getRitualInfo(x, y);
        const isHighlightedEnemy = isOpponent && isHighlight;

        return (
          <button
            key={`${x}-${y}`}
            title={
              ritualInfo
                ? `${ritualInfo.name}${ritualInfo.description ? `\n${ritualInfo.description}` : ''}`
                : undefined
            }
            onClick={() => onCellClick({ x, y })}
            className={cn(
              'relative h-16 w-16 rounded-lg border-2 transition-all duration-200',
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
                // RequestInput(예: 설치 위치 선택) 중에는 인접 칸 하이라이트를 숨긴다.
                !hasHighlight &&
                'border-primary/30 bg-primary/5',
              // map 타입 request_input 중, 상대 마법사가 실제 대상인 칸은 더 강하게 강조
              isHighlightedEnemy &&
                'animate-pulse border-yellow-300 bg-yellow-500/30 ring-4 ring-yellow-400',
              !isPlayer && !isOpponent && !isSelected && !isAdjacent && 'border-border',
            )}
          >
            {isPlayer && <div className="text-2xl font-bold text-white">👤</div>}
            {isOpponent && <div className="text-2xl font-bold text-white">🤖</div>}
            {ritualInfo && (
              <div
                className={cn(
                  'absolute right-1 bottom-1 h-3 w-3 rounded-full border border-white/70 shadow',
                  ritualInfo.isMine ? 'bg-purple-400' : 'bg-red-400',
                )}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
