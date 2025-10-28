import { useNavigate } from "react-router-dom";
import { useDeckStore } from "../store/useDeckStore";
import { getDeckLength } from "../utils/deck";

export default function DeckList() {
  const navigate = useNavigate();
  const { decks, deleteDeck } = useDeckStore();

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">내 덱 목록</h1>

      <button
        onClick={() => navigate("/deck-builder")}
        disabled={decks.length >= 4}
        className="mb-4 bg-primary text-white px-4 py-2 rounded disabled:bg-gray-400"
      >
        새 덱 만들기
      </button>
      <button
        onClick={() => navigate("/lobby")}
        className="mb-4 bg-primary text-white px-4 py-2 rounded"
      >
        로비로 돌아가기
      </button>

      {decks.length === 0 ? (
        <p>저장된 덱이 없습니다.</p>
      ) : (
        <ul className="space-y-3">
          {decks.map((deck) => (
            <li key={deck.id} className="border p-4 rounded bg-card">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="font-bold">{deck.name}</h3>
                  <p className="text-xs text-muted-foreground">
                    카드 {getDeckLength(deck)}장
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => navigate(`/deck-builder?id=${deck.id}`)}
                    className="px-3 py-1 bg-blue-500 text-white rounded"
                  >
                    수정
                  </button>
                  <button
                    onClick={() => deleteDeck(deck.id)}
                    className="px-3 py-1 bg-red-500 text-white rounded"
                  >
                    삭제
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
