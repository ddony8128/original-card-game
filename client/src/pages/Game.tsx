import { useState, useEffect, useMemo } from 'react';
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
import { DiscardPileModal } from '@/components/game/DiscardPileModal';
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
import type { PlayerActionPayload, RequestInputKind, RequestInputPayload } from '@/shared/types/ws';
import type { CardInstance } from '@/shared/types/game';

export default function Game() {
  const navigate = useNavigate();
  const { roomId: roomCode } = useParams<{ roomId: string }>();
  const { data: me } = useMeQuery();
  const fogged = useGameFogStore((s) => s.fogged);
  const lastDiff = useGameFogStore((s) => s.lastDiff);
  const logs = useGameFogStore((s) => s.logs);
  const requestInput = useGameFogStore((s) => s.requestInput);
  const setRequestInput = useGameFogStore((s) => s.setRequestInput);
  const clearLastDiff = useGameFogStore((s) => s.clearLastDiff);
  const isMyTurn = useGameFogStore((s) => s.isMyTurn);
  const hasEnoughMana = useGameFogStore((s) => s.hasEnoughMana);
  const [selectedBoardPosition, setSelectedBoardPosition] = useState<BoardPosition | null>(null);
  const [selectedCardIndex, setSelectedCardIndex] = useState<number | null>(null);
  const [graveModalOpen, setGraveModalOpen] = useState(false);
  const [graveModalType, setGraveModalType] = useState<'me' | 'opponent' | 'catastrophe' | null>(
    null,
  );

  const { sendReady, sendAnswerMulligan, sendPlayerInput, sendPlayerAction } = useGameSocket({
    roomCode: roomCode ?? '',
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

  // diff.log 기반 클라이언트 로그를 "나/상대" 시점으로 변환
  const perspectiveLogs = useMemo(() => {
    if (!logs || !fogged) return [];
    const boardWizards = fogged.board.wizards;
    const opponentId =
      myId && fogged ? Object.keys(boardWizards).find((id) => id !== myId) : undefined;

    return logs.map((log) => {
      let text = log.text;
      if (myId) {
        text = text.replaceAll(`플레이어 ${myId}`, '나');
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

    // 2) 일반 상황에서는 클릭으로 "선택"만 하고, 실제 이동/리추얼 사용은 아래 패널 버튼으로 처리
  };

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
    console.log('sendPlayerAction', { action: 'use_card', cardInstance: handEntry });

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
    console.log('sendPlayerAction', { action: 'move', to: [position.y, position.x] });
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
      toast.error('선택한 칸에 내가 사용할 수 있는 리추얼이 없습니다.');
      return;
    }

    // 서버 프로토콜은 확장 가능하므로 ritualId 필드를 함께 전송
    sendPlayerAction({ action: 'use_ritual', ritualId: ritual.id } as PlayerActionPayload);
    toast.info('리추얼 사용', {
      description: `리추얼 ${ritual.cardId}을(를) 사용했습니다.`,
    });
    console.log('sendPlayerAction', { action: 'use_ritual', ritualId: ritual.id });
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

  // option 타입 request_input 만 모달로 표시 (map/text 는 모달 사용 안 함)
  const currentRequest: InputRequest | null =
    optionRequest && optionRequest.kind.type === 'option'
      ? (() => {
          const kind = optionRequest.kind;
          const kindId = kind.kind;

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

          return {
            type,
            prompt: `입력이 필요합니다: ${kindId}`,
            options,
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
        <div className="grid grid-cols-3 gap-4">
          <PlayerInfo
            hp={fogged.opponent.hp}
            maxHp={fogged.opponent.maxHp}
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
            grave={fogged.opponent.grave}
            label="상대 덱"
            onViewGrave={() => handleViewGrave('opponent')}
          />
        </div>

        {/* Shared Catastrophe Deck */}
        <CatastropheDeckInfo
          deckCount={fogged.catastrophe.deckCount}
          graveCount={fogged.catastrophe.graveCount}
          grave={fogged.catastrophe.grave}
          onViewGrave={() => handleViewGrave('catastrophe')}
        />

        {/* Game Board */}
        <div className="flex flex-col items-center gap-2">
          <GameBoard
            playerPosition={playerPosition}
            opponentPosition={opponentPosition}
            selectedPosition={selectedBoardPosition}
            highlightPositions={mapHighlightPositions}
            rituals={fogged.board.rituals.map((r) => {
              const meta = getCardMeta(r.cardId);
              return {
                x: r.pos.c,
                y: r.pos.r,
                name: meta?.name ?? r.cardId,
                description: meta?.description,
                isMine: myId ? r.owner === myId : false,
              };
            })}
            onCellClick={handleBoardCellClick}
          />

          {selectedBoardPosition && (
            <div className="bg-card text-card-foreground flex w-full max-w-md items-center justify-between rounded-lg border px-3 py-2 text-xs shadow-sm">
              <div>
                <div className="font-semibold">
                  선택한 칸: ({selectedBoardPosition.x}, {selectedBoardPosition.y})
                </div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={handleMoveToSelected}>
                  이 칸으로 이동
                </Button>
                <Button size="sm" variant="outline" onClick={handleUseRitualAtSelected}>
                  리추얼 사용
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Player Info + Logs + My Deck */}
        <div className="grid grid-cols-3 gap-4">
          <PlayerInfo
            hp={fogged.me.hp}
            maxHp={fogged.me.maxHp}
            mana={fogged.me.mana}
            maxMana={fogged.me.maxMana}
            label="나"
          />
          <GameLog logs={perspectiveLogs} />
          <DeckInfo
            deckCount={fogged.me.deckCount}
            graveCount={fogged.me.graveCount}
            grave={fogged.me.grave}
            label="내 덱"
            onViewGrave={() => handleViewGrave('me')}
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
                  const meta = getCardMeta(handEntry.cardId);
                  const displayName = meta?.name ?? handEntry.cardId;
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
      <DiscardPileModal
        open={graveModalOpen}
        onOpenChange={setGraveModalOpen}
        cards={graveCards}
        title={graveModalTitle}
      />

      {isGameOver && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
          <div className="bg-card text-card-foreground border-primary/60 shadow-primary/40 mx-4 max-w-md rounded-2xl border p-8 text-center shadow-2xl">
            <div className="mb-4 text-4xl font-extrabold tracking-tight">
              {isWin && (
                <span className="text-emerald-400 drop-shadow-[0_0_15px_rgba(16,185,129,0.8)]">
                  승리!
                </span>
              )}
              {isLose && (
                <span className="text-rose-400 drop-shadow-[0_0_15px_rgba(244,63,94,0.8)]">
                  패배…
                </span>
              )}
              {!isWin && !isLose && (
                <span className="text-amber-300 drop-shadow-[0_0_15px_rgba(252,211,77,0.8)]">
                  무승부
                </span>
              )}
            </div>
            <p className="text-muted-foreground mb-6 text-sm">
              치열한 한 판이 끝났습니다. 로비로 돌아가서 다음 게임을 준비해 주세요.
            </p>
            <Button
              size="lg"
              className="bg-primary text-primary-foreground w-full animate-pulse font-semibold"
              onClick={() => navigate('/lobby')}
            >
              로비로 돌아가기
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
