import { Router } from 'express';
import { roomsService } from '../services/rooms';
import { HttpStatus } from '../type/status';
import { requireAuth } from '../middleware/auth';
import { usersService } from '../services/users';
import { decksService } from '../services/decks';

export const matchRouter = Router();
matchRouter.use(requireAuth);

async function buildStateResponse(roomCode: string) {
  const room = await roomsService.byCode(roomCode);
  if (!room) return null;
  const [host, guest] = await Promise.all([
    usersService.findById(room.host_id),
    room.guest_id
      ? usersService.findById(room.guest_id)
      : Promise.resolve(null),
  ]);
  return {
    roomId: room.code,
    host: host
      ? {
          id: host.id,
          username: host.username,
          deckId: (room as any).host_deck_id ?? undefined,
        }
      : undefined,
    guest: guest
      ? {
          id: guest.id,
          username: guest.username,
          deckId: (room as any).guest_deck_id ?? undefined,
        }
      : undefined,
    status: room.status,
  } as const;
}

// 4.1 방 생성
matchRouter.post('/create', (req, res) => {
  const userId = (req as any).user.id as string;

  (async () => {
    const room = await roomsService.create(userId);
    const host = await usersService.findById(userId);
    return res.status(HttpStatus.CREATED).json({
      roomId: room.code,
      host: host ? { id: host.id, username: host.username } : { id: userId },
      status: room.status,
    });
  })().catch((e) =>
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ message: e.message }),
  );
});

// 4.2 방 참가
matchRouter.post('/join', (req, res) => {
  const userId = (req as any).user.id as string;
  const { roomId } = req.body as { roomId?: string };
  if (!roomId) {
    return res
      .status(HttpStatus.BAD_REQUEST)
      .json({ message: 'roomId required' });
  }

  (async () => {
    const result = await roomsService.join(roomId, userId);
    if (result.notFound)
      return res
        .status(HttpStatus.NOT_FOUND)
        .json({ message: 'room not found' });
    if (result.full)
      return res.status(HttpStatus.CONFLICT).json({ message: 'room full' });
    const state = await buildStateResponse(roomId);
    return res.status(HttpStatus.OK).json(state);
  })().catch((e) =>
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ message: e.message }),
  );
});

// 4.3 덱 제출
matchRouter.patch('/deck', (req, res) => {
  const userId = (req as any).user.id as string;
  const { roomId, deckId } = req.body as { roomId?: string; deckId?: string };
  if (!roomId || !deckId)
    return res
      .status(HttpStatus.BAD_REQUEST)
      .json({ message: 'roomId and deckId required' });

  (async () => {
    // 덱 소유권 및 상태 확인
    const deck = await decksService.getById(deckId);
    if (!deck)
      return res
        .status(HttpStatus.NOT_FOUND)
        .json({ message: 'deck not found' });
    if (deck.deleted)
      return res
        .status(HttpStatus.BAD_REQUEST)
        .json({ message: 'deck deleted' });
    if (deck.user_id !== userId)
      return res
        .status(HttpStatus.FORBIDDEN)
        .json({ message: 'forbidden: not owner' });

    const result = await roomsService.submitDeckByCode(roomId, userId, deckId);
    if ((result as any).notFound)
      return res
        .status(HttpStatus.NOT_FOUND)
        .json({ message: 'room not found' });
    if ((result as any).forbidden)
      return res.status(HttpStatus.FORBIDDEN).json({ message: 'forbidden' });
    const state = await buildStateResponse(roomId);
    return res.status(HttpStatus.OK).json(state);
  })().catch((e) =>
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ message: e.message }),
  );
});

// 4.4 방 상태 조회 (폴링)
matchRouter.get('/:roomId', (req, res) => {
  const { roomId } = req.params as { roomId: string };
  (async () => {
    const state = await buildStateResponse(roomId);
    if (!state)
      return res.status(HttpStatus.NOT_FOUND).json({ message: 'not found' });
    return res.status(HttpStatus.OK).json(state);
  })().catch((e) =>
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ message: e.message }),
  );
});

// 4.5 참가자 이탈
matchRouter.post('/leave', (req, res) => {
  const userId = (req as any).user.id as string;
  const { roomId } = req.body as { roomId?: string };
  if (!roomId)
    return res
      .status(HttpStatus.BAD_REQUEST)
      .json({ message: 'roomId required' });
  (async () => {
    const room = await roomsService.byCode(roomId);
    if (!room)
      return res.status(HttpStatus.NOT_FOUND).json({ message: 'not found' });
    if (room.host_id !== userId && room.guest_id !== userId)
      return res.status(HttpStatus.FORBIDDEN).json({ message: 'forbidden' });
    await roomsService.finishByCode(roomId);
    return res.status(HttpStatus.OK).json({ roomId, status: 'finished' });
  })().catch((e) =>
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ message: e.message }),
  );
});

// 4.6 방 삭제 (방장 전용)
matchRouter.delete('/:roomId', (req, res) => {
  const userId = (req as any).user.id as string;
  const { roomId } = req.params as { roomId: string };
  (async () => {
    const result = await roomsService.finishByCodeIfHost(roomId, userId);
    if (result.notFound)
      return res.status(HttpStatus.NOT_FOUND).json({ message: 'not found' });
    if (result.forbidden)
      return res.status(HttpStatus.FORBIDDEN).json({ message: 'forbidden' });
    return res.status(HttpStatus.OK).json({ roomId, status: 'finished' });
  })().catch((e) =>
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ message: e.message }),
  );
});
