const AUTH_TOKEN_KEY = 'auth_token';

function safeStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function getAuthToken(): string | null {
  return safeStorage()?.getItem(AUTH_TOKEN_KEY) ?? null;
}

export function setAuthToken(token: string): void {
  safeStorage()?.setItem(AUTH_TOKEN_KEY, token);
}

export function clearAuthToken(): void {
  safeStorage()?.removeItem(AUTH_TOKEN_KEY);
}
