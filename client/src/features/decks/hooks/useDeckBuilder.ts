import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import type { DeckCard, Card as LocalCard } from '@/shared/types/deck';
import { useCardsQuery } from '@/features/cards/queries';
import { useDecksQuery, useSaveDeckMutation } from '@/features/decks/queries';
import type { CardDto } from '@/shared/api/types';

const MAX_MAIN_SIZE = 16;
const MAX_CATA_SIZE = 4;
const MAX_DUPLICATE = 2;

export const useDeckBuilder = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  // 로컬 스토어 제거: 서버만 사용

  const [deckName, setDeckName] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedMana, setSelectedMana] = useState<number | null>(null);
  const [selectedTab, setSelectedTab] = useState<'main' | 'cata'>('main');

  const [serverEditingDeckId, setServerEditingDeckId] = useState<string | null>(null);
  const [deckCards, setDeckCards] = useState<DeckCard[]>([]);

  // 서버 카드/덱 로드
  const cardsParams = {
    // 서버에서 mana=5를 5+로 처리하도록 변경됨
    mana: selectedMana !== null ? selectedMana : undefined,
    name: searchQuery || undefined,
  } as const;
  const { data: cardsResp, isLoading: loadingCards } = useCardsQuery(cardsParams);
  const { data: serverDecks } = useDecksQuery();
  const saveDeck = useSaveDeckMutation();

  // 카드 id -> dto 맵 (저장 시 분류용)
  const cardDtoById = useMemo(
    () => new Map<string, CardDto>((cardsResp?.cards ?? []).map((c) => [c.id, c])),
    [cardsResp?.cards],
  );

  useEffect(() => {
    const sid = searchParams.get('sid'); // 서버 덱 편집용
    if (sid && serverDecks) {
      const s = serverDecks.find((d) => d.id === sid);
      if (s) {
        setServerEditingDeckId(s.id);
        setDeckName(s.name);
        // 서버 덱은 {id,count} 형태이므로 그대로 병합
        const counts = new Map<string, number>();
        s.main_cards.forEach((e) => counts.set(e.id, (counts.get(e.id) ?? 0) + (e.count ?? 0)));
        s.cata_cards.forEach((e) => counts.set(e.id, (counts.get(e.id) ?? 0) + (e.count ?? 0)));
        const asCards: DeckCard[] = Array.from(counts.entries()).flatMap(([id, count]) => {
          const dto = cardDtoById.get(id);
          if (!dto) return [];
          return [
            {
              id: dto.id,
              name_dev: dto.name_dev,
              name_ko: dto.name_ko,
              description_ko: dto.description_ko ?? '',
              mana: dto.mana,
              type: dto.type as 'instant' | 'ritual' | 'catastrophe' | 'summon' | 'item',
              count,
            },
          ];
        });
        setDeckCards(asCards);
      }
    }
  }, [searchParams, serverDecks, cardDtoById]);

  const allCards: LocalCard[] = (cardsResp?.cards ?? [])
    // token 카드 필터링
    .filter((dto) => !dto.token)
    .map(
      (dto): LocalCard => ({
        id: dto.id,
        name_dev: dto.name_dev,
        name_ko: dto.name_ko,
        description_ko: dto.description_ko ?? '',
        mana: dto.mana,
        type: dto.type as 'instant' | 'ritual' | 'catastrophe' | 'summon' | 'item',
      }),
    );

  // 탭(메인 / 재앙)에 따라 표시할 카드 분리
  const filteredCards = useMemo(() => {
    if (selectedTab === 'cata') {
      return allCards.filter((c) => c.type === 'catastrophe');
    }
    // main 탭: 재앙이 아닌 카드만
    return allCards.filter((c) => c.type !== 'catastrophe');
  }, [allCards, selectedTab]);

  const isCatastrophe = (cardId: string) => {
    const dto = cardDtoById.get(cardId);
    return dto?.type === 'catastrophe';
  };

  const countsByCategory = () => {
    let main = 0;
    let cata = 0;
    for (const dc of deckCards) {
      if (isCatastrophe(dc.id)) cata += dc.count;
      else main += dc.count;
    }
    return { main, cata };
  };

  const getCardCount = (cardId: string): number => {
    return deckCards.find((c) => c.id === cardId)?.count || 0;
  };

  const handleAdd = (cardId: string) => {
    const card = allCards.find((c) => c.id === cardId);
    if (!card) return;

    const existing = deckCards.find((c) => c.id === cardId);
    if (existing && existing.count >= MAX_DUPLICATE)
      return toast.error('최대 2장까지만 추가할 수 있습니다.');

    const { main, cata } = countsByCategory();
    if (isCatastrophe(cardId)) {
      if (cata + 1 > MAX_CATA_SIZE) {
        return toast.error('재앙 카드는 최대 4장까지 추가할 수 있습니다.');
      }
    } else {
      if (main + 1 > MAX_MAIN_SIZE) {
        return toast.error('메인 카드는 최대 16장까지 추가할 수 있습니다.');
      }
    }

    setDeckCards((prev) =>
      existing
        ? prev.map((c) => (c.id === cardId ? { ...c, count: c.count + 1 } : c))
        : [...prev, { ...card, count: 1 }],
    );

    toast.success('카드가 추가되었습니다!', {
      description: card.name_ko,
    });
  };

  const handleRemove = (cardId: string) => {
    const card = allCards.find((c) => c.id === cardId);

    setDeckCards((prev) => {
      const existing = prev.find((c) => c.id === cardId);
      if (!existing) return prev;
      return prev
        .map((c) => (c.id === cardId ? { ...c, count: c.count - 1 } : c))
        .filter((c) => c.count > 0);
    });

    toast.success('카드가 제거되었습니다!', {
      description: card?.name_ko || '',
    });
  };

  const handleSave = async () => {
    if (saveDeck.isPending) return;
    if (!deckName.trim()) {
      toast.error('덱 이름을 입력하세요.');
      return;
    }

    if (deckCards.length === 0) {
      toast.error('덱에 카드를 추가하세요.');
      return;
    }

    const { main, cata } = countsByCategory();
    if (main !== MAX_MAIN_SIZE) {
      return toast.error(`메인 카드는 ${MAX_MAIN_SIZE}장이어야 합니다.`);
    }
    if (cata !== MAX_CATA_SIZE) {
      return toast.error(`재앙 카드는 ${MAX_CATA_SIZE}장이어야 합니다.`);
    }

    // 서버 저장/수정: 서버 포맷({id, count} 배열)으로 전송
    try {
      // id별 count 집계
      const countMap = new Map<string, number>();
      for (const dc of deckCards) countMap.set(dc.id, (countMap.get(dc.id) ?? 0) + dc.count);
      const entries = Array.from(countMap.entries()).map(([id, count]) => ({
        id,
        count,
      }));
      const main_cards = entries.filter((e) => !isCatastrophe(e.id));
      const cata_cards = entries.filter((e) => isCatastrophe(e.id));

      await saveDeck.mutateAsync({
        deckId: serverEditingDeckId,
        name: deckName,
        main_cards,
        cata_cards,
      });
      toast.success(
        serverEditingDeckId
          ? '서버 덱이 수정되었습니다!'
          : '서버 덱이 저장되었습니다!',
        { description: deckName },
      );

      // 로컬 동기화 제거: 서버를 단일 소스로 사용
    } catch (e: unknown) {
      const message =
        e instanceof Error
          ? e.message
          : typeof e === 'object' && e && 'message' in e
            ? (e as { message?: unknown }).message
            : undefined;
      toast.error(typeof message === 'string' ? message : '서버 저장 중 오류가 발생했습니다.');
      return; // 실패 시 이동하지 않음
    }

    navigate('/lobby');
  };

  return {
    navigate,
    deckName,
    setDeckName,
    searchQuery,
    setSearchQuery,
    selectedMana,
    setSelectedMana,
    selectedTab,
    setSelectedTab,
    serverEditingDeckId,
    deckCards,
    loadingCards,
    cardDtoById,
    filteredCards,
    getCardCount,
    handleAdd,
    handleRemove,
    handleSave,
    isPending: saveDeck.isPending,
    MAX_MAIN_SIZE,
    MAX_CATA_SIZE,
  };
};
