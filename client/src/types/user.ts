import type { Deck } from './deck';

export interface User { 
    id: string;
    name: string;
    decks: Deck[];
    createdAt: number;
    updatedAt: number;
}

