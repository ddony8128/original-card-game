import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface CreateRoomCardProps {
  roomName: string;
  onRoomNameChange: (value: string) => void;
  onCreate: () => void;
  isPending: boolean;
}

export function CreateRoomCard({
  roomName,
  onRoomNameChange,
  onCreate,
  isPending,
}: CreateRoomCardProps) {
  const { t } = useTranslation();
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Plus className="h-5 w-5" />
          {t('lobby.createRoomTitle')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Input
          placeholder={t('lobby.createRoomPlaceholder')}
          value={roomName}
          onChange={(e) => onRoomNameChange(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !isPending && roomName.trim() && onCreate()}
        />
        <Button
          onClick={onCreate}
          className="w-full"
          size="lg"
          disabled={isPending || !roomName.trim()}
        >
          <Users className="mr-2 h-4 w-4" />
          {isPending ? t('lobby.creatingRoom') : t('lobby.createRoom')}
        </Button>
      </CardContent>
    </Card>
  );
}
