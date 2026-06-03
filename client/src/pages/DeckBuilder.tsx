import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { GameCard } from '@/components/deck-builder/GameCard';
import { Skeleton } from '@/components/ui/skeleton';
import { CardFilters } from '@/components/deck-builder/CardFilters';
import { DeckPanel } from '@/components/deck-builder/DeckPanel';
import { ArrowLeft, Save } from 'lucide-react';
import { useDeckBuilder } from '@/features/decks/hooks/useDeckBuilder';
import { useBeforeUnloadWarning } from '@/shared/hooks/useBeforeUnloadWarning';

/**
 * 서버 기반 덱 빌더 화면.
 *
 * - 카드 검색(마나/이름) → 메인/재앙 탭으로 필터링 → 드래그 없이 클릭만으로 덱 구성.
 * - 메인 16장 / 재앙 4장 / 카드별 최대 2장 규칙을 로컬에서 검증한 뒤,
 *   서버 `/api/decks` 형식({ id, count } 배열)으로 저장/수정 요청을 보낸다.
 */
const DeckBuilder = () => {
  const {
    navigate,
    deckName,
    setDeckName,
    searchQuery,
    setSearchQuery,
    selectedMana,
    setSelectedMana,
    selectedTab,
    setSelectedTab,
    serverEditingDeckId,
    deckCards,
    loadingCards,
    cardDtoById,
    filteredCards,
    getCardCount,
    handleAdd,
    handleRemove,
    handleSave,
    isPending,
    MAX_MAIN_SIZE,
    MAX_CATA_SIZE,
  } = useDeckBuilder();

  useBeforeUnloadWarning(deckCards.length > 0);

  return (
    <div className="from-background via-background to-accent/10 min-h-screen bg-linear-to-br">
      <div className="container mx-auto p-6">
        <div className="mb-6 flex items-center gap-4">
          <Button variant="outline" onClick={() => navigate('/lobby')}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            로비로 돌아가기
          </Button>
          <h1 className="from-primary to-accent bg-linear-to-r bg-clip-text text-4xl font-bold">
            {serverEditingDeckId ? '덱 수정' : '덱 빌더'}
          </h1>
        </div>

        <div className="mb-6 flex flex-wrap gap-4">
          <Input
            placeholder="덱 이름"
            value={deckName}
            onChange={(e) => setDeckName(e.target.value)}
            className="max-w-xs"
          />
          <Button onClick={handleSave} disabled={isPending}>
            <Save className="mr-2 h-4 w-4" />
            {isPending
              ? '저장 중...'
              : serverEditingDeckId
                ? '수정 완료'
                : '덱 저장'}
          </Button>
        </div>

        <div className="grid h-[calc(100vh-240px)] grid-cols-1 gap-6 lg:grid-cols-[1fr_400px]">
          {/* Left Panel - Card Collction */}
          <div className="flex min-h-0 flex-col gap-4">
            <CardFilters
              selectedMana={selectedMana}
              onManaSelect={setSelectedMana}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
            />

            {/* 메인 / 재앙 카드 탭 전환 */}
            <div className="flex items-center gap-2 px-1">
              <Button
                size="sm"
                variant={selectedTab === 'main' ? 'default' : 'outline'}
                onClick={() => setSelectedTab('main')}
              >
                메인 카드
              </Button>
              <Button
                size="sm"
                variant={selectedTab === 'cata' ? 'default' : 'outline'}
                onClick={() => setSelectedTab('cata')}
              >
                재앙 카드
              </Button>
            </div>

            <div className="bg-card border-border flex-1 overflow-hidden rounded-lg border">
              <ScrollArea className="h-full p-4">
                {loadingCards ? (
                  <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
                    {Array.from({ length: 8 }).map((_, i) => (
                      <Skeleton key={i} className="h-40 w-full" />
                    ))}
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
                    {filteredCards.map((card) => (
                      <GameCard
                        key={card.id}
                        card={card}
                        onClick={() => handleAdd(card.id)}
                        count={getCardCount(card.id)}
                      />
                    ))}
                  </div>
                )}
                {!loadingCards && filteredCards.length === 0 && (
                  <div className="text-muted-foreground flex h-64 items-center justify-center">
                    <p>검색 결과가 없습니다</p>
                  </div>
                )}
              </ScrollArea>
            </div>
          </div>
          {/* Right Panel - Deck */}
          <div className="flex min-h-0 flex-col gap-4">
            <DeckPanel
              deckCards={deckCards}
              onRemoveCard={handleRemove}
              maxMainSize={MAX_MAIN_SIZE}
              maxCataSize={MAX_CATA_SIZE}
              cataIds={
                new Set(
                  deckCards.flatMap((dc) => {
                    // 선택된 카드가 재앙인지 여부는 dto를 통해 판별
                    const dto = cardDtoById.get(dc.id);
                    return dto?.type === 'catastrophe' ? [dc.id] : [];
                  }),
                )
              }
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default DeckBuilder;
