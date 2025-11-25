import { useNavigate } from 'react-router-dom';
import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Plus, LogIn, BookOpen, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useDecksQuery, useDeleteDeckMutation } from '@/features/decks/queries';
import { useCreateRoomMutation, useJoinRoomMutation } from '@/features/match/queries';
import { useMeQuery } from '@/features/auth/queries';

export default function Lobby() {
  const navigate = useNavigate();
  const { data: me } = useMeQuery();
  const [roomCode, setRoomCode] = useState('');

  const { data: serverDecks, isLoading: loadingDecks } = useDecksQuery();
  const createRoom = useCreateRoomMutation();
  const joinRoom = useJoinRoomMutation();
  const deleteDeckMutation = useDeleteDeckMutation();

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

  const getErrorMessage = (err: unknown): string | undefined => {
    if (err instanceof Error) return err.message;
    if (typeof err === 'object' && err && 'message' in err) {
      const m = (err as { message?: unknown }).message;
      return typeof m === 'string' ? m : undefined;
    }
    return undefined;
  };

  const handleCreateRoom = async () => {
    if (!requireDecksOrWarn()) return;
    try {
      const res = await createRoom.mutateAsync();
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

  return (
    <div className="from-background via-background to-accent/10 min-h-screen bg-linear-to-br p-6">
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="space-y-2 text-center">
          <h1 className="text-3xl font-bold">로비</h1>
          <p className="text-muted-foreground">환영합니다, {me?.username}님!</p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Plus className="h-5 w-5" />방 만들기
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground mb-4 text-sm">
                새로운 게임 방을 만들고 친구를 초대하세요
              </p>
              <Button
                onClick={handleCreateRoom}
                className="w-full"
                size="lg"
                disabled={createRoom.isPending}
              >
                <Users className="mr-2 h-4 w-4" />
                {createRoom.isPending ? '생성 중...' : '방 생성'}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <LogIn className="h-5 w-5" />방 참가
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input
                placeholder="방 코드 입력"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleJoinRoom()}
                className="uppercase"
              />
              <Button
                onClick={handleJoinRoom}
                className="w-full"
                size="lg"
                disabled={joinRoom.isPending}
              >
                {joinRoom.isPending ? '입장 중...' : '입장하기'}
              </Button>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5" />내 덱 ({totalDeckCount}/4)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {(serverDecks?.length ?? 0) === 0 ? (
              <div className="space-y-4 py-8 text-center">
                <p className="text-muted-foreground">아직 덱이 없습니다</p>
                <Button onClick={() => navigate('/deck-builder')}>첫 번째 덱 만들기</Button>
              </div>
            ) : (
              <div className="space-y-3">
                {serverDecks?.map((deck) => {
                  const mainCount = deck.main_cards.reduce((s, e) => s + (e.count ?? 0), 0);
                  const cataCount = deck.cata_cards.reduce((s, e) => s + (e.count ?? 0), 0);
                  return (
                    <div
                      key={deck.id}
                      className="bg-secondary/50 border-border flex items-center justify-between rounded-lg border p-3"
                    >
                      <div>
                        <h3 className="font-semibold">{deck.name}</h3>
                        <p className="text-muted-foreground text-xs">
                          메인 {mainCount}장 · 재앙 {cataCount}장
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => navigate(`/deck-builder?sid=${deck.id}`)}
                        >
                          <Pencil className="mr-2 h-4 w-4" />
                          수정
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => {
                            if (!confirm(`${deck.name} 덱을 삭제하시겠습니까?`)) return;
                            deleteDeckMutation.mutate(deck.id, {
                              onSuccess: () =>
                                toast.success('덱이 삭제되었습니다.', {
                                  description: deck.name,
                                }),
                              onError: (err: unknown) =>
                                toast.error(getErrorMessage(err) ?? '삭제 실패'),
                            });
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })}

                {totalDeckCount < 4 && (
                  <Button
                    onClick={() => navigate('/deck-builder')}
                    variant="outline"
                    className="w-full"
                  >
                    새 덱 만들기
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
