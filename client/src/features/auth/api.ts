import { http } from "@/shared/api/http";
import type { AuthLoginResponse, AuthMeResponse, AuthRegisterResponse } from "@/shared/api/types";

export const authApi = {
	register(username: string, password: string) {
		return http<AuthRegisterResponse>("/api/auth/register", {
			method: "POST",
			body: JSON.stringify({ username, password }),
		});
	},
	login(username: string, password: string) {
		return http<AuthLoginResponse>("/api/auth/login", {
			method: "POST",
			body: JSON.stringify({ username, password }),
		});
	},
	me() {
		return http<AuthMeResponse>("/api/auth/me");
	},
};


