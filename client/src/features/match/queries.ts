import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { matchApi } from './api';

export function useMatchStateQuery(roomId: string | null, enabled = true) {
  return useQuery({
    queryKey: ['match', 'state', roomId],
    queryFn: () => matchApi.state(roomId as string),
    enabled: !!roomId && enabled,
    refetchInterval: 3000,
  });
}

export function useCreateRoomMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: matchApi.create,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['match'] });
    },
  });
}

export function useJoinRoomMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (roomId: string) => matchApi.join(roomId),
    onSuccess: (_, roomId) => {
      qc.invalidateQueries({ queryKey: ['match', 'state', roomId] });
    },
  });
}

export function useSubmitDeckMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ roomId, deckId }: { roomId: string; deckId: string }) =>
      matchApi.submitDeck(roomId, deckId),
    onSuccess: (_, { roomId }) => {
      qc.invalidateQueries({ queryKey: ['match', 'state', roomId] });
    },
  });
}

export function useLeaveRoomMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (roomId: string) => matchApi.leave(roomId),
    onSuccess: (_, roomId) => {
      qc.invalidateQueries({ queryKey: ['match', 'state', roomId] });
    },
  });
}

export function useDeleteRoomMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (roomId: string) => matchApi.delete(roomId),
    onSuccess: (_, roomId) => {
      qc.invalidateQueries({ queryKey: ['match', 'state', roomId] });
    },
  });
}
