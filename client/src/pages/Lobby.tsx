import { useNavigate } from 'react-router-dom';
import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { LogOut, GraduationCap, Swords, Trophy } from 'lucide-react';
import { useDecksQuery, useDeleteDeckMutation } from '@/features/decks/queries';
import { usePveProgressQuery } from '@/features/pve/queries';
import { useCreateRoomMutation, useJoinRoomMutation } from '@/features/match/queries';
import { useMeQuery, useLogoutMutation } from '@/features/auth/queries';
import { getErrorMessage } from '@/shared/lib/errors';
import type { DeckDto } from '@/shared/api/types';
import { CreateRoomCard } from '@/components/lobby/CreateRoomCard';
import { JoinRoomCard } from '@/components/lobby/JoinRoomCard';
import { MyDecksCard } from '@/components/lobby/MyDecksCard';
import { WaitingRoomsList } from '@/components/lobby/WaitingRoomsList';

export default function Lobby() {
  const navigate = useNavigate();
  const { data: me } = useMeQuery();
  const [roomCode, setRoomCode] = useState('');
  const [roomName, setRoomName] = useState('');

  const { data: serverDecks, isLoading: loadingDecks } = useDecksQuery();
  const { data: pveProgress } = usePveProgressQuery();
  const createRoom = useCreateRoomMutation();
  const joinRoom = useJoinRoomMutation();
  const deleteDeckMutation = useDeleteDeckMutation();
  const logout = useLogoutMutation();

  const handleLogout = async () => {
    await logout.mutateAsync().catch(() => undefined);
    navigate('/login', { replace: true });
  };

  const totalDeckCount = useMemo(() => serverDecks?.length ?? 0, [serverDecks]);

  if (!me) {
    navigate('/login');
    return null;
  }

  const requireDecksOrWarn = () => {
    if (loadingDecks) {
      toast.info('덱 정보를 불러오는 중입니다. 잠시만 기다려주세요.');
      return false;
    }
    if (!totalDeckCount) {
      toast.error('덱을 먼저 만들어야 합니다.');
      return false;
    }
    return true;
  };

  const handleCreateRoom = async () => {
    if (!requireDecksOrWarn()) return;
    try {
      const res = await createRoom.mutateAsync(roomName.trim() || null);
      // 방 정보는 URL로 전달하고, BackRoom에서 서버 쿼리로 조회
      toast.success('방이 생성되었습니다.', { description: `방 코드 : ${res.roomCode}` });
      navigate(`/back-room/${res.roomCode}`);
    } catch (e: unknown) {
      toast.error(getErrorMessage(e) ?? '방 생성에 실패했습니다.');
    }
  };

  const handleJoinRoom = async () => {
    if (!requireDecksOrWarn()) return;
    if (!roomCode.trim()) return toast.error('방 코드를 입력하세요.');
    try {
      const res = await joinRoom.mutateAsync(roomCode.trim());
      // 방 정보는 URL로 전달하고, BackRoom에서 서버 쿼리로 조회
      toast.success('방에 입장했습니다.', { description: `방 코드 : ${res.roomCode}` });
      navigate(`/back-room/${res.roomCode}`);
    } catch (e: unknown) {
      toast.error(getErrorMessage(e) ?? '방 참가에 실패했습니다.');
    }
  };

  const handleDeleteDeck = (deck: DeckDto) => {
    if (!confirm(`${deck.name} 덱을 삭제하시겠습니까?`)) return;
    deleteDeckMutation.mutate(deck.id, {
      onSuccess: () =>
        toast.success('덱이 삭제되었습니다.', {
          description: deck.name,
        }),
      onError: (err: unknown) => toast.error(getErrorMessage(err) ?? '삭제 실패'),
    });
  };

  return (
    <div className="from-background via-background to-accent/10 min-h-screen bg-linear-to-br p-4 sm:p-6">
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="flex justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={handleLogout}
            disabled={logout.isPending}
          >
            <LogOut className="mr-2 h-4 w-4" />
            {logout.isPending ? '로그아웃 중...' : '로그아웃'}
          </Button>
        </div>
        <div className="space-y-2 text-center">
          <h1 className="text-3xl font-bold">로비</h1>
          <p className="text-muted-foreground">환영합니다, {me.username}님!</p>
        </div>

        <div className="flex flex-col items-center gap-2">
          <div className="flex flex-wrap justify-center gap-3">
            <Button onClick={() => navigate('/tutorial')}>
              <GraduationCap className="mr-2 h-4 w-4" />
              튜토리얼 (AI 연습)
            </Button>
            <Button variant="secondary" onClick={() => navigate('/pve')}>
              <Swords className="mr-2 h-4 w-4" />
              PvE (AI 도전)
            </Button>
          </div>
          {pveProgress?.allCleared ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-400/20 px-3 py-1 text-sm font-bold text-amber-300 ring-1 ring-amber-300/60 drop-shadow-[0_0_8px_rgba(252,211,77,0.6)]">
              <Trophy className="h-4 w-4" />
              황금 뱃지 획득!
            </span>
          ) : (
            <span className="text-muted-foreground text-xs">
              PvE 3스테이지 클리어 시 황금 뱃지 ({pveProgress?.clearedStageIds.length ?? 0}/3)
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
            리뷰하러 가기
          </Button>
        </div>
      </div>
    </div>
  );
}
