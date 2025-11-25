import type { DiffPatch } from '../../type/wsProtocol';
import type { GameEngineCore } from './index';
import { GamePhase, type PlayerID } from '../../type/gameState';
import type {
  Effect,
  MoveEffect,
  TurnEndEffect,
  TurnStartEffect,
  InstallAfterSelectionEffect,
  InstallEffect,
  CastExecuteEffect,
  TriggeredEffect,
  ManaPayEffect,
  ManaGainEffect,
  DamageEffect,
  HealEffect,
  DrawEffect,
  DrawCataEffect,
  DiscardEffect,
  BurnEffect,
} from '../effects/effectTypes';
import { parseCardEffectJson } from '../effects/schema';
import { MANA_INC_PER_TURN } from '../rules/constants';

export async function resolveEffect(
  engine: GameEngineCore,
  effect: Effect,
  diff: DiffPatch,
) {
  switch (effect.type) {
    case 'MANA_PAY': {
      const manaPay = effect as ManaPayEffect;
      const player = engine.state.players[manaPay.owner];
      if (!player) break;
      player.mana = Math.max(player.mana - manaPay.amount, 0);
      diff.log.push(
        `플레이어 ${manaPay.owner}가 마나 ${manaPay.amount}을(를) 지불했습니다.`,
      );
      break;
    }
    case 'MANA_GAIN': {
      const manaGain = effect as ManaGainEffect;
      const targetId =
        manaGain.target === 'self'
          ? manaGain.owner
          : Object.keys(engine.state.players).find(
              (id) => id !== manaGain.owner,
            );
      if (!targetId) break;
      const player = engine.state.players[targetId];
      if (!player) break;
      const before = player.mana;
      player.mana = Math.min(player.maxMana, player.mana + manaGain.value);
      const gained = player.mana - before;
      if (gained > 0) {
        diff.log.push(
          `플레이어 ${targetId} 마나 +${gained} (${player.mana}/${player.maxMana})`,
        );
      }
      break;
    }
    case 'MOVE': {
      const move = effect as MoveEffect;
      const wizard = engine.state.board.wizards[effect.owner];
      if (!wizard) break;

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
          `플레이어 ${effect.owner}가 (${from[0]},${from[1]}) → (${move.to.r},${move.to.c}) 이동`,
        );
        break;
      }

      // 카드 효과 기반 MOVE: direction/value를 사용해 전방 이동 (executor.applyMove 이전 로직)
      const dir = move.direction ?? 'forward';
      if (dir !== 'forward' && dir !== 'choose') {
        diff.log.push('move 효과는 아직 forward/choose만 지원합니다.');
        break;
      }

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
        break;
      }

      const from: [number, number] = [wizard.r, wizard.c];
      wizard.r = toR;
      wizard.c = toC;
      diff.log.push(`카드 효과로 플레이어 ${effect.owner}가 이동했습니다.`);
      diff.animations.push({
        kind: 'move',
        player: effect.owner,
        from,
        to: [toR, toC],
      });
      break;
    }
    case 'TURN_END': {
      const turnEnd = effect as TurnEndEffect;
      diff.log.push(`플레이어 ${turnEnd.owner} 턴 종료`);
      // 리추얼 onTurnEnd 트리거 실행
      for (const r of engine.state.board.rituals.filter(
        (r) => r.owner === turnEnd.owner,
      )) {
        await engine.enqueueCardTriggerEffects(
          r.cardId,
          'onTurnEnd',
          turnEnd.owner,
          diff,
        );
      }
      // 다음 턴 플레이어로 변경
      {
        const currentIdx = engine.players.indexOf(engine.state.activePlayer);
        const nextIdx = (currentIdx + 1) % engine.players.length;
        const nextPlayer = engine.players[nextIdx];
        const changeEffect: Effect = {
          type: 'CHANGE_TURN',
          owner: nextPlayer,
        } as Effect;
        engine.effectStack.push(changeEffect);
      }
      break;
    }
    case 'TURN_START': {
      const turnStart = effect as TurnStartEffect;
      const player = engine.state.players[turnStart.owner];
      if (!player) break;

      // 최대 마나 증가
      player.maxMana += MANA_INC_PER_TURN;

      // 마나 회복은 별도 Effect로 처리 (스택을 통해 일관성 유지)
      const manaGain: ManaGainEffect = {
        type: 'MANA_GAIN',
        owner: turnStart.owner,
        value: player.maxMana,
        target: 'self',
      };
      engine.effectStack.push(manaGain);

      diff.log.push(`플레이어 ${turnStart.owner} 턴 시작`);

      // 일반 드로우 1장
      engine.drawCardNoTriggers(turnStart.owner, diff);
      // onTurnStart 트리거 호출
      engine.enqueueTriggeredEffects('onTurnStart', {
        playerId: turnStart.owner,
      });
      break;
    }
    case 'CHANGE_TURN': {
      engine.state.turn += 1;
      engine.state.activePlayer = effect.owner;
      engine.state.phase = GamePhase.WAITING_FOR_PLAYER_ACTION;
      // 턴 시작 처리
      const ts: TurnStartEffect = { type: 'TURN_START', owner: effect.owner };
      engine.effectStack.push(ts);
      break;
    }
    case 'INSTALL_AFTER_SELECTION': {
      const inst = effect as InstallAfterSelectionEffect;
      const id = `ritual_${engine.ctx.now()}_${Math.floor(
        engine.ctx.random() * 100000,
      )}`;
      engine.state.board.rituals.push({
        id,
        cardId: inst.cardId,
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
      // 리추얼 카드의 onTurnEnd/onDestroy 트리거를 ObserverRegistry에 등록 (필요 시)
      const meta = await engine.ctx.lookupCard(inst.cardId);
      if (meta && meta.effectJson) {
        const parsed = parseCardEffectJson(meta.effectJson);
        if (parsed) {
          parsed.triggers.forEach((t, index) => {
            if (t.trigger === 'onTurnEnd' || t.trigger === 'onDestroy') {
              engine.observers.register({
                id: `${inst.cardId}:${t.trigger}:${index}:${id}`,
                owner: inst.owner,
                cardId: inst.cardId,
                trigger: t.trigger,
                effectRef: t,
              });
            }
          });
        }
      }
      break;
    }
    case 'INSTALL': {
      const inst = effect as InstallEffect;
      const wizard = engine.state.board.wizards[inst.owner];
      const pos = wizard ?? { r: 0, c: 0 };

      const id = `ritual_${engine.ctx.now()}_${Math.floor(
        engine.ctx.random() * 100000,
      )}`;
      engine.state.board.rituals.push({
        id,
        cardId: inst.object as any,
        owner: inst.owner,
        pos,
        usedThisTurn: false,
      });
      diff.log.push(`카드 효과로 ritual ${inst.object}가 설치되었습니다.`);
      diff.animations.push({
        kind: 'ritual_place',
        player: inst.owner,
      });
      break;
    }
    case 'CAST_EXECUTE': {
      const cast = effect as CastExecuteEffect;
      diff.log.push(
        `플레이어 ${cast.owner}가 인스턴트 카드를 사용 (id=${cast.cardId})`,
      );
      // effect_json의 onCast 트리거 실행 (효과들을 EffectStack에 올린다)
      await engine.enqueueCardTriggerEffects(
        cast.cardId,
        'onCast',
        cast.owner,
        diff,
      );
      break;
    }
    case 'DAMAGE': {
      const e = effect as DamageEffect;
      const { owner } = e;
      const { players, board } = engine.state;

      let targetId: PlayerID | null = null;
      if (e.target === 'self') {
        targetId = owner;
      } else {
        const enemyId = Object.keys(players).find((id) => id !== owner);
        if (!enemyId) break;
        targetId = enemyId;
      }
      const target = players[targetId];
      if (!target) break;

      // 조건 처리
      if (e.condition === 'if_self_deck_empty') {
        const self = players[owner];
        if (!self || self.deck.length > 0) break;
      }
      if (e.condition === 'if_self_deck_empty_not') {
        const self = players[owner];
        if (!self || self.deck.length === 0) break;
      }

      // near_enemy + range 체크
      if (e.target === 'near_enemy' && typeof e.range === 'number') {
        const mePos = board.wizards[owner];
        const enemyPos = board.wizards[targetId];
        if (!mePos || !enemyPos) break;
        const dist =
          Math.abs(mePos.r - enemyPos.r) + Math.abs(mePos.c - enemyPos.c);
        if (dist > e.range) break;
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
      diff.log.push(`플레이어 ${targetId}가 ${amount} 피해를 입었습니다.`);
      diff.animations.push({
        kind: 'damage',
        player: targetId,
        amount,
      } as any);
      break;
    }
    case 'HEAL': {
      const e = effect as HealEffect;
      const { owner } = e;
      const { players } = engine.state;

      const targetId =
        e.target === 'self'
          ? owner
          : Object.keys(players).find((id) => id !== owner);
      if (!targetId) break;
      const player = players[targetId];
      if (!player) break;

      if (e.condition === 'if_enemy_dead_not' && e.target === 'enemy') {
        if (player.hp <= 0) break;
      }

      const before = player.hp;
      player.hp = Math.min(player.hp + e.value, 20);
      const healed = player.hp - before;
      if (healed > 0) {
        diff.log.push(`플레이어 ${targetId}가 ${healed} 만큼 회복했습니다.`);
        diff.animations.push({
          kind: 'heal',
          player: targetId,
          amount: healed,
        } as any);
      }
      break;
    }
    case 'DRAW': {
      const e = effect as DrawEffect;
      const { owner } = e;
      const { players } = engine.state;

      const targetId =
        e.target === 'self'
          ? owner
          : Object.keys(players).find((id) => id !== owner);
      if (!targetId) break;

      for (let i = 0; i < e.value; i += 1) {
        (engine as any).drawCardNoTriggers(targetId, diff);
      }
      break;
    }
    case 'DRAW_CATA': {
      const e = effect as DrawCataEffect;
      const actor = e.owner;

      for (let i = 0; i < e.value; i += 1) {
        if (e.condition === 'if_cata_deck_empty_not') {
          if (engine.state.catastropheDeck.length === 0) break;
        }

        // executor.drawCatastropheCard 로직 이식
        if (engine.state.catastropheDeck.length === 0) {
          const grave = engine.state.catastropheGrave;
          if (grave.length === 0) break;
          for (let j = grave.length - 1; j > 0; j -= 1) {
            const k = Math.floor(engine.ctx.random() * (j + 1));
            [grave[j], grave[k]] = [grave[k], grave[j]];
          }
          engine.state.catastropheDeck = grave.splice(0, grave.length);
        }
        const cardInst = engine.state.catastropheDeck.shift();
        if (!cardInst) break;
        engine.state.catastropheGrave.push(cardInst);
        diff.log.push(
          `플레이어 ${actor}가 재앙 카드를 뽑아 즉시 발동했습니다. (${cardInst.cardId})`,
        );
        // TODO: 재앙 카드 effect_json의 onDrawn 트리거 실행
      }
      break;
    }
    case 'DISCARD': {
      const e = effect as DiscardEffect;
      const { owner } = e;
      const { players } = engine.state;

      const targetId =
        e.target === 'self'
          ? owner
          : Object.keys(players).find((id) => id !== owner);
      if (!targetId) break;
      const target = players[targetId];
      if (!target) break;

      // 조건 처리
      if (e.condition === 'if_self_hand_empty') {
        if (target.hand.length > 0) break;
      }
      if (e.condition === 'if_self_hand_empty_not') {
        if (target.hand.length === 0) break;
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
        break;
      }

      if (e.method === 'deck_top') {
        const count = Math.min(e.value, target.deck.length);
        for (let i = 0; i < count; i += 1) {
          const card = target.deck.shift();
          if (card) {
            target.grave.push(card);
          }
        }
        diff.log.push(
          `플레이어 ${targetId}의 덱 위에서 ${count}장을 버렸습니다.`,
        );
        diff.animations.push({
          kind: 'discard',
          player: targetId,
          amount: count,
        } as any);
        break;
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
        break;
      }

      if (e.method === 'hand_choose') {
        (engine as any).pendingInput = {
          playerId: targetId,
          kind: { type: 'option', kind: 'choose_discard' },
          count: e.value,
        };
        (engine as any).state.phase = GamePhase.WAITING_FOR_PLAYER_INPUT;
        diff.log.push('손패에서 버릴 카드를 선택하세요.');
      }
      break;
    }
    case 'BURN': {
      const e = effect as BurnEffect;
      const { owner } = e;
      const { players } = engine.state;

      // 조건 처리
      if (e.condition === 'if_self_deck_empty_not') {
        const self = players[owner];
        if (!self || self.deck.length === 0) break;
      }

      // 덱에서 무작위 burn
      if (e.method === 'deck_random') {
        const targetId =
          e.target === 'self'
            ? owner
            : Object.keys(players).find((id) => id !== owner);
        if (!targetId) break;
        const target = players[targetId];
        if (!target) break;
        const count = Math.min(e.value ?? 1, target.deck.length);
        for (let i = 0; i < count; i += 1) {
          const idx = Math.floor(engine.ctx.random() * target.deck.length);
          target.deck.splice(idx, 1);
        }
        diff.log.push(
          `플레이어 ${targetId}의 덱에서 무작위로 ${count}장이 소멸(burn)되었습니다.`,
        );
        break;
      }

      // 덱 위에서 burn
      if (e.method === 'deck_top') {
        const targetId =
          e.target === 'self'
            ? owner
            : Object.keys(players).find((id) => id !== owner);
        if (!targetId) break;
        const target = players[targetId];
        if (!target) break;
        const count = Math.min(e.value ?? 1, target.deck.length);
        for (let i = 0; i < count; i += 1) {
          target.deck.shift();
        }
        diff.log.push(
          `플레이어 ${targetId}의 덱 위에서 ${count}장이 소멸(burn)되었습니다.`,
        );
        break;
      }

      // 기본: 현재 사용 중인 카드를 burn (grave로 가지 않도록 표시)
      if (!e.cardId) break;
      (engine as any).burnedThisAction.add(e.cardId);
      diff.log.push(`카드 ${e.cardId}가 소멸(burn)되었습니다.`);
      break;
    }
    case 'TRIGGERED_EFFECT': {
      const trig = effect as TriggeredEffect;
      // TODO: trig.effectRef + trig.context를 이용해 effectJson 실행
      // 현재는 로그만 남긴다.
      diff.log.push(
        `TriggeredEffect 실행: card=${trig.cardId}, trigger=${trig.trigger}`,
      );
      break;
    }
    default:
      // 아직 구현되지 않은 Effect 타입
      break;
  }
}
