export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "";

export class ApiError extends Error {
	status: number;
	data?: unknown;
	constructor(status: number, message: string, data?: unknown) {
		super(message);
		this.status = status;
		this.data = data;
	}
}

export async function http<T>(path: string, options: RequestInit = {}): Promise<T> {
	const response = await fetch(API_BASE_URL + path, {
		headers: { "Content-Type": "application/json", ...(options.headers ?? {}) },
		credentials: "include",
		...options,
	});

	const isJson = response.headers.get("content-type")?.includes("application/json");
	const body = isJson ? await response.json().catch(() => undefined) : undefined;

	if (!response.ok) {
		const message = (body as any)?.message ?? `HTTP ${response.status}`;
		throw new ApiError(response.status, message, body);
	}
	return body as T;
}


