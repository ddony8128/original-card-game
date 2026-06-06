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
  diff.log.push({
    code: 'cast',
    params: { p: cast.owner, c: cast.cardId },
  });
  // 카드 사용을 사람이 따라갈 수 있게, 사용된 카드 정보를 애니메이션으로 알린다.
  diff.animations.push({
    kind: 'card_play',
    cardId: cast.cardId,
    owner: cast.owner,
  });
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
    diff.log.push({
      code: 'install_at',
      params: { p: inst.owner, c: cardId, r: inst.pos.r, cc: inst.pos.c },
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
    diff.log.push({ code: 'install_effect', params: { c: cardId } });
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
    diff.log.push({ code: 'install_no_space' });
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
  diff.log.push({ code: 'install_choose_position' });
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

  // 카드명/설명은 클라이언트가 현재 언어로 렌더한다(params 에는 cardId 만 담는다).
  // 설명 suffix(` (설명)`)도 클라이언트 헬퍼가 card meta 에서 붙인다.
  switch (dest) {
    case 'grave':
      player.grave.push(card);
      diff.log.push({ code: 'card_to_grave', params: { c: card.cardId } });
      break;
    case 'cata_grave':
      engine.state.catastropheGrave.push(card);
      diff.log.push({ code: 'cata_card_to_grave', params: { c: card.cardId } });
      break;
    case 'hand':
      player.hand.push(card);
      diff.log.push({ code: 'card_to_hand', params: { c: card.cardId } });
      break;
    case 'board':
      // 리추얼 설치 등: 실제 보드에는 RitualInstance 로 이미 표현되어 있으므로
      // resolveStack 에서만 제거하고 별도 이동은 하지 않는다.
      diff.log.push({ code: 'card_to_board', params: { c: card.cardId } });
      break;
    case 'burn':
      // 완전 소멸: 어떤 컬렉션에도 넣지 않고 제거
      diff.log.push({ code: 'card_burned_full', params: { c: card.cardId } });
      break;
    default:
      break;
  }
}
