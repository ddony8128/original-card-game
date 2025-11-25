import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { matchApi } from './api';

export function useMatchStateQuery(roomCode: string | null, enabled = true) {
  return useQuery({
    queryKey: ['match', 'state', roomCode],
    queryFn: () => matchApi.state(roomCode as string),
    enabled: !!roomCode && enabled,
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
    mutationFn: (roomCode: string) => matchApi.join(roomCode),
    onSuccess: (_, roomCode) => {
      qc.invalidateQueries({ queryKey: ['match', 'state', roomCode] });
    },
  });
}

export function useSubmitDeckMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ roomCode, deckId }: { roomCode: string; deckId: string }) =>
      matchApi.submitDeck(roomCode, deckId),
    onSuccess: (_, { roomCode }) => {
      qc.invalidateQueries({ queryKey: ['match', 'state', roomCode] });
    },
  });
}

export function useLeaveRoomMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (roomCode: string) => matchApi.leave(roomCode),
    onSuccess: (_, roomCode) => {
      qc.invalidateQueries({ queryKey: ['match', 'state', roomCode] });
    },
  });
}

export function useDeleteRoomMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (roomCode: string) => matchApi.delete(roomCode),
    onSuccess: (_, roomCode) => {
      qc.invalidateQueries({ queryKey: ['match', 'state', roomCode] });
    },
  });
}
