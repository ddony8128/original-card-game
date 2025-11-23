import type { PlayerID } from '../../type/gameState';
import type { DiffPatch } from '../../type/wsProtocol';
import type { GameEngineCore } from '../engine';
import type {
  CardEffectJson,
  EffectConfig,
  DamageEffectConfig,
  DiscardEffectConfig,
  BurnEffectConfig,
  InstallEffectConfig,
} from './schema';

export interface ExecuteContext {
  engine: GameEngineCore;
  actor: PlayerID;
  source: CardEffectJson;
  diff: DiffPatch;
}

export function executeEffects(
  effects: EffectConfig[],
  ctx: ExecuteContext,
  cardId?: string,
) {
  for (const effect of effects) {
    switch (effect.type) {
      case 'mana_gain':
        applyManaGain(effect, ctx);
        break;
      case 'damage':
        applyDamage(effect, ctx);
        break;
      case 'heal':
        applyHeal(effect, ctx);
        break;
      case 'move':
        applyMove(effect, ctx);
        break;
      case 'draw':
        applyDraw(effect, ctx);
        break;
      case 'draw_cata':
        applyDrawCata(effect, ctx);
        break;
      case 'discard':
        applyDiscard(effect, ctx);
        break;
      case 'burn':
        applyBurn(effect, ctx, cardId);
        break;
      case 'install':
        applyInstall(effect, ctx);
        break;
      default:
        break;
    }
  }
}

function applyManaGain(effect: EffectConfig, ctx: ExecuteContext) {
  if (effect.type !== 'mana_gain') return;
  const { engine, actor, diff } = ctx;
  const e = effect as any;
  const targetId =
    e.target === 'self'
      ? actor
      : Object.keys(engine.state.players).find((id) => id !== actor);
  if (!targetId) return;
  const player = engine.state.players[targetId];
  if (!player) return;
  player.mana = Math.min(player.maxMana, player.mana + effect.value);
  diff.log.push(
    `플레이어 ${targetId} 마나 +${effect.value} (${player.mana}/${player.maxMana})`,
  );
}

function applyDamage(effect: EffectConfig, ctx: ExecuteContext) {
  const e = effect as DamageEffectConfig;
  if (e.type !== 'damage') return;
  const { engine, actor, diff } = ctx;

  let targetId: PlayerID | null = null;
  if (e.target === 'self') {
    targetId = actor;
  } else {
    const enemyId = Object.keys(engine.state.players).find(
      (id) => id !== actor,
    );
    if (!enemyId) return;
    targetId = enemyId;
  }
  const target = engine.state.players[targetId];
  if (!target) return;

  // 조건 처리
  if (e.condition === 'if_self_deck_empty') {
    const self = engine.state.players[actor];
    if (!self || self.deck.length > 0) return;
  }
  if (e.condition === 'if_self_deck_empty_not') {
    const self = engine.state.players[actor];
    if (!self || self.deck.length === 0) return;
  }

  // 간단 버전: near_enemy/범위 체크는 마법사 간 거리로만 처리
  if (e.target === 'near_enemy' && typeof e.range === 'number') {
    const mePos = engine.state.board.wizards[actor];
    const enemyPos = engine.state.board.wizards[targetId];
    if (!mePos || !enemyPos) return;
    const dist =
      Math.abs(mePos.r - enemyPos.r) + Math.abs(mePos.c - enemyPos.c);
    if (dist > e.range) return;
  }

  // value가 특수 문자열인 경우 해석 (예: count(rituals_installed))
  let amount = e.value as any;
  if (typeof amount === 'string') {
    if (amount === 'count(rituals_installed)') {
      amount = engine.state.board.rituals.filter(
        (r) => r.owner === actor,
      ).length;
    } else {
      // 알 수 없는 포맷은 0으로 취급
      amount = 0;
    }
  }

  target.hp -= amount;
  diff.log.push(`플레이어 ${targetId}가 ${amount} 피해를 입었습니다.`);
  diff.animations.push({
    kind: 'damage',
    player: targetId,
    amount,
  });
}

function applyHeal(effect: EffectConfig, ctx: ExecuteContext) {
  if (effect.type !== 'heal') return;
  const e = effect as any;
  const { engine, actor, diff } = ctx;
  const targetId =
    e.target === 'self'
      ? actor
      : Object.keys(engine.state.players).find((id) => id !== actor);
  if (!targetId) return;
  const player = engine.state.players[targetId];
  if (!player) return;

  // 조건 처리 (예: if_enemy_dead_not)
  if (e.condition === 'if_enemy_dead_not' && e.target === 'enemy') {
    if (player.hp <= 0) {
      return;
    }
  }

  const before = player.hp;
  player.hp = Math.min(player.hp + effect.value, 20);
  const healed = player.hp - before;
  diff.log.push(`플레이어 ${targetId}가 ${healed} 만큼 회복했습니다.`);
  diff.animations.push({
    kind: 'heal',
    player: targetId,
    amount: healed,
  });
}

function applyMove(effect: EffectConfig, ctx: ExecuteContext) {
  if (effect.type !== 'move') return;
  const { engine, actor, diff } = ctx;
  const me = engine.state.board.wizards[actor];
  if (!me) return;

  // 현재는 간단히 \"전방\" 한 칸 이동만 지원 (실제 choose_move는 이후 단계에서 구현)
  const dir = effect.direction ?? 'forward';
  if (dir !== 'forward' && dir !== 'choose') {
    diff.log.push('move 효과는 아직 forward/choose만 지원합니다.');
    return;
  }

  const isBottomSide = (engine as any).isBottomSide
    ? (engine as any).isBottomSide(actor)
    : true;
  const delta = isBottomSide ? -1 : 1;
  const toR = me.r + delta;
  const toC = me.c;
  if (
    toR < 0 ||
    toR >= engine.state.board.height ||
    toC < 0 ||
    toC >= engine.state.board.width
  ) {
    return;
  }

  const from: [number, number] = [me.r, me.c];
  me.r = toR;
  me.c = toC;
  diff.log.push(`카드 효과로 플레이어 ${actor}가 이동했습니다.`);
  diff.animations.push({
    kind: 'move',
    player: actor,
    from,
    to: [toR, toC],
  });
}

function applyDraw(effect: EffectConfig, ctx: ExecuteContext) {
  if (effect.type !== 'draw') return;
  const { engine, actor, diff } = ctx;
  const e = effect as any;
  const targetId =
    e.target === 'self'
      ? actor
      : Object.keys(engine.state.players).find((id) => id !== actor);
  if (!targetId) return;
  for (let i = 0; i < effect.value; i += 1) {
    (engine as any).drawCardNoTriggers(targetId, diff);
  }
}

function applyDrawCata(effect: EffectConfig, ctx: ExecuteContext) {
  if (effect.type !== 'draw_cata') return;
  const { engine, actor, diff } = ctx;
  const e = effect as any;
  for (let i = 0; i < effect.value; i += 1) {
    if (e.condition === 'if_cata_deck_empty_not') {
      if (engine.state.catastropheDeck.length === 0) return;
    }
    drawCatastropheCard(engine, actor, diff);
  }
}

function drawCatastropheCard(
  engine: GameEngineCore,
  actor: PlayerID,
  diff: DiffPatch,
) {
  if (engine.state.catastropheDeck.length === 0) {
    // grave를 셔플해서 새 덱으로
    const grave = engine.state.catastropheGrave;
    if (grave.length === 0) return;
    // 간단 셔플
    for (let i = grave.length - 1; i > 0; i -= 1) {
      const j = Math.floor(engine.ctx.random() * (i + 1));
      [grave[i], grave[j]] = [grave[j], grave[i]];
    }
    engine.state.catastropheDeck = grave.splice(0, grave.length);
  }
  const cardInst = engine.state.catastropheDeck.shift();
  if (!cardInst) return;
  engine.state.catastropheGrave.push(cardInst);
  diff.log.push(
    `플레이어 ${actor}가 재앙 카드를 뽑아 즉시 발동했습니다. (${cardInst.cardId})`,
  );
  // TODO: 재앙 카드 effect_json의 onDrawn 트리거 실행
}

function applyDiscard(effect: EffectConfig, ctx: ExecuteContext) {
  const e = effect as DiscardEffectConfig;
  if (e.type !== 'discard') return;
  const { engine, actor, diff } = ctx;

  const targetId =
    e.target === 'self'
      ? actor
      : Object.keys(engine.state.players).find((id) => id !== actor);
  if (!targetId) return;
  const target = engine.state.players[targetId];
  if (!target) return;

  // 조건 처리
  if (e.condition === 'if_self_hand_empty') {
    if (target.hand.length > 0) return;
  }
  if (e.condition === 'if_self_hand_empty_not') {
    if (target.hand.length === 0) return;
  }

  if (e.method === 'deck_random') {
    const count = Math.min(e.value, target.deck.length);
    for (let i = 0; i < count; i += 1) {
      const idx = Math.floor(engine.ctx.random() * target.deck.length);
      const [card] = target.deck.splice(idx, 1);
      target.grave.push(card);
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
    // hand_choose는 엔진에서 request_input 플로우로 처리한다.
    const options = [...target.hand];
    (ctx.engine as any).pendingInput = {
      playerId: targetId,
      kind: { type: 'option', kind: 'choose_discard' },
      type: 'hand_discard',
      count: e.value,
    };
    diff.log.push('손패에서 버릴 카드를 선택하세요.');
    // 실제 request_input 결과는 GameEngineCore.stepUntilStable 이후
    // EngineResult로 전달된다.
  }
}

function applyBurn(effect: EffectConfig, ctx: ExecuteContext, cardId?: string) {
  const e = effect as BurnEffectConfig;
  if (e.type !== 'burn') return;
  const { engine, actor, diff } = ctx;

  // 조건 처리
  if (e.condition === 'if_self_deck_empty_not') {
    const self = engine.state.players[actor];
    if (!self || self.deck.length === 0) return;
  }

  // 덱에서 무작위 burn
  if (e.method === 'deck_random') {
    const targetId =
      e.target === 'self'
        ? actor
        : Object.keys(engine.state.players).find((id) => id !== actor);
    if (!targetId) return;
    const target = engine.state.players[targetId];
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
        ? actor
        : Object.keys(engine.state.players).find((id) => id !== actor);
    if (!targetId) return;
    const target = engine.state.players[targetId];
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

  // 기본: 현재 사용 중인 카드를 burn (grave로 가지 않도록 표시)
  if (!cardId) return;
  (engine as any).burnedThisAction.add(cardId);
  diff.log.push(`카드 ${cardId}가 소멸(burn)되었습니다.`);
}

function applyInstall(effect: EffectConfig, ctx: ExecuteContext) {
  if (effect.type !== 'install') return;
  const e = effect as InstallEffectConfig;
  const { engine, actor, diff } = ctx;

  const wizard = engine.state.board.wizards[actor];
  const pos = wizard ?? { r: 0, c: 0 };

  const id = `ritual_${engine.ctx.now()}_${Math.floor(
    engine.ctx.random() * 100000,
  )}`;
  engine.state.board.rituals.push({
    id,
    cardId: e.object as any,
    owner: actor,
    pos,
    usedThisTurn: false,
  });

  diff.log.push(`카드 효과로 ritual ${e.object}가 설치되었습니다.`);
  diff.animations.push({
    kind: 'ritual_place',
    player: actor,
  });
}
