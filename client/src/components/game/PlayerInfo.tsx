import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();
  const displayMaxHp = maxHp ?? hp;

  return (
    <div className="space-y-2">
      <div className="text-muted-foreground text-sm font-medium">{label}</div>
      <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 sm:gap-2">
        <Card>
          <CardContent className="px-2 pt-3 pb-2 sm:px-3 sm:pt-4 sm:pb-3">
            <div className="flex items-center gap-1 sm:gap-2">
              <Heart className="h-4 w-4 shrink-0 text-red-500" />
              <div className="min-w-0 text-base font-bold tabular-nums sm:text-lg">
                {hp}/{displayMaxHp}
              </div>
            </div>
            <div className="text-muted-foreground text-xs">HP</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="px-2 pt-3 pb-2 sm:px-3 sm:pt-4 sm:pb-3">
            <div className="flex items-center gap-1 sm:gap-2">
              <Droplet className="h-4 w-4 shrink-0 text-blue-500" />
              <div className="min-w-0 text-base font-bold tabular-nums sm:text-lg">
                {mana}/{maxMana}
              </div>
            </div>
            <div className="text-muted-foreground text-xs">{t('game.mana')}</div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
