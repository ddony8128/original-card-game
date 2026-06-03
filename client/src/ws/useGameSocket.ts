import { useEffect, useMemo } from 'react';
import { toast } from 'sonner';
import { createGameSocket, type GameSocket, type GameSocketMode } from '@/ws/gameSocket';
import { useGameFogStore } from '@/shared/store/gameStore';
import type {
  GameInitPayload,
  StatePatchPayload,
  AskMulliganPayload,
  RequestInputPayload,
  GameOverPayload,
} from '@/shared/types/ws';

interface UseGameSocketParams {
  roomCode: string;
  userId?: string;
  /** 기본 'game'. 'solo' 면 연결 시 start_solo 를 전송한다. */
  mode?: GameSocketMode;
  /** 'solo' 모드에서 사용할 덱 id */
  deckId?: string;
  /** false 면 소켓 연결을 보류한다(기본 true). 솔로 모드에서 덱 로딩 대기에 사용. */
  enabled?: boolean;
}

/**
 * 게임 화면용 WebSocket 훅.
 *
 * - 내부에서 `createGameSocket` 으로 소켓을 만들고,
 *   서버에서 내려오는 게임 관련 이벤트들을 Zustand `useGameFogStore` 에 반영한다.
 * - 컴포넌트 입장에서는 `sendReady / sendPlayerAction` 등만 사용하면 된다.
 */
export function useGameSocket({
  roomCode,
  userId,
  mode,
  deckId,
  enabled = true,
}: UseGameSocketParams) {
  const setFromGameInit = useGameFogStore((s) => s.setFromGameInit);
  const applyStatePatch = useGameFogStore((s) => s.applyStatePatch);
  const setRequestInput = useGameFogStore((s) => s.setRequestInput);
  const setMulligan = useGameFogStore((s) => s.setMulligan);
  // zustand selector 문법, 필요한 함수만 빼오는 것임.

  const socket: GameSocket = useMemo(
    () =>
      createGameSocket({
        roomCode,
        userId,
        mode,
        deckId,
      }),
    [roomCode, userId, mode, deckId],
  );

  useEffect(() => {
    if (!enabled) return;
    socket.connect();

    const offGameInit = socket.onEvent('game_init', (msg) => {
      setFromGameInit(msg.data as GameInitPayload);
    });

    const offStatePatch = socket.onEvent('state_patch', (msg) => {
      applyStatePatch(msg.data as StatePatchPayload);
    });

    const offAskMulligan = socket.onEvent('ask_mulligan', (msg) => {
      setMulligan(msg.data as AskMulliganPayload);
    });

    const offRequestInput = socket.onEvent('request_input', (msg) => {
      setRequestInput(msg.data as RequestInputPayload);
    });

    const offInvalidAction = socket.onEvent('invalid_action', (msg) => {
      const reason = (msg.data as { reason: string }).reason;
      toast.error('잘못된 행동입니다.', {
        description: reason,
      });
    });

    const offGameOver = socket.onEvent('game_over', (msg) => {
      const data = msg.data as GameOverPayload;
      toast.info('게임 종료', {
        description: `승자: ${data.winner ?? '없음'} / 이유: ${data.reason}`,
      });
    });

    return () => {
      offGameInit();
      offStatePatch();
      offAskMulligan();
      offRequestInput();
      offInvalidAction();
      offGameOver();
      socket.close();
    };
  }, [socket, enabled, setFromGameInit, applyStatePatch, setMulligan, setRequestInput]);

  return {
    sendReady: socket.sendReady,
    sendStartSolo: socket.sendStartSolo,
    sendAnswerMulligan: socket.sendAnswerMulligan,
    sendPlayerAction: socket.sendPlayerAction,
    sendPlayerInput: socket.sendPlayerInput,
    status: socket.getStatus(),
  };
}
