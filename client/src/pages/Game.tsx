import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { GameBoard, type BoardPosition } from '@/components/game/GameBoard';
import { GameHeader } from '@/components/game/GameHeader';
import { PlayerInfo } from '@/components/game/PlayerInfo';
import { DeckInfo, CatastropheDeckInfo } from '@/components/game/DeckInfo';
import { OpponentHand } from '@/components/game/OpponentHand';
import { GameLog } from '@/components/game/GameLog';
import { AnimationLayer, type SimpleAnimation } from '@/components/game/AnimationLayer';
import {
  RequestInputModal,
  type InputRequest,
  type InputOption,
} from '@/components/game/RequestInputModal';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowLeft, Play } from 'lucide-react';
import { toast } from 'sonner';
import { useMeQuery } from '@/features/auth/queries';
import { useGameFogStore } from '@/shared/store/gameStore';
import { useGameSocket } from '@/ws/useGameSocket';
import { useMulliganRequest } from '@/components/game/useMulliganRequest';
import { cn } from '@/shared/lib/utils';
import { useCardMetaStore } from '@/shared/store/cardMetaStore';

export default function Game() {
  const navigate = useNavigate();
  const { roomId } = useParams<{ roomId: string }>();
  const { data: me } = useMeQuery();
  const fogged = useGameFogStore((s) => s.fogged);
  const lastDiff = useGameFogStore((s) => s.lastDiff);
  const requestInput = useGameFogStore((s) => s.requestInput);
  const setRequestInput = useGameFogStore((s) => s.setRequestInput);
  const clearLastDiff = useGameFogStore((s) => s.clearLastDiff);
  const isMyTurn = useGameFogStore((s) => s.isMyTurn);
  const hasEnoughMana = useGameFogStore((s) => s.hasEnoughMana);
  const [selectedBoardPosition, setSelectedBoardPosition] = useState<BoardPosition | null>(null);
  const [selectedCardIndex, setSelectedCardIndex] = useState<number | null>(null);

  const {
    sendReady,
    sendAnswerMulligan,
    sendPlayerInput,
    sendPlayerAction,
    status: wsStatus,
  } = useGameSocket({
    roomId: roomId ?? '',
    userId: me?.id,
  });

  useEffect(() => {
    if (!me) {
      navigate('/login');
      return;
    }

    sendReady();
  }, [me, navigate, sendReady]);

  const myId = me?.id;

  const getCardMeta = useCardMetaStore((s) => s.getById);

  const { mulliganRequest, handleMulliganResponse, handleMulliganCancel } = useMulliganRequest({
    sendAnswerMulligan,
  });

  const handleBoardCellClick = (position: BoardPosition) => {
    setSelectedBoardPosition(position);
    if (!myId || !isMyTurn(myId)) {
      toast.error('현재 내 턴이 아니거나 행동할 수 없는 상태입니다.');
      return;
    }
    if (!hasEnoughMana(1)) {
      toast.error('마나가 부족하여 이동할 수 없습니다.');
      return;
    }

    sendPlayerAction({ action: 'move', to: [position.y, position.x] });
    toast.info('이동 시도', {
      description: `셀 (${position.x}, ${position.y})을 클릭했습니다.`,
    });
    console.log('sendPlayerAction', { action: 'move', to: [position.y, position.x] });
  };

  const handlePlayCard = (index: number) => {
    if (!fogged) return;
    const handEntry = fogged.me.hand[index];
    if (!handEntry) return;

    if (!myId || !isMyTurn(myId)) {
      toast.error('현재 내 턴이 아니거나 행동할 수 없는 상태입니다.');
      return;
    }

    const meta = getCardMeta(handEntry.id);
    const manaCost = meta?.mana ?? 0;

    if (!hasEnoughMana(manaCost)) {
      toast.error('마나가 부족하여 카드를 사용할 수 없습니다.');
      return;
    }

    sendPlayerAction({ action: 'use_card', cardId: handEntry.id });
    console.log('sendPlayerAction', { action: 'use_card', cardId: handEntry.id });

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
    console.log('sendPlayerAction', { action: 'end_turn' });
  };

  const myWizard = myId && fogged ? fogged.board.wizards[myId] : undefined;
  const opponentWizard =
    fogged && myId
      ? Object.entries(fogged.board.wizards).find(([id]) => id !== myId)?.[1]
      : undefined;

  if (!fogged) {
    return (
      <div className="from-background via-background to-accent/10 flex min-h-screen items-center justify-center bg-linear-to-br">
        <div className="text-center">
          <p className="text-muted-foreground mb-2 text-sm">게임 상태를 불러오는 중입니다.</p>
          <p className="text-muted-foreground text-xs">상대가 게임에 입장했는지 확인해주세요.</p>
        </div>
      </div>
    );
  }

  const playerPosition: BoardPosition = myWizard
    ? { x: myWizard.c, y: myWizard.r }
    : { x: 2, y: 4 };
  const opponentPosition: BoardPosition = opponentWizard
    ? { x: opponentWizard.c, y: opponentWizard.r }
    : { x: 2, y: 0 };

  const animations: SimpleAnimation[] =
    lastDiff?.animations?.map((anim) => {
      switch (anim.kind) {
        case 'draw':
          return { type: 'draw' };
        case 'damage':
          return {
            type: 'damage',
            value: typeof anim.amount === 'number' ? anim.amount : undefined,
          };
        case 'heal':
          return { type: 'heal', value: typeof anim.amount === 'number' ? anim.amount : undefined };
        case 'discard':
          return { type: 'discard' };
        case 'burn':
          return { type: 'burn' };
        case 'move':
          return { type: 'move' };
        case 'ritual_place':
          return { type: 'ritual_place' };
        case 'ritual_destroy':
          return { type: 'ritual_destroy' };
        case 'shuffle':
        default:
          return { type: 'shuffle' };
      }
    }) ?? [];

  const currentRequest: InputRequest | null = requestInput
    ? {
        type: requestInput.kind.startsWith('choose_')
          ? 'move'
          : requestInput.kind === 'choose_discard'
            ? 'discard'
            : requestInput.kind === 'choose_burn'
              ? 'burn'
              : requestInput.kind === 'select_install_position'
                ? 'ritual_placement'
                : 'target',
        prompt: `입력이 필요합니다: ${requestInput.kind}`,
        options: requestInput.options as InputOption[],
      }
    : null;

  const activeRequest = mulliganRequest ?? currentRequest;

  return (
    <div className="from-background via-background to-accent/10 min-h-screen bg-linear-to-br p-4">
      <div className="mx-auto max-w-7xl space-y-4">
        {/* Top Bar: navigation + WS status */}
        <div className="flex items-center justify-between">
          <Button variant="outline" onClick={() => navigate('/lobby')}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            로비
          </Button>
          <div className="text-muted-foreground min-w-[200px] text-right text-xs">
            WS 상태: {wsStatus}
          </div>
          <div className="text-muted-foreground text-sm">방 코드: {roomId ?? '-'}</div>
        </div>

        {/* Turn Header */}
        <GameHeader turn={fogged.turn} isMyTurn={Boolean(myId && fogged.activePlayer === myId)} />

        {/* Opponent Info */}
        <div className="grid grid-cols-3 gap-4">
          <PlayerInfo
            hp={fogged.opponent.hp}
            maxHp={fogged.opponent.hp}
            mana={fogged.opponent.mana}
            maxMana={fogged.opponent.maxMana}
            label="상대"
          />
          <div className="flex flex-col justify-center">
            <div className="text-muted-foreground mb-2 text-center text-xs">
              상대 손패 ({fogged.opponent.handCount}장)
            </div>
            <OpponentHand cardCount={fogged.opponent.handCount} />
          </div>
          <DeckInfo
            deckCount={fogged.opponent.deckCount}
            graveCount={fogged.opponent.graveCount}
            label="상대 덱"
          />
        </div>

        {/* Shared Catastrophe Deck */}
        <CatastropheDeckInfo
          deckCount={fogged.catastrophe.deckCount}
          graveCount={fogged.catastrophe.graveCount}
        />

        {/* Game Board */}
        <div className="flex justify-center">
          <GameBoard
            playerPosition={playerPosition}
            opponentPosition={opponentPosition}
            selectedPosition={selectedBoardPosition}
            onCellClick={handleBoardCellClick}
          />
        </div>

        {/* Player Info + Logs + My Deck */}
        <div className="grid grid-cols-3 gap-4">
          <PlayerInfo
            hp={fogged.me.hp}
            maxHp={fogged.me.hp}
            mana={fogged.me.mana}
            maxMana={fogged.me.maxMana}
            label="나"
          />
          <GameLog logs={fogged.lastActions} />
          <DeckInfo
            deckCount={fogged.me.deckCount}
            graveCount={fogged.me.graveCount}
            label="내 덱"
          />
        </div>

        {/* My Hand */}
        <Card>
          <CardContent className="pt-6">
            <div className="mb-3 flex items-center justify-between">
              <div className="text-sm font-medium">내 손패 ({fogged.me.hand.length}장)</div>
              <Button
                size="sm"
                variant="secondary"
                onClick={handleEndTurn}
                disabled={!myId || !isMyTurn(myId)}
              >
                턴 종료
              </Button>
            </div>

            {fogged.me.hand.length === 0 ? (
              <div className="text-muted-foreground py-8 text-center text-xs">
                손패가 비어 있습니다.
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-6">
                {fogged.me.hand.map((handEntry, index) => {
                  const meta = getCardMeta(handEntry.id);
                  const displayName = meta?.name ?? handEntry.id;
                  const mana = meta?.mana ?? 0;
                  const description = meta?.description ?? '';

                  return (
                    <div key={handEntry.id} className="relative">
                      <button
                        type="button"
                        onClick={() =>
                          setSelectedCardIndex(selectedCardIndex === index ? null : index)
                        }
                        className={cn(
                          'bg-card text-card-foreground w-full cursor-pointer rounded-lg border p-3 text-left shadow-sm transition-all hover:scale-105 hover:shadow-lg',
                          selectedCardIndex === index && 'ring-primary scale-105 ring-2',
                        )}
                      >
                        <div className="mb-2 flex items-center justify-between">
                          <span className="text-xs font-semibold">{displayName}</span>
                          <span className="bg-primary text-primary-foreground flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold">
                            {mana}
                          </span>
                        </div>
                        <p className="text-muted-foreground line-clamp-3 text-[11px]">
                          {description}
                        </p>
                      </button>

                      {selectedCardIndex === index && (
                        <div className="pointer-events-none absolute right-0 -bottom-3 left-0 flex justify-center">
                          <Button
                            size="sm"
                            className="pointer-events-auto h-7 px-2 text-[11px]"
                            onClick={(e) => {
                              e.stopPropagation();
                              handlePlayCard(index);
                            }}
                          >
                            <Play className="mr-1 h-3 w-3" />
                            사용
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <AnimationLayer
        animations={animations}
        onAnimationComplete={() => {
          clearLastDiff();
        }}
      />
      <RequestInputModal
        request={activeRequest}
        onResponse={(response) => {
          if (!activeRequest) return;
          if (activeRequest.type === 'mulligan') {
            handleMulliganResponse(response);
          } else {
            // 일반 request_input 응답
            sendPlayerInput({ answer: response });
            setRequestInput(null);
          }
        }}
        onCancel={() => {
          if (!activeRequest) return;
          if (activeRequest.type === 'mulligan') {
            handleMulliganCancel();
          } else {
            setRequestInput(null);
          }
        }}
      />
    </div>
  );
}
