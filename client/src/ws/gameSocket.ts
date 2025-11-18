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
  roomId: string;
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
      const readyPayload: WsClientToServerMessage = {
        event: 'ready',
        data: {
          roomId: options.roomId,
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
      roomId: options.roomId,
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
