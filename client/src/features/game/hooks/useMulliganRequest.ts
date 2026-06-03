import { useMemo, useCallback } from 'react';
import type { AskMulliganPayload, AnswerMulliganPayload } from '@/shared/types/ws';
import { useGameFogStore } from '@/shared/store/gameStore';
import { useCardMetaStore } from '@/shared/store/cardMetaStore';
import type { InputRequest, InputOption } from '@/components/game/RequestInputModal';

type UseMulliganRequestParams = {
  sendAnswerMulligan: (payload: AnswerMulliganPayload) => void;
};

type UseMulliganRequestResult = {
  mulliganRequest: InputRequest | null;
  handleMulliganResponse: (response: InputOption[]) => void;
  handleMulliganCancel: () => void;
};

export function useMulliganRequest({
  sendAnswerMulligan,
}: UseMulliganRequestParams): UseMulliganRequestResult {
  const mulligan = useGameFogStore((s) => s.mulligan) as AskMulliganPayload | null;
  const setMulligan = useGameFogStore((s) => s.setMulligan);
  const cardMetaById = useCardMetaStore((s) => s.byId);

  const mulliganRequest: InputRequest | null = useMemo(() => {
    if (!mulligan) return null;
    return {
      type: 'mulligan',
      prompt: '멀리건할 카드를 선택하세요.',
      options: mulligan.initialHand.map((inst, idx) => {
        const cardId = inst.cardId;
        const meta = cardMetaById[cardId];
        const option: InputOption & {
          idx: number;
          cardId: string;
          instanceId: string;
          mana?: number;
          description?: string;
        } = {
          idx,
          cardId,
          instanceId: inst.id,
          name: meta?.name ?? cardId,
          mana: meta?.mana,
          description: meta?.description,
        };
        return option;
      }),
      minSelect: 0,
      maxSelect: mulligan.initialHand.length,
    };
  }, [mulligan, cardMetaById]);

  const handleMulliganResponse = useCallback(
    (response: InputOption[]) => {
      if (!mulliganRequest) return;
      const indices = response
        .map((opt) => (opt as { idx?: unknown }).idx)
        .filter((v): v is number => typeof v === 'number');
      sendAnswerMulligan({ replaceIndices: indices });
      setMulligan(null);
    },
    [mulliganRequest, sendAnswerMulligan, setMulligan],
  );

  const handleMulliganCancel = useCallback(() => {
    if (!mulliganRequest) return;
    // 멀리건을 취소하면 아무 카드도 교체하지 않는 것으로 처리
    sendAnswerMulligan({ replaceIndices: [] });
    setMulligan(null);
  }, [mulliganRequest, sendAnswerMulligan, setMulligan]);

  return {
    mulliganRequest,
    handleMulliganResponse,
    handleMulliganCancel,
  };
}
