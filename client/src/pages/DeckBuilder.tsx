import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { mockCards } from "../data/mockCards";
import { useDeckStore } from "../store/useDeckStore";
import type { DeckCard } from "../types/deck";
import { toast } from "sonner";

const MAX_DECK_SIZE = 16;
const MAX_DUPLICATE = 2;

export default function DeckBuilder() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const deckId = params.get("id");
  const { addDeck, updateDeck, getDeck } = useDeckStore();

  const editingDeck = deckId ? getDeck(deckId) : null;
  const [deckCards, setDeckCards] = useState<DeckCard[]>(editingDeck?.cards || []);
  const [name, setName] = useState(editingDeck?.name || "");

  const total = deckCards.reduce((sum, c) => sum + c.count, 0);

  const handleAdd = (cardId: string) => {
    const card = mockCards.find((c) => c.id === cardId);
    if (!card) return;

    const existing = deckCards.find((c) => c.id === cardId);
    if (existing && existing.count >= MAX_DUPLICATE)
      return toast.error("최대 2장까지만 추가할 수 있습니다.");

    if (total >= MAX_DECK_SIZE)
      return toast.error("덱이 가득 찼습니다!");

    setDeckCards((prev) =>
      existing
        ? prev.map((c) => (c.id === cardId ? { ...c, count: c.count + 1 } : c))
        : [...prev, { ...card, count: 1 }]
    );
  };

  const handleRemove = (cardId: string) => {
    setDeckCards((prev) =>
      prev
        .map((c) => (c.id === cardId ? { ...c, count: c.count - 1 } : c))
        .filter((c) => c.count > 0)
    );
  };

  const handleSave = () => {
    if (total !== MAX_DECK_SIZE)
      return toast.error(`덱은 ${MAX_DECK_SIZE}장이어야 저장됩니다.`);

    if (!name.trim()) return toast.error("덱 이름을 입력하세요.");

    const newDeck = {
      id: editingDeck?.id || crypto.randomUUID(),
      name,
      cards: deckCards,
      createdAt: editingDeck?.createdAt || Date.now(),
      updatedAt: Date.now(),
    };

    editingDeck ? updateDeck(newDeck) : addDeck(newDeck);
    toast.success("덱이 저장되었습니다!");
    navigate("/deck-list");
  };

  return (
    <div className="p-6">
      <h1 className="text-xl font-bold mb-4">
        {editingDeck ? "덱 수정" : "새 덱 만들기"}
      </h1>

      <input
        placeholder="덱 이름"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="border p-2 rounded mb-4 w-full"
      />

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

        <div className="w-64 border rounded p-4 bg-secondary">
          <h2 className="font-bold mb-2">현재 덱 ({total}/16)</h2>
          {deckCards.length === 0 && <p>카드를 추가하세요.</p>}
          {deckCards.map((c) => (
            <div key={c.id} className="flex justify-between items-center mb-1">
              <span>{c.name}</span>
              <div className="flex gap-2 items-center">
                <span>x{c.count}</span>
                <button
                  onClick={() => handleRemove(c.id)}
                  className="text-red-500 hover:text-red-700"
                >
                  -1
                </button>
              </div>
            </div>
          ))}

          <button
            onClick={handleSave}
            className="mt-4 w-full bg-primary text-white py-2 rounded"
          >
            저장
          </button>
        </div>
      </div>
    </div>
  );
}
