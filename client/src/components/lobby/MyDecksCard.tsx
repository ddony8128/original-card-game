import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { BookOpen, Pencil, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { DeckDto } from '@/shared/api/types';

interface MyDecksCardProps {
  decks: DeckDto[] | undefined;
  totalDeckCount: number;
  isLoading?: boolean;
  onEditDeck: (id: string) => void;
  onDeleteDeck: (deck: DeckDto) => void;
  onCreateDeck: () => void;
}

export function MyDecksCard({
  decks,
  totalDeckCount,
  isLoading = false,
  onEditDeck,
  onDeleteDeck,
  onCreateDeck,
}: MyDecksCardProps) {
  const { t } = useTranslation();
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BookOpen className="h-5 w-5" />
          {t('lobby.myDecks')} ({isLoading ? '…' : `${totalDeckCount}/4`})
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-[60px] w-full" />
            <Skeleton className="h-[60px] w-full" />
          </div>
        ) : (decks?.length ?? 0) === 0 ? (
          <div className="space-y-4 py-8 text-center">
            <p className="text-muted-foreground">{t('lobby.noDecks')}</p>
            <Button onClick={onCreateDeck}>{t('lobby.createFirstDeck')}</Button>
          </div>
        ) : (
          <div className="space-y-3">
            {decks?.map((deck) => {
              const mainCount = deck.main_cards.reduce((s, e) => s + (e.count ?? 0), 0);
              const cataCount = deck.cata_cards.reduce((s, e) => s + (e.count ?? 0), 0);
              return (
                <div
                  key={deck.id}
                  className="bg-secondary/50 border-border flex items-center justify-between rounded-lg border p-3"
                >
                  <div>
                    <h3 className="font-semibold">
                      {deck.name === '기본 덱' ? t('common.basicDeck') : deck.name}
                    </h3>
                    <p className="text-muted-foreground text-xs">
                      {t('lobby.deckCardCount', { main: mainCount, cata: cataCount })}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => onEditDeck(deck.id)}>
                      <Pencil className="mr-2 h-4 w-4" />
                      {t('lobby.edit')}
                    </Button>
                    <Button variant="destructive" size="sm" onClick={() => onDeleteDeck(deck)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              );
            })}

            {totalDeckCount < 4 && (
              <Button onClick={onCreateDeck} variant="outline" className="w-full">
                {t('lobby.createNewDeck')}
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
