import { useNavigate } from "react-router-dom";
import { useDeckStore } from "../store/useDeckStore";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";


export default function DeckList() {
  const navigate = useNavigate();
  const { decks, deleteDeck } = useDeckStore();

  const handleDelete = (id: string, name: string) => {
    if (confirm(`${name} 덱을 삭제하시겠습니까?`)) {
      deleteDeck(id);
      toast.success("덱이 삭제되었습니다.", {
        description: name,
      });
    }
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-background via-background to-accent/10 p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="outline" onClick={() => navigate("/lobby")}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            로비
          </Button>
          <h1 className="text-3xl font-bold">내 덱 목록</h1>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>덱 관리</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {decks.length < 4 && (
              <Button
                onClick={() => navigate("/deck-builder")}
                className="w-full"
              >
                <Plus className="w-4 h-4 mr-2" />
                새 덱 만들기
              </Button>
            )}

            {decks.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                저장된 덱이 없습니다
              </p>
            ) : (
              <div className="space-y-3">
                {decks.map((deck) => (
                  <div
                    key={deck.id}
                    className="flex items-center justify-between p-4 bg-secondary/50 rounded-lg border border-border"
                  >
                    <div>
                      <h3 className="font-bold">{deck.name}</h3>
                      <p className="text-sm text-muted-foreground">
                        카드 {deck.cards.reduce((sum, c) => sum + c.count, 0)}장
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate(`/deck-builder?id=${deck.id}`)}
                      >
                        <Pencil className="w-4 h-4 mr-2" />
                        수정
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDelete(deck.id, deck.name)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
