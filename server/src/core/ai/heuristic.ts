import type { GameState, PlayerID } from '../../type/gameState';
import type { CardMeta } from '../context';
import { MOVE_MANA_COST } from '../rules/constants';
import { legalActions, type LegalAction } from './legalActions';
import {
  manhattan,
  onCastHitDamage,
  onCastSelfHeal,
  evalStepOnRitual,
  ongoingHarm,
  ritualUseValue,
  ritualUseEnemyDamage,
  hasAnyOffensiveOnCast,
  maxOffensiveRange,
  isUtilityCard,
  isRitualInstallCard,
  type Pos,
} from './cardEval';
import { getProfile, type AIProfile } from './profiles';

type UseCardAction = Extract<LegalAction, { kind: 'use_card' }>;
type MoveAction = Extract<LegalAction, { kind: 'move' }>;
type UseRitualAction = Extract<LegalAction, { kind: 'use_ritual' }>;

/** 동점 후보 중 rand 로 하나를 고른다. */
function pickRandom<T>(items: T[], rand: () => number): T {
  if (items.length === 1) return items[0];
  const idx = Math.floor(rand() * items.length);
  return items[Math.min(idx, items.length - 1)];
}

/**
 * 게임 규칙을 인지하고 카드별 데이터를 평가하는 AI 휴리스틱.
 *
 * 우선순위 사다리(첫 번째로 적용 가능한 행동을 반환):
 *  0. 킬각(kill-angle): 이번 턴 도달 가능한 총 데미지 >= opp.hp 이면 버스트 카드부터 commit.
 *     (단일 카드 lethal 은 이 킬각의 부분집합이다.)
 *  P. (프로필) spamPriority: 킬각이 아니면 교란/엔진 카드를 최우선 사용.
 *  1. 치명타(lethal): 사거리 내 onCast 데미지로 상대를 끝낼 수 있으면 그 카드.
 *  2. 상대를 때리는 보유 ritual 사용(use_ritual).
 *  R. (프로필) prioritizeRituals: ritual 설치/사용을 데미지보다 먼저 셋업.
 *  3. 사거리 내 데미지 카드(hitDamage 최대). (aggressionManaThreshold 미만이면 보류)
 *  4. 체력이 절반 미만이면 self heal 카드.
 *  5. 해로운 상대 ritual을 밟아 파괴(net 이득일 때만).
 *  6. 사거리 밖 데미지 카드를 들고 있으면, 안전하게 거리를 좁히는 이동.
 *  7. 유틸 카드(draw/heal/install/mana 등).
 *  C. (프로필) cycleCards: 덱 사이클용 힐/드로우 카드.
 *  D. (프로필) preferredDistance: idle 일 때 선호 거리 유지(접근 대신 후퇴/대기).
 *  8. 일반 전진(안전하게 거리를 좁히는 이동).
 *  9. end_turn.
 *
 * 프로필(profile)은 위 사다리에 얇게 얹히는 파라미터 묶음이다. default 프로필은
 * 모든 override 가 비어 있어 기존 동작과 100% 동일하다.
 */
export function chooseAIAction(
  state: GameState,
  playerId: PlayerID,
  getMeta: (cardId: string) => CardMeta | null,
  rand: () => number,
  profile: AIProfile = getProfile(),
): LegalAction {
  const actions = legalActions(state, playerId, getMeta);

  const ai = state.players[playerId];
  const aiWizard = state.board.wizards[playerId];
  const oppEntry = Object.entries(state.board.wizards).find(
    ([pid]) => pid !== playerId,
  );
  const oppId = oppEntry?.[0];
  const oppWizard = oppEntry?.[1];
  const opp = oppId ? state.players[oppId] : undefined;

  const cardActions = actions.filter(
    (a): a is UseCardAction => a.kind === 'use_card',
  );
  const moveActions = actions.filter(
    (a): a is MoveAction => a.kind === 'move',
  );
  const ritualActions = actions.filter(
    (a): a is UseRitualAction => a.kind === 'use_ritual',
  );

  // AI 자신이 보드에 설치한 ritual 개수 (count(rituals_installed) 평가용).
  const ownRitualCount = state.board.rituals.filter(
    (r) => r.owner === playerId,
  ).length;

  const dist =
    aiWizard && oppWizard ? manhattan(aiWizard, oppWizard) : Infinity;

  const mana = (cardId: string) => getMeta(cardId)?.mana ?? 0;

  // ── 0. Kill-angle detection ────────────────────────────────────────────
  // 이번 턴에 실제로 도달 가능한 총 데미지를 추정한다:
  //   sum(현재 사거리에서 명중하는 affordable 카드들의 onCast 데미지)
  //   + sum(보유한 ready ritual 들의 onUsePerTurn enemy 데미지)
  // 이 합이 opp.hp 이상이면 "킬각" → 버스트를 commit 한다.
  // (단일 카드 lethal 은 이 킬각의 부분집합이다.)
  const killAngle = ((): boolean => {
    if (!opp || !oppWizard) return false;
    let total = 0;
    for (const a of cardActions) {
      total += onCastHitDamage(getMeta(a.cardInstance.cardId), dist, ownRitualCount);
    }
    for (const a of ritualActions) {
      const ritual = state.board.rituals.find((r) => r.id === a.ritualId);
      if (!ritual) continue;
      total += ritualUseEnemyDamage(getMeta(ritual.cardId), ownRitualCount);
    }
    return total > 0 && total >= opp.hp;
  })();

  // 킬각이 아니면, 프로필이 "킬각 전용"으로 묶어둔 카드는 후보에서 제외한다.
  const holdSet = new Set(profile.holdUntilKill ?? []);
  const playableCardActions =
    killAngle || holdSet.size === 0
      ? cardActions
      : cardActions.filter((a) => !holdSet.has(a.cardInstance.cardId));

  // maxMana 가 임계 미만이면(=아직 충분히 성장하지 않았으면) 버스트(in-range
  // 데미지 카드)를 commit 하지 않고 셋업/거리유지를 선호한다. 킬각이면 무시한다.
  const belowAggressionThreshold =
    !killAngle &&
    profile.aggressionManaThreshold !== undefined &&
    ai !== undefined &&
    ai.maxMana < profile.aggressionManaThreshold;

  // ── P. (profile) spamPriority: 킬각이 아니면 교란/엔진 카드 최우선 ────────
  if (!killAngle && profile.spamPriority && profile.spamPriority.length > 0) {
    const prioSet = new Set(profile.spamPriority);
    const best = playableCardActions.filter((a) =>
      prioSet.has(a.cardInstance.cardId),
    );
    if (best.length > 0) return pickRandom(best, rand);
  }

  // ── 1. Lethal ──────────────────────────────────────────────────────────
  if (opp && oppWizard) {
    let bestDmg = -Infinity;
    let lethal: UseCardAction[] = [];
    for (const a of playableCardActions) {
      const meta = getMeta(a.cardInstance.cardId);
      const dmg = onCastHitDamage(meta, dist, ownRitualCount);
      if (dmg >= opp.hp && dmg > 0) {
        if (dmg > bestDmg) {
          bestDmg = dmg;
          lethal = [a];
        } else if (dmg === bestDmg) {
          lethal.push(a);
        }
      }
    }
    if (lethal.length > 0) return pickRandom(lethal, rand);
  }

  // ── 2. Use own ready ritual that damages the enemy ─────────────────────
  {
    let bestValue = 0;
    let best: UseRitualAction[] = [];
    for (const a of ritualActions) {
      const ritual = state.board.rituals.find((r) => r.id === a.ritualId);
      if (!ritual) continue;
      const meta = getMeta(ritual.cardId);
      // 데미지뿐 아니라 회복/드로우 등 유익한 ritual 이면 사용한다.
      const value = ritualUseValue(meta, ownRitualCount);
      if (value > 0) {
        if (value > bestValue) {
          bestValue = value;
          best = [a];
        } else if (value === bestValue) {
          best.push(a);
        }
      }
    }
    if (best.length > 0) return pickRandom(best, rand);
  }

  // ── R. (profile) prioritizeRituals: ritual 설치를 데미지보다 먼저 셋업 ────
  // 킬각이 아닐 때, ritual 카드(설치)를 데미지 카드보다 먼저 깔아 엔진을 구축한다.
  if (!killAngle && profile.prioritizeRituals) {
    let bestMana = -Infinity;
    let best: UseCardAction[] = [];
    for (const a of playableCardActions) {
      if (!isRitualInstallCard(getMeta(a.cardInstance.cardId))) continue;
      const m = mana(a.cardInstance.cardId);
      if (m > bestMana) {
        bestMana = m;
        best = [a];
      } else if (m === bestMana) {
        best.push(a);
      }
    }
    if (best.length > 0) return pickRandom(best, rand);
  }

  // ── 3. In-range damage card (max hitDamage, tie -> higher mana) ─────────
  // belowAggressionThreshold 이면(아직 마나가 임계 미만) 버스트를 commit 하지
  // 않고 셋업/거리유지로 넘어간다.
  if (oppWizard && !belowAggressionThreshold) {
    let bestDmg = 0;
    let bestMana = -Infinity;
    let best: UseCardAction[] = [];
    for (const a of playableCardActions) {
      const meta = getMeta(a.cardInstance.cardId);
      const dmg = onCastHitDamage(meta, dist, ownRitualCount);
      if (dmg <= 0) continue;
      const m = mana(a.cardInstance.cardId);
      if (
        dmg > bestDmg ||
        (dmg === bestDmg && m > bestMana)
      ) {
        bestDmg = dmg;
        bestMana = m;
        best = [a];
      } else if (dmg === bestDmg && m === bestMana) {
        best.push(a);
      }
    }
    if (best.length > 0) return pickRandom(best, rand);
  }

  // ── 4. Heal when hurt ──────────────────────────────────────────────────
  if (ai && ai.hp < ai.maxHp / 2) {
    let bestHeal = 0;
    let best: UseCardAction[] = [];
    for (const a of playableCardActions) {
      const heal = onCastSelfHeal(getMeta(a.cardInstance.cardId));
      if (heal > 0) {
        if (heal > bestHeal) {
          bestHeal = heal;
          best = [a];
        } else if (heal === bestHeal) {
          best.push(a);
        }
      }
    }
    if (best.length > 0) return pickRandom(best, rand);
  }

  // Rituals owned by the opponent, keyed by cell (for step-on evaluation).
  const oppRitualAt = (r: number, c: number) =>
    state.board.rituals.find(
      (rt) => rt.owner !== playerId && rt.pos.r === r && rt.pos.c === c,
    );

  /**
   * 한 칸으로 이동했을 때 상대 ritual을 밟는 경우의 손익을 계산한다.
   * net = 상대가 입는 즉시 피해 + 제거로 막는 지속 피해 - AI가 입는 피해.
   */
  const evalMoveOntoRitual = (to: Pos) => {
    const ritual = oppRitualAt(to.r, to.c);
    if (!ritual) return null;
    const meta = getMeta(ritual.cardId);
    const { aiDamage, oppDamage } = evalStepOnRitual(meta, ownRitualCount);
    const harm = ongoingHarm(meta, ownRitualCount);
    return { aiDamage, oppDamage, harm };
  };

  // ── 5. Destroy a harmful opponent ritual ───────────────────────────────
  {
    let bestNet = -Infinity;
    let best: MoveAction[] = [];
    for (const a of moveActions) {
      const ev = evalMoveOntoRitual(a.to);
      if (!ev) continue;
      const notTrap = ev.oppDamage + ev.harm >= ev.aiDamage;
      const worthwhile = ev.harm > 0 || ev.oppDamage > 0;
      if (!notTrap || !worthwhile) continue;
      const net = ev.oppDamage + ev.harm - ev.aiDamage;
      if (net > bestNet) {
        bestNet = net;
        best = [a];
      } else if (net === bestNet) {
        best.push(a);
      }
    }
    if (best.length > 0) return pickRandom(best, rand);
  }

  // A move is SAFE if it does NOT step onto a net-trap opponent ritual
  // (aiDamage > oppDamage + ongoingHarm).
  const isSafeMove = (to: Pos): boolean => {
    const ev = evalMoveOntoRitual(to);
    if (!ev) return true;
    return ev.aiDamage <= ev.oppDamage + ev.harm;
  };

  // ── 6. Close into range for an out-of-range damage card ─────────────────
  // belowAggressionThreshold 이면 아직 거리를 좁히지 않고(셋업/유지) 넘어간다.
  if (oppWizard && aiWizard && !belowAggressionThreshold) {
    const holdsOutOfRangeDamage = playableCardActions.some((a) => {
      const meta = getMeta(a.cardInstance.cardId);
      if (!hasAnyOffensiveOnCast(meta)) return false;
      // 이미 사거리 안이면(=이번 거리에서 명중) 6번이 아니라 3번에서 처리됨.
      if (onCastHitDamage(meta, dist, ownRitualCount) > 0) return false;
      return maxOffensiveRange(meta) > 0;
    });
    if (holdsOutOfRangeDamage) {
      const best = bestDistReducingMoves(
        moveActions,
        oppWizard,
        dist,
        isSafeMove,
      );
      if (best.length > 0) return pickRandom(best, rand);
    }
  }

  // ── 7. Utility card ────────────────────────────────────────────────────
  {
    let bestMana = -Infinity;
    let best: UseCardAction[] = [];
    for (const a of playableCardActions) {
      if (!isUtilityCard(getMeta(a.cardInstance.cardId))) continue;
      const m = mana(a.cardInstance.cardId);
      if (m > bestMana) {
        bestMana = m;
        best = [a];
      } else if (m === bestMana) {
        best.push(a);
      }
    }
    if (best.length > 0) return pickRandom(best, rand);
  }

  // ── C. (profile) cycleCards: 덱 사이클용 힐/드로우 카드 ───────────────────
  // 위에서 처리되지 않은(예: belowAggressionThreshold 라 데미지를 미룬) 상황에서,
  // 프로필이 지정한 사이클 카드가 손에 있으면 그것을 깐다(덱 압축/힐/드로우).
  if (profile.cycleCards && profile.cycleCards.length > 0) {
    const cycleSet = new Set(profile.cycleCards);
    const best = playableCardActions.filter((a) =>
      cycleSet.has(a.cardInstance.cardId),
    );
    if (best.length > 0) return pickRandom(best, rand);
  }

  // ── D. (profile) preferredDistance: idle 일 때 선호 거리 유지 ─────────────
  // 마땅한 공격/설치/사이클이 없으면, 선호 거리보다 가까우면 후퇴하고(거리 벌리기),
  // 멀면 일반 전진(8)에 맡긴다. 너무 가까이 붙지 않도록 거리를 관리한다.
  if (
    profile.preferredDistance !== undefined &&
    oppWizard &&
    aiWizard &&
    ai &&
    ai.mana >= MOVE_MANA_COST &&
    dist < profile.preferredDistance
  ) {
    const best = bestDistIncreasingMoves(
      moveActions,
      oppWizard,
      dist,
      isSafeMove,
    );
    if (best.length > 0) return pickRandom(best, rand);
  }

  // ── 8. General advance ─────────────────────────────────────────────────
  // preferredDistance 가 설정된 프로필은 그 거리 이상에서는 굳이 더 접근하지 않는다.
  if (oppWizard && aiWizard && ai && ai.mana >= MOVE_MANA_COST) {
    const floor = profile.preferredDistance;
    if (floor === undefined || dist > floor) {
      const best = bestDistReducingMoves(
        moveActions,
        oppWizard,
        dist,
        isSafeMove,
        floor,
      );
      if (best.length > 0) return pickRandom(best, rand);
    }
  }

  // ── 9. End turn ────────────────────────────────────────────────────────
  return { kind: 'end_turn' };
}

/**
 * 거리를 strictly 줄이는 SAFE 이동 중, 가장 가까워지는 것들을 반환한다.
 * floor 가 주어지면 그 거리 미만으로는 좁히지 않는다(선호 거리 하한).
 */
function bestDistReducingMoves(
  moveActions: MoveAction[],
  oppWizard: Pos,
  currentDist: number,
  isSafeMove: (to: Pos) => boolean,
  floor?: number,
): MoveAction[] {
  let bestDist = currentDist;
  for (const a of moveActions) {
    if (!isSafeMove(a.to)) continue;
    const d = manhattan(a.to, oppWizard);
    if (floor !== undefined && d < floor) continue;
    if (d < bestDist) bestDist = d;
  }
  if (bestDist >= currentDist) return [];
  return moveActions.filter(
    (a) => isSafeMove(a.to) && manhattan(a.to, oppWizard) === bestDist,
  );
}

/**
 * 거리를 strictly 늘리는 SAFE 이동 중, 가장 멀어지는 것들을 반환한다.
 * (선호 거리보다 가까울 때 후퇴용.)
 */
function bestDistIncreasingMoves(
  moveActions: MoveAction[],
  oppWizard: Pos,
  currentDist: number,
  isSafeMove: (to: Pos) => boolean,
): MoveAction[] {
  let bestDist = currentDist;
  for (const a of moveActions) {
    if (!isSafeMove(a.to)) continue;
    const d = manhattan(a.to, oppWizard);
    if (d > bestDist) bestDist = d;
  }
  if (bestDist <= currentDist) return [];
  return moveActions.filter(
    (a) => isSafeMove(a.to) && manhattan(a.to, oppWizard) === bestDist,
  );
}
