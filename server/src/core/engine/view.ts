import type {
  GameState,
  FoggedGameState,
  PlayerID,
} from '../../type/gameState';
import type { DiffPatch, StatePatchPayload } from '../../type/wsProtocol';
import { toViewerPos } from './boardUtils';

export interface ViewerStatePatch {
  playerId: PlayerID;
  statePatch: StatePatchPayload;
}

// FoggedGameState 변환
export function toFoggedState(
  state: GameState,
  viewer: PlayerID,
  bottomSidePlayerId: PlayerID | null,
): FoggedGameState {
  const meState = state.players[viewer];
  const opponentEntry = Object.entries(state.players).find(
    ([id]) => id !== viewer,
  );
  const opponentState = opponentEntry?.[1];

  const { width, height } = state.board;

  console.log('meState', {
    meState,
  });
  console.log('opponentState', {
    opponentState,
  });

  const wizards: FoggedGameState['board']['wizards'] = {} as any;
  Object.entries(state.board.wizards).forEach(([pid, pos]) => {
    const translated = toViewerPos(
      state.board,
      bottomSidePlayerId,
      pos,
      viewer,
    );

    console.log('translated', {
      r: translated.r,
      c: translated.c,
    });

    (wizards as any)[pid] = { r: translated.r, c: translated.c };
  });

  const rituals = state.board.rituals.map((r) => {
    const translated = toViewerPos(
      state.board,
      bottomSidePlayerId,
      r.pos,
      viewer,
    );
    return {
      id: r.id,
      cardId: r.cardId,
      owner: r.owner,
      pos: translated,
      usedThisTurn: !!r.usedThisTurn,
    };
  });

  return {
    phase: state.phase,
    turn: state.turn,
    activePlayer: state.activePlayer,
    winner: state.winner ?? null,
    board: {
      width,
      height,
      wizards,
      rituals,
    },
    me: {
      hp: meState?.hp ?? 0,
      maxHp: meState?.maxHp ?? meState?.hp ?? 0,
      mana: meState?.mana ?? 0,
      maxMana: meState?.maxMana ?? 0,
      hand: meState?.hand ?? [],
      handCount: meState?.hand.length ?? 0,
      deckCount: meState?.deck.length ?? 0,
      graveCount: meState?.grave.length ?? 0,
      resolveStack: meState?.resolveStack.map((e) => e.card) ?? [],
    },
    opponent: {
      hp: opponentState?.hp ?? 0,
      maxHp: opponentState?.maxHp ?? opponentState?.hp ?? 0,
      mana: opponentState?.mana ?? 0,
      maxMana: opponentState?.maxMana ?? 0,
      handCount: opponentState?.hand.length ?? 0,
      deckCount: opponentState?.deck.length ?? 0,
      graveCount: opponentState?.grave.length ?? 0,
      resolveStack: opponentState?.resolveStack.map((e) => e.card) ?? [],
    },
    catastrophe: {
      deckCount: state.catastropheDeck.length,
      graveCount: state.catastropheGrave.length,
    },
    lastActions: state.logs.slice(-10),
  };
}

// 전체 플레이어에 대한 상태 패치 생성
export function buildStatePatchForAllView(params: {
  state: GameState;
  players: PlayerID[];
  version: number;
  bottomSidePlayerId: PlayerID | null;
  diff?: DiffPatch;
}): { nextVersion: number; patches: ViewerStatePatch[] } {
  const { state, players, version, bottomSidePlayerId, diff } = params;
  const patches: ViewerStatePatch[] = [];
  const nextVersion = version + 1;
  const baseDiff: DiffPatch = diff ?? { animations: [], log: [] };

  players.forEach((pid) => {
    const fog = toFoggedState(state, pid, bottomSidePlayerId);
    const viewerDiff: DiffPatch = {
      animations: baseDiff.animations.map((anim) => {
        const transformed = { ...anim };
        if (anim.from) {
          const [r, c] = anim.from;
          const pos = toViewerPos(
            state.board,
            bottomSidePlayerId,
            { r, c },
            pid,
          );
          transformed.from = [pos.r, pos.c];
        }
        if (anim.to) {
          const [r, c] = anim.to;
          const pos = toViewerPos(
            state.board,
            bottomSidePlayerId,
            { r, c },
            pid,
          );
          transformed.to = [pos.r, pos.c];
        }
        return transformed;
      }),
      log: [...baseDiff.log],
    };

    const statePatch: StatePatchPayload = {
      version: nextVersion,
      fogged_state: fog,
      diff_patch: viewerDiff,
    };

    patches.push({
      playerId: pid,
      statePatch,
    });
  });

  return { nextVersion, patches };
}
