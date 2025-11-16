import { useQuery } from '@tanstack/react-query';
import { cardsApi, type CardsListParams } from './api';

export function useCardsQuery(params: CardsListParams) {
  return useQuery({
    queryKey: ['cards', params],
    queryFn: () => cardsApi.list(params),
  });
}

/*  no use for now
export function useCardQuery(id: string, enabled = true) {
	return useQuery({
		queryKey: ["card", id],
		queryFn: () => cardsApi.getById(id),
		enabled,
	});
}
*/
