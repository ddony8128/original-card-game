import type { GameState, PlayerID } from '../../type/gameState';
import type { CardMeta } from '../context';
import { MOVE_MANA_COST } from '../rules/constants';
import { legalActions, type LegalAction } from './legalActions';

function pickRandom<T>(items: T[], rand: () => number): T {
  if (items.length === 1) return items[0];
  const idx = Math.floor(rand() * items.length);
  return items[Math.min(idx, items.length - 1)];
}

export function chooseAIAction(
  state: GameState,
  playerId: PlayerID,
  getMeta: (cardId: string) => CardMeta | null,
  rand: () => number,
): LegalAction {
  const actions = legalActions(state, playerId, getMeta);

  // 1. Most-expensive affordable card.
  const cardActions = actions.filter(
    (a): a is Extract<LegalAction, { kind: 'use_card' }> =>
      a.kind === 'use_card',
  );
  if (cardActions.length > 0) {
    let bestCost = -Infinity;
    for (const a of cardActions) {
      const cost = getMeta(a.cardInstance.cardId)?.mana ?? 0;
      if (cost > bestCost) bestCost = cost;
    }
    const best = cardActions.filter(
      (a) => (getMeta(a.cardInstance.cardId)?.mana ?? 0) === bestCost,
    );
    return pickRandom(best, rand);
  }

  // 2. Move that strictly reduces Manhattan distance to the opponent wizard.
  const player = state.players[playerId];
  const wizard = state.board.wizards[playerId];
  const opponentEntry = Object.entries(state.board.wizards).find(
    ([pid]) => pid !== playerId,
  );
  if (wizard && opponentEntry && player && player.mana >= MOVE_MANA_COST) {
    const opponent = opponentEntry[1];
    const currentDist =
      Math.abs(wizard.r - opponent.r) + Math.abs(wizard.c - opponent.c);

    const moveActions = actions.filter(
      (a): a is Extract<LegalAction, { kind: 'move' }> => a.kind === 'move',
    );

    let bestDist = currentDist;
    for (const a of moveActions) {
      const dist =
        Math.abs(a.to.r - opponent.r) + Math.abs(a.to.c - opponent.c);
      if (dist < bestDist) bestDist = dist;
    }

    if (bestDist < currentDist) {
      const best = moveActions.filter(
        (a) =>
          Math.abs(a.to.r - opponent.r) + Math.abs(a.to.c - opponent.c) ===
          bestDist,
      );
      return pickRandom(best, rand);
    }
  }

  // 3. Nothing useful.
  return { kind: 'end_turn' };
}
