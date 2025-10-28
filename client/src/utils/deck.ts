import type { Deck } from "../types/deck";

export const getDeckLength = (deck: Deck) => {
    return deck.cards.reduce((acc, card) => acc + card.count, 0);
}