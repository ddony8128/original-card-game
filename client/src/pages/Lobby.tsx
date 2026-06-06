import { useLangNavigate } from '@/i18n/nav';
import { LangToggle } from '@/i18n/LangToggle';
import { useState, useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { LogOut, GraduationCap, Swords, Trophy, BookOpen } from 'lucide-react';
import { GlossaryModal } from '@/components/glossary/GlossaryModal';
import { useDecksQuery, useDeleteDeckMutation } from '@/features/decks/queries';
import { usePveProgressQuery, usePveStagesQuery } from '@/features/pve/queries';
import { useCreateRoomMutation, useJoinRoomMutation } from '@/features/match/queries';
import { useMeQuery, useLogoutMutation } from '@/features/auth/queries';
import { getErrorMessage } from '@/shared/lib/errors';
import type { DeckDto } from '@/shared/api/types';
import { CreateRoomCard } from '@/components/lobby/CreateRoomCard';
import { JoinRoomCard } from '@/components/lobby/JoinRoomCard';
import { MyDecksCard } from '@/components/lobby/MyDecksCard';
import { WaitingRoomsList } from '@/components/lobby/WaitingRoomsList';
import { track } from '@/shared/analytics';

export default function Lobby() {
  const navigate = useLangNavigate();
  const { t } = useTranslation();
  const { data: me } = useMeQuery();
  const [roomCode, setRoomCode] = useState('');
  const [roomName, setRoomName] = useState('');
  const [glossaryOpen, setGlossaryOpen] = useState(false);

  const { data: serverDecks, isLoading: loadingDecks } = useDecksQuery();
  const { data: pveProgress } = usePveProgressQuery();
  const { data: pveStages } = usePveStagesQuery();
  const createRoom = useCreateRoomMutation();
  const joinRoom = useJoinRoomMutation();
  const deleteDeckMutation = useDeleteDeckMutation();
  const logout = useLogoutMutation();

  const handleLogout = async () => {
    await logout.mutateAsync().catch(() => undefined);
    navigate('/login', { replace: true });
  };

  const totalDeckCount = useMemo(() => serverDecks?.length ?? 0, [serverDecks]);

  // 전 스테이지 클리어(allCleared) 최초 1회 badge_earned 전송.
  // localStorage 플래그로 사용자/세션 간 중복 발화를 방지한다.
  useEffect(() => {
    if (!pveProgress?.allCleared) return;
    try {
      if (localStorage.getItem('analytics_badge_earned')) return;
      localStorage.setItem('analytics_badge_earned', '1');
    } catch {
      // localStorage 접근 불가 환경에서도 추적은 시도하되 에러는 무시.
    }
    track('badge_earned');
  }, [pveProgress?.allCleared]);

  if (!me) {
    navigate('/login');
    return null;
  }

  const requireDecksOrWarn = () => {
    if (loadingDecks) {
      toast.info(t('lobby.loadingDecks'));
      return false;
    }
    if (!totalDeckCount) {
      toast.error(t('lobby.needDeck'));
      return false;
    }
    return true;
  };

  const handleCreateRoom = async () => {
    if (!requireDecksOrWarn()) return;
    try {
      const res = await createRoom.mutateAsync(roomName.trim() || null);
      // 방 정보는 URL로 전달하고, BackRoom에서 서버 쿼리로 조회
      toast.success(t('lobby.roomCreated'), {
        description: t('lobby.roomCodeDesc', { code: res.roomCode }),
      });
      navigate(`/back-room/${res.roomCode}`);
    } catch (e: unknown) {
      toast.error(getErrorMessage(e) ?? t('lobby.errCreateRoom'));
    }
  };

  const handleJoinRoom = async () => {
    if (!requireDecksOrWarn()) return;
    if (!roomCode.trim()) return toast.error(t('lobby.needRoomCode'));
    try {
      const res = await joinRoom.mutateAsync(roomCode.trim());
      // 방 정보는 URL로 전달하고, BackRoom에서 서버 쿼리로 조회
      toast.success(t('lobby.joinedRoom'), {
        description: t('lobby.roomCodeDesc', { code: res.roomCode }),
      });
      navigate(`/back-room/${res.roomCode}`);
    } catch (e: unknown) {
      toast.error(getErrorMessage(e) ?? t('lobby.errJoinRoom'));
    }
  };

  const handleDeleteDeck = (deck: DeckDto) => {
    if (!confirm(t('lobby.confirmDeleteDeck', { name: deck.name }))) return;
    deleteDeckMutation.mutate(deck.id, {
      onSuccess: () =>
        toast.success(t('lobby.deckDeleted'), {
          description: deck.name,
        }),
      onError: (err: unknown) => toast.error(getErrorMessage(err) ?? t('lobby.errDeleteDeck')),
    });
  };

  return (
    <div className="from-background via-background to-accent/10 min-h-screen bg-linear-to-br p-4 sm:p-6">
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="flex items-center justify-end gap-2">
          <LangToggle />
          <Button
            variant="outline"
            size="sm"
            onClick={() => setGlossaryOpen(true)}
          >
            <BookOpen className="mr-2 h-4 w-4" />
            {t('common.glossary')}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleLogout}
            disabled={logout.isPending}
          >
            <LogOut className="mr-2 h-4 w-4" />
            {logout.isPending ? t('lobby.loggingOut') : t('lobby.logout')}
          </Button>
        </div>
        <div className="space-y-2 text-center">
          <h1 className="text-3xl font-bold">{t('lobby.title')}</h1>
          <p className="text-muted-foreground">{t('lobby.welcome', { username: me.username })}</p>
        </div>

        <div className="flex flex-col items-center gap-2">
          <div className="flex flex-wrap justify-center gap-3">
            <Button onClick={() => navigate('/tutorial')}>
              <GraduationCap className="mr-2 h-4 w-4" />
              {t('lobby.tutorial')}
            </Button>
            <Button variant="secondary" onClick={() => navigate('/pve')}>
              <Swords className="mr-2 h-4 w-4" />
              {t('lobby.pve')}
            </Button>
          </div>
          {pveProgress?.allCleared ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-400/20 px-3 py-1 text-sm font-bold text-amber-300 ring-1 ring-amber-300/60 drop-shadow-[0_0_8px_rgba(252,211,77,0.6)]">
              <Trophy className="h-4 w-4" />
              {t('lobby.goldenBadge')}
            </span>
          ) : (
            <span className="text-muted-foreground text-xs">
              {t('lobby.pveBadgeProgress', {
                count: pveProgress?.clearedStageIds.length ?? 0,
                total: pveStages?.total ?? pveStages?.stages.length ?? 0,
              })}
            </span>
          )}
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <CreateRoomCard
            roomName={roomName}
            onRoomNameChange={setRoomName}
            onCreate={handleCreateRoom}
            isPending={createRoom.isPending}
          />

          <JoinRoomCard
            roomCode={roomCode}
            onRoomCodeChange={setRoomCode}
            onJoin={handleJoinRoom}
            isPending={joinRoom.isPending}
          />
        </div>

        <MyDecksCard
          decks={serverDecks}
          totalDeckCount={totalDeckCount}
          isLoading={loadingDecks}
          onEditDeck={(id) => navigate(`/deck-builder?sid=${id}`)}
          onDeleteDeck={handleDeleteDeck}
          onCreateDeck={() => navigate('/deck-builder')}
        />

        <WaitingRoomsList />

        {/* 리뷰 페이지로 이동 */}
        <div className="flex justify-end">
          <Button variant="outline" onClick={() => navigate('/review')}>
            {t('lobby.goToReview')}
          </Button>
        </div>
      </div>

      <GlossaryModal open={glossaryOpen} onOpenChange={setGlossaryOpen} />
    </div>
  );
}
