import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { cardsApi, type CardsListParams } from './api';

// 카드 카탈로그는 플레이 세션 중 바뀌지 않는 리소스이므로 길게 캐시한다.
// 같은 검색어를 다시 입력해도(예: '마'→'마나'→'마') 재요청하지 않는다.
const CARDS_STALE_TIME_MS = 5 * 60 * 1000;

export function useCardsQuery(params: CardsListParams) {
  return useQuery({
    queryKey: ['cards', params],
    queryFn: () => cardsApi.list(params),
    staleTime: CARDS_STALE_TIME_MS,
    placeholderData: keepPreviousData,
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
