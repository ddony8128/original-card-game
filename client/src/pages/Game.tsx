import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { type BoardPosition } from '@/components/game/GameBoard';
import { GameHeader } from '@/components/game/GameHeader';
import { OpponentZone } from '@/components/game/OpponentZone';
import { BoardZone } from '@/components/game/BoardZone';
import { PlayerZone } from '@/components/game/PlayerZone';
import { MyHand } from '@/components/game/MyHand';
import { GameOverOverlay } from '@/components/game/GameOverOverlay';
import { AnimationLayer, type SimpleAnimation } from '@/components/game/AnimationLayer';
import {
  RequestInputModal,
  type InputRequest,
  type InputOption,
} from '@/components/game/RequestInputModal';
import { DiscardPileModal } from '@/components/game/DiscardPileModal';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { useMeQuery } from '@/features/auth/queries';
import { useDecksQuery } from '@/features/decks/queries';
import { useGameFogStore } from '@/shared/store/gameStore';
import { useGameSocket } from '@/ws/useGameSocket';
import { useMulliganRequest } from '@/features/game/hooks/useMulliganRequest';
import { useGameActions } from '@/features/game/hooks/useGameActions';
import { useBeforeUnloadWarning } from '@/shared/hooks/useBeforeUnloadWarning';
import { useCardMetaStore } from '@/shared/store/cardMetaStore';
import type { RequestInputKind, RequestInputPayload } from '@/shared/types/ws';
import type { CardInstance } from '@/shared/types/game';

interface GameProps {
  solo?: boolean;
}

export default function Game({ solo = false }: GameProps) {
  const navigate = useNavigate();
  const { roomId: roomCode } = useParams<{ roomId: string }>();
  const { data: me } = useMeQuery();
  const { data: decks, isLoading: decksLoading } = useDecksQuery();
  const soloDeckId = solo ? decks?.[0]?.id : undefined;
  const fogged = useGameFogStore((s) => s.fogged);
  const lastDiff = useGameFogStore((s) => s.lastDiff);
  const logs = useGameFogStore((s) => s.logs);
  const requestInput = useGameFogStore((s) => s.requestInput);
  const setRequestInput = useGameFogStore((s) => s.setRequestInput);
  const clearLastDiff = useGameFogStore((s) => s.clearLastDiff);
  const isMyTurn = useGameFogStore((s) => s.isMyTurn);
  const hasEnoughMana = useGameFogStore((s) => s.hasEnoughMana);
  const clearGameState = useGameFogStore((s) => s.clear);
  const [selectedBoardPosition, setSelectedBoardPosition] = useState<BoardPosition | null>(null);
  const [selectedCardIndex, setSelectedCardIndex] = useState<number | null>(null);
  const [graveModalOpen, setGraveModalOpen] = useState(false);
  const [graveModalType, setGraveModalType] = useState<'me' | 'opponent' | 'catastrophe' | null>(
    null,
  );

  // 페이지 진입 시 전역 게임 상태 초기화
  useEffect(() => {
    clearGameState();
  }, [clearGameState]);

  const { sendReady, sendAnswerMulligan, sendPlayerInput, sendPlayerAction } = useGameSocket({
    roomCode: solo ? 'solo' : (roomCode ?? ''),
    userId: me?.id,
    mode: solo ? 'solo' : 'game',
    deckId: soloDeckId,
    // 솔로 모드는 덱 id 가 준비된 뒤에만 연결해 start_solo 에 올바른 덱을 전달한다.
    enabled: solo ? Boolean(soloDeckId) : true,
  });

  // 솔로 모드에서 사용할 덱이 없으면 덱 빌더로 안내한다.
  useEffect(() => {
    if (!solo || decksLoading) return;
    if (!decks || decks.length === 0) {
      toast.error('덱을 먼저 만들어주세요');
      navigate('/deck-builder');
    }
  }, [solo, decks, decksLoading, navigate]);

  useEffect(() => {
    if (!me) {
      navigate('/login');
      return;
    }

    // 솔로 모드는 소켓 open 시 start_solo 를 자동 전송하므로 ready 를 보내지 않는다.
    if (solo) return;

    sendReady();
  }, [me, navigate, sendReady, solo]);

  const myId = me?.id;

  const getCardMeta = useCardMetaStore((s) => s.getById);

  const { mulliganRequest, handleMulliganResponse, handleMulliganCancel } = useMulliganRequest({
    sendAnswerMulligan,
  });

  // diff.log 기반 클라이언트 로그를 "나/상대" 시점으로 변환
  const perspectiveLogs = useMemo(() => {
    if (!logs || !fogged) return [];
    const boardWizards = fogged.board.wizards;
    const opponentId =
      myId && fogged ? Object.keys(boardWizards).find((id) => id !== myId) : undefined;

    return logs.map((log) => {
      let text = log.text;
      if (myId) {
        text = text.replaceAll(`플레이어 ${myId}`, '내');
      }
      if (opponentId) {
        text = text.replaceAll(`플레이어 ${opponentId}`, '상대');
      }
      return { ...log, text };
    });
  }, [logs, myId, fogged]);

  // ---- request_input 해석 ----

  const isMapRequest = (
    kind: RequestInputKind,
  ): kind is Extract<RequestInputKind, { type: 'map' }> => kind.type === 'map';

  const isOptionRequest = (
    kind: RequestInputKind,
  ): kind is Extract<RequestInputKind, { type: 'option' }> => kind.type === 'option';

  const mapRequest: RequestInputPayload | null =
    requestInput && isMapRequest(requestInput.kind) ? requestInput : null;

  const optionRequest: RequestInputPayload | null =
    requestInput && isOptionRequest(requestInput.kind) ? requestInput : null;

  // map 타입 요청일 때, 서버가 내려준 좌표 목록을 보드 기준 (x, y) 로 변환
  const mapHighlightPositions: BoardPosition[] =
    mapRequest?.options
      ?.map((opt) => {
        if (opt && typeof opt === 'object') {
          const o = opt as Record<string, unknown>;
          if (typeof o.x === 'number' && typeof o.y === 'number') {
            return { x: o.x, y: o.y } as BoardPosition;
          }
          if (typeof o.r === 'number' && typeof o.c === 'number') {
            // 서버는 { r, c } (행, 열) 기준으로 내려주므로 보드 좌표로 변환
            return { x: o.c, y: o.r } as BoardPosition;
          }
        }
        return null;
      })
      .filter((p): p is BoardPosition => p !== null) ?? [];

  const handleBoardCellClick = (position: BoardPosition) => {
    setSelectedBoardPosition(position);

    // 1) map 타입 request_input 처리: 하이라이트된 칸만 선택 허용
    if (mapRequest) {
      const isAllowed = mapHighlightPositions.some((p) => p.x === position.x && p.y === position.y);
      if (!isAllowed) return;

      // 서버는 viewer 기준 { r, c } 또는 [r, c] 를 허용한다. 여기서는 [r, c] 형태로 보낸다.
      const answer: [number, number] = [position.y, position.x];
      sendPlayerInput({ answer });
      setRequestInput(null);
      return;
    }

    // 2) 일반 상황에서는 클릭으로 "선택"만 하고, 실제 이동/마법진 사용은 아래 패널 버튼으로 처리
  };

  // 묘지 카드를 DeckCard 형태로 변환
  const convertGraveToDeckCards = useMemo(
    () => (grave: CardInstance[] | undefined) => {
      if (!grave) return [];
      return grave.map((instance) => {
        const meta = getCardMeta(instance.cardId);
        if (!meta) {
          return {
            id: instance.cardId,
            name_dev: '',
            name_ko: instance.cardId,
            description_ko: '',
            type: 'instant' as const,
            mana: null,
            count: 1,
          };
        }
        return {
          id: instance.cardId,
          name_dev: meta.name || '',
          name_ko: meta.name,
          description_ko: meta.description || '',
          type: meta.type,
          mana: meta.mana,
          count: 1,
        };
      });
    },
    [getCardMeta],
  );

  const handleViewGrave = (type: 'me' | 'opponent' | 'catastrophe') => {
    setGraveModalType(type);
    setGraveModalOpen(true);
  };

  const graveCards = useMemo(() => {
    if (!graveModalType || !fogged) return [];
    switch (graveModalType) {
      case 'me':
        return convertGraveToDeckCards(fogged.me.grave);
      case 'opponent':
        return convertGraveToDeckCards(fogged.opponent.grave);
      case 'catastrophe':
        return convertGraveToDeckCards(fogged.catastrophe.grave);
      default:
        return [];
    }
  }, [graveModalType, fogged, convertGraveToDeckCards]);

  const myWizard = myId && fogged ? fogged.board.wizards[myId] : undefined;
  const opponentWizard =
    fogged && myId
      ? Object.entries(fogged.board.wizards).find(([id]) => id !== myId)?.[1]
      : undefined;

  const isGameOver = fogged?.phase === 'GAME_OVER';
  const isWin = myId && fogged?.winner === myId;
  const isLose = myId && fogged?.winner && fogged.winner !== myId;

  const playerPosition: BoardPosition = myWizard
    ? { x: myWizard.c, y: myWizard.r }
    : { x: 2, y: 4 };
  const opponentPosition: BoardPosition = opponentWizard
    ? { x: opponentWizard.c, y: opponentWizard.r }
    : { x: 2, y: 0 };

  const { handlePlayCard, handleEndTurn, handleMoveToSelected, handleUseRitualAtSelected } =
    useGameActions({
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
    });

  useBeforeUnloadWarning(!!fogged && fogged.phase !== 'GAME_OVER');

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

  const animations: SimpleAnimation[] =
    lastDiff?.animations?.map((anim) => {
      switch (anim.kind) {
        case 'draw':
          return { type: 'draw' };
        case 'damage':
          return {
            type: 'damage',
            value: typeof anim.amount === 'number' ? anim.amount : undefined,
            side: anim.player === myId ? 'me' : 'opponent',
          };
        case 'heal':
          return {
            type: 'heal',
            value: typeof anim.amount === 'number' ? anim.amount : undefined,
            side: anim.player === myId ? 'me' : 'opponent',
          };
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

  // option 타입 request_input 만 모달로 표시 (map/text 는 모달 사용 안 함)
  const currentRequest: InputRequest | null =
    optionRequest && optionRequest.kind.type === 'option'
      ? (() => {
          const kind = optionRequest.kind;
          const kindId = kind.kind;
          const count = optionRequest.count ?? 1;

          let type: InputRequest['type'];
          switch (kindId) {
            case 'choose_discard':
              type = 'discard';
              break;
            case 'choose_burn':
              type = 'burn';
              break;
            default:
              type = 'target';
          }

          // 카드 선택 계열 요청(choose_discard / choose_burn)은
          // 카드 메타 정보를 붙여서 모달에 사람이 읽을 수 있는 텍스트가 보이도록 가공
          let options: InputOption[] = optionRequest.options as InputOption[];
          if (kindId === 'choose_discard' || kindId === 'choose_burn') {
            options = (optionRequest.options as CardInstance[]).map((inst) => {
              const meta = getCardMeta(inst.cardId);
              return {
                ...inst,
                name: meta?.name ?? inst.cardId,
                mana: meta?.mana,
                description: meta?.description,
              } as InputOption;
            });
          }

          // ----- 선택해야 하는 장수(min/max) 및 안내 문구 구성 -----
          const totalOptions = options.length;
          let minSelect: number | undefined;
          let maxSelect: number | undefined;
          let prompt: string;

          if (kindId === 'choose_discard' || kindId === 'choose_burn') {
            if (totalOptions >= count) {
              // 선택지가 충분하면 정확히 count 장 선택
              minSelect = count;
              maxSelect = count;
              prompt =
                type === 'discard'
                  ? `버릴 카드를 ${count}장 선택하세요.`
                  : `소멸(burn)할 카드를 ${count}장 선택하세요.`;
            } else {
              // 선택지가 부족하면 "모두 선택"해야 진행 가능
              minSelect = totalOptions;
              maxSelect = totalOptions;
              prompt =
                type === 'discard'
                  ? `버릴 수 있는 카드는 ${totalOptions}장뿐입니다. 모든 카드를 선택하면 진행됩니다.`
                  : `소멸(burn)할 수 있는 카드는 ${totalOptions}장뿐입니다. 모든 카드를 선택하면 진행됩니다.`;
            }
          } else {
            // 일반 option 입력: 기본적으로 1개 선택
            minSelect = 1;
            maxSelect = 1;
            prompt = `입력이 필요합니다: ${kindId}`;
          }

          return {
            type,
            prompt,
            options,
            minSelect,
            maxSelect,
          };
        })()
      : null;

  const activeRequest = mulliganRequest ?? currentRequest;

  const graveModalTitle =
    graveModalType === 'me'
      ? '내 버린 카드'
      : graveModalType === 'opponent'
        ? '상대 버린 카드'
        : '재앙 덱 버린 카드';

  return (
    <div className="from-background via-background to-accent/10 min-h-screen bg-linear-to-br p-4">
      <div className="mx-auto max-w-7xl space-y-4">
        {/* Top Bar: navigation */}
        <div className="flex items-center justify-between">
          <Button variant="outline" onClick={() => navigate('/lobby')}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            로비
          </Button>
        </div>

        {/* Turn Header */}
        <GameHeader turn={fogged.turn} isMyTurn={Boolean(myId && fogged.activePlayer === myId)} />

        {/* Opponent Info */}
        <OpponentZone
          opponent={fogged.opponent}
          catastrophe={fogged.catastrophe}
          onViewGrave={handleViewGrave}
        />

        {/* Game Board */}
        <BoardZone
          playerPosition={playerPosition}
          opponentPosition={opponentPosition}
          selectedBoardPosition={selectedBoardPosition}
          mapHighlightPositions={mapHighlightPositions}
          rituals={fogged.board.rituals}
          getCardMeta={getCardMeta}
          myId={myId}
          onCellClick={handleBoardCellClick}
          onMoveToSelected={handleMoveToSelected}
          onUseRitualAtSelected={handleUseRitualAtSelected}
        />

        {/* Player Info + Logs + My Deck */}
        <PlayerZone me={fogged.me} perspectiveLogs={perspectiveLogs} onViewGrave={handleViewGrave} />

        {/* My Hand */}
        <MyHand
          hand={fogged.me.hand}
          getCardMeta={getCardMeta}
          selectedCardIndex={selectedCardIndex}
          onSelectCard={(index) =>
            setSelectedCardIndex(selectedCardIndex === index ? null : index)
          }
          onPlayCard={handlePlayCard}
          onEndTurn={handleEndTurn}
          isMyTurn={isMyTurn}
          myId={myId}
          canAfford={hasEnoughMana}
        />
      </div>

      <AnimationLayer
        animations={animations}
        onAnimationComplete={() => {
          clearLastDiff();
        }}
      />
      <RequestInputModal
        request={activeRequest}
        dismissible={activeRequest?.type === 'mulligan'}
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
      <DiscardPileModal
        open={graveModalOpen}
        onOpenChange={setGraveModalOpen}
        cards={graveCards}
        title={graveModalTitle}
      />

      {isGameOver && (
        <GameOverOverlay
          isWin={Boolean(isWin)}
          isLose={Boolean(isLose)}
          onReview={() => navigate('/review')}
          onLobby={() => navigate('/lobby')}
        />
      )}
    </div>
  );
}
