import {
  GamePhase,
  type GameState,
  type PlayerID,
  type CardID,
  type PlayerState,
  type CardInstance,
} from '../type/gameState';
import type { DeckList } from '../type/deck';
import type { EngineContext, CardMeta } from '../core/context';
import { cardsService, type CardRow } from '../services/cards';
import {
  BOARD_WIDTH,
  BOARD_HEIGHT,
  INITIAL_HP,
  INITIAL_MAX_HP,
  INITIAL_MANA,
  INITIAL_MAX_MANA,
  INITIAL_HAND_LIMIT,
} from '../core/rules/constants';

export interface PlayerDeckConfig {
  playerId: PlayerID;
  main: DeckList;
  cata: DeckList;
}

function buildCardInstancesForPlayer(
  playerId: PlayerID,
  deck: DeckList,
  kind: 'main' | 'cata',
): CardInstance[] {
  const instances: CardInstance[] = [];

  deck.forEach((entry) => {
    for (let i = 0; i < entry.count; i += 1) {
      instances.push({
        id: `${kind}_${playerId}_${entry.id}_${i}`,
        cardId: entry.id as CardID,
      });
    }
  });

  return instances;
}

export function createInitialGameState(
  playerDeckConfigs: PlayerDeckConfig[],
): GameState {
  const playerStates: Record<PlayerID, PlayerState> = {};
  const catastropheDeck: CardInstance[] = [];

  playerDeckConfigs.forEach((cfg) => {
    const deck = buildCardInstancesForPlayer(cfg.playerId, cfg.main, 'main');
    const cata = buildCardInstancesForPlayer(cfg.playerId, cfg.cata, 'cata');
    catastropheDeck.push(...cata);
    playerStates[cfg.playerId] = {
      hp: INITIAL_HP,
      maxHp: INITIAL_MAX_HP,
      maxMana: INITIAL_MAX_MANA,
      mana: INITIAL_MANA,
      deck,
      grave: [],
      hand: [],
      handLimit: INITIAL_HAND_LIMIT,
      mulliganSelected: false,
      resolveStack: [],
    };
  });

  const wizards: GameState['board']['wizards'] = {};
  const first = playerDeckConfigs[0];
  const second = playerDeckConfigs[1];
  if (first) {
    wizards[first.playerId] = {
      r: BOARD_HEIGHT - 1,
      c: Math.floor(BOARD_WIDTH / 2),
    };
  }
  if (second) {
    wizards[second.playerId] = {
      r: 0,
      c: Math.floor(BOARD_WIDTH / 2),
    };
  }

  return {
    phase: GamePhase.INITIALIZING,
    turn: 1,
    activePlayer: playerDeckConfigs[0]?.playerId ?? 'player1',
    // 실제 첫 턴은 GameEnginCore가 랜덤으로 결정함
    winner: null,
    board: {
      width: BOARD_WIDTH,
      height: BOARD_HEIGHT,
      wizards,
      rituals: [],
    },
    players: playerStates,
    catastropheDeck,
    catastropheGrave: [],
    logs: [],
  };
}

export async function buildEngineContextFromDecks(
  configs: PlayerDeckConfig[],
): Promise<EngineContext> {
  const neededCardIds = new Set<CardID>();
  configs.forEach((cfg) => {
    cfg.main.forEach((entry) => neededCardIds.add(entry.id));
    cfg.cata.forEach((entry) => neededCardIds.add(entry.id));
  });

  // 필요한 카드만 조회 (getByIds 사용)
  const neededCardIdsArray = Array.from(neededCardIds);
  const cardRows: CardRow[] = await cardsService.getByIds(neededCardIdsArray);

  const metaById = new Map<CardID, CardMeta>();
  for (const row of cardRows) {
    metaById.set(row.id as CardID, {
      id: row.id as CardID,
      name_dev: row.name_dev,
      name_ko: row.name_ko,
      description_ko: row.description_ko,
      type: row.type,
      mana: row.mana,
      token: row.token,
      effectJson: row.effect_json,
    });
  }

  const ctx: EngineContext = {
    lookupCard: async (id: CardID) => {
      // 먼저 캐시에서 확인
      const cached = metaById.get(id);
      if (cached) return cached;

      // 캐시에 없으면 DB에서 조회 (비동기 fallback)
      const row = await cardsService.getById(id);
      if (!row) return null;

      const meta: CardMeta = {
        id: row.id as CardID,
        name_dev: row.name_dev,
        name_ko: row.name_ko,
        description_ko: row.description_ko,
        type: row.type,
        mana: row.mana,
        token: row.token,
        effectJson: row.effect_json,
      };

      // 캐시에 추가 (다음 조회는 동기로 가능)
      metaById.set(id, meta);
      return meta;
    },
  };

  return ctx;
}
