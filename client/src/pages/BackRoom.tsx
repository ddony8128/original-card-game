import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useDecksQuery } from "@/features/decks/queries";
import {
  useLeaveRoomMutation,
  useMatchStateQuery,
  useSubmitDeckMutation,
} from "@/features/match/queries";
import { toast } from "sonner";
import { useMeQuery } from "@/features/auth/queries";

export default function BackRoom() {
  const navigate = useNavigate();
  const { roomId } = useParams<{ roomId: string }>();
  const { data: me } = useMeQuery();

  const { data: state, refetch: refetchState } = useMatchStateQuery(
    roomId,
    true
  );
  const { data: serverDecks, isLoading: loadingDecks } = useDecksQuery();
  const leaveRoom = useLeaveRoomMutation();
  const submitDeck = useSubmitDeckMutation();

  const [selectedDeckId, setSelectedDeckId] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);

  useEffect(() => {
    if (!me) navigate("/login");
    if (!roomId) navigate("/lobby");
  }, [me, roomId, navigate]);

  const canStart = state?.status === "playing";
  const hostName = state?.host?.username ?? "(대기 중)";
  const guestName = state?.guest?.username ?? "(대기 중)";

  const handleLeave = async () => {
    if (!roomId) return;
    try {
      await leaveRoom.mutateAsync(roomId);
      toast.success("방에서 나갔습니다.");
      navigate("/lobby");
    } catch (e: any) {
      toast.error(e?.message ?? "방 나가기에 실패했습니다.");
    }
  };

  const handleSelectDeck = async (deckId: string) => {
    if (!roomId || locked) return;
    try {
      await submitDeck.mutateAsync({ roomId, deckId });
      setSelectedDeckId(deckId);
      setLocked(true);
      toast.success("덱이 제출되었습니다.");
      await refetchState();
    } catch (e: any) {
      toast.error(e?.message ?? "덱 제출에 실패했습니다.");
    }
  };

  const deckList = useMemo(() => serverDecks ?? [], [serverDecks]);

  return (
    <div className="min-h-screen bg-linear-to-br from-background via-background to-accent/10 p-6">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">대기실</h1>
          <Button variant="outline" onClick={handleLeave}>
            나가기
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>방 참가자</span>
              <span className="text-sm text-muted-foreground">
                상태: {state?.status ?? "unknown"}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <div className="p-4 rounded-lg bg-secondary/50">
              <div className="text-sm text-muted-foreground">Host</div>
              <div className="text-xl font-bold">{hostName}</div>
            </div>
            <div className="p-4 rounded-lg bg-secondary/50">
              <div className="text-sm text-muted-foreground">Guest</div>
              <div className="text-xl font-bold">{guestName}</div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>내 덱 선택</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingDecks ? (
              <div className="text-center text-muted-foreground py-8">
                덱을 불러오는 중...
              </div>
            ) : deckList.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                저장된 서버 덱이 없습니다. 덱을 먼저 만들어주세요.
              </div>
            ) : (
              <div className="space-y-2">
                {deckList.map((d) => {
                  const mainCount = d.main_cards.reduce(
                    (s, e) => s + (e.count ?? 0),
                    0
                  );
                  const cataCount = d.cata_cards.reduce(
                    (s, e) => s + (e.count ?? 0),
                    0
                  );
                  return (
                    <div
                      key={d.id}
                      className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg border border-border"
                    >
                      <div>
                        <div className="font-semibold">{d.name}</div>
                        <div className="text-xs text-muted-foreground">
                          메인 {mainCount}장 / 재앙 {cataCount}장
                        </div>
                      </div>
                      <Button
                        size="sm"
                        disabled={locked || selectedDeckId === d.id}
                        onClick={() => handleSelectDeck(d.id)}
                      >
                        {selectedDeckId === d.id ? "선택됨" : "선택"}
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button disabled={!canStart} onClick={() => navigate(`/game/${roomId}`)}>
            게임 시작
          </Button>
        </div>
      </div>
    </div>
  );
}

