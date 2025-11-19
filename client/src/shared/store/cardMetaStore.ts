import { create } from 'zustand';
import type { DeckDto } from '@/shared/api/types';
import type { PublicHandCard } from '@/shared/types/game';

export type GameCardMeta = {
  id: string;
  name: string;
  mana: number;
  // 서버 CardDto 기준 전체 타입을 허용하되, 실제 게임에서는 주로 instant/ritual 을 쓴다.
  type: 'instant' | 'ritual' | 'catastrophe' | 'summon' | 'item';
  description?: string;
};

type CardMetaState = {
  /**
   * 카드 ID → 메타 정보 맵.
   * - 내 덱에서 가져온 카드
   * - 게임 중 WS 로 공개된 카드
   * 를 모두 이 맵에 합쳐서 캐시한다.
   */
  byId: Record<string, GameCardMeta>;
};

type CardMetaActions = {
  /**
   * 선택된 덱 한 개 기준으로 카드 메타를 초기 세팅한다.
   * - REST `/api/decks` 로 가져온 `DeckDto` 중 현재 사용 중인 덱만 넘겨서 호출하는 용도.
   * - 이미 존재하던 메타가 있으면 덮어쓴다.
   */
  setFromDeck: (deck: DeckDto) => void;

  /**
   * 여러 장의 카드 메타를 한 번에 upsert.
   * - 동일 id 가 있으면 새 메타로 덮어쓴다.
   */
  upsertMany: (cards: GameCardMeta[]) => void;

  /**
   * WS 에서 내려오는 `PublicHandCard` 배열을 받아 메타로 변환해 캐시에 합친다.
   * - 예: 상대/나의 공개된 손패, 공개된 카드 정보 등.
   */
  upsertFromWsHand: (cards: PublicHandCard[] | null | undefined) => void;

  /**
   * 단일 카드 메타 조회용 helper.
   * - 훅 내부 selector 로도 충분히 대체 가능하지만 편의를 위해 노출.
   */
  getById: (id: string) => GameCardMeta | undefined;

  /**
   * 전체 캐시 초기화.
   * - 방을 나가거나 게임이 완전히 종료됐을 때 호출하는 용도.
   */
  clear: () => void;
};

export const useCardMetaStore = create<CardMetaState & CardMetaActions>((set, get) => ({
  byId: {},

  setFromDeck: (deck) =>
    set((state) => {
      const next = { ...state.byId };

      const addFromEntries = (entries: DeckDto['main_cards'] | DeckDto['cata_cards']) => {
        entries.forEach((entry) => {
          const existing = next[entry.id];
          next[entry.id] = {
            id: entry.id,
            // 한국어 이름이 있으면 우선 사용, 없으면 개발용 이름/기존 값 사용
            name: entry.name_ko || existing?.name || entry.name_dev,
            mana: entry.mana ?? existing?.mana ?? 0,
            type: entry.type,
            description: entry.description_ko ?? existing?.description,
          };
        });
      };

      addFromEntries(deck.main_cards);
      addFromEntries(deck.cata_cards);

      return { byId: next };
    }),

  upsertMany: (cards) =>
    set((state) => {
      if (!cards || cards.length === 0) return state;
      const next = { ...state.byId };
      cards.forEach((card) => {
        const existing = next[card.id];
        next[card.id] = {
          ...existing,
          ...card,
        };
      });
      return { byId: next };
    }),

  upsertFromWsHand: (cards) => {
    if (!cards || cards.length === 0) return;
    const metas: GameCardMeta[] = cards.map((c) => ({
      id: c.id,
      name: c.name,
      mana: c.mana,
      type: c.type,
      description: c.description,
    }));
    get().upsertMany(metas);
  },

  getById: (id) => get().byId[id],

  clear: () => set({ byId: {} }),
}));
