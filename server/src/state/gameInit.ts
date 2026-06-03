import {
  GamePhase,
  type GameState,
  type PlayerID,
  type CardID,
  type PlayerState,
  type CardInstance,
} from '../type/gameState';
import type { DeckList } from '../type/deck';
import type { EngineContext } from '../core/context';
import { ensureCardCatalog } from '../core/resources/cardCatalog';
import {
  BOARD_WIDTH,
  BOARD_HEIGHT,
  INITIAL_HP,
  INITIAL_MAX_HP,
  INITIAL_MANA,
  INITIAL_MAX_MANA,
  INITIAL_HAND_LIMIT,
} from '../core/rules/constants';

/**
 * 게임 엔진이 사용할 **초기 GameState 및 카드 메타(Context)** 를 만드는 모듈.
 *
 * - 덱 리스트(메인/재앙)를 받아 각 플레이어별 CardInstance 배열을 생성한다.
 * - 두 플레이어의 마법사 시작 위치를 설정하고, 재앙 덱을 하나로 합친다.
 * - `buildEngineContextFromDecks` 는 필요한 카드 메타만 Supabase에서 미리 조회 후
 *   엔진에서 사용할 lookupCard 캐시를 구성한다.
 */

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
  _configs: PlayerDeckConfig[],
): Promise<EngineContext> {
  // 카드 카탈로그(불변 리소스)를 메모리에 1회 적재한다. 이후 플레이 중
  // lookupCard 는 DB 조회 없이 메모리 카탈로그에서 동기적으로 찾는다.
  const catalog = await ensureCardCatalog();

  const ctx: EngineContext = {
    lookupCard: async (id: CardID) => catalog.get(id) ?? null,
  };

  return ctx;
}
