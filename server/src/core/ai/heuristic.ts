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
  hasAnyOffensiveOnCast,
  maxOffensiveRange,
  isUtilityCard,
  type Pos,
} from './cardEval';

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
 *  1. 치명타(lethal): 사거리 내 onCast 데미지로 상대를 끝낼 수 있으면 그 카드.
 *  2. 상대를 때리는 보유 ritual 사용(use_ritual).
 *  3. 사거리 내 데미지 카드(hitDamage 최대).
 *  4. 체력이 절반 미만이면 self heal 카드.
 *  5. 해로운 상대 ritual을 밟아 파괴(net 이득일 때만).
 *  6. 사거리 밖 데미지 카드를 들고 있으면, 안전하게 거리를 좁히는 이동.
 *  7. 유틸 카드(draw/heal/install/mana 등).
 *  8. 일반 전진(안전하게 거리를 좁히는 이동).
 *  9. end_turn.
 */
export function chooseAIAction(
  state: GameState,
  playerId: PlayerID,
  getMeta: (cardId: string) => CardMeta | null,
  rand: () => number,
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

  // ── 1. Lethal ──────────────────────────────────────────────────────────
  if (opp && oppWizard) {
    let bestDmg = -Infinity;
    let lethal: UseCardAction[] = [];
    for (const a of cardActions) {
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

  // ── 3. In-range damage card (max hitDamage, tie -> higher mana) ─────────
  if (oppWizard) {
    let bestDmg = 0;
    let bestMana = -Infinity;
    let best: UseCardAction[] = [];
    for (const a of cardActions) {
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
    for (const a of cardActions) {
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
  if (oppWizard && aiWizard) {
    const holdsOutOfRangeDamage = cardActions.some((a) => {
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
    for (const a of cardActions) {
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

  // ── 8. General advance ─────────────────────────────────────────────────
  if (oppWizard && aiWizard && ai && ai.mana >= MOVE_MANA_COST) {
    const best = bestDistReducingMoves(moveActions, oppWizard, dist, isSafeMove);
    if (best.length > 0) return pickRandom(best, rand);
  }

  // ── 9. End turn ────────────────────────────────────────────────────────
  return { kind: 'end_turn' };
}

/**
 * 거리를 strictly 줄이는 SAFE 이동 중, 가장 가까워지는 것들을 반환한다.
 */
function bestDistReducingMoves(
  moveActions: MoveAction[],
  oppWizard: Pos,
  currentDist: number,
  isSafeMove: (to: Pos) => boolean,
): MoveAction[] {
  let bestDist = currentDist;
  for (const a of moveActions) {
    if (!isSafeMove(a.to)) continue;
    const d = manhattan(a.to, oppWizard);
    if (d < bestDist) bestDist = d;
  }
  if (bestDist >= currentDist) return [];
  return moveActions.filter(
    (a) => isSafeMove(a.to) && manhattan(a.to, oppWizard) === bestDist,
  );
}
