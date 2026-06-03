export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '';

export class ApiError extends Error {
  status: number;
  data?: unknown;
  constructor(status: number, message: string, data?: unknown) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

const MAX_QUERY_RETRIES = 2;

export function shouldRetryQuery(failureCount: number, error: unknown): boolean {
  if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
    return false;
  }
  return failureCount < MAX_QUERY_RETRIES;
}

export async function http<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(API_BASE_URL + path, {
    headers: { 'Content-Type': 'application/json', ...(options.headers ?? {}) },
    credentials: 'include',
    ...options,
  });

  const isJson = response.headers.get('content-type')?.includes('application/json');
  const body = isJson ? await response.json().catch(() => undefined) : undefined;

  if (!response.ok) {
    let message = `HTTP ${response.status}`;
    if (body && typeof body === 'object' && 'message' in body) {
      const m = (body as { message?: unknown }).message;
      if (typeof m === 'string') message = m;
    }
    throw new ApiError(response.status, message, body);
  }
  return body as T;
}
