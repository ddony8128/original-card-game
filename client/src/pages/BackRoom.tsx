import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useLangNavigate } from '@/i18n/nav';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useRoomChat } from '@/features/game/hooks/useRoomChat';
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
  const navigate = useLangNavigate();
  const { t } = useTranslation();
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

  // 대기실 실시간 채팅(휘발성). 게임 시작/ready 와 분리된 chat 모드 소켓을 사용한다.
  const { messages, sendChat } = useRoomChat({ roomCode, userId: me?.id });
  const [chatInput, setChatInput] = useState('');
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ block: 'end' });
  }, [messages]);

  const handleSendChat = () => {
    const text = chatInput.trim();
    if (!text) return;
    sendChat(text);
    setChatInput('');
  };

  useEffect(() => {
    if (!me) navigate('/login');
    if (!roomCode) navigate('/lobby');
  }, [me, roomCode, navigate]);

  const canStart = state?.status === 'playing';
  const hostName = state?.host?.username ?? t('common.waiting');
  const guestName = state?.guest?.username ?? t('common.waiting');

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
      toast.success(t('backRoom.leftRoom'));
      navigate('/lobby');
    } catch (e: unknown) {
      toast.error(getErrorMessage(e) ?? t('backRoom.errLeave'));
    }
  };

  const handleSelectDeck = async (deckId: string) => {
    if (!roomCode || locked) return;
    const deck = deckList.find((d) => d.id === deckId);
    // 낙관적 업데이트: 선택을 즉시 반영하고, 실패 시 롤백한다.
    const prevSelected = selectedDeckId;
    setSelectedDeckId(deckId);
    setLocked(true);
    try {
      await submitDeck.mutateAsync({ roomCode, deckId });
      if (deck) {
        setGlobalSelectedDeckId(deckId);
        setCardMetaFromDeck(deck);
      }
      toast.success(t('backRoom.deckSubmitted'));
      await refetchState();
    } catch (e: unknown) {
      setSelectedDeckId(prevSelected);
      setLocked(false);
      toast.error(getErrorMessage(e) ?? t('backRoom.errSubmitDeck'));
    }
  };

  const deckList = useMemo(() => serverDecks ?? [], [serverDecks]);

  return (
    <div className="from-background via-background to-accent/10 min-h-screen bg-linear-to-br p-4 sm:p-6">
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">{t('backRoom.title')}</h1>
            <div className="text-muted-foreground mt-1 text-sm">
              {t('backRoom.roomInfo', {
                roomName: state?.roomName || t('backRoom.noRoomName'),
                code: roomCode,
              })}
            </div>
          </div>
          <Button
            variant="outline"
            onClick={handleLeave}
            disabled={leaveRoom.isPending}
          >
            {leaveRoom.isPending ? t('backRoom.leaving') : t('backRoom.leave')}
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>{t('backRoom.participants')}</span>
              <span className="text-muted-foreground text-sm">
                {t('backRoom.status', { status: state?.status ?? 'unknown' })}
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
            <CardTitle>{t('backRoom.selectDeck')}</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingDecks ? (
              <div className="text-muted-foreground py-8 text-center">{t('backRoom.loadingDecks')}</div>
            ) : deckList.length === 0 ? (
              <div className="text-muted-foreground py-8 text-center">
                {t('backRoom.noDecks')}
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
                          {t('backRoom.deckCardCount', { main: mainCount, cata: cataCount })}
                        </div>
                      </div>
                      <Button
                        size="sm"
                        disabled={locked || selectedDeckId === d.id}
                        onClick={() => handleSelectDeck(d.id)}
                      >
                        {selectedDeckId === d.id ? t('backRoom.selected') : t('backRoom.select')}
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('backRoom.chat')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="bg-secondary/30 h-64 overflow-y-auto rounded-lg p-3">
              {messages.length === 0 ? (
                <div className="text-muted-foreground py-8 text-center text-sm">
                  {t('backRoom.noMessages')}
                </div>
              ) : (
                <div className="space-y-1">
                  {messages.map((m) => {
                    const isMine = m.userId === me?.id;
                    return (
                      <div key={m.key} className="text-sm">
                        <span
                          className={
                            isMine
                              ? 'font-semibold text-primary'
                              : 'text-muted-foreground font-semibold'
                          }
                        >
                          {m.username}
                        </span>
                        <span className="text-muted-foreground">: </span>
                        <span className="break-words">{m.text}</span>
                      </div>
                    );
                  })}
                  <div ref={chatEndRef} />
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <Input
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    handleSendChat();
                  }
                }}
                placeholder={t('backRoom.chatPlaceholder')}
                maxLength={500}
              />
              <Button onClick={handleSendChat} disabled={!chatInput.trim()}>
                {t('backRoom.send')}
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button disabled={!canStart} onClick={() => navigate(`/game/${roomCode}`)}>
            {t('backRoom.startGame')}
          </Button>
        </div>
      </div>
    </div>
  );
}
