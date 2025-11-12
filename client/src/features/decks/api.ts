import { http } from "@/shared/api/http";
import type { DeckDto } from "@/shared/api/types";

export const decksApi = {
	list() {
		return http<DeckDto[]>("/api/decks");
	},
	create(input: { name: string; main_cards: string[]; cata_cards: string[] }) {
		return http<DeckDto>("/api/decks", {
			method: "POST",
			body: JSON.stringify(input),
		});
	},
	update(deckId: string, input: { name: string; main_cards: string[]; cata_cards: string[] }) {
		return http<DeckDto>(`/api/decks/${deckId}`, {
			method: "PUT",
			body: JSON.stringify(input),
		});
	},
	delete(deckId: string) {
		return http<void>(`/api/decks/${deckId}`, {
			method: "DELETE",
		});
	},
};


