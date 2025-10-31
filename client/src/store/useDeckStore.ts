import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Deck } from "../types/deck";

interface DeckStore {
  decks: Deck[];
  addDeck: (deck: Deck) => void;
  updateDeck: (id : string, deck: Deck) => void;
  deleteDeck: (id: string) => void;
  getDeck: (id: string) => Deck | undefined;
}

export const useDeckStore = create<DeckStore>()(
  persist(
    (set, get) => ({
      decks: [],

      addDeck: (deck) =>
        set((state) => ({
          decks: [...state.decks, deck],
        })),

      updateDeck: (id, deck) =>
        set((state) => ({
          decks: state.decks.map((d) => (d.id === id ? deck : d)),
        })),

      deleteDeck: (id) =>
        set((state) => ({
          decks: state.decks.filter((d) => d.id !== id),
        })),

      getDeck: (id) => get().decks.find((d) => d.id === id),
    }),
    { name: "deck-storage" }  // local storage key 이름
  )
);
