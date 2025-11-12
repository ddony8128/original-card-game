// Server DTO types for API layer

export type AuthRegisterResponse = {
	id: string;
	username: string;
	message: string;
};

export type AuthLoginResponse = {
	id: string;
	username: string;
	message: string;
};

export type AuthMeResponse = {
	id: string;
	username: string;
	created_at: string;
	message: string;
};

export type CardDto = {
	id: string;
	name_ko: string;
	type: "instant" | "ritual" | "catastrophe" | "summon" | "item";
	mana: number;
	effect_json: unknown | null;
	token: boolean;
	description_ko: string;
};

export type CardsListResponse = {
	cards: CardDto[];
	total: number;
	page?: number;
	limit?: number;
};

export type DeckDto = {
	id: string;
	name: string;
	main_cards: string[];
	cata_cards: string[];
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


