import type { FoggedGameState } from '@/shared/types/game';

interface GameHeaderProps {
  turn: FoggedGameState['turn'];
  isMyTurn: boolean;
}

export function GameHeader({ turn, isMyTurn }: GameHeaderProps) {
  return (
    <div className="text-center">
      <div className="text-muted-foreground text-sm">
        턴 {turn} - {isMyTurn ? '내 턴' : '상대 턴'}
      </div>
    </div>
  );
}
