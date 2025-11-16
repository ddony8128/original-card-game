import { useQuery } from '@tanstack/react-query';
import { logsApi } from './api';

export function useGameResultQuery(roomId: string | null, enabled = true) {
  return useQuery({
    queryKey: ['logs', 'result', roomId],
    queryFn: () => logsApi.getResult(roomId as string),
    enabled: !!roomId && enabled,
    refetchInterval: 5000,
  });
}

export function useTurnLogsQuery(roomId: string | null, enabled = true) {
  return useQuery({
    queryKey: ['logs', 'turns', roomId],
    queryFn: () => logsApi.getLogs(roomId as string),
    enabled: !!roomId && enabled,
  });
}
