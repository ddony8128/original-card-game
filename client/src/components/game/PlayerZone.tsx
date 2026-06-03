import { useTranslation } from 'react-i18next';
import { PlayerInfo } from '@/components/game/PlayerInfo';
import { DeckInfo } from '@/components/game/DeckInfo';
import { GameLog } from '@/components/game/GameLog';
import type { FoggedGameState, ClientSideActionLog } from '@/shared/types/game';

interface PlayerZoneProps {
  me: FoggedGameState['me'];
  perspectiveLogs: ClientSideActionLog[];
  onViewGrave: (type: 'me' | 'opponent' | 'catastrophe') => void;
}

export function PlayerZone({ me, perspectiveLogs, onViewGrave }: PlayerZoneProps) {
  const { t } = useTranslation();
  return (
    <div className="grid grid-cols-3 gap-2 sm:gap-4">
      <PlayerInfo
        hp={me.hp}
        maxHp={me.maxHp}
        mana={me.mana}
        maxMana={me.maxMana}
        label={t('game.me')}
      />
      <DeckInfo
        deckCount={me.deckCount}
        graveCount={me.graveCount}
        grave={me.grave}
        label={t('game.myDeck')}
        onViewGrave={() => onViewGrave('me')}
      />
      <div className="col-span-3">
        <GameLog logs={perspectiveLogs} />
      </div>
    </div>
  );
}
