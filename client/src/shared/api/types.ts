// Server DTO types for API layer

export type AuthResponse = {
	id: string;
	username: string;
	message: string;
	created_at: string;
};

export type Json = null | boolean | number | string | { [key: string]: Json } | Json[];

export type CardDto = {
	id: string;
	name_dev: string;
	name_ko: string;
	type: "instant" | "ritual" | "catastrophe" | "summon" | "item";
	mana: number | null;
	effect_json: Json | null;
	token: boolean;
	description_ko: string;
};

export type CardsListResponse = {
	cards: CardDto[];
	total: number;
};

export type DeckDto = {
	id: string;
	name: string;
	main_cards: Array< Omit<CardDto, "token" | "effect_json"> & { count: number } >;
	cata_cards: Array< Omit<CardDto, "token" | "effect_json"> & { count: number } >;
	created_at: string;
	updated_at: string;
};

export type MatchStateDto = {
	roomId: string;
	status: string;
	host?: { id: string; username: string; deckId?: string };
	guest?: { id: string; username: string; deckId?: string };
};

export type GameResultDto = {
	id: string;
	room_id: string;
	started_at: string;
	ended_at: string;
	result: "p1" | "p2" | "draw";
};

export type TurnLogDto = {
	roomId: string;
	logs: { turn: number; text: string }[];
};


