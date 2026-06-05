import { describe, it, vi, beforeAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

/**
 * 밸런스 재시뮬용 수동 스펙.
 *
 * 평소 `npm test` 에서는 skip 되고, 명시적으로 BAL_SIM 환경변수를 켤 때만 돈다.
 *   실행: BAL_SIM=1 npx vitest run src/core/test/balanceSim.manual.test.ts
 *   (Windows PowerShell: $env:BAL_SIM=1; npx vitest run src/core/test/balanceSim.manual.test.ts)
 *
 * 장시간(매치업 × 판수) 시뮬이 일반 CI 를 느리게 하면 안 되므로 게이트를 둔다.
 *
 * mock 패턴은 selfPlay.test.ts 와 동일: Supabase 대신 레포의 cards.json 을 listAll 로 돌려준다.
 */

const CARDS_JSON_PATH = path.join(__dirname, '../../../resources/cards.json');
const realCards = JSON.parse(fs.readFileSync(CARDS_JSON_PATH, 'utf-8'));

vi.mock('../../services/cards', () => {
  return {
    cardsService: {
      listAll: vi.fn(async () => realCards),
      getByIds: vi.fn(async () => []),
      getById: vi.fn(async () => null),
    },
  };
});

import {
  playOneGame,
  type SelfPlayPlayer,
} from '../ai/selfPlay';
import { ensureCardCatalog, getCardMeta } from '../resources/cardCatalog';
import { getPveStages } from '../resources/pveStages';
import { getDefaultDeck } from '../resources/defaultDeck';

const RUN = !!process.env.BAL_SIM;
// 판수: BAL_GAMES 로 조정 가능(기본 100). 너무 느리면 50 으로.
const GAMES = Number(process.env.BAL_GAMES ?? 100);
const SEED_BASE = 9000;

interface MatchResult {
  label: string;
  /** A(스테이지 측) 승 / B 승 / 무 */
  aWins: number;
  bWins: number;
  draws: number;
  aWinPct: number;
  drawPct: number;
  avgTurns: number;
}

async function runMatch(
  label: string,
  a: SelfPlayPlayer,
  b: SelfPlayPlayer,
): Promise<MatchResult> {
  let aWins = 0;
  let bWins = 0;
  let draws = 0;
  let totalTurns = 0;
  for (let g = 0; g < GAMES; g += 1) {
    const result = await playOneGame(a, b, getCardMeta, SEED_BASE + g);
    if (result.winner === 'A') aWins += 1;
    else if (result.winner === 'B') bWins += 1;
    else draws += 1;
    totalTurns += result.turns;
  }
  return {
    label,
    aWins,
    bWins,
    draws,
    aWinPct: (aWins / GAMES) * 100,
    drawPct: (draws / GAMES) * 100,
    avgTurns: totalTurns / GAMES,
  };
}

function printTable(title: string, rows: MatchResult[]): void {
  // eslint-disable-next-line no-console
  console.log(`\n================ ${title} (각 ${GAMES}판, seed ${SEED_BASE}~) ================`);
  // eslint-disable-next-line no-console
  console.log(
    'matchup'.padEnd(46) +
      'A승%'.padStart(8) +
      '무%'.padStart(8) +
      '평균턴'.padStart(9) +
      '   (A승:B승:무)',
  );
  for (const r of rows) {
    // eslint-disable-next-line no-console
    console.log(
      r.label.padEnd(46) +
        r.aWinPct.toFixed(0).padStart(7) +
        '%' +
        r.drawPct.toFixed(0).padStart(7) +
        '%' +
        r.avgTurns.toFixed(1).padStart(9) +
        `   (${r.aWins}:${r.bWins}:${r.draws})`,
    );
  }
}

(RUN ? describe : describe.skip)('balance sim', () => {
  beforeAll(async () => {
    await ensureCardCatalog();
  });

  it(
    'measures stage-vs-default and stage-vs-stage win rates',
    async () => {
      const stages = getPveStages();
      const dd = getDefaultDeck();
      const baseline: SelfPlayPlayer = {
        deck: { main: dd.main, cata: dd.cata },
        profileId: 'default',
      };

      // 스테이지를 SelfPlayPlayer 로. 하드 스테이지(aiHp 지정)는 그대로 aiHp 전달.
      const stagePlayer = (s: ReturnType<typeof getPveStages>[number]): SelfPlayPlayer => ({
        deck: { main: s.deck.main, cata: s.deck.cata },
        profileId: s.profileId,
        // stage.aiHp 가 있으면(하드 4/5/6) 보스 HP 30 반영. 1/2/3 은 undefined → 기본 HP.
        aiHp: s.aiHp,
      });

      // (1) 각 스테이지 vs 기본덱. A=스테이지(측), B=기본덱.
      const vsDefault: MatchResult[] = [];
      for (const s of stages) {
        const a = stagePlayer(s);
        const hpNote = a.aiHp !== undefined ? ` aiHp=${a.aiHp}` : '';
        const label = `${s.id} ${s.name}(${s.profileId}${hpNote})  vs 기본덱`;
        vsDefault.push(await runMatch(label, a, baseline));
      }
      printTable('스테이지 vs 기본덱', vsDefault);

      // (2) 스테이지끼리: 1v2, 1v3, 2v3 (기본 난이도 묶음만; 하드는 동일 덱이라 생략).
      const byId = new Map(stages.map((s) => [s.id, s]));
      const pairs: Array<[string, string]> = [
        ['stage-1', 'stage-2'],
        ['stage-1', 'stage-3'],
        ['stage-2', 'stage-3'],
      ];
      const vsStage: MatchResult[] = [];
      for (const [ai, bi] of pairs) {
        const sa = byId.get(ai)!;
        const sb = byId.get(bi)!;
        const a = stagePlayer(sa);
        const b = stagePlayer(sb);
        const label = `${sa.id} ${sa.name}  vs  ${sb.id} ${sb.name}`;
        vsStage.push(await runMatch(label, a, b));
      }
      printTable('스테이지끼리 (A=앞)', vsStage);
    },
    600000,
  );
});
