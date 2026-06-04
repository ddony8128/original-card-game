import type { DiffPatch } from '../../../type/wsProtocol';
import type { GameEngineCore } from '../gameEngineCore';
import { GamePhase } from '../../../type/gameState';
import type { MoveEffect } from '../../effects/effectTypes';
import { toViewerPos, isInsideBoard } from '../boardUtils';

export async function resolveMove(
  engine: GameEngineCore,
  effect: MoveEffect,
  diff: DiffPatch,
) {
  const move = effect;
  const wizard = engine.state.board.wizards[effect.owner];
  if (!wizard) return;

  // value > 1 인 MOVE 이펙트는, 1칸짜리 MOVE 이펙트를 value 번으로 분할해서 스택에 올린다.
  // 이렇게 하면 draw / discard 등의 다중 처리와 동일하게,
  // "이동 → (입력 대기) → 이동 ..." 이 value 횟수만큼 순차 처리된다.
  if ((move.value ?? 1) > 1 && !move.to) {
    const count = move.value ?? 1;
    const direction = move.direction ?? 'forward';
    const effects: MoveEffect[] = [];
    for (let i = 0; i < count; i += 1) {
      effects.push({
        type: 'MOVE',
        owner: effect.owner,
        direction,
        value: 1,
      } as MoveEffect);
    }
    engine.effectStack.push(effects);
    return;
  }

  // 액션 기반 MOVE: to가 명시된 경우 절대 좌표로 이동
  if (move.to) {
    const from = [wizard.r, wizard.c] as [number, number];
    wizard.r = move.to.r;
    wizard.c = move.to.c;
    diff.animations.push({
      kind: 'move',
      player: effect.owner,
      from,
      to: [move.to.r, move.to.c],
    });
    diff.log.push(
      `{{p:${effect.owner}}}의 마법사가 (${from[0]},${from[1]}) → (${move.to.r},${move.to.c}) 이동`,
    );

    // 이동한 칸에 상대 리추얼이 있으면 파괴 트리거 처리
    {
      const { rituals } = engine.state.board;
      const stepped = rituals.find(
        (r) =>
          r.pos.r === wizard.r &&
          r.pos.c === wizard.c &&
          r.owner !== effect.owner,
      );
      if (stepped) {
        await engine.destroyRitual({
          owner: stepped.owner,
          ritualId: stepped.id,
          actor: effect.owner,
          invertSelfEnemy: true,
          diff,
        });
      }
    }
    return;
  }

  // 카드 효과 기반 MOVE: direction/value를 사용 (choose / forward)
  const dir = move.direction ?? 'forward';
  if (dir === 'choose') {
    const { board } = engine.state;
    const { r, c } = wizard;
    const candidates: { r: number; c: number }[] = [
      { r: r - 1, c }, // up
      { r: r + 1, c }, // down
      { r, c: c - 1 }, // left
      { r, c: c + 1 }, // right
    ];

    // 보드 안이면서, 어떤 마법사도 없는 칸만 허용
    const occupied = new Set(
      Object.values(board.wizards).map((pos) => `${pos.r},${pos.c}`),
    );
    const optionsAbs = candidates.filter(
      (p) => isInsideBoard(board, p.r, p.c) && !occupied.has(`${p.r},${p.c}`),
    );

    if (optionsAbs.length === 0) {
      diff.log.push(
        '이동 가능한 칸이 없어 MOVE(choose) 효과가 무효 처리되었습니다.',
      );
      return;
    }

    const requestKind = {
      type: 'map',
      kind: 'choose_move_direction',
    } as const;

    const options = optionsAbs.map((pos) =>
      toViewerPos(board, engine.bottomSidePlayerId, pos, effect.owner),
    );

    (engine as any).pendingInput = {
      playerId: effect.owner,
      kind: requestKind,
      options,
    };
    (engine as any).state.phase = GamePhase.WAITING_FOR_PLAYER_INPUT;
    diff.log.push('이동할 방향을 선택하세요.');
    return;
  }

  if (dir === 'forward') {
    const isBottomSide = (engine as any).isBottomSide
      ? (engine as any).isBottomSide(effect.owner)
      : true;
    const delta = isBottomSide ? -1 : 1;
    const toR = wizard.r + delta;
    const toC = wizard.c;
    if (
      toR < 0 ||
      toR >= engine.state.board.height ||
      toC < 0 ||
      toC >= engine.state.board.width
    ) {
      return;
    }

    const from: [number, number] = [wizard.r, wizard.c];
    wizard.r = toR;
    wizard.c = toC;
    diff.log.push(`카드 효과로 {{p:${effect.owner}}}의 마법사가 이동했습니다.`);
    diff.animations.push({
      kind: 'move',
      player: effect.owner,
      from,
      to: [toR, toC],
    });

    // 이동한 칸에 상대 리추얼이 있으면 파괴 트리거 처리
    {
      const { rituals } = engine.state.board;
      const stepped = rituals.find(
        (r) =>
          r.pos.r === wizard.r &&
          r.pos.c === wizard.c &&
          r.owner !== effect.owner,
      );
      if (stepped) {
        await engine.destroyRitual({
          owner: stepped.owner,
          ritualId: stepped.id,
          actor: effect.owner,
          invertSelfEnemy: true,
          diff,
        });
      }
    }
    return;
  }

  diff.log.push('지원되지 않는 move direction 입니다.');
}
