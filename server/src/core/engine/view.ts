import type {
  GameState,
  FoggedGameState,
  PlayerID,
  PublicHandCard,
} from '../../type/gameState';
import type { DiffPatch, StatePatchPayload } from '../../type/wsProtocol';
import type { EngineContext } from '../context';
import { toViewerPos } from './boardUtils';

export interface ViewerStatePatch {
  playerId: PlayerID;
  statePatch: StatePatchPayload;
}

// FoggedGameState 변환
export async function toFoggedState(
  state: GameState,
  viewer: PlayerID,
  bottomSidePlayerId: PlayerID | null,
  ctx: EngineContext,
): Promise<FoggedGameState> {
  const meState = state.players[viewer];
  const opponentEntry = Object.entries(state.players).find(
    ([id]) => id !== viewer,
  );
  const opponentState = opponentEntry?.[1];

  const { width, height } = state.board;

  const wizards: FoggedGameState['board']['wizards'] = {} as any;
  Object.entries(state.board.wizards).forEach(([pid, pos]) => {
    const translated = toViewerPos(
      state.board,
      bottomSidePlayerId,
      pos,
      viewer,
    );
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

  // 묘지 / 보드 위 리추얼 / resolve stack 에 있는 모든 카드 ID 수집
  const cardIdsToFetch = new Set<string>();

  // 내 묘지
  meState?.grave.forEach((instance) => {
    cardIdsToFetch.add(instance.cardId);
  });

  // 상대 묘지
  opponentState?.grave.forEach((instance) => {
    cardIdsToFetch.add(instance.cardId);
  });

  // 재앙 묘지
  state.catastropheGrave.forEach((instance) => {
    cardIdsToFetch.add(instance.cardId);
  });

  // 보드 위 리추얼
  state.board.rituals.forEach((ritual) => {
    cardIdsToFetch.add(ritual.cardId);
  });

  // 내 resolve stack
  meState?.resolveStack.forEach((entry) => {
    cardIdsToFetch.add(entry.card.cardId);
  });

  // 상대 resolve stack
  opponentState?.resolveStack.forEach((entry) => {
    cardIdsToFetch.add(entry.card.cardId);
  });

  // 카드 메타 정보 조회
  const cardMetasPromises = Array.from(cardIdsToFetch).map(async (cardId) => {
    const meta = await ctx.lookupCard(cardId);
    if (!meta) return null;
    return {
      id: cardId,
      name: meta.name_ko || meta.name_dev,
      mana: meta.mana ?? 0,
      type: meta.type,
      description: meta.description_ko || '',
    } as PublicHandCard;
  });

  const cardMetas = (await Promise.all(cardMetasPromises)).filter(
    (meta): meta is PublicHandCard => meta !== null,
  );

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
      grave: meState?.grave ?? [],
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
      grave: opponentState?.grave ?? [],
      graveCount: opponentState?.grave.length ?? 0,
      resolveStack: opponentState?.resolveStack.map((e) => e.card) ?? [],
    },
    catastrophe: {
      deckCount: state.catastropheDeck.length,
      grave: state.catastropheGrave ?? [],
      graveCount: state.catastropheGrave.length,
    },
    cardMetas,
    lastActions: state.logs.slice(-10),
  };
}

// 전체 플레이어에 대한 상태 패치 생성
export async function buildStatePatchForAllView(params: {
  state: GameState;
  players: PlayerID[];
  version: number;
  bottomSidePlayerId: PlayerID | null;
  diff?: DiffPatch;
  ctx: EngineContext;
}): Promise<{ nextVersion: number; patches: ViewerStatePatch[] }> {
  const { state, players, version, bottomSidePlayerId, diff, ctx } = params;
  const patches: ViewerStatePatch[] = [];
  const nextVersion = version + 1;
  const baseDiff: DiffPatch = diff ?? { animations: [], log: [] };

  await Promise.all(
    players.map(async (pid) => {
      const fog = await toFoggedState(state, pid, bottomSidePlayerId, ctx);
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
    }),
  );

  return { nextVersion, patches };
}
