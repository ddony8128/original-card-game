import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { mockCards } from "../data/mockCards";
import { GameCard } from "@/components/deck-builder/GameCard";
import { CardFilters } from "@/components/deck-builder/CardFilters";
import { DeckPanel } from "@/components/deck-builder/DeckPanel";
import { useDeckStore } from "../store/useDeckStore";
import type { Deck, DeckCard } from "../types/deck";
import { ArrowLeft, Save } from "lucide-react";
import { toast } from "sonner";

const MAX_DECK_SIZE = 16;
const MAX_DUPLICATE = 2;

const Index = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { addDeck, updateDeck, getDeck, decks } = useDeckStore();

  const [deckName, setDeckName] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedMana, setSelectedMana] = useState<number | null>(null);

  const [editingDeckId, setEditingDeckId] = useState<string | null>(null);
  const [deckCards, setDeckCards] = useState<DeckCard[]>([]);

  useEffect(() => {
    const deckId = searchParams.get("id");
    if (deckId) {
      const deck = getDeck(deckId);
      if (deck) {
        setEditingDeckId(deckId);
        setDeckName(deck.name);
        setDeckCards(deck.cards);
      }
    }
  }, [searchParams, getDeck]);

  const filteredCards = mockCards.filter((card) => {
    const matchesMana =
      selectedMana === null ||
      (selectedMana === 5 ? card.manaCost >= 5 : card.manaCost === selectedMana);
    const matchsSearch =
      searchQuery === "" ||
      card.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesMana && matchsSearch;
  });

  const total = deckCards.reduce((sum, c) => sum + c.count, 0);

  const getCardCount = (cardId: string): number => {
    return deckCards.find((c) => c.id === cardId)?.count || 0;
  };

  const handleAdd = (cardId: string) => {
    if (total >= MAX_DECK_SIZE) {
      return toast.error("덱이 가득 찼습니다!", {
        description: `최대 ${MAX_DECK_SIZE}장까지 추가할 수 있습니다.`,
      });
    }

    const card = mockCards.find((c) => c.id === cardId);
    if (!card) return;

    const existing = deckCards.find((c) => c.id === cardId);
    if (existing && existing.count >= MAX_DUPLICATE)
      return toast.error("최대 2장까지만 추가할 수 있습니다.");

    setDeckCards((prev) =>
      existing
        ? prev.map((c) => (c.id === cardId ? { ...c, count: c.count + 1 } : c))
        : [...prev, { ...card, count: 1 }]
    );
    
    toast.success("카드가 추가되었습니다!", {
      description: card.name,
    });
  };

  const handleRemove = (cardId: string) => {
    const card = mockCards.find((c) => c.id === cardId);

    setDeckCards((prev) => {
        const existing = prev.find((c) => c.id === cardId);
        if (!existing) return prev;
        return prev
            .map((c) => (c.id === cardId ? { ...c, count: c.count - 1 } : c))
            .filter((c) => c.count > 0);
    });

    toast.success("카드가 제거되었습니다!", {
      description: card?.name || "",
    });
  };

  const handleSave = () => {
    if (!deckName.trim()) {
      toast.error("덱 이름을 입력하세요.");
      return;
    }

    if (deckCards.length === 0) {
      toast.error("덱에 카드를 추가하세요.");
      return;
    }

    if (total !== MAX_DECK_SIZE)
      return toast.error(`덱은 ${MAX_DECK_SIZE}장이어야 합니다.`);

    const now = Date.now();
    const deck: Deck = {
      id: editingDeckId || crypto.randomUUID(),
      name: deckName,
      cards: deckCards,
      createdAt: editingDeckId ? getDeck(editingDeckId)?.createdAt || now : now,
      updatedAt: now,
    };

    if (editingDeckId) {
      updateDeck(editingDeckId, deck);
      toast.success("덱이 수정되었습니다!", {
        description: deckName,
      });
    } else {
      if (decks.length >= 4) {
        toast.error("최대 4개의 덱만 저장할 수 있습니다.");
        return;
      }
      addDeck(deck);
      toast.success("덱이 저장되었습니다!", {
        description: deckName,
      });
    }

    navigate("/deck-list");
  };


  return (
    <div className="min-h-screen bg-linear-to-br from-background via-background to-accent/10">
      <div className="container mx-auto p-6">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="outline" onClick={() => navigate("/lobby")}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            로비로 돌아가기
          </Button>
          <h1 className="text-4xl font-bold bg-linear-to-r from-primary to-accent bg-clip-text text-transparent">
            {editingDeckId ? "덱 수정" : "덱 빌더"}
          </h1>
        </div>

        <div className= "flex gap-4 mb-6">
            <Input
              placeholder="덱 이름"
              value={deckName}
              onChange={(e) => setDeckName(e.target.value)}
              className="max-w-xs"
            />
            <Button onClick={handleSave}>
              <Save className="w-4 h-4 mr-2" />
              {editingDeckId ? "수정 완료" : "덱 저장"}
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
                {filteredCards.length === 0 && (
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
              onCardRemove={handleRemove}
              onDeckSave={handleSave}
            />
          </div>
        </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="col-span-1">
      <h1 className="text-xl font-bold mb-4">
        {editingDeckId ? "덱 수정" : "새 덱 만들기"}
      </h1>



      <div className="flex gap-4">
        <div className="flex-1 grid grid-cols-2 md:grid-cols-3 gap-3">
          {mockCards.map((card) => {
            const count = deckCards.find((c) => c.id === card.id)?.count || 0;
            return (
              <button
                key={card.id}
                onClick={() => handleAdd(card.id)}
                className="border p-3 rounded bg-card hover:bg-accent text-left"
              >
                <div className="flex justify-between items-center mb-1">
                  <span className="font-bold">{card.name}</span>
                  <span className="text-sm">{count > 0 && `x${count}`}</span>
                </div>
                <p className="text-sm text-muted-foreground">{card.description}</p>
                <p className="text-xs text-primary mt-1">마나 {card.manaCost}</p>
              </button>
            );
          })}
        </div>

        </div>
          </div>

          {/* Right Panel - Deck */}
          <DeckPanel
            deckCards={deckCards}
            onRemoveCard={handleRemove}
            maxDeckSize={MAX_DECK_SIZE}
          />
        </div>
      </div>
  );
}

export default Index;