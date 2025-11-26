import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { reviewsService } from '../services/reviews';
import { HttpStatus } from '../type/status';

export const reviewsRouter = Router();

reviewsRouter.use(requireAuth);

reviewsRouter.post('/', (req, res) => {
  const userId = (req as any).user.id as string;
  const { review } = req.body as { review: string };
  (async () => {
    const reviewRow = await reviewsService.create(userId, review);
    res.status(HttpStatus.CREATED).json({
      id: reviewRow.id,
      writer_id: reviewRow.writer_id,
      review: reviewRow.review,
      created_at: reviewRow.created_at,
    });
  })().catch((e) =>
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ message: e.message }),
  );
});
