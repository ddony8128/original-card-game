import { http } from "@/shared/api/http";
import type { MatchStateDto } from "@/shared/api/types";

export const matchApi = {
	create() {
		return http<{ roomId: string; status: string; host: { id: string; username?: string } }>(
			"/api/match/create",
			{ method: "POST" },
		);
	},
	join(roomId: string) {
		return http<MatchStateDto>("/api/match/join", {
			method: "POST",
			body: JSON.stringify({ roomId }),
		});
	},
	submitDeck(roomId: string, deckId: string) {
		return http<MatchStateDto>("/api/match/deck", {
			method: "PATCH",
			body: JSON.stringify({ roomId, deckId }),
		});
	},
	state(roomId: string) {
		return http<MatchStateDto>(`/api/match/${roomId}`);
	},
	leave(roomId: string) {
		return http<{ roomId: string; status: string }>("/api/match/leave", {
			method: "POST",
			body: JSON.stringify({ roomId }),
		});
	},
	delete(roomId: string) {
		return http<{ roomId: string; status: string }>(`/api/match/${roomId}`, {
			method: "DELETE",
		});
	},
};


