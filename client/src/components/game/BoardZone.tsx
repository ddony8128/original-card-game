import { Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { GameBoard, type BoardPosition } from '@/components/game/GameBoard';
import { Button } from '@/components/ui/button';
import { cn } from '@/shared/lib/utils';
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
  const { t } = useTranslation();

  // 선택된 칸에 설치된 마법진 찾기.
  // BoardPosition 은 {x=열(c), y=행(r)} 이고 ritual.pos 는 {r,c} 이므로
  // pos.r === selectedY && pos.c === selectedX 로 매칭한다.
  const selectedRitual = selectedBoardPosition
    ? rituals.find(
        (r) => r.pos.r === selectedBoardPosition.y && r.pos.c === selectedBoardPosition.x,
      )
    : undefined;
  const selectedRitualMeta = selectedRitual ? getCardMeta(selectedRitual.cardId) : undefined;
  const selectedRitualIsMine = selectedRitual
    ? myId
      ? selectedRitual.owner === myId
      : false
    : false;

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
        <div className="bg-card text-card-foreground flex w-full max-w-md flex-col gap-2 rounded-lg border px-3 py-2 text-xs shadow-sm">
          {selectedRitual && (
            <div
              className={cn(
                'flex flex-col gap-1 rounded-md border px-2 py-1.5',
                selectedRitualIsMine
                  ? 'border-purple-400/50 bg-purple-500/10'
                  : 'border-red-400/50 bg-red-500/10',
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span
                  className={cn(
                    'flex items-center gap-1 font-semibold',
                    selectedRitualIsMine ? 'text-purple-500' : 'text-red-500',
                  )}
                >
                  <Sparkles className="h-3.5 w-3.5 shrink-0" />
                  {selectedRitualMeta?.name ?? selectedRitual.cardId}
                </span>
                <span
                  className={cn(
                    'shrink-0 rounded-sm px-1.5 py-0.5 text-[10px] font-medium',
                    selectedRitualIsMine
                      ? 'bg-purple-500/20 text-purple-600'
                      : 'bg-red-500/20 text-red-600',
                  )}
                >
                  {selectedRitualIsMine
                    ? t('game.ritualOwnerMine')
                    : t('game.ritualOwnerOpponent')}
                </span>
              </div>
              {selectedRitualMeta?.description && (
                <p className="text-muted-foreground leading-snug">
                  {selectedRitualMeta.description}
                </p>
              )}
              <span
                className={cn(
                  'text-[10px] font-medium',
                  selectedRitual.usedThisTurn ? 'text-muted-foreground' : 'text-emerald-500',
                )}
              >
                {selectedRitual.usedThisTurn
                  ? t('game.ritualUsedThisTurn')
                  : t('game.ritualReady')}
              </span>
            </div>
          )}

          <div className="flex items-center justify-between">
            <div className="font-semibold">
              {t('game.selectedCell', { x: selectedBoardPosition.x, y: selectedBoardPosition.y })}
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={onMoveToSelected}>
                {t('game.moveToCell')}
              </Button>
              <Button size="sm" variant="outline" onClick={onUseRitualAtSelected}>
                {t('game.useRitual')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
