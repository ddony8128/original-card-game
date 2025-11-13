import { useState, useEffect, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { GameCard } from "@/components/deck-builder/GameCard";
import { CardFilters } from "@/components/deck-builder/CardFilters";
import { DeckPanel } from "@/components/deck-builder/DeckPanel";
import type { DeckCard, Card as LocalCard } from "@/shared/types/deck";
import { ArrowLeft, Save } from "lucide-react";
import { toast } from "sonner";
import { useCardsQuery } from "@/features/cards/queries";
import { useDecksQuery } from "@/features/decks/queries";
import { decksApi } from "@/features/decks/api";
import type { CardDto } from "@/shared/api/types";

const MAX_MAIN_SIZE = 16;
const MAX_CATA_SIZE = 4;
const MAX_DUPLICATE = 2;

const DeckBuilder = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  // 로컬 스토어 제거: 서버만 사용

  const [deckName, setDeckName] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedMana, setSelectedMana] = useState<number | null>(null);

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

  // 카드 id -> dto 맵 (저장 시 분류용)
  const cardDtoById = useMemo(
    () =>
      new Map<string, CardDto>(
        (cardsResp?.cards ?? []).map((c) => [c.id, c])
      ),
    [cardsResp?.cards]
  );

  useEffect(() => {
    const sid = searchParams.get("sid"); // 서버 덱 편집용
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
              description_ko: dto.description_ko ?? "",
              mana: dto.mana,
              type: dto.type as "instant" | "ritual" | "catastrophe" | "summon" | "item",
              count,
            },
          ];
        });
        setDeckCards(asCards);
      }
    }
  }, [searchParams, serverDecks, cardDtoById]);

  const allCards: LocalCard[] = (cardsResp?.cards ?? []).map(
    (dto): LocalCard => ({
      id: dto.id,
      name_dev: dto.name_dev,
      name_ko: dto.name_ko,
      description_ko: dto.description_ko ?? "",
      mana: dto.mana,
      type: dto.type as "instant" | "ritual" | "catastrophe" | "summon" | "item",
    })
  );

  // 필터링은 서버에서 처리하므로 그대로 사용
  const filteredCards = allCards;

  const isCatastrophe = (cardId: string) => {
    const dto = cardDtoById.get(cardId);
    return dto?.type === "catastrophe";
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
      return toast.error("최대 2장까지만 추가할 수 있습니다.");

    const { main, cata } = countsByCategory();
    if (isCatastrophe(cardId)) {
      if (cata + 1 > MAX_CATA_SIZE) {
        return toast.error("재앙 카드는 최대 4장까지 추가할 수 있습니다.");
      }
    } else {
      if (main + 1 > MAX_MAIN_SIZE) {
        return toast.error("메인 카드는 최대 16장까지 추가할 수 있습니다.");
      }
    }

    setDeckCards((prev) =>
      existing
        ? prev.map((c) => (c.id === cardId ? { ...c, count: c.count + 1 } : c))
        : [...prev, { ...card, count: 1 }]
    );

    toast.success("카드가 추가되었습니다!", {
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

    toast.success("카드가 제거되었습니다!", {
      description: card?.name_ko || "",
    });
  };

  const handleSave = async () => {
    if (!deckName.trim()) {
      toast.error("덱 이름을 입력하세요.");
      return;
    }

    if (deckCards.length === 0) {
      toast.error("덱에 카드를 추가하세요.");
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
      for (const dc of deckCards)
        countMap.set(dc.id, (countMap.get(dc.id) ?? 0) + dc.count);
      const entries = Array.from(countMap.entries()).map(([id, count]) => ({
        id,
        count,
      }));
      const main_cards = entries.filter((e) => !isCatastrophe(e.id));
      const cata_cards = entries.filter((e) => isCatastrophe(e.id));

      if (serverEditingDeckId) {
        await decksApi.update(serverEditingDeckId, {
          name: deckName,
          main_cards,
          cata_cards,
        });
        toast.success("서버 덱이 수정되었습니다!", { description: deckName });
      } else {
        await decksApi.create({
          name: deckName,
          main_cards,
          cata_cards,
        });
        toast.success("서버 덱이 저장되었습니다!", { description: deckName });
      }

      // 로컬 동기화 제거: 서버를 단일 소스로 사용
    } catch (e: any) {
      toast.error(e?.message ?? "서버 저장 중 오류가 발생했습니다.");
      return; // 실패 시 이동하지 않음
    }

    navigate("/lobby");
  };

  return (
    <div className="min-h-screen bg-linear-to-br from-background via-background to-accent/10">
      <div className="container mx-auto p-6">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="outline" onClick={() => navigate("/lobby")}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            로비로 돌아가기
          </Button>
          <h1 className="text-4xl font-bold bg-linear-to-r from-primary to-accent bg-clip-text">
            {serverEditingDeckId ? "덱 수정" : "덱 빌더"}
          </h1>
        </div>

        <div className="flex gap-4 mb-6">
          <Input
            placeholder="덱 이름"
            value={deckName}
            onChange={(e) => setDeckName(e.target.value)}
            className="max-w-xs"
          />
          <Button onClick={handleSave}>
            <Save className="w-4 h-4 mr-2" />
            {serverEditingDeckId ? "수정 완료" : "덱 저장"}
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-6 h-[calc(100vh-240px)]">
          {/* Left Panel - Card Collction */}
          <div className="flex flex-col gap-4 min-h-0">
            <CardFilters
              selectedMana={selectedMana}
              onManaSelect={setSelectedMana}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
            />

            <div className="flex-1 bg-card rounded-lg border border-border overflow-hidden">
              <ScrollArea className="h-full p-4">
                {loadingCards ? (
                  <div className="flex items-center justify-center h-64 text-muted-foreground">
                    <p>카드를 불러오는 중...</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                    {filteredCards.map((card) => (
                      <GameCard
                        key={card.id}
                        card={card}
                        onClick={() => handleAdd(card.id)}
                        count={getCardCount(card.id)}
                      />
                    ))}
                  </div>
                )}
                {!loadingCards && filteredCards.length === 0 && (
                  <div className="flex items-center justify-center h-64 text-muted-foreground">
                    <p>검색 결과가 없습니다</p>
                  </div>
                )}
              </ScrollArea>
            </div>
          </div>
          {/* Right Panel - Deck */}
          <div className="flex flex-col gap-4 min-h-0">
            <DeckPanel
              deckCards={deckCards}
              onRemoveCard={handleRemove}
              maxMainSize={MAX_MAIN_SIZE}
              maxCataSize={MAX_CATA_SIZE}
              cataIds={new Set(
                deckCards.flatMap((dc) => {
                  // 선택된 카드가 재앙인지 여부는 dto를 통해 판별
                  const dto = cardDtoById.get(dc.id);
                  return dto?.type === "catastrophe" ? [dc.id] : [];
                })
              )}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default DeckBuilder;