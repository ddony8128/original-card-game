import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export interface RitualTooltipViewModel {
  id: string;
  name: string;
  description: string;
  mana?: number;
  position: { r: number; c: number };
  ownerLabel: string; // "나" / "상대" 등
  usedThisTurn: boolean;
}

interface RitualTooltipProps {
  ritual: RitualTooltipViewModel;
  /** 화면 좌표 (마우스 위치 등) */
  position: { x: number; y: number };
}

export function RitualTooltip({ ritual, position }: RitualTooltipProps) {
  const { t } = useTranslation();
  return (
    <div
      className="pointer-events-none fixed z-50"
      style={{
        left: position.x + 10,
        top: position.y + 10,
      }}
    >
      <Card className="border-primary/50 w-64 shadow-lg">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            🔮 {ritual.name}
            {ritual.usedThisTurn && <span className="text-muted-foreground text-xs">{t('game.ritualUsed')}</span>}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="text-muted-foreground text-xs">
            <div>{t('game.ritualPosition', { c: ritual.position.c, r: ritual.position.r })}</div>
            <div>{t('game.ritualOwner', { owner: ritual.ownerLabel })}</div>
            <div className="text-foreground mt-2">{ritual.description}</div>
          </div>

          {ritual.mana !== undefined && (
            <div className="text-xs">
              <span className="text-muted-foreground">{t('game.ritualMana')}</span>{' '}
              <span className="text-primary font-bold">{ritual.mana}</span>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
