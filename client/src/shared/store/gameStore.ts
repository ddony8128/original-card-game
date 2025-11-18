import { create } from 'zustand';
import type { FoggedGameState } from '@/shared/types/game';
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
};

type GameFogActions = {
  setFromGameInit: (payload: GameInitPayload) => void;
  applyStatePatch: (payload: StatePatchPayload) => void;
  setRequestInput: (payload: RequestInputPayload | null) => void;
  setMulligan: (payload: AskMulliganPayload | null) => void;
  clearLastDiff: () => void;
  clear: () => void;
};

export const useGameFogStore = create<GameFogState & GameFogActions>((set, get) => ({
  fogged: null,
  version: null,
  lastDiff: null,
  requestInput: null,
  mulligan: null,
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
  clearLastDiff: () => set({ lastDiff: null }),
  clear: () =>
    set({
      fogged: null,
      version: null,
      lastDiff: null,
      requestInput: null,
      mulligan: null,
    }),
}));
