import { create } from 'zustand';
import type { FoggedGameState } from '@/shared/types/game';

type GameFogState = {
  fogged: FoggedGameState | null;
};

type GameFogActions = {
  setFogged: (state: FoggedGameState) => void;
  patchFogged: (partial: Partial<FoggedGameState>) => void;
  clear: () => void;
};

export const useGameFogStore = create<GameFogState & GameFogActions>((set, get) => ({
  fogged: null,
  setFogged: (state) => set({ fogged: state }),
  patchFogged: (partial) => {
    const current = get().fogged;
    if (!current) return;
    set({ fogged: { ...current, ...partial } });
  },
  clear: () => set({ fogged: null }),
}));
