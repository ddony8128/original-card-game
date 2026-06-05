import type { ComponentType } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Flame, Package, Play, Sparkles, Sprout, Zap } from 'lucide-react';
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

type CardType = GameCardMeta['type'];

type TypeStyle = {
  icon: ComponentType<{ className?: string }>;
  /** 배지 색상(글자/배경/테두리). */
  badge: string;
  /** 카드 좌측 강조 바 색상. */
  accent: string;
  /** i18n 라벨 키. */
  labelKey: string;
};

const TYPE_STYLES: Record<CardType, TypeStyle> = {
  instant: {
    icon: Zap,
    badge: 'bg-blue-500/15 text-blue-600 border-blue-500/30 dark:text-blue-300',
    accent: 'bg-blue-500',
    labelKey: 'game.cardTypeInstant',
  },
  ritual: {
    icon: Sparkles,
    badge: 'bg-violet-500/15 text-violet-600 border-violet-500/30 dark:text-violet-300',
    accent: 'bg-violet-500',
    labelKey: 'game.cardTypeRitual',
  },
  summon: {
    icon: Sprout,
    badge: 'bg-green-500/15 text-green-600 border-green-500/30 dark:text-green-300',
    accent: 'bg-green-500',
    labelKey: 'game.cardTypeSummon',
  },
  item: {
    icon: Package,
    badge: 'bg-amber-500/15 text-amber-600 border-amber-500/30 dark:text-amber-300',
    accent: 'bg-amber-500',
    labelKey: 'game.cardTypeItem',
  },
  catastrophe: {
    icon: Flame,
    badge: 'bg-orange-500/15 text-orange-600 border-orange-500/30 dark:text-orange-300',
    accent: 'bg-orange-500',
    labelKey: 'game.cardTypeCatastrophe',
  },
};

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
    <Card className="shrink-0">
      <CardContent className="p-3">
        <div className="mb-2 flex items-center justify-between">
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
              const cardType = meta?.type;
              const typeStyle = cardType ? TYPE_STYLES[cardType] : undefined;
              const TypeIcon = typeStyle?.icon;
              const affordable = canAfford(mana);
              const playable = myTurn && affordable;
              const isSelected = selectedCardIndex === index;
              // 마나가 부족한 상태(내 턴 기준)면 마나 배지를 빨강으로.
              const manaShort = myTurn && !affordable;

              return (
                <div key={handEntry.id} className="relative">
                  <button
                    type="button"
                    onClick={() => onSelectCard(index)}
                    className={cn(
                      'bg-card text-card-foreground relative w-full cursor-pointer overflow-hidden rounded-lg border p-3 pl-3.5 text-left shadow-sm transition-all hover:scale-105 hover:shadow-lg',
                      playable
                        ? 'ring-primary/40 border-primary/30 ring-1'
                        : 'opacity-50 saturate-50',
                      isSelected && 'ring-primary scale-105 opacity-100 ring-2 saturate-100',
                    )}
                  >
                    {/* 타입별 좌측 강조 바 */}
                    {typeStyle && (
                      <span
                        aria-hidden
                        className={cn('absolute inset-y-0 left-0 w-1', typeStyle.accent)}
                      />
                    )}

                    <div className="mb-1.5 flex items-start justify-between gap-1">
                      <span className="text-xs font-semibold leading-tight">{displayName}</span>
                      <span
                        className={cn(
                          'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold',
                          manaShort
                            ? 'bg-red-500 text-white ring-2 ring-red-300'
                            : 'bg-primary text-primary-foreground',
                        )}
                        title={manaShort ? t('game.manaShort') : t('game.mana')}
                      >
                        {mana}
                      </span>
                    </div>

                    {/* 타입 배지 */}
                    {typeStyle && (
                      <span
                        className={cn(
                          'mb-1.5 inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-medium',
                          typeStyle.badge,
                        )}
                      >
                        {TypeIcon && <TypeIcon className="h-3 w-3" />}
                        {t(typeStyle.labelKey)}
                      </span>
                    )}

                    <p
                      className={cn(
                        'text-muted-foreground text-[11px]',
                        isSelected ? 'whitespace-pre-wrap' : 'line-clamp-3',
                      )}
                    >
                      {description}
                    </p>
                  </button>

                  {isSelected && (
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
