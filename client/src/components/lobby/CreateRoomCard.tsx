import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Plus } from 'lucide-react';

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
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Plus className="h-5 w-5" />방 만들기
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Input
          placeholder="방 이름 입력"
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
          {isPending ? '생성 중...' : '방 생성'}
        </Button>
      </CardContent>
    </Card>
  );
}
