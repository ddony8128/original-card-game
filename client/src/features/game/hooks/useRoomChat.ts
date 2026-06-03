import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createGameSocket, type GameSocket } from '@/ws/gameSocket';
import type { ChatBroadcastPayload } from '@/shared/types/ws';

interface UseRoomChatParams {
  roomCode?: string;
  userId?: string;
}

export interface ChatMessage extends ChatBroadcastPayload {
  /** 클라이언트 측 표시용 고유 키(수신 순번 기반) */
  key: string;
}

// 대기실 채팅은 휘발성이므로 메모리에 보관하는 메시지 수를 제한한다.
const MAX_MESSAGES = 100;

/**
 * 대기실(BackRoom) 실시간 채팅 훅.
 *
 * - chat 모드 소켓을 열어 `join_chat` 으로만 방에 참여한다(게임 시작/ready 미발동).
 * - 서버에서 내려오는 `chat` 이벤트를 로컬 메시지 목록(useState)에 누적한다(최대 100개).
 * - 언마운트 시 소켓을 정리한다.
 */
export function useRoomChat({ roomCode, userId }: UseRoomChatParams) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  // 수신 순번 카운터(메시지 key 생성용)
  const seqRef = useRef(0);

  const socket: GameSocket | null = useMemo(() => {
    if (!roomCode) return null;
    return createGameSocket({ roomCode, userId, mode: 'chat' });
  }, [roomCode, userId]);

  useEffect(() => {
    if (!socket) return;
    socket.connect();

    const offChat = socket.onEvent('chat', (msg) => {
      const data = msg.data as ChatBroadcastPayload;
      setMessages((prev) => {
        const next = [...prev, { ...data, key: `${seqRef.current++}` }];
        return next.length > MAX_MESSAGES ? next.slice(next.length - MAX_MESSAGES) : next;
      });
    });

    return () => {
      offChat();
      socket.close();
    };
  }, [socket]);

  const sendChat = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || !socket) return;
      socket.sendChat(trimmed);
    },
    [socket],
  );

  return { messages, sendChat };
}
