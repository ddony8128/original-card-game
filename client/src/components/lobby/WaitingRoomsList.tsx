import { useTranslation } from 'react-i18next';
import { useLangNavigate } from '@/i18n/nav';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { useJoinRoomMutation, useWaitingRoomsQuery } from '@/features/match/queries';
import { getErrorMessage } from '@/shared/lib/errors';

export function WaitingRoomsList() {
  const navigate = useLangNavigate();
  const { t } = useTranslation();
  const { data: waitingRooms, refetch, isLoading } = useWaitingRoomsQuery(true);
  const joinRoom = useJoinRoomMutation();

  const handleJoin = async (roomCode: string) => {
    try {
      const res = await joinRoom.mutateAsync(roomCode);
      toast.success(t('lobby.joinedRoom'), {
        description: t('lobby.roomCodeDesc', { code: res.roomCode }),
      });
      navigate(`/back-room/${res.roomCode}`);
    } catch (e: unknown) {
      toast.error(getErrorMessage(e) ?? t('lobby.errJoinRoom'));
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            {t('lobby.waitingRooms')}
          </span>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isLoading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            {t('lobby.refresh')}
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-muted-foreground py-8 text-center">{t('lobby.loadingRooms')}</div>
        ) : !waitingRooms || !Array.isArray(waitingRooms) || waitingRooms.length === 0 ? (
          <div className="text-muted-foreground py-8 text-center">{t('lobby.noWaitingRooms')}</div>
        ) : (
          <div className="space-y-2">
            {waitingRooms.map((room) => (
              <div
                key={room.roomCode}
                className="bg-secondary/50 border-border flex items-center justify-between rounded-lg border p-3"
              >
                <div className="flex-1">
                  <div className="font-semibold">
                    {room.roomName || t('lobby.roomFallbackName', { code: room.roomCode })}
                  </div>
                  <div className="text-muted-foreground text-xs">
                    {t('lobby.roomHostInfo', {
                      host: room.host?.username || t('common.waiting'),
                      code: room.roomCode,
                    })}
                    {room.guest && t('lobby.roomGuestInfo', { guest: room.guest.username })}
                  </div>
                </div>
                <Button
                  size="sm"
                  onClick={() => handleJoin(room.roomCode)}
                  disabled={joinRoom.isPending || !!room.guest}
                >
                  {room.guest
                    ? t('lobby.joinDisabled')
                    : joinRoom.isPending
                      ? t('lobby.joiningRoom')
                      : t('lobby.join')}
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
