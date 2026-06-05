import { Sparkles } from 'lucide-react';
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
    <div className="bg-card inline-grid grid-cols-5 gap-1.5 rounded-lg border p-2 sm:gap-2 sm:p-3">
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
              'relative h-12 w-12 rounded-lg border-2 transition-all duration-200 sm:h-14 sm:w-14 lg:h-16 lg:w-16',
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
            {isPlayer && <div className="text-xl font-bold text-white sm:text-2xl">👤</div>}
            {isOpponent && <div className="text-xl font-bold text-white sm:text-2xl">🤖</div>}
            {ritualInfo && (
              <>
                {/* 마법사가 없는 칸이면 마법진 아이콘 + 축약 이름을 직접 보여줘
                    (점만 찍던 기존 방식과 달리) 모바일에서도 무엇이 깔렸는지 알 수 있게 한다. */}
                {!isPlayer && !isOpponent && (
                  <span
                    className={cn(
                      'pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-0.5 px-0.5',
                      ritualInfo.isMine ? 'text-purple-500' : 'text-red-500',
                    )}
                  >
                    <Sparkles className="h-3.5 w-3.5 shrink-0" />
                    <span className="w-full truncate text-center text-[8px] leading-tight font-semibold">
                      {ritualInfo.name}
                    </span>
                  </span>
                )}
                <span
                  className={cn(
                    'absolute right-1 bottom-1 h-2.5 w-2.5 rounded-full border border-white/70 shadow',
                    ritualInfo.isMine ? 'bg-purple-400' : 'bg-red-400',
                  )}
                />
              </>
            )}
          </button>
        );
      })}
    </div>
  );
}
