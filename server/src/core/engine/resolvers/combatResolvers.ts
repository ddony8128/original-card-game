import type { DiffPatch } from '../../../type/wsProtocol';
import type { GameEngineCore } from '../gameEngineCore';
import { GamePhase, type PlayerID } from '../../../type/gameState';
import type { DamageEffect, HealEffect } from '../../effects/effectTypes';
import { toViewerPos } from '../boardUtils';
import { checkDamageCondition, checkHealCondition } from '../../effects/conditions';

export async function resolveDamage(
  engine: GameEngineCore,
  effect: DamageEffect,
  diff: DiffPatch,
) {
  const e = effect;
  const { owner } = e;
  const { players, board } = engine.state;

  // 고정 위치 데미지 (select_damage_target 이후)
  if (e.pos) {
    const targetEntry = Object.entries(board.wizards).find(
      ([, pos]) => pos.r === e.pos!.r && pos.c === e.pos!.c,
    );
    if (!targetEntry) return;
    const targetId = targetEntry[0] as PlayerID;
    const target = players[targetId];
    if (!target) return;

    // condition 공통 처리
    if (!checkDamageCondition(engine, e)) return;

    // value가 특수 문자열인 경우 해석
    let amount: number | string = e.value;
    if (typeof amount === 'string') {
      if (amount === 'count(rituals_installed)') {
        amount = board.rituals.filter((r) => r.owner === owner).length;
      } else {
        amount = 0;
      }
    }

    target.hp -= amount as number;
    diff.log.push(
      `{{p:${targetId}}}의 마법사가 (${e.pos.r},${e.pos.c}) 위치에서 ${amount} 피해를 입었습니다.`,
    );
    diff.animations.push({
      kind: 'damage',
      player: targetId,
      amount,
    } as any);
    return;
  }

  let targetId: PlayerID | null = null;
  if (e.target === 'self') {
    targetId = owner;
  } else {
    const enemyId = Object.keys(players).find((id) => id !== owner);
    if (!enemyId) return;
    targetId = enemyId;
  }
  const target = players[targetId];
  if (!target) return;

  // condition 공통 처리
  if (!checkDamageCondition(engine, e)) return;

  // 선택형 damage: 대상 위치 선택 (select_damage_target)
  if (e.selectMode === 'choose_target' && typeof e.range === 'number') {
    // 자동 대상 확정은 하지 않고, "선택 가능한 위치"만 계산한다.
    // 현재는 enemy 마법사 한 명만 존재하므로,
    // range 이내에 enemy 마법사가 있으면 그 위치 하나만 후보로 제공한다.
    const positions: { r: number; c: number }[] = [];
    const casterPos = board.wizards[owner];
    const enemyEntry = Object.entries(board.wizards).find(
      ([pid]) => pid !== owner,
    );
    if (casterPos && enemyEntry) {
      const enemyPos = enemyEntry[1];
      const dist =
        Math.abs(casterPos.r - enemyPos.r) + Math.abs(casterPos.c - enemyPos.c);
      if (dist <= e.range) {
        positions.push({ r: enemyPos.r, c: enemyPos.c });
      }
    }

    if (!positions || positions.length === 0) {
      diff.log.push(
        '피해를 줄 수 있는 대상이 없어 DAMAGE 효과가 무효 처리되었습니다.',
      );
      return;
    }

    const requestKind = {
      type: 'map',
      kind: 'select_damage_target',
    } as const;

    const options = positions.map((pos) =>
      toViewerPos(board, engine.bottomSidePlayerId, pos, owner),
    );

    (engine as any).pendingInput = {
      playerId: owner,
      kind: requestKind,
      options,
      damageValue: e.value,
    };
    (engine as any).state.phase = GamePhase.WAITING_FOR_PLAYER_INPUT;
    diff.log.push('피해를 줄 대상을 선택하세요.');
    return;
  }

  // near_enemy + range 체크
  if (e.target === 'near_enemy' && typeof e.range === 'number') {
    const mePos = board.wizards[owner];
    const enemyPos = board.wizards[targetId];
    if (!mePos || !enemyPos) return;
    const dist =
      Math.abs(mePos.r - enemyPos.r) + Math.abs(mePos.c - enemyPos.c);
    if (dist > e.range) return;
  }

  // value가 특수 문자열인 경우 해석 (예: count(rituals_installed))
  let amount: number | string = e.value;
  if (typeof amount === 'string') {
    if (amount === 'count(rituals_installed)') {
      amount = board.rituals.filter((r) => r.owner === owner).length;
    } else {
      amount = 0;
    }
  }

  target.hp -= amount as number;
  diff.log.push(`{{p:${targetId}}}의 마법사가 ${amount} 피해를 입었습니다.`);
  diff.animations.push({
    kind: 'damage',
    player: targetId,
    amount,
  } as any);
}

export async function resolveHeal(
  engine: GameEngineCore,
  effect: HealEffect,
  diff: DiffPatch,
) {
  const e = effect;
  const { owner } = e;
  const { players } = engine.state;

  const targetId =
    e.target === 'self'
      ? owner
      : Object.keys(players).find((id) => id !== owner);
  if (!targetId) return;
  const player = players[targetId];
  if (!player) return;

  // condition 공통 처리
  if (!checkHealCondition(engine, e, player.hp)) return;

  const before = player.hp;
  player.hp = Math.min(player.hp + e.value, player.maxHp);
  const healed = player.hp - before;
  if (healed > 0) {
    diff.log.push(`{{p:${targetId}}}의 마법사가 ${healed} 만큼 회복했습니다.`);
    diff.animations.push({
      kind: 'heal',
      player: targetId,
      amount: healed,
    } as any);
  }
}
