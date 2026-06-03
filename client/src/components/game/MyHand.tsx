import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Play } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import type { CardInstance } from '@/shared/types/game';
import type { GameCardMeta } from '@/shared/store/cardMetaStore';

interface MyHandProps {
  hand: CardInstance[];
  getCardMeta: (id: string) => GameCardMeta | undefined;
  selectedCardIndex: number | null;
  onSelectCard: (index: number) => void;
  onPlayCard: (index: number) => void;
  onEndTurn: () => void;
  isMyTurn: (id: string) => boolean;
  myId: string | undefined;
  /** 마나 충분 & 행동 가능 여부(마나 비용 입력). */
  canAfford: (manaCost: number) => boolean;
}

export function MyHand({
  hand,
  getCardMeta,
  selectedCardIndex,
  onSelectCard,
  onPlayCard,
  onEndTurn,
  isMyTurn,
  myId,
  canAfford,
}: MyHandProps) {
  const { t } = useTranslation();
  const myTurn = !!myId && isMyTurn(myId);
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="mb-3 flex items-center justify-between">
          <div className="text-sm font-medium">{t('game.myHandCount', { count: hand.length })}</div>
          <Button
            size="sm"
            variant="secondary"
            onClick={onEndTurn}
            disabled={!myId || !isMyTurn(myId)}
          >
            {t('game.endTurn')}
          </Button>
        </div>

        {hand.length === 0 ? (
          <div className="text-muted-foreground py-8 text-center text-xs">
            {t('game.emptyHand')}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-6">
            {hand.map((handEntry, index) => {
              const meta = getCardMeta(handEntry.cardId);
              const displayName = meta?.name ?? handEntry.cardId;
              const mana = meta?.mana ?? 0;
              const description = meta?.description ?? '';
              const playable = myTurn && canAfford(mana);

              return (
                <div key={handEntry.id} className="relative">
                  <button
                    type="button"
                    onClick={() => onSelectCard(index)}
                    className={cn(
                      'bg-card text-card-foreground w-full cursor-pointer rounded-lg border p-3 text-left shadow-sm transition-all hover:scale-105 hover:shadow-lg',
                      playable
                        ? 'ring-primary/40 ring-1'
                        : 'opacity-55 saturate-50',
                      selectedCardIndex === index && 'ring-primary scale-105 ring-2 opacity-100',
                    )}
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-xs font-semibold">{displayName}</span>
                      <span className="bg-primary text-primary-foreground flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold">
                        {mana}
                      </span>
                    </div>
                    <p className="text-muted-foreground line-clamp-3 text-[11px]">
                      {description}
                    </p>
                  </button>

                  {selectedCardIndex === index && (
                    <div className="pointer-events-none absolute right-0 -bottom-3 left-0 flex justify-center">
                      <Button
                        size="sm"
                        className="pointer-events-auto h-7 px-2 text-[11px]"
                        onClick={(e) => {
                          e.stopPropagation();
                          onPlayCard(index);
                        }}
                      >
                        <Play className="mr-1 h-3 w-3" />
                        {t('game.use')}
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
