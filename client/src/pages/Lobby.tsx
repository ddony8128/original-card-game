import { useNavigate } from 'react-router-dom';
import { useGameStore } from '@/store/useGameStore';
import { useDeckStore } from '@/store/useDeckStore';
import { useState } from 'react';
import type { Room } from '@/types/room';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Plus, LogIn, BookOpen } from 'lucide-react';
import { toast } from 'sonner';

export default function Lobby() {
  const navigate = useNavigate();
  const { user, setRoom } = useGameStore();
  const { decks } = useDeckStore();
  const [roomCode, setRoomCode] = useState("");

  if (!user) {
    navigate('/');
    return null;
  }

  const noDecks = () => {
    toast.error('덱을 먼저 만들어야 합니다.');
    return;
  }
  
  const handleCreateRoom = () => {
    if (!user) return;
    if (!decks.length || decks.length === 0) return noDecks();
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    const now = Date.now();
    const newRoom: Room = {
      id: crypto.randomUUID(),
      code,
      name: `${user.name}의 방`,
      createdAt: now,
      updatedAt: now,
      players: [user],
    };
    setRoom(newRoom);
    toast.success("방이 생성되었습니다.", {
      description: `방 코드 : ${code}`,
    });
    navigate('/game');
  };

  const handleJoinRoom = () => {
    if (!user) return;
    if (!decks.length || decks.length === 0) return noDecks();
    if (!roomCode.trim()) return toast.error('방 코드를 입력하세요.');
    const now = Date.now();
    const joinedRoom: Room = {
      id: crypto.randomUUID(),
      code: roomCode,
      name: '참가한 방',
      createdAt: now,
      updatedAt: now,
      players: [user],
    };
    setRoom(joinedRoom);
    toast.success("방에 입장했습니다.", {
      description: `방 코드 : ${roomCode}`,
    });
    navigate('/game');
  };

  return (
    <div className="min-h-screen bg-linear-to-br from-background via-background to-accent/10 p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold">로비</h1>
          <p className="text-muted-foreground">환영합니다, {user.name}님!</p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Plus className="w-5 h-5" />
                방 만들기
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                새로운 게임 방을 만들고 친구를 초대하세요
              </p>
              <Button onClick={handleCreateRoom} className="w-full" size="lg">
                <Users className="w-4 h-4 mr-2" />
                방 생성
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <LogIn className="w-5 h-5" />
                방 참가
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input
                placeholder="방 코드 입력"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleJoinRoom()}
                className="uppercase"
              />
              <Button onClick={handleJoinRoom} className="w-full" size="lg">
                입장하기
              </Button>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="w-5 h-5" />
              내 덱 ({decks.length}/4)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {decks.length === 0 ? (
              <div className="text-center py-8 space-y-4">
                <p className="text-muted-foreground">아직 덱이 없습니다</p>
                <Button onClick={() => navigate("/deck-builder")}>
                  첫 번째 덱 만들기
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {decks.map((deck) => (
                  <div
                    key={deck.id}
                    className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg"
                  >
                    <div>
                      <h3 className="font-semibold">{deck.name}</h3>
                      <p className="text-xs text-muted-foreground">
                        {deck.cards.reduce((sum, c) => sum + c.count, 0)}장
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigate(`/deck-list`)}
                    >
                      관리
                    </Button>
                  </div>
                ))}
                {decks.length < 4 && (
                  <Button
                    onClick={() => navigate("/deck-builder")}
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