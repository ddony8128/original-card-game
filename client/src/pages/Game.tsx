import { useState, useEffect, useMemo } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { useLangNavigate } from '@/i18n/nav';
import { useQueryClient } from '@tanstack/react-query';
import { type BoardPosition } from '@/components/game/GameBoard';
import { GameHeader } from '@/components/game/GameHeader';
import { BoardZone } from '@/components/game/BoardZone';
import { StatBar } from '@/components/game/StatBar';
import { OpponentHand } from '@/components/game/OpponentHand';
import { CatastropheDeckInfo } from '@/components/game/DeckInfo';
import { GameLog } from '@/components/game/GameLog';
import { MyHand } from '@/components/game/MyHand';
import { GameOverOverlay } from '@/components/game/GameOverOverlay';
import { AnimationLayer, type SimpleAnimation } from '@/components/game/AnimationLayer';
import { CardPlaySpotlight } from '@/components/game/CardPlaySpotlight';
import { EventBanner } from '@/components/game/EventBanner';
import {
  RequestInputModal,
  type InputRequest,
  type InputOption,
} from '@/components/game/RequestInputModal';
import { DiscardPileModal } from '@/components/game/DiscardPileModal';
import { Button } from '@/components/ui/button';
import { ArrowLeft, HelpCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { GlossaryModal } from '@/components/glossary/GlossaryModal';
import { toast } from 'sonner';
import { useMeQuery } from '@/features/auth/queries';
import { useDecksQuery } from '@/features/decks/queries';
import { useGameFogStore } from '@/shared/store/gameStore';
import { useGameSocket } from '@/ws/useGameSocket';
import { useMulliganRequest } from '@/features/game/hooks/useMulliganRequest';
import { useGameActions } from '@/features/game/hooks/useGameActions';
import { useBeforeUnloadWarning } from '@/shared/hooks/useBeforeUnloadWarning';
import { useCardMetaStore } from '@/shared/store/cardMetaStore';
import { pveProgressQueryKey } from '@/features/pve/queries';
import type { RequestInputKind, RequestInputPayload, SoloSpeed } from '@/shared/types/ws';
import type { CardInstance } from '@/shared/types/game';

const SOLO_SPEED_KEY = 'soloSpeed';
const SOLO_SPEEDS: SoloSpeed[] = ['slow', 'normal', 'fast'];

function readStoredSoloSpeed(): SoloSpeed {
  if (typeof window === 'undefined') return 'normal';
  const stored = window.localStorage.getItem(SOLO_SPEED_KEY);
  return SOLO_SPEEDS.includes(stored as SoloSpeed) ? (stored as SoloSpeed) : 'normal';
}

interface GameProps {
  solo?: boolean;
  /** 설정 시 PvE 모드로 solo 게임을 시작한다(해당 stageId 의 AI 와 대전). */
  pveStageId?: string;
}

export default function Game({ solo = false, pveStageId }: GameProps) {
  const navigate = useLangNavigate();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { roomId: roomCode } = useParams<{ roomId: string }>();
  const [searchParams] = useSearchParams();
  const { data: me } = useMeQuery();
  const { data: decks, isLoading: decksLoading } = useDecksQuery();
  // PvE 도 튜토리얼과 동일하게 solo 연결 경로를 사용한다.
  const isSolo = solo || Boolean(pveStageId);
  // 튜토리얼 모드(solo && !pveStageId)는 회원가입 시 제공되는 기본 덱 "기본 덱"으로 진행한다.
  const isTutorial = solo && !pveStageId;
  // PvE 는 스테이지 선택 화면에서 고른 덱을 ?deck= 쿼리로 전달받는다.
  // 누락/무효한 경우 첫 번째 덱으로 폴백한다(하위 호환).
  const requestedDeckId = searchParams.get('deck');
  const pveDeckId =
    requestedDeckId && decks?.some((d) => d.id === requestedDeckId)
      ? requestedDeckId
      : decks?.[0]?.id;
  const soloDeckId = isSolo
    ? isTutorial
      ? (decks?.find((d) => d.name === '기본 덱')?.id ?? decks?.[0]?.id)
      : pveDeckId
    : undefined;
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
  const [glossaryOpen, setGlossaryOpen] = useState(false);
  const [graveModalType, setGraveModalType] = useState<'me' | 'opponent' | 'catastrophe' | null>(
    null,
  );
  // 솔로 AI 턴 속도. localStorage 에 영속화하며, 게임 시작 시 start_solo 로 전달된다.
  const [soloSpeed, setSoloSpeed] = useState<SoloSpeed>(() => readStoredSoloSpeed());

  // 페이지 진입 시 전역 게임 상태 초기화
  useEffect(() => {
    clearGameState();
  }, [clearGameState]);

  const { sendReady, sendAnswerMulligan, sendPlayerInput, sendPlayerAction, sendSetSpeed } =
    useGameSocket({
      roomCode: isSolo ? 'solo' : (roomCode ?? ''),
      userId: me?.id,
      mode: isSolo ? 'solo' : 'game',
      deckId: soloDeckId,
      // pveStageId 가 있으면 pve, 없으면(튜토리얼) 기존대로 tutorial.
      soloMode: pveStageId ? 'pve' : undefined,
      stageId: pveStageId,
      // 솔로 모드에서만 AI 턴 속도를 게임 시작 시 함께 전달한다.
      aiSpeed: isSolo ? soloSpeed : undefined,
      // 솔로 모드는 덱 id 가 준비된 뒤에만 연결해 start_solo 에 올바른 덱을 전달한다.
      enabled: isSolo ? Boolean(soloDeckId) : true,
    });

  // 속도 변경: state + localStorage 갱신 후 진행 중인 게임에 실시간 반영한다.
  const handleChangeSoloSpeed = (next: SoloSpeed) => {
    setSoloSpeed(next);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(SOLO_SPEED_KEY, next);
    }
    sendSetSpeed(next);
  };

  // 솔로 모드에서 사용할 덱이 없으면 덱 빌더로 안내한다.
  useEffect(() => {
    if (!isSolo || decksLoading) return;
    if (!decks || decks.length === 0) {
      toast.error(t('game.needDeck'));
      navigate('/deck-builder');
    }
  }, [isSolo, decks, decksLoading, navigate, t]);

  useEffect(() => {
    if (!me) {
      navigate('/login');
      return;
    }

    // 솔로 모드는 소켓 open 시 start_solo 를 자동 전송하므로 ready 를 보내지 않는다.
    if (isSolo) return;

    sendReady();
  }, [me, navigate, sendReady, isSolo]);

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
        text = text.replaceAll(`플레이어 ${myId}`, t('game.logSelf'));
      }
      if (opponentId) {
        text = text.replaceAll(`플레이어 ${opponentId}`, t('game.logOpponent'));
      }
      return { ...log, text };
    });
  }, [logs, myId, fogged, t]);

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
            name_en: instance.cardId,
            description_ko: '',
            description_en: '',
            type: 'instant' as const,
            mana: null,
            count: 1,
          };
        }
        // getCardMeta 는 이미 현재 언어로 name/description 을 해석해 돌려준다.
        // GameCard 가 언어별 필드를 보더라도 동일 값이 보이도록 양쪽에 채운다.
        return {
          id: instance.cardId,
          name_dev: meta.name || '',
          name_ko: meta.name,
          name_en: meta.name,
          description_ko: meta.description || '',
          description_en: meta.description || '',
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

  // PvE 게임이 끝나면(특히 승리 시 서버가 클리어를 기록하므로) 진행도 캐시를 무효화해
  // 스테이지 선택/뱃지가 최신 상태로 갱신되게 한다.
  useEffect(() => {
    if (pveStageId && fogged?.phase === 'GAME_OVER') {
      queryClient.invalidateQueries({ queryKey: pveProgressQueryKey });
    }
  }, [pveStageId, fogged?.phase, queryClient]);

  useBeforeUnloadWarning(!!fogged && fogged.phase !== 'GAME_OVER');

  if (!fogged) {
    return (
      <div className="from-background via-background to-accent/10 flex min-h-screen items-center justify-center bg-linear-to-br">
        <div className="text-center">
          <p className="text-muted-foreground mb-2 text-sm">{t('game.loadingState')}</p>
          <p className="text-muted-foreground text-xs">{t('game.loadingStateHint')}</p>
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
                  ? t('game.promptDiscardCount', { count })
                  : t('game.promptBurnCount', { count });
            } else {
              // 선택지가 부족하면 "모두 선택"해야 진행 가능
              minSelect = totalOptions;
              maxSelect = totalOptions;
              prompt =
                type === 'discard'
                  ? t('game.promptDiscardAll', { count: totalOptions })
                  : t('game.promptBurnAll', { count: totalOptions });
            }
          } else {
            // 일반 option 입력: 기본적으로 1개 선택
            minSelect = 1;
            maxSelect = 1;
            prompt = t('game.promptInputNeeded', { kind: kindId });
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
      ? t('game.graveMine')
      : graveModalType === 'opponent'
        ? t('game.graveOpponent')
        : t('game.graveCatastrophe');

  const myTurnActive = Boolean(myId && fogged.activePlayer === myId);
  const oppTurnActive = Boolean(fogged.activePlayer && fogged.activePlayer !== myId);

  // ---- 행동 가이드 배너 ----
  // 현재 상태로 "지금 무엇을 해야 하는지" 한 줄 안내 문구와 강조 여부를 계산한다.
  // 순수 안내 전용이며 어떤 행동 로직도 변경하지 않는다.
  const guide = (() => {
    if (isGameOver) return null;
    // 멀리건/입력 요구는 모달이 함께 떠도 배너로 다음 행동을 명확히 안내한다.
    if (mulliganRequest) return { text: t('game.guideMulligan'), emphatic: true };
    if (mapRequest) return { text: t('game.guideSelectCell'), emphatic: true };
    if (optionRequest) return { text: t('game.guideSelectOption'), emphatic: true };
    if (myTurnActive) {
      if (selectedCardIndex !== null)
        return { text: t('game.guideCardSelected'), emphatic: true };
      if (selectedBoardPosition !== null)
        return { text: t('game.guideCellSelected'), emphatic: true };
      return { text: t('game.guideMyTurn'), emphatic: true };
    }
    return { text: t('game.guideOpponentTurn'), emphatic: false };
  })();

  return (
    <div className="from-background via-background to-accent/10 flex min-h-[100dvh] flex-col bg-linear-to-br p-2 sm:p-3 lg:h-[100dvh] lg:overflow-hidden">
      {/* Top Bar: 로비 | 턴 헤더 | 속도·도움말 — 한 줄로 압축 */}
      <div className="flex shrink-0 items-center justify-between gap-2">
        <Button variant="outline" size="sm" onClick={() => navigate('/lobby')}>
          <ArrowLeft className="mr-1 h-4 w-4" />
          <span className="hidden sm:inline">{t('game.lobby')}</span>
        </Button>
        <GameHeader turn={fogged.turn} isMyTurn={myTurnActive} />
        <div className="flex items-center gap-1">
          {/* 솔로 모드 전용: AI 턴 속도 조절(느림/보통/빠름). 실시간 반영. */}
          {isSolo && (
            <div className="hidden items-center gap-1 sm:flex" role="group" aria-label={t('game.speed')}>
              {SOLO_SPEEDS.map((sp) => (
                <Button
                  key={sp}
                  type="button"
                  size="sm"
                  variant={soloSpeed === sp ? 'default' : 'outline'}
                  aria-pressed={soloSpeed === sp}
                  onClick={() => handleChangeSoloSpeed(sp)}
                >
                  {t(
                    sp === 'slow'
                      ? 'game.speedSlow'
                      : sp === 'fast'
                        ? 'game.speedFast'
                        : 'game.speedNormal',
                  )}
                </Button>
              ))}
            </div>
          )}
          <Button
            variant="ghost"
            size="icon"
            aria-label={t('common.glossary')}
            title={t('common.glossary')}
            onClick={() => setGlossaryOpen(true)}
          >
            <HelpCircle className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* 메인: 남은 높이를 채우는 2열(데스크톱) / 세로(모바일) 레이아웃 */}
      <div className="mt-2 flex min-h-0 flex-1 flex-col gap-2 lg:flex-row">
        {/* CENTER: 상대 스탯 → 상대 손패 → 보드 → 내 스탯 → 내 손패 */}
        <div className="flex min-h-0 flex-1 flex-col gap-2">
          <StatBar
            label={t('game.opponent')}
            hp={fogged.opponent.hp}
            maxHp={fogged.opponent.maxHp}
            mana={fogged.opponent.mana}
            maxMana={fogged.opponent.maxMana}
            deckCount={fogged.opponent.deckCount}
            graveCount={fogged.opponent.graveCount}
            handCount={fogged.opponent.handCount}
            active={oppTurnActive}
            onViewGrave={() => handleViewGrave('opponent')}
          />
          <OpponentHand cardCount={fogged.opponent.handCount} />

          {/* 행동 가이드: 보드 바로 위의 얇은 한 줄 배너(레이아웃 점프 없음) */}
          {guide && (
            <div
              role="status"
              aria-live="polite"
              className={`shrink-0 truncate rounded-md border px-3 py-1 text-center text-xs sm:text-sm ${
                guide.emphatic
                  ? 'border-primary/40 bg-primary/10 text-primary font-medium'
                  : 'border-border bg-muted/40 text-muted-foreground'
              }`}
            >
              {guide.text}
            </div>
          )}

          {/* 보드: 가운데 정렬하고 남는 공간을 차지 */}
          <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto">
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
          </div>

          <StatBar
            label={t('game.me')}
            hp={fogged.me.hp}
            maxHp={fogged.me.maxHp}
            mana={fogged.me.mana}
            maxMana={fogged.me.maxMana}
            deckCount={fogged.me.deckCount}
            graveCount={fogged.me.graveCount}
            active={myTurnActive}
            onViewGrave={() => handleViewGrave('me')}
          />

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

        {/* SIDE: 재앙 덱 + 게임 로그 (데스크톱은 우측 고정, 모바일은 아래) */}
        <div className="flex shrink-0 flex-col gap-2 lg:w-72 lg:overflow-hidden">
          <CatastropheDeckInfo
            deckCount={fogged.catastrophe.deckCount}
            graveCount={fogged.catastrophe.graveCount}
            grave={fogged.catastrophe.grave}
            onViewGrave={() => handleViewGrave('catastrophe')}
          />
          <div className="min-h-0 flex-1">
            <GameLog logs={perspectiveLogs} />
          </div>
        </div>
      </div>

      <AnimationLayer
        animations={animations}
        onAnimationComplete={() => {
          clearLastDiff();
        }}
      />
      {/* 상대(AI)가 사용한 카드를 잠깐 화면 중앙에 보여준다(PvP 에서도 무해). */}
      <CardPlaySpotlight />
      {/* 방금 일어난 일(재앙 발동/피해/회복 등)을 화면 상단에 잠깐 띄우는 텍스트 배너.
          이미 번역된 perspectiveLogs 텍스트를 재활용하며, 게임 종료 시엔 띄우지 않는다. */}
      <EventBanner logs={perspectiveLogs} paused={isGameOver} />
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
      <GlossaryModal open={glossaryOpen} onOpenChange={setGlossaryOpen} />

      {/* 튜토리얼 모드의 게임 종료 안내는 /tutorial 라우트의 TutorialOutro 가 담당하므로
          여기서는 PvE/2인전에서만 기본 게임 종료 오버레이를 노출한다. */}
      {isGameOver && !isTutorial && (
        <GameOverOverlay
          isWin={Boolean(isWin)}
          isLose={Boolean(isLose)}
          onReview={() => navigate('/review')}
          onLobby={() => navigate(pveStageId ? '/pve' : '/lobby')}
        />
      )}
    </div>
  );
}
