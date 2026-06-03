import { Json } from '../type/json';
import { CardID } from '../type/gameState';
import {
  getAllCardRows,
  getCardRowById,
  getCardRowsByIds,
} from '../core/resources/cardResource';

export type CardRow = {
  id: string;
  name_dev: string;
  name_ko: string;
  description_ko: string | null;
  type: 'instant' | 'ritual' | 'catastrophe' | 'summon' | 'item';
  mana: number | null;
  token: boolean;
  effect_json: Json | null;
};

export const cardsService = {
  async listAll(): Promise<CardRow[]> {
    return getAllCardRows();
  },

  async getById(id: CardID): Promise<CardRow | null> {
    return getCardRowById(id);
  },

  async getByIds(ids: CardID[]): Promise<CardRow[]> {
    return getCardRowsByIds(ids);
  },

  async list(params: {
    mana?: number;
    name?: string;
    token?: boolean;
    type?: CardRow['type'];
    page?: number;
    limit?: number;
  }): Promise<{
    items: CardRow[];
    total: number;
  }> {
    const paginate = !(params.page === undefined && params.limit === undefined);
    const page = paginate ? Math.max(1, Number(params.page ?? 1)) : 1;
    const limit = paginate
      ? Math.min(3000, Math.max(1, Number(params.limit ?? 20)))
      : 0;
    const from = paginate ? (page - 1) * limit : 0;
    const to = paginate ? from + limit - 1 : 0;

    let rows = getAllCardRows();

    if (typeof params.mana === 'number' && Number.isFinite(params.mana)) {
      // mana=5가 들어오면 5 이상으로 필터 (5+)
      if (params.mana >= 5) {
        rows = rows.filter((r) => r.mana !== null && r.mana >= 5);
      } else {
        rows = rows.filter((r) => r.mana === params.mana);
      }
    }

    if (params.name && params.name.trim() !== '') {
      const q = params.name
        .trim()
        .replaceAll('.', '')
        .replaceAll('%', '')
        .toLowerCase();
      // name_dev 또는 name_ko 에 대해 부분 일치
      rows = rows.filter(
        (r) =>
          String(r.name_dev ?? '')
            .toLowerCase()
            .includes(q) ||
          String(r.name_ko ?? '')
            .toLowerCase()
            .includes(q),
      );
    }

    if (typeof params.token === 'boolean') {
      rows = rows.filter((r) => r.token === params.token);
    }

    if (params.type) {
      rows = rows.filter((r) => r.type === params.type);
    }

    // ORDER BY mana ASC NULLS FIRST, then name_ko ASC
    rows = rows.slice().sort((a, b) => {
      const am = a.mana;
      const bm = b.mana;
      if (am !== bm) {
        if (am === null) return -1;
        if (bm === null) return 1;
        return am - bm;
      }
      return String(a.name_ko).localeCompare(String(b.name_ko));
    });

    const total = rows.length;
    const items = paginate ? rows.slice(from, to + 1) : rows;

    return { items, total };
  },
};
