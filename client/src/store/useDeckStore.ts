import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Deck } from "../types/deck";

interface DeckState {
  decks: Deck[];
  addDeck: (deck: Deck) => void;
  updateDeck: (deck: Deck) => void;
  deleteDeck: (id: string) => void;
  getDeck: (id: string) => Deck | undefined;
}

export const useDeckStore = create<DeckState>()(
  persist(
    (set, get) => ({
      decks: [],

      addDeck: (deck) =>
        set((state) => ({
          decks: [...state.decks, deck].slice(0, 4), // 최대 4개 제한
        })),

      updateDeck: (deck) =>
        set((state) => ({
          decks: state.decks.map((d) => (d.id === deck.id ? deck : d)),
        })),

      deleteDeck: (id) =>
        set((state) => ({
          decks: state.decks.filter((d) => d.id !== id),
        })),

      getDeck: (id) => get().decks.find((d) => d.id === id),
    }),
    { name: "deck-storage" }
  )
);
