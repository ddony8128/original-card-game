import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { HttpStatus } from '../type/status';
import { getPveStages } from '../core/resources/pveStages';
import { pveProgressService } from '../services/pveProgress';

export const pveRouter = Router();

pveRouter.use(requireAuth);

// PvE 스테이지 목록: 클라이언트에는 id/name 만 노출한다(AI 덱/프로필 비공개).
pveRouter.get('/stages', (_req, res) => {
  const stages = getPveStages();
  const list = stages.map((s) => ({ id: s.id, name: s.name }));
  res
    .status(HttpStatus.OK)
    .json({ stages: list, total: list.length });
});

// PvE 진행도: 클리어한 스테이지 id 목록과 전체 클리어 여부(골드 뱃지 조건).
pveRouter.get('/progress', (req, res) => {
  const userId = (req as any).user.id as string;
  (async () => {
    const clearedStageIds = await pveProgressService.getClearedStageIds(userId);
    const allStageIds = getPveStages().map((s) => s.id);
    const clearedSet = new Set(clearedStageIds);
    const allCleared =
      allStageIds.length > 0 && allStageIds.every((id) => clearedSet.has(id));
    res.status(HttpStatus.OK).json({ clearedStageIds, allCleared });
  })().catch((e) =>
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ message: e.message }),
  );
});
