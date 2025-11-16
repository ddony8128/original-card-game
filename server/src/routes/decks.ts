import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { decksService } from '../services/decks';
import { HttpStatus } from '../type/status';
import { DeckList, coerceDeckList } from '../type/deck';

export const decksRouter = Router();

decksRouter.use(requireAuth);

decksRouter.get('/', (req, res) => {
  const userId = (req as any).user.id as string;
  (async () => {
    const rows = await decksService.listByUser(userId);
    const res_json = rows.map((row) => ({
      id: row.id,
      name: row.name,
      main_cards: row.main_cards,
      cata_cards: row.cata_cards,
      created_at: row.created_at,
      updated_at: row.updated_at,
    }));
    res.status(HttpStatus.OK).json(res_json);
  })().catch((e) =>
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ message: e.message }),
  );
});

decksRouter.post('/', (req, res) => {
  const userId = (req as any).user.id as string;
  const { name, main_cards, cata_cards } = req.body as {
    name?: string;
    main_cards?: unknown;
    cata_cards?: unknown;
  };
  if (!name)
    return res
      .status(HttpStatus.BAD_REQUEST)
      .json({ message: 'name required' });
  (async () => {
    // 입력 파싱 및 형태 검증
    let mainParsed: DeckList, cataParsed: DeckList;
    try {
      mainParsed = coerceDeckList(main_cards);
      cataParsed = coerceDeckList(cata_cards);
    } catch (e: any) {
      return res
        .status(HttpStatus.BAD_REQUEST)
        .json({ message: e.message || 'invalid deck payload' });
    }

    try {
      const { main, cata } = await decksService.validateAndHydrate(
        mainParsed,
        cataParsed,
      );
      const deck = await decksService.create(userId, name, {
        main_cards: main,
        cata_cards: cata,
      });
      res.status(HttpStatus.CREATED).json({
        id: deck.id,
        name: deck.name,
        main_cards: deck.main_cards,
        cata_cards: deck.cata_cards,
        created_at: deck.created_at,
        updated_at: deck.updated_at,
      });
    } catch (e: any) {
      // 검증 실패는 400으로 매핑
      if (typeof e?.message === 'string') {
        return res.status(HttpStatus.BAD_REQUEST).json({ message: e.message });
      }
      return res
        .status(HttpStatus.INTERNAL_SERVER_ERROR)
        .json({ message: 'unexpected error' });
    }
  })().catch((e) =>
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ message: e.message }),
  );
});

decksRouter.put('/:deckId', (req, res) => {
  const userId = (req as any).user.id as string;
  const { name, main_cards, cata_cards } = req.body as {
    name?: string;
    main_cards?: unknown;
    cata_cards?: unknown;
  };
  if (!name)
    return res
      .status(HttpStatus.BAD_REQUEST)
      .json({ message: 'name required' });

  let mainParsed: DeckList, cataParsed: DeckList;
  try {
    mainParsed = coerceDeckList(main_cards);
    cataParsed = coerceDeckList(cata_cards);
  } catch (e: any) {
    return res
      .status(HttpStatus.BAD_REQUEST)
      .json({ message: e.message || 'invalid deck payload' });
  }

  (async () => {
    const deck = await decksService.getById(req.params.deckId);
    if (!deck)
      return res.status(HttpStatus.NOT_FOUND).json({ message: 'not found' });
    if (deck.user_id !== userId)
      return res.status(HttpStatus.FORBIDDEN).json({ message: 'forbidden' });
    const { main, cata } = await decksService.validateAndHydrate(
      mainParsed,
      cataParsed,
    );
    const updated = await decksService.update(deck.id, {
      name,
      main_cards: main,
      cata_cards: cata,
    });
    res.status(HttpStatus.OK).json({
      id: updated.id,
      name: updated.name,
      main_cards: updated.main_cards,
      cata_cards: updated.cata_cards,
      created_at: updated.created_at,
      updated_at: updated.updated_at,
    });
  })().catch((e) =>
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ message: e.message }),
  );
});

decksRouter.delete('/:deckId', (req, res) => {
  const userId = (req as any).user.id as string;
  (async () => {
    const deck = await decksService.getById(req.params.deckId);
    if (!deck)
      return res.status(HttpStatus.NOT_FOUND).json({ message: 'not found' });
    if (deck.user_id !== userId)
      return res.status(HttpStatus.FORBIDDEN).json({ message: 'forbidden' });
    await decksService.softDelete(deck.id);
    res.status(HttpStatus.NO_CONTENT).end();
  })().catch((e) =>
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ message: e.message }),
  );
});
