import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { GameBoard, type BoardPosition } from '@/components/game/GameBoard';
import { GameHeader } from '@/components/game/GameHeader';
import { PlayerInfo } from '@/components/game/PlayerInfo';
import { DeckInfo, CatastropheDeckInfo } from '@/components/game/DeckInfo';
import { OpponentHand } from '@/components/game/OpponentHand';
import { GameLog } from '@/components/game/GameLog';
import type { FoggedGameState } from '@/shared/types/game';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { useDecksQuery } from '@/features/decks/queries';
import { useMeQuery } from '@/features/auth/queries';
import { useGameFogStore } from '@/shared/store/gameStore';

export default function Game() {
  const navigate = useNavigate();
  const { roomId } = useParams<{ roomId: string }>();
  const { data: me } = useMeQuery();
  const { data: serverDecks } = useDecksQuery();
  const setFogged = useGameFogStore((s) => s.setFogged);
  const patchFogged = useGameFogStore((s) => s.patchFogged);
  const fogged = useGameFogStore((s) => s.fogged);

  // 상단 테스트 버튼/플레이스홀더
  const [wsMessage, setWsMessage] = useState<string>('');
  const wsRef = useRef<WebSocket | null>(null);

  const [selectedBoardPosition, setSelectedBoardPosition] = useState<BoardPosition | null>(null);

  // WebSocket 초기화 및 수신 핸들러
  useEffect(() => {
    // me 정보가 있거나 roomId가 있을 때 연결
    if (!roomId) return;
    const apiBase = import.meta.env.VITE_API_BASE_URL ?? window.location.origin;
    const wsBase = apiBase.replace(/^http/i, 'ws');
    const url = `${wsBase}/api/match/socket`;
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      setWsMessage('WS 연결됨');
      console.log('[WS] 연결됨. 방 참여 요청 전송 roomId:', roomId, 'userId:', me?.id);
      // 방 참여
      ws.send(
        JSON.stringify({
          event: 'join_room',
          data: { roomCode: roomId, userId: me?.id },
        }),
      );
    };

    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data as string) as { event: string; data?: unknown };
        console.log('[WS] 수신 이벤트:', msg?.event, '데이터:', msg?.data);
        if (msg?.event === 'check_back') {
          console.log('WS received check_back:', msg?.data);
        }
        if (msg?.event === 'game_start' && msg.data) {
          console.log('[WS] game_start 수신, FoggedGameState 설정');
          setFogged(msg.data as FoggedGameState);
        }
        if (msg?.event === 'change_phase') {
          const phase = msg.data;
          console.log('[WS] change_phase 수신:', phase);
          if (typeof phase === 'string') {
            patchFogged({ phase: phase as FoggedGameState['phase'] });
          }
        }
      } catch (e) {
        console.error('[WS] 메시지 처리 중 오류:', e, ev.data);
        // ignore non-JSON
      }
    };

    ws.onerror = (e) => {
      setWsMessage('WS 오류');
      console.error('[WS] 오류 발생:', e);
    };
    ws.onclose = (e) => {
      setWsMessage('WS 연결 종료');
      console.log('[WS] 연결 종료', e);
    };

    return () => {
      try {
        ws.close();
      } finally {
        wsRef.current = null;
      }
    };
  }, [roomId, me?.id, setFogged, patchFogged]);

  const sendWs = (event: string, data?: unknown) => {
    const socket = wsRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      setWsMessage('WS 미연결 상태');
      return;
    }
    socket.send(JSON.stringify({ event, data }));
  };

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
    // 예: sendWs('player_action', { type: 'move', target: { r: position.y, c: position.x } });
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

  return (
    <div className="from-background via-background to-accent/10 min-h-screen bg-linear-to-br p-4">
      <div className="mx-auto max-w-7xl space-y-4">
        {/* Top Bar: navigation + WS status */}
        <div className="flex items-center justify-between">
          <Button variant="outline" onClick={() => navigate('/lobby')}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            로비
          </Button>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={() => {
                sendWs('check');
                setWsMessage('check 전송');
              }}
            >
              WS 테스트
            </Button>
            <div className="text-muted-foreground min-w-[200px] text-xs">
              {wsMessage || '웹소켓 상태 메시지 ...'}
            </div>
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
    </div>
  );
}
