import { useQuery } from '@tanstack/react-query';
import { pveApi } from './api';

export const pveProgressQueryKey = ['pve', 'progress'] as const;
export const pveStagesQueryKey = ['pve', 'stages'] as const;

export function usePveStagesQuery() {
  return useQuery({ queryKey: pveStagesQueryKey, queryFn: () => pveApi.getStages() });
}

export function usePveProgressQuery() {
  return useQuery({
    queryKey: pveProgressQueryKey,
    queryFn: () => pveApi.getProgress(),
    // 게임에서 돌아왔을 때 최신 클리어 상태를 반영하기 위해 마운트 시 재요청.
    refetchOnMount: 'always',
  });
}
