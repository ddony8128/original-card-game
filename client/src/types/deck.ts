export interface Card {
    id: string;
    name: string;
    description: string;
    manaCost: number;
    type: "instant" | "ritual";
  }
  
  export interface DeckCard extends Card {
    count: number;
  }
  
  export interface Deck {
    id: string;
    name: string;
    cards: DeckCard[];
    createdAt: number;
    updatedAt: number;
  }
  