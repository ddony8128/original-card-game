import { toast } from 'sonner';
import i18n from '@/i18n';
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
      toast.error(i18n.t('game.toastErrCannotAct'));
      return;
    }

    const meta = getCardMeta(handEntry.cardId);
    const manaCost = meta?.mana ?? 0;

    if (!hasEnoughMana(manaCost)) {
      toast.error(i18n.t('game.toastErrNotEnoughManaCard'));
      return;
    }

    sendPlayerAction({ action: 'use_card', cardInstance: handEntry });

    setSelectedCardIndex(null);
    toast.info(i18n.t('game.toastCardUse'), {
      description: i18n.t('game.toastCardUseDesc', { name: meta?.name ?? handEntry.id }),
    });
  };

  const handleEndTurn = () => {
    if (!myId || !isMyTurn(myId)) {
      toast.error(i18n.t('game.toastErrCannotAct'));
      return;
    }

    sendPlayerAction({ action: 'end_turn' });
  };

  const handleMoveToSelected = () => {
    if (!fogged || !myId || !selectedBoardPosition) return;
    if (!isMyTurn(myId)) {
      toast.error(i18n.t('game.toastErrCannotAct'));
      return;
    }
    if (!hasEnoughMana(1)) {
      toast.error(i18n.t('game.toastErrNotEnoughManaMove'));
      return;
    }

    const position = selectedBoardPosition;
    // 상대 마법사가 있는 칸으로는 이동 금지
    if (position.x === opponentPosition.x && position.y === opponentPosition.y) {
      toast.error(i18n.t('game.toastErrMoveOnOpponent'));
      return;
    }

    // 인접한 칸(상하좌우)만 허용
    const dx = Math.abs(playerPosition.x - position.x);
    const dy = Math.abs(playerPosition.y - position.y);
    const isAdjacent = (dx === 1 && dy === 0) || (dx === 0 && dy === 1);
    if (!isAdjacent) {
      toast.error(i18n.t('game.toastErrMoveNotAdjacent'));
      return;
    }

    sendPlayerAction({ action: 'move', to: [position.y, position.x] });
    toast.info(i18n.t('game.toastMoveTry'), {
      description: i18n.t('game.toastMoveTryDesc', { x: position.x, y: position.y }),
    });
  };

  const handleUseRitualAtSelected = () => {
    if (!fogged || !myId || !selectedBoardPosition) return;
    if (!isMyTurn(myId)) {
      toast.error(i18n.t('game.toastErrCannotAct'));
      return;
    }

    const { x, y } = selectedBoardPosition;
    const r = y;
    const c = x;
    const ritual = fogged.board.rituals.find(
      (rt) => rt.owner === myId && rt.pos.r === r && rt.pos.c === c,
    );
    if (!ritual) {
      toast.error(i18n.t('game.toastErrNoRitual'));
      return;
    }

    // 서버 프로토콜은 확장 가능하므로 ritualId 필드를 함께 전송
    sendPlayerAction({ action: 'use_ritual', ritualId: ritual.id } as PlayerActionPayload);
    toast.info(i18n.t('game.toastRitualUse'), {
      description: i18n.t('game.toastRitualUseDesc', { cardId: ritual.cardId }),
    });
  };

  return {
    handlePlayCard,
    handleEndTurn,
    handleMoveToSelected,
    handleUseRitualAtSelected,
  };
}
