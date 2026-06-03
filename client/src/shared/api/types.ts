// Server DTO types for API layer

export type AuthResponse = {
  id: string;
  username: string;
  message: string;
  created_at: string;
  // 시크릿탭 등 쿠키가 차단되는 환경 대비용 Bearer 토큰 (login 응답에만 포함)
  token?: string;
};

export type Json = null | boolean | number | string | { [key: string]: Json } | Json[];

export type CardDto = {
  id: string;
  name_dev: string;
  name_ko: string;
  name_en: string;
  type: 'instant' | 'ritual' | 'catastrophe' | 'summon' | 'item';
  mana: number | null;
  effect_json: Json | null;
  token: boolean;
  description_ko: string;
  description_en: string;
};

export type CardsListResponse = {
  cards: CardDto[];
  total: number;
};

export type DeckDto = {
  id: string;
  name: string;
  main_cards: Array<Omit<CardDto, 'token' | 'effect_json'> & { count: number }>;
  cata_cards: Array<Omit<CardDto, 'token' | 'effect_json'> & { count: number }>;
  created_at: string;
  updated_at: string;
};

export type MatchStateDto = {
  roomCode: string;
  roomName?: string | null;
  status: string;
  host?: { id: string; username: string; deckId?: string };
  guest?: { id: string; username: string; deckId?: string };
};

export type WaitingRoomDto = {
  roomCode: string;
  roomName: string | null;
  status: string;
  host?: { id: string; username: string; deckId?: string };
  guest?: { id: string; username: string; deckId?: string };
};

export type GameResultDto = {
  id: string;
  room_id: string;
  started_at: string;
  ended_at: string;
  result: 'p1' | 'p2' | 'draw';
};

export type TurnLogDto = {
  roomId: string;
  logs: { turn: number; text: string }[];
};
