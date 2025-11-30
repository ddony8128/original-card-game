import { Router } from 'express';
import { logsService } from '../services/logs';
import { HttpStatus } from '../type/status';
import { requireAuthOrInternal, requireInternal } from '../middleware/auth';

export const logsRouter = Router();

// 6.1 게임 결과 생성 (서버 전용): roomCode 기준으로 게임 결과 row를 새로 만든다.
logsRouter.post('/result', requireInternal, (req, res) => {
  const { roomCode, startedAt } = req.body as {
    roomCode?: string;
    startedAt?: string;
  };
  if (!roomCode || !startedAt) {
    return res
      .status(HttpStatus.BAD_REQUEST)
      .json({ message: 'roomCode and startedAt required' });
  }
  (async () => {
    const r = await logsService.createGameResult(roomCode, startedAt);
    return res.status(HttpStatus.CREATED).json(r);
  })().catch((e) => {
    const code = (e as any).code;
    if (code === 'NOT_FOUND') {
      return res.status(HttpStatus.NOT_FOUND).json({ message: e.message });
    }
    return res
      .status(HttpStatus.INTERNAL_SERVER_ERROR)
      .json({ message: (e as any).message });
  });
});

// 6.2 게임 결과 업데이트 (서버 전용): 이미 생성된 결과의 승패/종료 시각을 기록한다.
logsRouter.patch('/result/:roomCode', requireInternal, (req, res) => {
  const { roomCode } = req.params as { roomCode: string };
  const { result, endedAt } = req.body as {
    result?: 'p1' | 'p2' | 'draw';
    endedAt?: string;
  };
  if (!result || !endedAt) {
    return res
      .status(HttpStatus.BAD_REQUEST)
      .json({ message: 'result and endedAt required' });
  }
  (async () => {
    const r = await logsService.updateGameResult(roomCode, result, endedAt);
    return res.status(HttpStatus.OK).json(r);
  })().catch((e) => {
    const code = (e as any).code;
    if (code === 'NOT_FOUND') {
      return res.status(HttpStatus.NOT_FOUND).json({ message: e.message });
    }
    return res
      .status(HttpStatus.INTERNAL_SERVER_ERROR)
      .json({ message: (e as any).message });
  });
});

// 6.3 게임 결과 조회 (클라이언트용, finished만 허용): 끝난 게임의 요약 결과를 돌려준다.
logsRouter.get('/result/:roomCode', requireAuthOrInternal, (req, res) => {
  const { roomCode } = req.params as { roomCode: string };
  (async () => {
    const data = await logsService.getFinishedGameResult(roomCode);
    return res.status(HttpStatus.OK).json(data);
  })().catch((e) => {
    const code = (e as any).code;
    if (code === 'FORBIDDEN') {
      return res
        .status(HttpStatus.FORBIDDEN)
        .json({ message: 'game not finished' });
    }
    if (code === 'NOT_FOUND') {
      return res.status(HttpStatus.NOT_FOUND).json({ message: e.message });
    }
    return res
      .status(HttpStatus.INTERNAL_SERVER_ERROR)
      .json({ message: (e as any).message });
  });
});

// 6.4 게임 턴 로그 저장 (서버 전용): 특정 결과(resultId)에 턴별 텍스트 로그를 적재한다.
logsRouter.post('/log', requireInternal, (req, res) => {
  const { resultId, turn, text } = req.body as {
    resultId?: string;
    turn?: number;
    text?: string;
  };
  if (!resultId || typeof turn !== 'number' || typeof text !== 'string') {
    return res
      .status(HttpStatus.BAD_REQUEST)
      .json({ message: 'resultId, turn, text required' });
  }
  (async () => {
    await logsService.createTurnLog(resultId, turn, text);
    return res.status(HttpStatus.CREATED).json({ ok: true });
  })().catch((e) =>
    res
      .status(HttpStatus.INTERNAL_SERVER_ERROR)
      .json({ message: (e as any).message }),
  );
});

// 6.5 게임 로그 조회 (클라이언트/서버 공용): 방 코드 기준으로 저장된 턴 로그를 조회한다.
logsRouter.get('/log/:roomCode', requireAuthOrInternal, (req, res) => {
  const { roomCode } = req.params as { roomCode: string };
  (async () => {
    const { roomExists, logs } = await logsService.getLogs(roomCode);
    if (!roomExists) {
      return res
        .status(HttpStatus.NOT_FOUND)
        .json({ message: 'room not found' });
    }
    if (logs.length === 0) {
      return res.status(HttpStatus.NO_CONTENT).end();
    }
    return res.status(HttpStatus.OK).json({ roomCode, logs });
  })().catch((e) =>
    res
      .status(HttpStatus.INTERNAL_SERVER_ERROR)
      .json({ message: (e as any).message }),
  );
});
