import type {
  ClientToServerEvent,
  WsClientToServerMessage,
  WsServerToClientMessage,
  ServerToClientEvent,
  ReadyPayload,
  AnswerMulliganPayload,
  PlayerActionPayload,
  PlayerInputPayload,
} from '@/shared/types/ws';

type MessageHandler = (msg: WsServerToClientMessage) => void;
type EventHandler<E extends ServerToClientEvent> = (
  data: WsServerToClientMessage & { event: E },
) => void;

export type GameSocketStatus = 'idle' | 'connecting' | 'open' | 'closed' | 'error';

export interface GameSocketOptions {
  roomCode: string;
  userId?: string;
  token?: string;
}

export interface GameSocket {
  connect: () => void;
  close: () => void;
  send: (msg: WsClientToServerMessage) => void;
  sendEvent: <E extends ClientToServerEvent>(
    event: E,
    data: WsClientToServerMessage['data'],
  ) => void;
  sendReady: (payload?: Partial<ReadyPayload>) => void;
  sendAnswerMulligan: (payload: AnswerMulliganPayload) => void;
  sendPlayerAction: (payload: PlayerActionPayload) => void;
  sendPlayerInput: (payload: PlayerInputPayload) => void;
  onMessage: (handler: MessageHandler) => () => void;
  onEvent: <E extends ServerToClientEvent>(event: E, handler: EventHandler<E>) => () => void;
  getStatus: () => GameSocketStatus;
}

/**
 * 게임 화면에서 사용하는 WebSocket 클라이언트 래퍼.
 *
 * - 서버와의 원시 WS 연결을 숨기고, `sendReady / sendPlayerAction / onEvent(...)` 같은
 *   **도메인 친화적인 인터페이스**만 노출한다.
 * - 실제 엔드포인트는 서버의 `/api/match/socket` 을 사용하며,
 *   최초 연결 시 `ready` 이벤트를 자동으로 전송해 방/유저 정보를 알려준다.
 */
export function createGameSocket(options: GameSocketOptions): GameSocket {
  let socket: WebSocket | null = null;
  let status: GameSocketStatus = 'idle';

  const messageHandlers = new Set<MessageHandler>();
  const eventHandlers = new Map<ServerToClientEvent, Set<EventHandler<ServerToClientEvent>>>();

  const updateStatus = (next: GameSocketStatus) => {
    status = next;
  };

  const connect = () => {
    if (
      socket &&
      (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }

    const apiBase = import.meta.env.VITE_API_BASE_URL ?? window.location.origin;
    const wsBase = apiBase.replace(/^http/i, 'ws');
    const url = `${wsBase}/api/match/socket`;

    updateStatus('connecting');
    socket = new WebSocket(url);

    socket.onopen = () => {
      updateStatus('open');
      // 서버에 이 소켓이 어떤 방/유저에 속하는지 알려주는 초기 ready 메시지
      const readyPayload: WsClientToServerMessage = {
        event: 'ready',
        data: {
          roomCode: options.roomCode,
          userId: options.userId,
        },
      };
      socket?.send(JSON.stringify(readyPayload));
    };

    socket.onmessage = (ev: MessageEvent) => {
      try {
        const msg = JSON.parse(ev.data as string) as WsServerToClientMessage;
        messageHandlers.forEach((h) => h(msg));
        const handlersForEvent = eventHandlers.get(msg.event as ServerToClientEvent);
        if (handlersForEvent) {
          handlersForEvent.forEach((h) =>
            h(msg as WsServerToClientMessage & { event: ServerToClientEvent }),
          );
        }
      } catch (e) {
        console.error('[GameSocket] 메시지 파싱 실패', e, ev.data);
      }
    };

    socket.onerror = (e) => {
      updateStatus('error');

      console.error('[GameSocket] 오류 발생', e);
    };

    socket.onclose = () => {
      updateStatus('closed');
      socket = null;
    };
  };

  const close = () => {
    if (socket) {
      socket.close();
      socket = null;
      updateStatus('closed');
    }
  };

  const send = (msg: WsClientToServerMessage) => {
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      console.warn('[GameSocket] 소켓이 열려있지 않아 전송 실패', msg);
      return;
    }
    socket.send(JSON.stringify(msg));
  };

  const sendEvent = <E extends ClientToServerEvent>(
    event: E,
    data: WsClientToServerMessage['data'],
  ) => {
    send({ event, data } as WsClientToServerMessage);
  };

  const sendReady = (payload?: Partial<ReadyPayload>) => {
    const base: ReadyPayload = {
      roomCode: options.roomCode,
      userId: options.userId,
    };
    send({ event: 'ready', data: { ...base, ...payload } });
  };

  const sendAnswerMulligan = (payload: AnswerMulliganPayload) => {
    send({ event: 'answer_mulligan', data: payload });
  };

  const sendPlayerAction = (payload: PlayerActionPayload) => {
    send({ event: 'player_action', data: payload });
  };

  const sendPlayerInput = (payload: PlayerInputPayload) => {
    send({ event: 'player_input', data: payload });
  };

  const onMessage = (handler: MessageHandler) => {
    messageHandlers.add(handler);
    return () => {
      messageHandlers.delete(handler);
    };
  };

  const onEvent = <E extends ServerToClientEvent>(event: E, handler: EventHandler<E>) => {
    const set = eventHandlers.get(event) ?? new Set<EventHandler<ServerToClientEvent>>();
    set.add(handler as EventHandler<ServerToClientEvent>);
    eventHandlers.set(event, set);
    return () => {
      const existing = eventHandlers.get(event);
      if (!existing) return;
      existing.delete(handler as EventHandler<ServerToClientEvent>);
      if (existing.size === 0) {
        eventHandlers.delete(event);
      }
    };
  };

  const getStatus = () => status;

  return {
    connect,
    close,
    send,
    sendEvent,
    sendReady,
    sendAnswerMulligan,
    sendPlayerAction,
    sendPlayerInput,
    onMessage,
    onEvent,
    getStatus,
  };
}
