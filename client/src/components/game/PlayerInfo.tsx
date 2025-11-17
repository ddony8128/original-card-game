import { Card, CardContent } from '@/components/ui/card';
import { Heart, Droplet } from 'lucide-react';

interface PlayerInfoProps {
  hp: number;
  maxHp?: number;
  mana: number;
  maxMana: number;
  label: string;
}

export function PlayerInfo({ hp, maxHp, mana, maxMana, label }: PlayerInfoProps) {
  const displayMaxHp = maxHp ?? hp;

  return (
    <div className="space-y-2">
      <div className="text-muted-foreground text-sm font-medium">{label}</div>
      <div className="grid grid-cols-2 gap-2">
        <Card>
          <CardContent className="px-3 pt-4 pb-3">
            <div className="flex items-center gap-2">
              <Heart className="h-4 w-4 text-red-500" />
              <div className="text-lg font-bold">
                {hp}/{displayMaxHp}
              </div>
            </div>
            <div className="text-muted-foreground text-xs">HP</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="px-3 pt-4 pb-3">
            <div className="flex items-center gap-2">
              <Droplet className="h-4 w-4 text-blue-500" />
              <div className="text-lg font-bold">
                {mana}/{maxMana}
              </div>
            </div>
            <div className="text-muted-foreground text-xs">마나</div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
