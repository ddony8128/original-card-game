import { useTranslation } from 'react-i18next';
import { PlayerInfo } from '@/components/game/PlayerInfo';
import { DeckInfo, CatastropheDeckInfo } from '@/components/game/DeckInfo';
import { OpponentHand } from '@/components/game/OpponentHand';
import type { FoggedGameState } from '@/shared/types/game';

interface OpponentZoneProps {
  opponent: FoggedGameState['opponent'];
  catastrophe: FoggedGameState['catastrophe'];
  onViewGrave: (type: 'me' | 'opponent' | 'catastrophe') => void;
}

export function OpponentZone({ opponent, catastrophe, onViewGrave }: OpponentZoneProps) {
  const { t } = useTranslation();
  return (
    <>
      {/* Opponent Info */}
      <div className="grid grid-cols-3 gap-2 sm:gap-4">
        <PlayerInfo
          hp={opponent.hp}
          maxHp={opponent.maxHp}
          mana={opponent.mana}
          maxMana={opponent.maxMana}
          label={t('game.opponent')}
        />
        <div className="flex min-w-0 flex-col justify-center">
          <div className="text-muted-foreground mb-2 text-center text-[11px] sm:text-xs">
            {t('game.opponentHandCount', { count: opponent.handCount })}
          </div>
          <OpponentHand cardCount={opponent.handCount} />
        </div>
        <DeckInfo
          deckCount={opponent.deckCount}
          graveCount={opponent.graveCount}
          grave={opponent.grave}
          label={t('game.opponentDeck')}
          onViewGrave={() => onViewGrave('opponent')}
        />
      </div>

      {/* Shared Catastrophe Deck */}
      <CatastropheDeckInfo
        deckCount={catastrophe.deckCount}
        graveCount={catastrophe.graveCount}
        grave={catastrophe.grave}
        onViewGrave={() => onViewGrave('catastrophe')}
      />
    </>
  );
}
