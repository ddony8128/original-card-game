import type { DiffPatch } from '../../../type/wsProtocol';
import type { GameEngineCore } from '../gameEngineCore';
import { GamePhase } from '../../../type/gameState';
import type {
  InstallEffect,
  CastExecuteEffect,
  ThrowResolveStackEffect,
} from '../../effects/effectTypes';
import { computeInstallPositions, toViewerPos } from '../boardUtils';
import { parseCardEffectJson } from '../../effects/schema';

export async function resolveCastExecute(
  engine: GameEngineCore,
  effect: CastExecuteEffect,
  diff: DiffPatch,
) {
  const cast = effect;
  diff.log.push(
    `플레이어 ${cast.owner}가 인스턴트 카드를 사용 (id=${cast.cardId})`,
  );
  // effect_json의 onCast 트리거 실행 (효과들을 EffectStack에 올린다)
  await engine.enqueueCardTriggerEffects(cast.cardId, 'onCast', cast.owner, diff, {
    sourceInstanceId: cast.sourceInstanceId,
  });
}

export async function resolveInstall(
  engine: GameEngineCore,
  effect: InstallEffect,
  diff: DiffPatch,
) {
  const inst = effect;
  const cardId = inst.object.cardId;

  const player = engine.state.players[inst.owner];

  // 1) pos 가 명시된 경우: 고정 위치 설치 (fix 모드)
  if (inst.pos) {
    const id = `ritual_${engine.ctx.now()}_${Math.floor(
      engine.ctx.random() * 100000,
    )}`;
    engine.state.board.rituals.push({
      id,
      cardId,
      owner: inst.owner,
      pos: inst.pos,
      usedThisTurn: false,
    });
    diff.animations.push({
      kind: 'ritual_place',
      player: inst.owner,
    });
    diff.log.push(
      `플레이어 ${inst.owner}가 (${inst.pos.r},${inst.pos.c}) 위치에 리추얼을 설치`,
    );

    // resolveStack 상에서 해당 카드의 최종 목적지를 board 로 설정
    if (player) {
      const entry = player.resolveStack
        .slice()
        .reverse()
        .find((en) => en.card.id === inst.object.id);
      if (entry) {
        entry.dest = 'board';
      }
    }

    // 리추얼 카드의 onTurnEnd / onTurnStart 트리거를 ObserverRegistry에 등록 (필요 시)
    const meta = await engine.ctx.lookupCard(cardId);
    if (meta && meta.effectJson) {
      const parsed = parseCardEffectJson(meta.effectJson);
      if (parsed) {
        parsed.triggers.forEach((t, index) => {
          if (t.trigger === 'onTurnEnd' || t.trigger === 'onTurnStart') {
            engine.observers.register({
              id: `${cardId}:${t.trigger}:${index}:${id}`,
              owner: inst.owner,
              cardId,
              ritualId: id,
              trigger: t.trigger as any,
              effectRef: t,
            });
          }
        });
      }
    }
    return;
  }

  // 2) range 가 없고 pos 도 없으면: 시전자 위치에 즉시 설치
  if (inst.range === undefined) {
    const wizard = engine.state.board.wizards[inst.owner];
    const pos = wizard ?? { r: 0, c: 0 };

    const id = `ritual_${engine.ctx.now()}_${Math.floor(
      engine.ctx.random() * 100000,
    )}`;
    engine.state.board.rituals.push({
      id,
      cardId,
      owner: inst.owner,
      pos,
      usedThisTurn: false,
    });
    diff.log.push(`카드 효과로 ritual ${cardId}가 설치되었습니다.`);
    diff.animations.push({
      kind: 'ritual_place',
      player: inst.owner,
    });

    // resolveStack 상에서 해당 카드의 최종 목적지를 board 로 설정
    if (player) {
      const entry = player.resolveStack
        .slice()
        .reverse()
        .find((en) => en.card.id === inst.object.id);
      if (entry) {
        entry.dest = 'board';
      }
    }

    // 리추얼 카드의 onTurnEnd / onTurnStart 트리거를 ObserverRegistry에 등록 (필요 시)
    const meta = await engine.ctx.lookupCard(cardId);
    if (meta && meta.effectJson) {
      const parsed = parseCardEffectJson(meta.effectJson);
      if (parsed) {
        parsed.triggers.forEach((t, index) => {
          if (t.trigger === 'onTurnEnd' || t.trigger === 'onTurnStart') {
            engine.observers.register({
              id: `${cardId}:${t.trigger}:${index}:${id}`,
              owner: inst.owner,
              cardId,
              ritualId: id,
              trigger: t.trigger as any,
              effectRef: t,
            });
          }
        });
      }
    }
    return;
  }

  // 3) range 가 있고 pos 가 없으면: 선택 설치 모드
  const requestKind = {
    type: 'map',
    kind: 'select_install_position',
  } as const;

  // 설치 가능한 위치 계산
  const absOptions = computeInstallPositions(
    engine.state.board,
    inst.owner,
    inst.range,
  );

  if (!absOptions || absOptions.length === 0) {
    diff.log.push('설치 가능한 위치가 없어 INSTALL 효과가 무효 처리되었습니다.');
    return;
  }

  const options = absOptions.map((pos: { r: number; c: number }) =>
    toViewerPos(engine.state.board, engine.bottomSidePlayerId, pos, inst.owner),
  );

  engine.pendingInput = {
    playerId: inst.owner,
    kind: requestKind,
    cardId,
    installRange: inst.range,
    // 이후 select_install_position 응답에서 동일 인스턴스를 INSTALL 하도록
    // 현재 INSTALL 이펙트의 object(카드 인스턴스)를 그대로 넘겨둔다.
    cardInstance: inst.object,
    options,
  };
  engine.state.phase = GamePhase.WAITING_FOR_PLAYER_INPUT;
  diff.log.push('리추얼을 설치할 위치를 선택하세요.');
}

export async function resolveThrowResolveStack(
  engine: GameEngineCore,
  effect: ThrowResolveStackEffect,
  diff: DiffPatch,
) {
  const e = effect;
  const owner = e.owner;
  const player = engine.state.players[owner];
  if (!player || player.resolveStack.length === 0) return;

  const entry = player.resolveStack.pop();
  if (!entry) return;

  const card = entry.card;
  let dest = entry.dest;

  // dest 가 명시되지 않은 경우, 카드 메타를 조회하여
  // 재앙(catatastrophe)이면 catastropheGrave, 아니면 일반 grave 로 보낸다.
  const meta = await engine.ctx.lookupCard(card.cardId);
  if (!dest) {
    if (meta && meta.type === 'catastrophe') {
      dest = 'cata_grave';
    } else {
      dest = 'grave';
    }
  }

  const cardName =
    (meta && (meta as any).name_ko) ||
    (meta && (meta as any).name_dev) ||
    card.cardId;
  const cardDesc =
    (meta && (meta as any).description_ko) ||
    (meta && (meta as any).description) ||
    '';

  switch (dest) {
    case 'grave':
      player.grave.push(card);
      diff.log.push(
        `카드 ${cardName}가 무덤으로 이동했습니다.${
          cardDesc ? ` (${cardDesc})` : ''
        }`,
      );
      break;
    case 'cata_grave':
      engine.state.catastropheGrave.push(card);
      diff.log.push(
        `재앙 카드 ${cardName}가 재앙 묘지로 이동했습니다.${
          cardDesc ? ` (${cardDesc})` : ''
        }`,
      );
      break;
    case 'hand':
      player.hand.push(card);
      diff.log.push(
        `카드 ${cardName}가 손패로 돌아갔습니다.${
          cardDesc ? ` (${cardDesc})` : ''
        }`,
      );
      break;
    case 'board':
      // 리추얼 설치 등: 실제 보드에는 RitualInstance 로 이미 표현되어 있으므로
      // resolveStack 에서만 제거하고 별도 이동은 하지 않는다.
      diff.log.push(
        `카드 ${cardName}의 최종 목적지가 보드(board)로 처리되었습니다.${
          cardDesc ? ` (${cardDesc})` : ''
        }`,
      );
      break;
    case 'burn':
      // 완전 소멸: 어떤 컬렉션에도 넣지 않고 제거
      diff.log.push(
        `카드 ${cardName}가 완전히 소멸(burn)되었습니다.${
          cardDesc ? ` (${cardDesc})` : ''
        }`,
      );
      break;
    default:
      break;
  }
}
