import type { DiffPatch } from '../../../type/wsProtocol';
import type { CardInstance } from '../../../type/gameState';
import type { GameEngineCore } from '../gameEngineCore';
import { GamePhase } from '../../../type/gameState';
import type {
  DrawEffect,
  DrawCataEffect,
  ThrowResolveStackEffect,
  DiscardEffect,
  BurnEffect,
} from '../../effects/effectTypes';
import { shuffle } from '../boardUtils';
import {
  checkDiscardCondition,
  checkBurnCondition,
  checkDrawCataCondition,
} from '../../effects/conditions';

export async function resolveDraw(
  engine: GameEngineCore,
  effect: DrawEffect,
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
  const target = players[targetId];
  if (!target) return;

  const drawCount = e.value ?? 1;

  // value > 1 인 경우, 1장짜리 DRAW 이펙트를 여러 개로 분할하여 스택에 올린다.
  if (drawCount > 1) {
    const effects: DrawEffect[] = [];
    for (let i = 0; i < drawCount; i += 1) {
      effects.push({
        type: 'DRAW',
        owner,
        value: 1,
        target: e.target,
      });
    }
    engine.effectStack.push(effects);
    return;
  }

  // value === 1 인 경우에만 실제 드로우 수행
  let card: CardInstance | null = null;

  // 1) 일반 덱에서 우선 드로우
  if (target.deck.length > 0) {
    card = target.deck.shift()!;
    target.hand.push(card);
  } else {
    // 2) 덱이 비어 있으면, 묘지에서 덱 복원
    if (target.grave.length > 0) {
      shuffle(target.grave, engine.ctx.random);
      target.deck = target.grave.splice(0, target.grave.length);
      diff.log.push(`플레이어 ${targetId}의 덱을 묘지에서 복원`);
    }

    // 3) 여전히 일반 덱에서 뽑을 카드가 없으면, 재앙 덱을 사용 (DRAW_CATA 이펙트로 위임)
    if (engine.state.catastropheDeck.length === 0) {
      if (engine.state.catastropheGrave.length > 0) {
        shuffle(engine.state.catastropheGrave, engine.ctx.random);
        engine.state.catastropheDeck = engine.state.catastropheGrave.splice(
          0,
          engine.state.catastropheGrave.length,
        );
        diff.log.push(`재앙 덱을 묘지에서 복원`);
      }
    }

    if (engine.state.catastropheDeck.length > 0) {
      const drawCata: DrawCataEffect = {
        type: 'DRAW_CATA',
        owner: targetId,
        value: 1,
      };
      engine.effectStack.push(drawCata);
    }

    // 이 DRAW 이펙트에서는 더 이상 카드 드로우/로그를 처리하지 않는다.
    return;
  }

  if (card) {
    diff.animations.push({ kind: 'draw', player: targetId });
    diff.log.push(`플레이어 ${targetId} 드로우`);
  }
}

export async function resolveDrawCata(
  engine: GameEngineCore,
  effect: DrawCataEffect,
  diff: DiffPatch,
) {
  const e = effect;
  const actor = e.owner;

  // value > 1 인 경우, 1장짜리 DRAW_CATA 이펙트를 여러 개로 분할하여 스택에 올린다.
  if (e.value > 1) {
    const effects: DrawCataEffect[] = [];
    for (let i = 0; i < e.value; i += 1) {
      effects.push({
        type: 'DRAW_CATA',
        owner: actor,
        value: 1,
        condition: e.condition,
      });
    }
    engine.effectStack.push(effects);
    return;
  }

  // value === 1 인 경우에만 실제 재앙 카드 드로우 처리
  if (!checkDrawCataCondition(engine, e)) return;

  // executor.drawCatastropheCard 로직 이식
  if (engine.state.catastropheDeck.length === 0) {
    const grave = engine.state.catastropheGrave;
    if (grave.length === 0) return;
    for (let j = grave.length - 1; j > 0; j -= 1) {
      const k = Math.floor(engine.ctx.random() * (j + 1));
      [grave[j], grave[k]] = [grave[k], grave[j]];
    }
    engine.state.catastropheDeck = grave.splice(0, grave.length);
  }
  const cardInst = engine.state.catastropheDeck.shift();
  if (!cardInst) return;

  diff.log.push(
    `플레이어 ${actor}가 재앙 카드를 뽑아 즉시 발동했습니다. (${cardInst.cardId})`,
  );

  // STEP 2: resolveStack 에 재앙 카드 적재
  {
    const player = engine.state.players[actor];
    if (player) {
      player.resolveStack.push({ card: cardInst });
    }
  }

  // STEP 3: THROW_RESOLVE_STACK 을 push (onDrawn 이후에 실행되도록)
  {
    const throwEffect: ThrowResolveStackEffect = {
      type: 'THROW_RESOLVE_STACK',
      owner: actor,
    };
    engine.effectStack.push(throwEffect);
  }

  // STEP 4: onDrawn 트리거를 push (스택상 위쪽에 쌓이므로 먼저 실행)
  await engine.enqueueCardTriggerEffects(cardInst.cardId, 'onDrawn', actor, diff);
}

export async function resolveDiscard(
  engine: GameEngineCore,
  effect: DiscardEffect,
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
  const target = players[targetId];
  if (!target) return;

  // condition 공통 처리
  if (!checkDiscardCondition(engine, e, target.hand.length)) return;

  // 손패 최대 개수 초과분 강제 버리기용 내부 모드:
  // - 현재 손패 개수 - handLimit 을 계산하여,
  //   초과분이 1장 이상이면 hand_choose DISCARD 이펙트를 스택에 올린다.
  if (e.method === 'hand_max') {
    const overflow = target.hand.length - target.handLimit;
    if (overflow > 0) {
      const chooseEffect: DiscardEffect = {
        type: 'DISCARD',
        owner,
        value: overflow,
        target: 'self',
        method: 'hand_choose',
      };
      engine.effectStack.push(chooseEffect);
      diff.log.push(
        `플레이어 ${targetId}의 손패가 최대 제한을 초과하여 ${overflow}장을 버려야 합니다.`,
      );
    }
    return;
  }

  // value > 1 이고, 자동 처리 모드(deck_random / deck_top / hand_random)인 경우
  // 1장짜리 DISCARD 이펙트를 여러 개로 분할하여 스택에 올린다.
  if (
    e.value > 1 &&
    (e.method === 'deck_random' ||
      e.method === 'deck_top' ||
      e.method === 'hand_random')
  ) {
    const effects: DiscardEffect[] = [];
    for (let i = 0; i < e.value; i += 1) {
      effects.push({
        type: 'DISCARD',
        owner,
        value: 1,
        target: e.target,
        method: e.method,
        condition: e.condition,
      });
    }
    engine.effectStack.push(effects);
    return;
  }

  if (e.method === 'deck_random') {
    const count = Math.min(e.value, target.deck.length);
    for (let i = 0; i < count; i += 1) {
      const idx = Math.floor(engine.ctx.random() * target.deck.length);
      const [card] = target.deck.splice(idx, 1);
      target.grave.push(card);
      // 덱에서 버려진 각 카드마다 onDiscard 트리거 발동
      engine.enqueueTriggeredEffects('onDiscard', {
        playerId: targetId,
        sourceCardId: card.cardId,
        amount: 1,
      });
    }
    diff.log.push(
      `플레이어 ${targetId}의 덱에서 무작위로 ${e.value}장을 버렸습니다.`,
    );
    diff.animations.push({
      kind: 'discard',
      player: targetId,
      amount: e.value,
    } as any);
    return;
  }

  if (e.method === 'deck_top') {
    const count = Math.min(e.value, target.deck.length);
    for (let i = 0; i < count; i += 1) {
      const card = target.deck.shift();
      if (card) {
        target.grave.push(card);
        // 덱 위에서 버려진 각 카드마다 onDiscard 트리거 발동
        engine.enqueueTriggeredEffects('onDiscard', {
          playerId: targetId,
          sourceCardId: card.cardId,
          amount: 1,
        });
      }
    }
    diff.log.push(`플레이어 ${targetId}의 덱 위에서 ${count}장을 버렸습니다.`);
    diff.animations.push({
      kind: 'discard',
      player: targetId,
      amount: count,
    } as any);
    return;
  }

  if (e.method === 'hand_random') {
    const count = Math.min(e.value, target.hand.length);
    for (let i = 0; i < count; i += 1) {
      const idx = Math.floor(engine.ctx.random() * target.hand.length);
      const [card] = target.hand.splice(idx, 1);
      target.grave.push(card);
      // 손패에서 무작위로 버려진 각 카드마다 onDiscard 트리거 발동
      engine.enqueueTriggeredEffects('onDiscard', {
        playerId: targetId,
        sourceCardId: card.cardId,
        amount: 1,
      });
    }
    diff.log.push(
      `플레이어 ${targetId}의 손에서 무작위로 ${count}장을 버렸습니다.`,
    );
    diff.animations.push({
      kind: 'discard',
      player: targetId,
      amount: count,
    } as any);
    return;
  }

  if (e.method === 'hand_choose') {
    // 손패에서 플레이어가 선택하여 버리는 효과:
    // - pendingInput 에 선택 요청을 기록하고
    // - stepUntilStable 에서 스택 처리가 중단되며
    //   request_input 이벤트가 전송된다.
    const requestKind = {
      type: 'option',
      kind: 'choose_discard',
    } as const;
    // 실제 클라이언트로는 cardId 문자열이 아니라
    // CardInstance 전체를 전달해야, 중복 카드 구분 및 UI 표시가 가능하다.
    const options: CardInstance[] = target.hand.map((ci) => ({ ...ci }));
    // 손패가 요구 수량 이하이면 고를 여지가 없으므로(빈 손 포함) 입력을 요청하지
    // 않고 가진 카드를 즉시 전부 버린다. (빈 options 로 request_input 을 보내면
    // 클라이언트/AI 가 답할 수 없어 게임이 WAITING_FOR_PLAYER_INPUT 에서 멈춘다.)
    if (options.length <= e.value) {
      const discarded = [...target.hand];
      target.hand = [];
      for (const card of discarded) {
        target.grave.push(card);
        engine.enqueueTriggeredEffects('onDiscard', {
          playerId: targetId,
          sourceCardId: card.cardId,
          amount: 1,
        });
      }
      if (discarded.length > 0) {
        diff.animations.push({
          kind: 'discard',
          player: targetId,
          amount: discarded.length,
        } as any);
        diff.log.push(
          `플레이어 ${targetId}가 손패 ${discarded.length}장을 모두 버렸습니다.`,
        );
      }
      return;
    }
    engine.pendingInput = {
      playerId: targetId,
      kind: requestKind,
      count: e.value,
      options,
    };
    engine.state.phase = GamePhase.WAITING_FOR_PLAYER_INPUT;
    diff.log.push('손패에서 버릴 카드를 선택하세요.');
    return;
  }

  // 엔진 내부에서 특정 인스턴스를 지정해서 버릴 때 사용 (method === 'instance')
  if (e.method === 'instance') {
    const target = players[targetId];
    if (!target || !e.instanceId) return;
    const idx = target.hand.findIndex((ci) => ci.id === e.instanceId);
    if (idx < 0) return;
    const [card] = target.hand.splice(idx, 1);
    target.grave.push(card);
    engine.enqueueTriggeredEffects('onDiscard', {
      playerId: targetId,
      sourceCardId: card.cardId,
      amount: 1,
    });
    diff.animations.push({
      kind: 'discard',
      player: targetId,
      amount: 1,
    } as any);
    diff.log.push(`플레이어 ${targetId}가 손에서 카드를 1장 버렸습니다.`);
  }
}

export async function resolveBurn(
  engine: GameEngineCore,
  effect: BurnEffect,
  diff: DiffPatch,
) {
  const e = effect;
  const { owner } = e;
  const { players } = engine.state;

  // condition 공통 처리
  if (!checkBurnCondition(engine, e)) return;

  // value > 1 이고, 자동 처리 모드(deck_random / deck_top)인 경우
  // 1장짜리 BURN 이펙트를 여러 개로 분할하여 스택에 올린다.
  {
    const count = e.value ?? 1;
    if (count > 1 && (e.method === 'deck_random' || e.method === 'deck_top')) {
      const effects: BurnEffect[] = [];
      for (let i = 0; i < count; i += 1) {
        effects.push({
          type: 'BURN',
          owner,
          target: e.target,
          method: e.method,
          value: 1,
          condition: e.condition,
          cardId: e.cardId,
        });
      }
      engine.effectStack.push(effects);
      return;
    }
  }

  // 선택형 burn: 손패 등에서 소멸할 카드를 직접 선택
  if (e.selectMode === 'choose') {
    const targetId =
      e.target === 'self'
        ? owner
        : Object.keys(players).find((id) => id !== owner);
    if (!targetId) return;
    const target = players[targetId];
    if (!target) return;
    if (target.hand.length === 0) {
      diff.log.push(
        '소멸(burn)할 손패 카드가 없어 BURN 효과가 무효 처리되었습니다.',
      );
      return;
    }

    const requestKind = {
      type: 'option',
      kind: 'choose_burn',
    } as const;
    const options: CardInstance[] = target.hand.map((ci) => ({ ...ci }));
    (engine as any).pendingInput = {
      playerId: targetId,
      kind: requestKind,
      options,
      count: e.value ?? 1,
    };
    (engine as any).state.phase = GamePhase.WAITING_FOR_PLAYER_INPUT;
    diff.log.push('소멸(burn)할 카드를 선택하세요.');
    return;
  }

  // 덱에서 무작위 burn
  if (e.method === 'deck_random') {
    const targetId =
      e.target === 'self'
        ? owner
        : Object.keys(players).find((id) => id !== owner);
    if (!targetId) return;
    const target = players[targetId];
    if (!target) return;
    const count = Math.min(e.value ?? 1, target.deck.length);
    for (let i = 0; i < count; i += 1) {
      const idx = Math.floor(engine.ctx.random() * target.deck.length);
      target.deck.splice(idx, 1);
    }
    diff.log.push(
      `플레이어 ${targetId}의 덱에서 무작위로 ${count}장이 소멸(burn)되었습니다.`,
    );
    return;
  }

  // 덱 위에서 burn
  if (e.method === 'deck_top') {
    const targetId =
      e.target === 'self'
        ? owner
        : Object.keys(players).find((id) => id !== owner);
    if (!targetId) return;
    const target = players[targetId];
    if (!target) return;
    const count = Math.min(e.value ?? 1, target.deck.length);
    for (let i = 0; i < count; i += 1) {
      target.deck.shift();
    }
    diff.log.push(
      `플레이어 ${targetId}의 덱 위에서 ${count}장이 소멸(burn)되었습니다.`,
    );
    return;
  }

  // 인스턴스 지정 burn (손패/덱 등에서 특정 인스턴스를 소멸)
  if (e.method === 'instance' && e.instanceId) {
    const targetId =
      e.target === 'self'
        ? owner
        : Object.keys(players).find((id) => id !== owner);
    if (!targetId) return;
    const target = players[targetId];
    if (!target) return;

    // 1) 손패에서 제거
    let idx = target.hand.findIndex((ci) => ci.id === e.instanceId);
    if (idx >= 0) {
      const [card] = target.hand.splice(idx, 1);
      diff.log.push(`카드 ${card.cardId}가 손패에서 소멸(burn)되었습니다.`);
    } else {
      // 2) 덱에서도 한 번 더 탐색 (필요시 확장 가능)
      idx = target.deck.findIndex((ci) => ci.id === e.instanceId);
      if (idx >= 0) {
        const [card] = target.deck.splice(idx, 1);
        diff.log.push(`카드 ${card.cardId}가 덱에서 소멸(burn)되었습니다.`);
      }
    }

    // 3) resolveStack 상의 동일 인스턴스 dest='burn' 표시
    const entry = target.resolveStack
      .slice()
      .reverse()
      .find((en) => en.card.id === e.instanceId);
    if (entry) {
      entry.dest = 'burn';
    }
    return;
  }
}
