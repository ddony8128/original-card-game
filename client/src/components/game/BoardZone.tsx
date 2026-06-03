import { GameBoard, type BoardPosition } from '@/components/game/GameBoard';
import { Button } from '@/components/ui/button';
import type { FoggedGameState } from '@/shared/types/game';
import type { GameCardMeta } from '@/shared/store/cardMetaStore';

interface BoardZoneProps {
  playerPosition: BoardPosition;
  opponentPosition: BoardPosition;
  selectedBoardPosition: BoardPosition | null;
  mapHighlightPositions: BoardPosition[];
  rituals: FoggedGameState['board']['rituals'];
  getCardMeta: (id: string) => GameCardMeta | undefined;
  myId: string | undefined;
  onCellClick: (position: BoardPosition) => void;
  onMoveToSelected: () => void;
  onUseRitualAtSelected: () => void;
}

export function BoardZone({
  playerPosition,
  opponentPosition,
  selectedBoardPosition,
  mapHighlightPositions,
  rituals,
  getCardMeta,
  myId,
  onCellClick,
  onMoveToSelected,
  onUseRitualAtSelected,
}: BoardZoneProps) {
  return (
    <div className="flex flex-col items-center gap-2">
      <GameBoard
        playerPosition={playerPosition}
        opponentPosition={opponentPosition}
        selectedPosition={selectedBoardPosition}
        highlightPositions={mapHighlightPositions}
        rituals={rituals.map((r) => {
          const meta = getCardMeta(r.cardId);
          return {
            x: r.pos.c,
            y: r.pos.r,
            name: meta?.name ?? r.cardId,
            description: meta?.description,
            isMine: myId ? r.owner === myId : false,
          };
        })}
        onCellClick={onCellClick}
      />

      {selectedBoardPosition && (
        <div className="bg-card text-card-foreground flex w-full max-w-md items-center justify-between rounded-lg border px-3 py-2 text-xs shadow-sm">
          <div>
            <div className="font-semibold">
              선택한 칸: ({selectedBoardPosition.x}, {selectedBoardPosition.y})
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={onMoveToSelected}>
              이 칸으로 이동
            </Button>
            <Button size="sm" variant="outline" onClick={onUseRitualAtSelected}>
              마법진 사용
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
