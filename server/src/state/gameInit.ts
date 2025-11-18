import { GamePhase, type GameState, type PlayerID, type CardID, type PlayerState } from '../type/gameState';
import type { DeckList } from '../type/deck';
import type { EngineContext, CardMeta } from '../core/context';
import { cardsService } from '../services/cards';

export interface PlayerDeckConfig {
  playerId: PlayerID;
  main: DeckList;
  cata: DeckList;
}

export function createInitialGameState(players: PlayerID[], decks: Map<PlayerID, DeckList>, cataDecks: Map<PlayerID, DeckList>): GameState {
  const boardWidth = 5;
  const boardHeight = 5;

  const playerStates: Record<PlayerID, PlayerState> = {} as any;
  const catastropheDeck: CardID[] = [];

  players.forEach((pid, index) => {
    const main = decks.get(pid) ?? [];
    const cata = cataDecks.get(pid) ?? [];

    const deck: CardID[] = [];
    main.forEach((entry) => {
      for (let i = 0; i < entry.count; i += 1) {
        deck.push(entry.id);
      }
    });

    cata.forEach((entry) => {
      for (let i = 0; i < entry.count; i += 1) {
        catastropheDeck.push(entry.id);
      }
    });

    playerStates[pid] = {
      hp: 20,
      maxMana: 0,
      mana: 0,
      deck,
      grave: [],
      hand: [],
      handLimit: 10,
      mulliganSelected: false,
    };
  });

  const wizards: GameState['board']['wizards'] = {} as any;
  if (players[0]) {
    wizards[players[0]] = { r: boardHeight - 1, c: Math.floor(boardWidth / 2) };
  }
  if (players[1]) {
    wizards[players[1]] = { r: 0, c: Math.floor(boardWidth / 2) };
  }

  return {
    phase: GamePhase.WAITING_FOR_PLAYER_ACTION,
    turn: 1,
    activePlayer: players[0] ?? 'player1',
    winner: null,
    board: {
      width: boardWidth,
      height: boardHeight,
      wizards,
      rituals: [],
    },
    players: playerStates,
    catastropheDeck,
    catastropheGrave: [],
    logs: [],
  };
}

export async function buildEngineContextFromDecks(configs: PlayerDeckConfig[]): Promise<EngineContext> {
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


