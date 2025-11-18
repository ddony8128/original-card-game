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
import { ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { useDecksQuery } from '@/features/decks/queries';
import { useMeQuery } from '@/features/auth/queries';
import { useGameFogStore } from '@/shared/store/gameStore';
import { useGameSocket } from '@/ws/useGameSocket';

export default function Game() {
  const navigate = useNavigate();
  const { roomId } = useParams<{ roomId: string }>();
  const { data: me } = useMeQuery();
  const { data: serverDecks } = useDecksQuery();
  const fogged = useGameFogStore((s) => s.fogged);
  const lastDiff = useGameFogStore((s) => s.lastDiff);
  const requestInput = useGameFogStore((s) => s.requestInput);
  const setRequestInput = useGameFogStore((s) => s.setRequestInput);
  const clearLastDiff = useGameFogStore((s) => s.clearLastDiff);

  const [selectedBoardPosition, setSelectedBoardPosition] = useState<BoardPosition | null>(null);

  const { sendPlayerInput, status: wsStatus } = useGameSocket({
    roomId: roomId ?? '',
    userId: me?.id,
  });

  useEffect(() => {
    if (!me) {
      navigate('/login');
      return;
    }
    // 덱 정보는 서버 / FoggedGameState에서 관리하므로
    // 여기서는 별도 로컬 GameState를 만들지 않습니다.
    if (!serverDecks || serverDecks.length === 0) return;
  }, [me, serverDecks, navigate]);

  const handleBoardCellClick = (position: BoardPosition) => {
    setSelectedBoardPosition(position);
    // TODO: 서버로 이동 요청 전송 (FoggedGameState 기반)
    // 예: sendPlayerAction({ action: 'move', to: [position.y, position.x] });
    toast.info('보드 클릭', {
      description: `셀 (${position.x}, ${position.y})을 클릭했습니다.`,
    });
  };
  const myId = me?.id;
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
          <p className="text-muted-foreground text-xs">
            방에 입장했는지, 서버에서 <code>game_start</code> 이벤트가 왔는지 확인해주세요.
          </p>
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
      </div>

      <AnimationLayer
        animations={animations}
        onAnimationComplete={() => {
          clearLastDiff();
        }}
      />
      <RequestInputModal
        request={currentRequest}
        onResponse={(response) => {
          // TODO: 서버에서 기대하는 형태에 맞게 응답 변환
          // 현재는 선택된 옵션 배열을 그대로 answer로 보낸다.
          sendPlayerInput({ answer: response });
          setRequestInput(null);
        }}
        onCancel={() => setRequestInput(null)}
      />
    </div>
  );
}
