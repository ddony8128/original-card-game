import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { authApi } from './api';
import { setAuthToken } from '@/shared/api/authToken';

export function useMeQuery(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['auth', 'me'],
    queryFn: () => authApi.me(),
    enabled: options?.enabled ?? true,
  });
}

export function useLoginMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ username, password }: { username: string; password: string }) =>
      authApi.login(username, password),
    onSuccess: async (data) => {
      if (data?.token) setAuthToken(data.token);
      await qc.invalidateQueries({ queryKey: ['auth', 'me'] });
    },
  });
}

export function useRegisterMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ username, password }: { username: string; password: string }) =>
      authApi.register(username, password),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['auth', 'me'] });
    },
  });
}
