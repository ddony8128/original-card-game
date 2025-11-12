import type { AuthMeResponse, DeckDto } from "@/shared/api/types";
import type { User } from "@/types/user";

export function toLocalUser(me: AuthMeResponse): User {
	return {
		id: me.id,
		name: me.username,
		decks: [],
		createdAt: Date.parse(me.created_at),
		updatedAt: Date.now(),
	};
}

export function deckDtoToSummary(dto: DeckDto) {
	return {
		id: dto.id,
		name: dto.name,
		cardCounts: {
			main: dto.main_cards.length,
			cata: dto.cata_cards.length,
		},
		createdAt: Date.parse(dto.created_at),
		updatedAt: Date.parse(dto.updated_at),
	};
}

export function ensureArray<T>(value: T | T[] | undefined | null): T[] {
	if (Array.isArray(value)) return value;
	if (value == null) return [];
	return [value];
}


