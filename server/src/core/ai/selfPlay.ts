import { GamePhase, type PlayerID } from '../../type/gameState';
import type { DeckList } from '../../type/deck';
import type { PlayerActionPayload } from '../../type/wsProtocol';
import { GameEngineAdapter } from '../engine/gameEngineAdapter';
import type { GameEngineCore } from '../engine/gameEngineCore';
import {
  createInitialGameState,
  type PlayerDeckConfig,
} from '../../state/gameInit';
import { ensureCardCatalog } from '../resources/cardCatalog';
import { toViewerPos } from '../engine/boardUtils';
import { chooseAIAction } from './heuristic';
import { getProfile } from './profiles';
import type { LegalAction } from './legalActions';
import type { CardMeta } from '../context';
import type { CardID } from '../../type/gameState';

/**
 * 자기대전(AI vs AI) 시뮬레이션 하네스.
 *
 * 소켓/DB 없이 GameEngineCore 만으로 헤드리스 게임을 끝까지 돌린다.
 * 양쪽 모두 chooseAIAction(프로필 적용)으로 구동하고, AI 입력 요청은
 * soloGameManager 와 동일한 defaultAnswer 로직으로 안전하게 답한다.
 *
 * 반드시 종료(termination)되도록:
 *  - 턴당 스텝 cap (MAX_STEPS_PER_TURN)
 *  - 전역 턴 cap (MAX_TURNS) → 초과 시 draw 처리
 *  - 매 스텝 try/catch → 실패 시 end_turn 강제
 *
 * 재현성(reproducibility)을 위해:
 *  - numeric seed 로 mulberry32 PRNG 를 만들어
 *    ctx.random(셔플/선후공)과 chooseAIAction(동점 선택) 양쪽에 같은 rng 를 주입한다.
 */

const A: PlayerID = 'A';
const B: PlayerID = 'B';

/** 한 턴 안에서 허용하는 최대 스텝(무한 루프 방지). */
const MAX_STEPS_PER_TURN = 40;
/** 전역 턴 cap(초과 시 draw). */
const MAX_TURNS = 200;

export interface SelfPlayResult {
  winner: 'A' | 'B' | 'draw';
  turns: number;
}

export interface SelfPlaySummary {
  games: number;
  aWins: number;
  bWins: number;
  draws: number;
  avgTurns: number;
}

export interface SelfPlayPlayer {
  deck: { main: DeckList; cata: DeckList };
  profileId?: string;
}

/** mulberry32: seed 하나로 만든 결정적 PRNG → 재현 가능한 결과를 보장한다. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** AI 입력 요청에 대한 방어적 기본 답변(soloGameManager 와 동일 로직). */
function defaultAnswer(pendingInput: GameEngineCore['pendingInput']): unknown {
  if (!pendingInput) return null;
  const options = pendingInput.options;
  if (Array.isArray(options) && options.length > 0) {
    const count = pendingInput.count ?? 1;
    if (count > 1) {
      return options.slice(0, Math.min(count, options.length));
    }
    return options[0];
  }
  return null;
}

/** LegalAction(절대 좌표) → PlayerActionPayload(해당 플레이어 viewer 좌표). */
function toActionPayload(
  engine: GameEngineAdapter,
  playerId: PlayerID,
  action: LegalAction,
): PlayerActionPayload {
  switch (action.kind) {
    case 'move': {
      const core = engine.getCore();
      const viewer = toViewerPos(
        engine.state.board,
        core.bottomSidePlayerId,
        action.to,
        playerId,
      );
      return { action: 'move', to: [viewer.r, viewer.c] };
    }
    case 'use_card':
      return { action: 'use_card', cardInstance: action.cardInstance };
    case 'use_ritual':
      return { action: 'use_ritual', ritualId: action.ritualId };
    case 'end_turn':
    default:
      return { action: 'end_turn' };
  }
}

/**
 * 한 명의 활성 플레이어가 자기 턴을 끝까지 진행한다(end_turn 또는 게임오버까지).
 * 스텝 cap + try/catch 로 절대 hang/throw 하지 않는다.
 */
async function runOneAITurn(
  engine: GameEngineAdapter,
  playerId: PlayerID,
  getMeta: (cardId: string) => CardMeta | null,
  rand: () => number,
  profileId?: string,
): Promise<void> {
  const profile = getProfile(profileId);
  let steps = 0;
  while (
    engine.state.activePlayer === playerId &&
    engine.state.phase !== GamePhase.GAME_OVER &&
    steps++ < MAX_STEPS_PER_TURN
  ) {
    try {
      const core = engine.getCore();
      if (core.pendingInput) {
        // 양쪽 모두 AI 이므로 어떤 pendingInput 이든 기본값으로 답한다.
        await engine.handlePlayerInput(core.pendingInput.playerId, {
          answer: defaultAnswer(core.pendingInput),
        });
        continue;
      }

      const action = chooseAIAction(
        engine.state,
        playerId,
        getMeta,
        rand,
        profile,
      );
      if (action.kind === 'end_turn') {
        await engine.handlePlayerAction(playerId, { action: 'end_turn' });
        break;
      }
      await engine.handlePlayerAction(
        playerId,
        toActionPayload(engine, playerId, action),
      );
    } catch {
      try {
        await engine.handlePlayerAction(playerId, { action: 'end_turn' });
      } catch {
        // end_turn 마저 실패하면 루프를 빠져나가 안전망에 맡긴다.
      }
      break;
    }
  }

  // 안전망: 여전히 같은 AI 턴이면(게임오버 아님) 입력을 비우고 강제 종료.
  let drain = 0;
  while (
    engine.state.activePlayer === playerId &&
    engine.state.phase !== GamePhase.GAME_OVER &&
    drain++ < 5
  ) {
    const core = engine.getCore();
    if (core.pendingInput) {
      try {
        await engine.handlePlayerInput(core.pendingInput.playerId, {
          answer: defaultAnswer(core.pendingInput),
        });
      } catch {
        break;
      }
      continue;
    }
    try {
      await engine.handlePlayerAction(playerId, { action: 'end_turn' });
    } catch {
      break;
    }
  }
}

/**
 * 헤드리스 AI vs AI 게임 한 판을 끝까지 돌린다.
 *
 * seed 로 만든 결정적 rng 를 ctx.random 과 chooseAIAction 에 모두 주입해 재현 가능하다.
 */
export async function playOneGame(
  a: SelfPlayPlayer,
  b: SelfPlayPlayer,
  getMeta: (cardId: string) => CardMeta | null,
  seed: number,
): Promise<SelfPlayResult> {
  const rand = mulberry32(seed);

  const configs: PlayerDeckConfig[] = [
    { playerId: A, main: a.deck.main, cata: a.deck.cata },
    { playerId: B, main: b.deck.main, cata: b.deck.cata },
  ];

  const initialState = createInitialGameState(configs);
  const catalog = await ensureCardCatalog();
  const engine = GameEngineAdapter.create({
    roomCode: `selfplay_${seed}`,
    players: [A, B],
    initialState,
    ctx: {
      lookupCard: async (id: CardID) => catalog.get(id) ?? null,
      random: rand,
    },
  });

  await engine.markReady();
  // 양쪽 모두 멀리건은 교체 없이 keep all.
  await engine.handleAnswerMulligan(A, { replaceIndices: [] });
  await engine.handleAnswerMulligan(B, { replaceIndices: [] });

  let turns = 0;
  let lastActive: PlayerID | null = null;
  while (engine.state.phase !== GamePhase.GAME_OVER && turns < MAX_TURNS) {
    const active = engine.state.activePlayer;
    // 활성 플레이어가 바뀔 때마다 1턴으로 센다.
    if (active !== lastActive) {
      turns += 1;
      lastActive = active;
    }
    if (active === A) {
      await runOneAITurn(engine, A, getMeta, rand, a.profileId);
    } else if (active === B) {
      await runOneAITurn(engine, B, getMeta, rand, b.profileId);
    } else {
      break;
    }
  }

  let winner: 'A' | 'B' | 'draw';
  if (engine.state.phase === GamePhase.GAME_OVER) {
    const w = engine.state.winner;
    winner = w === A ? 'A' : w === B ? 'B' : 'draw';
  } else {
    // 턴 cap 초과 → 무승부 처리.
    winner = 'draw';
  }

  return { winner, turns };
}

/**
 * N 판을 돌려 승률 요약을 반환한다.
 * seedBase + i 로 매 판 다른(그러나 재현 가능한) seed 를 사용한다.
 */
export async function runSelfPlay(
  a: SelfPlayPlayer,
  b: SelfPlayPlayer,
  getMeta: (cardId: string) => CardMeta | null,
  games: number,
  seedBase: number,
): Promise<SelfPlaySummary> {
  let aWins = 0;
  let bWins = 0;
  let draws = 0;
  let totalTurns = 0;

  for (let i = 0; i < games; i += 1) {
    const result = await playOneGame(a, b, getMeta, seedBase + i);
    if (result.winner === 'A') aWins += 1;
    else if (result.winner === 'B') bWins += 1;
    else draws += 1;
    totalTurns += result.turns;
  }

  return {
    games,
    aWins,
    bWins,
    draws,
    avgTurns: games > 0 ? totalTurns / games : 0,
  };
}
