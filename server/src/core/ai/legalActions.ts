import type { GameState, PlayerID, CardInstance } from '../../type/gameState';
import type { CardMeta } from '../context';
import { isInsideBoard } from '../engine/boardUtils';
import { MOVE_MANA_COST } from '../rules/constants';

export type LegalAction =
  | { kind: 'end_turn' }
  | { kind: 'move'; to: { r: number; c: number } } // ABSOLUTE board coords
  | { kind: 'use_card'; cardInstance: CardInstance }
  | { kind: 'use_ritual'; ritualId: string };

const ORTHOGONAL_DELTAS: ReadonlyArray<{ dr: number; dc: number }> = [
  { dr: -1, dc: 0 },
  { dr: 1, dc: 0 },
  { dr: 0, dc: -1 },
  { dr: 0, dc: 1 },
];

export function legalActions(
  state: GameState,
  playerId: PlayerID,
  getMeta: (cardId: string) => CardMeta | null,
): LegalAction[] {
  const actions: LegalAction[] = [{ kind: 'end_turn' }];

  const player = state.players[playerId];
  if (!player) return actions;

  const { board } = state;

  // MOVE: orthogonally-adjacent in-board cells not occupied by another wizard,
  // only if the player can afford the move.
  const wizard = board.wizards[playerId];
  if (wizard && player.mana >= MOVE_MANA_COST) {
    for (const { dr, dc } of ORTHOGONAL_DELTAS) {
      const r = wizard.r + dr;
      const c = wizard.c + dc;
      if (!isInsideBoard(board, r, c)) continue;
      const occupiedByOtherWizard = Object.entries(board.wizards).some(
        ([pid, pos]) => pid !== playerId && pos.r === r && pos.c === c,
      );
      if (occupiedByOtherWizard) continue;
      actions.push({ kind: 'move', to: { r, c } });
    }
  }

  // USE_CARD: each affordable hand card.
  for (const cardInstance of player.hand) {
    const cost = getMeta(cardInstance.cardId)?.mana ?? 0;
    if (cost <= player.mana) {
      actions.push({ kind: 'use_card', cardInstance });
    }
  }

  // USE_RITUAL: owned rituals not yet used this turn.
  for (const ritual of board.rituals) {
    if (ritual.owner === playerId && !ritual.usedThisTurn) {
      actions.push({ kind: 'use_ritual', ritualId: ritual.id });
    }
  }

  return actions;
}
