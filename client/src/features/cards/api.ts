import { http } from '@/shared/api/http';
import type { CardDto, CardsListResponse } from '@/shared/api/types';

export type CardsListParams = {
  mana?: number;
  name?: string;
  token?: boolean;
  type?: CardDto['type'];
};

export const cardsApi = {
  list(params: CardsListParams = {}) {
    const q = new URLSearchParams();
    if (params.mana != null) q.set('mana', String(params.mana));
    if (params.name) q.set('name', params.name);
    if (params.token != null) q.set('token', params.token ? 'true' : 'false');
    if (params.type) q.set('type', params.type);
    const qs = q.toString();
    return http<CardsListResponse>(`/api/cards${qs ? `?${qs}` : ''}`);
  },
  getById(id: string) {
    return http<CardDto>(`/api/cards/${id}`);
  },
};
