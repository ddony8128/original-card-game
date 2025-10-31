import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User } from '../types/user';
import type { Room } from '../types/room';

interface GameStore {
  user: User | null;
  room: Room | null;
  setUser: (user: User | null) => void;
  setRoom: (room: Room | null) => void;
}

export const useGameStore = create<GameStore>()(
  persist(
    (set) => ({
      user: null,
      room: null,
      setUser: (user) => set({ user }),
      setRoom: (room) => set({ room }),
    }),
    { name: "game-storage" }
  )
);