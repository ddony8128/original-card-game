import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { decksApi } from './api';

export function useDecksQuery() {
  return useQuery({ queryKey: ['decks'], queryFn: () => decksApi.list() });
}

export function useCreateDeckMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: decksApi.create,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['decks'] });
    },
  });
}

export function useUpdateDeckMutation(deckId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      name: string;
      main_cards: Array<{ id: string; count: number }>;
      cata_cards: Array<{ id: string; count: number }>;
    }) => decksApi.update(deckId, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['decks'] });
    },
  });
}

export function useDeleteDeckMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (deckId: string) => decksApi.delete(deckId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['decks'] });
    },
  });
}
