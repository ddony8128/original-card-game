import { create } from 'zustand';
import type { Deck } from '../types/deck';
import type { User } from '../types/user';
import type { Room } from '../types/room';

interface GameStoreState {
  user: User | null;
  decks: Deck[];
  room: Room | null;
  gameState: unknown;
}

interface GameStoreActions {
  setUser: (user: User | null) => void;
  addDeck: (deck: Deck) => void;
  setRoom: (room: Room | null) => void;
  setGameState: (gameState: unknown) => void;
}

export const useGameStore = create<GameStoreState & GameStoreActions>((set) => ({
  user: null,
  decks: [],
  room: null,
  gameState: null,

  setUser: (user) => set({ user }),
  addDeck: (deck) => set((state) => ({ decks: [...state.decks, deck] })),
  setRoom: (room) => set({ room }),
  setGameState: (gameState) => set({ gameState }),
}));