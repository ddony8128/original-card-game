import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useDecksQuery } from '@/features/decks/queries';
import {
  useLeaveRoomMutation,
  useMatchStateQuery,
  useSubmitDeckMutation,
} from '@/features/match/queries';
import { toast } from 'sonner';
import { useMeQuery } from '@/features/auth/queries';
import { useGameFogStore } from '@/shared/store/gameStore';
import { useCardMetaStore } from '@/shared/store/cardMetaStore';

export default function BackRoom() {
  const navigate = useNavigate();
  const { roomId } = useParams<{ roomId: string }>();
  const { data: me } = useMeQuery();
  // URL 파라미터는 roomId지만 실제로는 roomCode를 전달받음
  const roomCode = roomId;

  const { data: state, refetch: refetchState } = useMatchStateQuery(roomCode, true);
  const { data: serverDecks, isLoading: loadingDecks } = useDecksQuery();
  const leaveRoom = useLeaveRoomMutation();
  const submitDeck = useSubmitDeckMutation();

  const [selectedDeckId, setSelectedDeckId] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);

  const setGlobalSelectedDeckId = useGameFogStore((s) => s.setSelectedDeckId);
  const setCardMetaFromDeck = useCardMetaStore((s) => s.setFromDeck);

  useEffect(() => {
    if (!me) navigate('/login');
    if (!roomCode) navigate('/lobby');
  }, [me, roomCode, navigate]);

  const canStart = state?.status === 'playing';
  const hostName = state?.host?.username ?? '(대기 중)';
  const guestName = state?.guest?.username ?? '(대기 중)';

  const getErrorMessage = (err: unknown): string | undefined => {
    if (err instanceof Error) return err.message;
    if (typeof err === 'object' && err && 'message' in err) {
      const m = (err as { message?: unknown }).message;
      return typeof m === 'string' ? m : undefined;
    }
    return undefined;
  };

  const handleLeave = async () => {
    if (!roomCode) return;
    try {
      await leaveRoom.mutateAsync(roomCode);
      toast.success('방에서 나갔습니다.');
      navigate('/lobby');
    } catch (e: unknown) {
      toast.error(getErrorMessage(e) ?? '방 나가기에 실패했습니다.');
    }
  };

  const handleSelectDeck = async (deckId: string) => {
    if (!roomCode || locked) return;
    const deck = deckList.find((d) => d.id === deckId);
    try {
      await submitDeck.mutateAsync({ roomCode, deckId });
      setSelectedDeckId(deckId);
      setLocked(true);
      if (deck) {
        setGlobalSelectedDeckId(deckId);
        setCardMetaFromDeck(deck);
      }
      toast.success('덱이 제출되었습니다.');
      await refetchState();
    } catch (e: unknown) {
      toast.error(getErrorMessage(e) ?? '덱 제출에 실패했습니다.');
    }
  };

  const deckList = useMemo(() => serverDecks ?? [], [serverDecks]);

  return (
    <div className="from-background via-background to-accent/10 min-h-screen bg-linear-to-br p-6">
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">대기실</h1>
            <div className="text-muted-foreground mt-1 text-sm">
              {state?.roomName || '방 이름 없음'} · 코드: {roomCode}
            </div>
          </div>
          <Button variant="outline" onClick={handleLeave}>
            나가기
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>방 참가자</span>
              <span className="text-muted-foreground text-sm">
                상태: {state?.status ?? 'unknown'}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <div className="bg-secondary/50 rounded-lg p-4">
              <div className="text-muted-foreground text-sm">Host</div>
              <div className="text-xl font-bold">{hostName}</div>
            </div>
            <div className="bg-secondary/50 rounded-lg p-4">
              <div className="text-muted-foreground text-sm">Guest</div>
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
              <div className="text-muted-foreground py-8 text-center">덱을 불러오는 중...</div>
            ) : deckList.length === 0 ? (
              <div className="text-muted-foreground py-8 text-center">
                저장된 서버 덱이 없습니다. 덱을 먼저 만들어주세요.
              </div>
            ) : (
              <div className="space-y-2">
                {deckList.map((d) => {
                  const mainCount = d.main_cards.reduce((s, e) => s + (e.count ?? 0), 0);
                  const cataCount = d.cata_cards.reduce((s, e) => s + (e.count ?? 0), 0);
                  return (
                    <div
                      key={d.id}
                      className="bg-secondary/50 border-border flex items-center justify-between rounded-lg border p-3"
                    >
                      <div>
                        <div className="font-semibold">{d.name}</div>
                        <div className="text-muted-foreground text-xs">
                          메인 {mainCount}장 / 재앙 {cataCount}장
                        </div>
                      </div>
                      <Button
                        size="sm"
                        disabled={locked || selectedDeckId === d.id}
                        onClick={() => handleSelectDeck(d.id)}
                      >
                        {selectedDeckId === d.id ? '선택됨' : '선택'}
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button disabled={!canStart} onClick={() => navigate(`/game/${roomCode}`)}>
            게임 시작
          </Button>
        </div>
      </div>
    </div>
  );
}
