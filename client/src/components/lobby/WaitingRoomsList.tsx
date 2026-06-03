import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { useJoinRoomMutation, useWaitingRoomsQuery } from '@/features/match/queries';
import { getErrorMessage } from '@/shared/lib/errors';

export function WaitingRoomsList() {
  const navigate = useNavigate();
  const { data: waitingRooms, refetch, isLoading } = useWaitingRoomsQuery(true);
  const joinRoom = useJoinRoomMutation();

  const handleJoin = async (roomCode: string) => {
    try {
      const res = await joinRoom.mutateAsync(roomCode);
      toast.success('방에 입장했습니다.', { description: `방 코드 : ${res.roomCode}` });
      navigate(`/back-room/${res.roomCode}`);
    } catch (e: unknown) {
      toast.error(getErrorMessage(e) ?? '방 참가에 실패했습니다.');
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            대기 중인 방
          </span>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isLoading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            새로고침
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-muted-foreground py-8 text-center">방 목록을 불러오는 중...</div>
        ) : !waitingRooms || !Array.isArray(waitingRooms) || waitingRooms.length === 0 ? (
          <div className="text-muted-foreground py-8 text-center">대기 중인 방이 없습니다.</div>
        ) : (
          <div className="space-y-2">
            {waitingRooms.map((room) => (
              <div
                key={room.roomCode}
                className="bg-secondary/50 border-border flex items-center justify-between rounded-lg border p-3"
              >
                <div className="flex-1">
                  <div className="font-semibold">{room.roomName || `방 ${room.roomCode}`}</div>
                  <div className="text-muted-foreground text-xs">
                    호스트: {room.host?.username || '(대기 중)'} · 코드: {room.roomCode}
                    {room.guest && ` · 게스트: ${room.guest.username}`}
                  </div>
                </div>
                <Button
                  size="sm"
                  onClick={() => handleJoin(room.roomCode)}
                  disabled={joinRoom.isPending || !!room.guest}
                >
                  {room.guest ? '참가 불가' : joinRoom.isPending ? '입장 중...' : '참가'}
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
