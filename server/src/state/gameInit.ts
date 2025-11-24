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
import { cardsService } from '../services/cards';

const BOARD_WIDTH = 5;
const BOARD_HEIGHT = 5;
const INITIAL_HP = 20;
const INITIAL_MAX_HP = 20;
const INITIAL_MANA = 0;
const INITIAL_MAX_MANA = 0;
const INITIAL_HAND_LIMIT = 6;

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
    phase: GamePhase.WAITING_FOR_PLAYER_ACTION,
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

  const allRows = await cardsService.listAll();
  const metaById = new Map<CardID, CardMeta>();
  for (const row of allRows) {
    if (!neededCardIds.has(row.id)) continue;
    const kind = row.type === 'ritual' ? 'ritual' : 'instant';
    const name = row.name_ko || row.name_dev;
    metaById.set(row.id as CardID, {
      id: row.id as CardID,
      name,
      manaCost: row.mana ?? 0,
      kind,
      effectJson: row.effect_json,
    });
  }

  const ctx: EngineContext = {
    lookupCard: (id) => metaById.get(id) ?? null,
  };

  return ctx;
}
