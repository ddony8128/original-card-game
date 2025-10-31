import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useGameStore } from "@/store/useGameStore";
import { useDeckStore } from "@/store/useDeckStore";
import type { Card as CardType } from "@/types/deck";
import { GameCard } from "@/components/deck-builder/GameCard";
import { GameBoard } from "@/components/game/GameBoard";
import type { GameState, Position } from "@/types/game";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, Trash2, Play } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export default function Game() {
  const navigate = useNavigate();
  const { user, room } = useGameStore();
  const { decks } = useDeckStore();
  
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [selectedCardIndex, setSelectedCardIndex] = useState<number | null>(null);
  const [selectedBoardPosition, setSelectedBoardPosition] = useState<Position | null>(null);

  useEffect(() => {
    if (!user || !room) {
      navigate("/");
      return;
    }
    
    // 첫 번째 덱으로 게임 초기화
    if (decks.length > 0 && !gameState) {
      const deck = decks[0];
      const fullDeck: CardType[] = [];
      deck.cards.forEach(card => {
        for (let i = 0; i < card.count; i++) {
          fullDeck.push({ ...card });
        }
      });
      
      // 덱 섞기
      const shuffled = [...fullDeck].sort(() => Math.random() - 0.5);
      
      // 초기 핸드 5장 드로우
      const initialHand = shuffled.slice(0, 5);
      const remainingDeck = shuffled.slice(5);
      
      setGameState({
        deck: remainingDeck,
        hand: initialHand,
        discardPile: [],
        playedCards: [],
        mana: 3,
        maxMana: 3,
        hp: 20,
        maxHp: 20,
        playerPosition: { x: 2, y: 4 }, // 하단 중앙
        opponentPosition: { x: 2, y: 0 }, // 상단 중앙
      });
    }
  }, [user, room, decks, gameState, navigate]);

  const drawCard = () => {
    if (!gameState) return;
    
    if (gameState.deck.length === 0) {
      toast.error("덱에 카드가 없습니다.", {
        description: "덱에 카드를 추가하세요.",
      });
      return;
    }
    
    if (gameState.hand.length >= 10) {
      toast.error("손패가 가득 찼습니다.", {
        description: "최대 10장까지 보유할 수 있습니다.",
      });
      return;
    }
    
    const newDeck = [...gameState.deck];
    const drawnCard = newDeck.shift()!;
    
    setGameState({
      ...gameState,
      deck: newDeck,
      hand: [...gameState.hand, drawnCard],
    });
    
    toast.success("카드를 뽑았습니다.", {
      description: `${drawnCard.name}을(를) 뽑았습니다.`,
    });
  };

  const playCard = (index: number) => {
    if (!gameState) return;
    
    const card = gameState.hand[index];
    
    if (gameState.mana < card.manaCost) {
      toast.error("마나가 부족합니다.", {
        description: `${card.manaCost} 마나가 필요합니다.`,
      });
      return;
    }
    
    const newHand = [...gameState.hand];
    newHand.splice(index, 1);
    
    setGameState({
      ...gameState,
      hand: newHand,
      playedCards: [...gameState.playedCards, card],
      mana: gameState.mana - card.manaCost,
    });
    
    toast.success("카드를 사용했습니다.", {
      description: `${card.name}을(를) 사용했습니다.`,
    });
    
    setSelectedCardIndex(null);
  };

  const discardCard = (index: number) => {
    if (!gameState) return;
    
    const card = gameState.hand[index];
    const newHand = [...gameState.hand];
    newHand.splice(index, 1);
    
    setGameState({
      ...gameState,
      hand: newHand,
      discardPile: [...gameState.discardPile, card],
    });
    
    toast.success("카드를 버렸습니다.", {
      description: `${card.name}을(를) 버렸습니다.`,
    });
    
    setSelectedCardIndex(null);
  };

  const movePlayer = (targetPosition: Position) => {
    if (!gameState) return;

    // 이미 플레이어나 상대가 있는 위치인지 확인
    if (
      (targetPosition.x === gameState.playerPosition.x &&
        targetPosition.y === gameState.playerPosition.y) ||
      (targetPosition.x === gameState.opponentPosition.x &&
        targetPosition.y === gameState.opponentPosition.y)
    ) {
      toast.error("이동 불가능합니다.", {
        description: "해당 위치에는 이동할 수 없습니다.",
      });
      return;
    }

    // 인접한 칸인지 확인 (상하좌우 1칸)
    const dx = Math.abs(targetPosition.x - gameState.playerPosition.x);
    const dy = Math.abs(targetPosition.y - gameState.playerPosition.y);
    if ((dx === 1 && dy === 0) || (dx === 0 && dy === 1)) {
      if (gameState.mana < 1) {
        toast.error("마나가 부족합니다.", {
          description: "이동하려면 1 마나가 필요합니다.",
        });
        return;
      }

      setGameState({
        ...gameState,
        playerPosition: targetPosition,
        mana: gameState.mana - 1,
      });

      toast.success("이동 완료", {
        description: "플레이어가 이동했습니다.",
      });

      setSelectedBoardPosition(null);
    } else {
      toast.error("이동 불가능합니다.", {
        description: "인접한 칸으로만 이동할 수 있습니다.",
      });
    }
  };

  const handleBoardCellClick = (position: Position) => {
    setSelectedBoardPosition(position);
    movePlayer(position);
  };

  const endTurn = () => {
    if (!gameState) return;
    
    setGameState({
      ...gameState,
      mana: Math.min(gameState.maxMana + 1, 10),
      maxMana: Math.min(gameState.maxMana + 1, 10),
      playedCards: [],
    });
    
    toast.success("턴 종료", {
      description: "새로운 턴이 시작됩니다.",
    });
  };

  if (!gameState) return null;

  return (
    <div className="min-h-screen bg-linear-to-br from-background via-background to-accent/10 p-4">
      <div className="max-w-7xl mx-auto space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <Button variant="outline" onClick={() => navigate("/lobby")}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            로비
          </Button>
          <div className="text-sm text-muted-foreground">
            방 코드: {room?.code}
          </div>
        </div>

        {/* Game Board */}
        <div className="flex justify-center">
          <GameBoard
            playerPosition={gameState.playerPosition}
            opponentPosition={gameState.opponentPosition}
            selectedPosition={selectedBoardPosition}
            onCellClick={handleBoardCellClick}
          />
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6 text-center">
              <div className="text-2xl font-bold text-primary">{gameState.hp}</div>
              <div className="text-xs text-muted-foreground">HP</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 text-center">
              <div className="text-2xl font-bold text-blue-500">
                {gameState.mana}/{gameState.maxMana}
              </div>
              <div className="text-xs text-muted-foreground">마나</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 text-center">
              <div className="text-2xl font-bold">{gameState.deck.length}</div>
              <div className="text-xs text-muted-foreground">덱</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 text-center">
              <div className="text-2xl font-bold">{gameState.discardPile.length}</div>
              <div className="text-xs text-muted-foreground">버린 카드</div>
            </CardContent>
          </Card>
        </div>

        {/* Played Cards Area */}
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm font-medium mb-3">플레이한 카드</div>
            {gameState.playedCards.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                이번 턴에 사용한 카드가 없습니다
              </div>
            ) : (
              <div className="grid grid-cols-4 md:grid-cols-6 gap-3">
                {gameState.playedCards.map((card, index) => (
                  <GameCard key={`${card.id}-${index}`} card={card} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Hand */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm font-medium">
                내 손패 ({gameState.hand.length}/10)
              </div>
              <div className="flex gap-2">
                <Button onClick={drawCard} size="sm">
                  카드 드로우
                </Button>
                <Button onClick={endTurn} variant="secondary" size="sm">
                  턴 종료
                </Button>
              </div>
            </div>
            
            {gameState.hand.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                손패가 비어있습니다
              </div>
            ) : (
              <div className="grid grid-cols-3 md:grid-cols-5 lg:grid-cols-6 gap-3">
                {gameState.hand.map((card, index) => (
                  <div key={`${card.id}-${index}`} className="relative">
                    <div
                      className={cn(
                        "transition-all",
                        selectedCardIndex === index && "ring-2 ring-primary rounded-lg"
                      )}
                      onClick={() => setSelectedCardIndex(index)}
                    >
                      <GameCard card={card} />
                    </div>
                    
                    {selectedCardIndex === index && (
                      <div className="absolute -bottom-2 left-0 right-0 flex gap-1 justify-center z-10">
                        <Button
                          size="sm"
                          className="h-7 text-xs"
                          onClick={(e) => {
                            e.stopPropagation();
                            playCard(index);
                          }}
                        >
                          <Play className="w-3 h-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          className="h-7 text-xs"
                          onClick={(e) => {
                            e.stopPropagation();
                            discardCard(index);
                          }}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
