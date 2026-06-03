import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LogIn } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface JoinRoomCardProps {
  roomCode: string;
  onRoomCodeChange: (value: string) => void;
  onJoin: () => void;
  isPending: boolean;
}

export function JoinRoomCard({ roomCode, onRoomCodeChange, onJoin, isPending }: JoinRoomCardProps) {
  const { t } = useTranslation();
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <LogIn className="h-5 w-5" />
          {t('lobby.joinRoomTitle')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Input
          placeholder={t('lobby.joinRoomPlaceholder')}
          value={roomCode}
          onChange={(e) => onRoomCodeChange(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && onJoin()}
          className="uppercase"
        />
        <Button onClick={onJoin} className="w-full" size="lg" disabled={isPending}>
          {isPending ? t('lobby.joiningRoom') : t('lobby.joinRoom')}
        </Button>
      </CardContent>
    </Card>
  );
}
