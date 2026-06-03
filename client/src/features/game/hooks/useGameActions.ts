import { toast } from 'sonner';
import type { BoardPosition } from '@/components/game/GameBoard';
import type { FoggedGameState, PlayerID } from '@/shared/types/game';
import type { PlayerActionPayload } from '@/shared/types/ws';
import type { GameCardMeta } from '@/shared/store/cardMetaStore';

type UseGameActionsParams = {
  fogged: FoggedGameState | null;
  myId: string | undefined;
  selectedBoardPosition: BoardPosition | null;
  playerPosition: BoardPosition;
  opponentPosition: BoardPosition;
  isMyTurn: (userId: PlayerID) => boolean;
  hasEnoughMana: (cost: number) => boolean;
  sendPlayerAction: (payload: PlayerActionPayload) => void;
  getCardMeta: (id: string) => GameCardMeta | undefined;
  setSelectedCardIndex: (index: number | null) => void;
};

type UseGameActionsResult = {
  handlePlayCard: (index: number) => void;
  handleEndTurn: () => void;
  handleMoveToSelected: () => void;
  handleUseRitualAtSelected: () => void;
};

export function useGameActions({
  fogged,
  myId,
  selectedBoardPosition,
  playerPosition,
  opponentPosition,
  isMyTurn,
  hasEnoughMana,
  sendPlayerAction,
  getCardMeta,
  setSelectedCardIndex,
}: UseGameActionsParams): UseGameActionsResult {
  const handlePlayCard = (index: number) => {
    if (!fogged) return;
    const handEntry = fogged.me.hand[index];
    if (!handEntry) return;

    if (!myId || !isMyTurn(myId)) {
      toast.error('현재 내 턴이 아니거나 행동할 수 없는 상태입니다.');
      return;
    }

    const meta = getCardMeta(handEntry.cardId);
    const manaCost = meta?.mana ?? 0;

    if (!hasEnoughMana(manaCost)) {
      toast.error('마나가 부족하여 카드를 사용할 수 없습니다.');
      return;
    }

    sendPlayerAction({ action: 'use_card', cardInstance: handEntry });

    setSelectedCardIndex(null);
    toast.info('카드 사용', {
      description: `${meta?.name ?? handEntry.id}을(를) 사용했습니다.`,
    });
  };

  const handleEndTurn = () => {
    if (!myId || !isMyTurn(myId)) {
      toast.error('현재 내 턴이 아니거나 행동할 수 없는 상태입니다.');
      return;
    }

    sendPlayerAction({ action: 'end_turn' });
  };

  const handleMoveToSelected = () => {
    if (!fogged || !myId || !selectedBoardPosition) return;
    if (!isMyTurn(myId)) {
      toast.error('현재 내 턴이 아니거나 행동할 수 없는 상태입니다.');
      return;
    }
    if (!hasEnoughMana(1)) {
      toast.error('마나가 부족하여 이동할 수 없습니다.');
      return;
    }

    const position = selectedBoardPosition;
    // 상대 마법사가 있는 칸으로는 이동 금지
    if (position.x === opponentPosition.x && position.y === opponentPosition.y) {
      toast.error('상대 마법사가 있는 칸으로는 이동할 수 없습니다.');
      return;
    }

    // 인접한 칸(상하좌우)만 허용
    const dx = Math.abs(playerPosition.x - position.x);
    const dy = Math.abs(playerPosition.y - position.y);
    const isAdjacent = (dx === 1 && dy === 0) || (dx === 0 && dy === 1);
    if (!isAdjacent) {
      toast.error('인접한 칸으로만 이동할 수 있습니다.');
      return;
    }

    sendPlayerAction({ action: 'move', to: [position.y, position.x] });
    toast.info('이동 시도', {
      description: `셀 (${position.x}, ${position.y})으로 이동을 시도합니다.`,
    });
  };

  const handleUseRitualAtSelected = () => {
    if (!fogged || !myId || !selectedBoardPosition) return;
    if (!isMyTurn(myId)) {
      toast.error('현재 내 턴이 아니거나 행동할 수 없는 상태입니다.');
      return;
    }

    const { x, y } = selectedBoardPosition;
    const r = y;
    const c = x;
    const ritual = fogged.board.rituals.find(
      (rt) => rt.owner === myId && rt.pos.r === r && rt.pos.c === c,
    );
    if (!ritual) {
      toast.error('선택한 칸에 내가 사용할 수 있는 마법진이 없습니다.');
      return;
    }

    // 서버 프로토콜은 확장 가능하므로 ritualId 필드를 함께 전송
    sendPlayerAction({ action: 'use_ritual', ritualId: ritual.id } as PlayerActionPayload);
    toast.info('마법진 사용', {
      description: `마법진 ${ritual.cardId}을(를) 사용했습니다.`,
    });
  };

  return {
    handlePlayCard,
    handleEndTurn,
    handleMoveToSelected,
    handleUseRitualAtSelected,
  };
}
