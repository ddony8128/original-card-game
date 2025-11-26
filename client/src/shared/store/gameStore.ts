import { create } from 'zustand';
import type { FoggedGameState, PlayerID, ClientSideActionLog } from '@/shared/types/game';
import type {
  AskMulliganPayload,
  DiffPatch,
  GameInitPayload,
  RequestInputPayload,
  StatePatchPayload,
} from '@/shared/types/ws';
import { useCardMetaStore } from './cardMetaStore';

type GameFogState = {
  fogged: FoggedGameState | null;
  version: number | null;
  lastDiff: DiffPatch | null;
  logs: ClientSideActionLog[];
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
  logs: [],
  requestInput: null,
  mulligan: null,
  selectedDeckId: null,
  setFromGameInit: (payload) => {
    // 카드 메타 정보 저장
    if (payload.state.cardMetas && payload.state.cardMetas.length > 0) {
      useCardMetaStore.getState().upsertFromWsHand(payload.state.cardMetas);
    }
    set({
      fogged: payload.state,
      version: payload.version,
      lastDiff: null,
      requestInput: null,
      mulligan: null,
      logs: [],
    });
  },
  applyStatePatch: (payload) => {
    const current = get().fogged;
    console.log('[applyStatePatch] payload:', payload);
    if (!current) {
      console.log('[applyStatePatch] No current fogged state. Skipping patch.');
      return;
    }
    // 카드 메타 정보 저장
    if (payload.fogged_state.cardMetas && payload.fogged_state.cardMetas.length > 0) {
      useCardMetaStore.getState().upsertFromWsHand(payload.fogged_state.cardMetas);
    }

    // diff.log 를 클라이언트 게임 로그로 변환하여 누적
    const prevLogs = get().logs ?? [];
    const turn = payload.fogged_state.turn;
    const actor = payload.fogged_state.activePlayer;
    const newLogs: ClientSideActionLog[] =
      payload.diff_patch.log?.map((text) => ({
        turn,
        actor,
        text,
      })) ?? [];

    set({
      fogged: payload.fogged_state,
      version: payload.version,
      lastDiff: payload.diff_patch,
      logs: [...prevLogs, ...newLogs].slice(-100),
    });
    console.log('[applyStatePatch] State updated:', {
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
