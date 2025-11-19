import { create } from 'zustand';
import type { FoggedGameState, PlayerID } from '@/shared/types/game';
import type {
  AskMulliganPayload,
  DiffPatch,
  GameInitPayload,
  RequestInputPayload,
  StatePatchPayload,
} from '@/shared/types/ws';

type GameFogState = {
  fogged: FoggedGameState | null;
  version: number | null;
  lastDiff: DiffPatch | null;
  requestInput: RequestInputPayload | null;
  mulligan: AskMulliganPayload | null;
  selectedDeckId: string | null;
};

type GameFogActions = {
  setFromGameInit: (payload: GameInitPayload) => void;
  applyStatePatch: (payload: StatePatchPayload) => void;
  setRequestInput: (payload: RequestInputPayload | null) => void;
  setMulligan: (payload: AskMulliganPayload | null) => void;
  isMyTurn: (userId: PlayerID) => boolean;
  hasEnoughMana: (cost: number) => boolean;
  clearLastDiff: () => void;
  clear: () => void;
  setSelectedDeckId: (deckId: string | null) => void;
};

export const useGameFogStore = create<GameFogState & GameFogActions>((set, get) => ({
  fogged: null,
  version: null,
  lastDiff: null,
  requestInput: null,
  mulligan: null,
  selectedDeckId: null,
  setFromGameInit: (payload) =>
    set({
      fogged: payload.state,
      version: payload.version,
      lastDiff: null,
      requestInput: null,
      mulligan: null,
    }),
  applyStatePatch: (payload) => {
    const current = get().fogged;
    if (!current) return;
    set({
      fogged: payload.fogged_state,
      version: payload.version,
      lastDiff: payload.diff_patch,
    });
  },
  setRequestInput: (payload) => set({ requestInput: payload }),
  setMulligan: (payload) => set({ mulligan: payload }),
  isMyTurn: (userId: PlayerID) => {
    const current = get().fogged;
    if (!current) return false;
    return current.activePlayer === userId && current.phase === 'WAITING_FOR_PLAYER_ACTION';
  },
  hasEnoughMana: (cost: number) => {
    const current = get().fogged;
    if (!current) return false;
    return current.me.mana >= cost && current.phase === 'WAITING_FOR_PLAYER_ACTION';
  },
  clearLastDiff: () => set({ lastDiff: null }),
  setSelectedDeckId: (deckId) => set({ selectedDeckId: deckId }),
  clear: () =>
    set({
      fogged: null,
      version: null,
      lastDiff: null,
      requestInput: null,
      mulligan: null,
      selectedDeckId: null,
    }),
}));
