export interface Card {
  id: string;
  name_dev: string;
  name_ko: string;
  name_en: string;
  description_ko: string;
  description_en: string;
  type: 'instant' | 'ritual' | 'catastrophe' | 'summon' | 'item';
  mana: number | null;
}

export interface DeckCard extends Card {
  count: number;
}

export interface Deck {
  id: string;
  name: string;
  cards: DeckCard[];
  createdAt: number;
  updatedAt: number;
}
