import { http } from '@/shared/api/http';
import type { AuthResponse } from '@/shared/api/types';

export const authApi = {
  register(username: string, password: string) {
    return http<AuthResponse>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
  },
  login(username: string, password: string) {
    return http<AuthResponse>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
  },
  me() {
    return http<AuthResponse>('/api/auth/me');
  },
};
