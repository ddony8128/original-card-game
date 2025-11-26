import type { DiffPatch } from '../../type/wsProtocol';
import type { CardInstance } from '../../type/gameState';
import type { GameEngineCore } from './index';
import { GamePhase, type PlayerID } from '../../type/gameState';
import {
  computeInstallPositions,
  toViewerPos,
  fromViewerPos,
  isInsideBoard,
} from './boardUtils';
import type {
  Effect,
  MoveEffect,
  TurnEndEffect,
  TurnStartEffect,
  InstallEffect,
  CastExecuteEffect,
  TriggeredEffect,
  ManaPayEffect,
  ManaGainEffect,
  DamageEffect,
  HealEffect,
  DrawEffect,
  DrawCataEffect,
  ThrowResolveStackEffect,
  DiscardEffect,
  BurnEffect,
} from '../effects/effectTypes';
import { parseCardEffectJson } from '../effects/schema';
import {
  checkDamageCondition,
  checkHealCondition,
  checkDiscardCondition,
  checkBurnCondition,
  checkDrawCataCondition,
} from '../effects/conditions';
import { MANA_CEILING, MANA_INC_PER_TURN } from '../rules/constants';

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
      player.mana += manaGain.value;
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
        break;
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
          (p) =>
            isInsideBoard(board, p.r, p.c) && !occupied.has(`${p.r},${p.c}`),
        );

        if (optionsAbs.length === 0) {
          diff.log.push(
            '이동 가능한 칸이 없어 MOVE(choose) 효과가 무효 처리되었습니다.',
          );
          break;
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
        break;
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
        break;
      }

      diff.log.push('지원되지 않는 move direction 입니다.');
      break;
    }
    case 'TURN_END': {
      const turnEnd = effect as TurnEndEffect;
      diff.log.push(`플레이어 ${turnEnd.owner} 턴 종료`);

      // 1) 먼저 CHANGE_TURN, hand_max DISCARD 를 push 해 두고
      // 2) 마지막에 onTurnEnd 트리거 이펙트들을 push 해서,
      //    실제 해석 순서가 onTurnEnd → hand_max DISCARD → CHANGE_TURN 이 되도록 한다.

      // 다음 턴 플레이어로 변경 (가장 마지막에 실행되도록 먼저 push)
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

      // 턴 종료 시 손패 최대 개수 초과분을 강제로 버리기 위한 hand_max discard 이펙트
      {
        const handMaxEffect: DiscardEffect = {
          type: 'DISCARD',
          owner: turnEnd.owner,
          value: 0, // hand_max 에서는 value 는 사용하지 않음
          target: 'self',
          method: 'hand_max',
        };
        engine.effectStack.push(handMaxEffect);
      }

      // 리추얼 onTurnEnd 트리거 실행 (스택 최상단에 올라가서 가장 먼저 해석됨)
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

      break;
    }
    case 'TURN_START': {
      const turnStart = effect as TurnStartEffect;
      const player = engine.state.players[turnStart.owner];
      if (!player) break;

      // 최대 마나 증가
      player.maxMana = Math.min(
        player.maxMana + MANA_INC_PER_TURN,
        MANA_CEILING,
      );

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
    case 'INSTALL': {
      const inst = effect as InstallEffect;
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

        // 리추얼 카드의 onTurnEnd 트리거를 ObserverRegistry에 등록 (필요 시)
        const meta = await engine.ctx.lookupCard(cardId);
        if (meta && meta.effectJson) {
          const parsed = parseCardEffectJson(meta.effectJson);
          if (parsed) {
            parsed.triggers.forEach((t, index) => {
              if (t.trigger === 'onTurnEnd') {
                engine.observers.register({
                  id: `${cardId}:${t.trigger}:${index}:${id}`,
                  owner: inst.owner,
                  cardId,
                  trigger: t.trigger,
                  effectRef: t,
                });
              }
            });
          }
        }
        break;
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
        break;
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
        diff.log.push(
          '설치 가능한 위치가 없어 INSTALL 효과가 무효 처리되었습니다.',
        );
        break;
      }

      const options = absOptions.map((pos: { r: number; c: number }) =>
        toViewerPos(
          engine.state.board,
          engine.bottomSidePlayerId,
          pos,
          inst.owner,
        ),
      );

      engine.pendingInput = {
        playerId: inst.owner,
        kind: requestKind,
        cardId,
        installRange: inst.range,
        options,
      };
      engine.state.phase = GamePhase.WAITING_FOR_PLAYER_INPUT;
      diff.log.push('리추얼을 설치할 위치를 선택하세요.');
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
        {
          sourceInstanceId: cast.sourceInstanceId,
        },
      );
      break;
    }
    case 'DAMAGE': {
      const e = effect as DamageEffect;
      const { owner } = e;
      const { players, board } = engine.state;

      // 고정 위치 데미지 (select_damage_target 이후)
      if (e.pos) {
        const targetEntry = Object.entries(board.wizards).find(
          ([, pos]) => pos.r === e.pos!.r && pos.c === e.pos!.c,
        );
        if (!targetEntry) break;
        const targetId = targetEntry[0] as PlayerID;
        const target = players[targetId];
        if (!target) break;

        // condition 공통 처리
        if (!checkDamageCondition(engine, e)) break;

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
          `플레이어 ${targetId}가 (${e.pos.r},${e.pos.c}) 위치에서 ${amount} 피해를 입었습니다.`,
        );
        diff.animations.push({
          kind: 'damage',
          player: targetId,
          amount,
        } as any);
        break;
      }

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

      // condition 공통 처리
      if (!checkDamageCondition(engine, e)) break;

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
            Math.abs(casterPos.r - enemyPos.r) +
            Math.abs(casterPos.c - enemyPos.c);
          if (dist <= e.range) {
            positions.push({ r: enemyPos.r, c: enemyPos.c });
          }
        }

        if (!positions || positions.length === 0) {
          diff.log.push(
            '피해를 줄 수 있는 대상이 없어 DAMAGE 효과가 무효 처리되었습니다.',
          );
          break;
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
        break;
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

      // condition 공통 처리
      if (!checkHealCondition(engine, e, player.hp)) break;

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

      // value > 1 인 경우, 1장짜리 DRAW 이펙트를 여러 개로 분할하여 스택에 올린다.
      if (e.value > 1) {
        const effects: DrawEffect[] = [];
        for (let i = 0; i < e.value; i += 1) {
          effects.push({
            type: 'DRAW',
            owner,
            value: 1,
            target: e.target,
          });
        }
        engine.effectStack.push(effects);
        break;
      }

      // value === 1 인 경우에만 실제 드로우 수행
      (engine as any).drawCardNoTriggers(targetId, diff);
      break;
    }
    case 'DRAW_CATA': {
      const e = effect as DrawCataEffect;
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
        break;
      }

      // value === 1 인 경우에만 실제 재앙 카드 드로우 처리
      if (!checkDrawCataCondition(engine, e)) break;

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
      await engine.enqueueCardTriggerEffects(
        cardInst.cardId,
        'onDrawn',
        actor,
        diff,
      );
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

      // condition 공통 처리
      if (!checkDiscardCondition(engine, e, target.hand.length)) break;

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
        break;
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
        break;
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
        break;
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
        break;
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
        engine.pendingInput = {
          playerId: targetId,
          kind: requestKind,
          count: e.value,
          options,
        };
        engine.state.phase = GamePhase.WAITING_FOR_PLAYER_INPUT;
        diff.log.push('손패에서 버릴 카드를 선택하세요.');
      }

      // 엔진 내부에서 특정 인스턴스를 지정해서 버릴 때 사용 (method === 'instance')
      if (e.method === 'instance') {
        const target = players[targetId];
        if (!target || !e.instanceId) break;
        const idx = target.hand.findIndex((ci) => ci.id === e.instanceId);
        if (idx < 0) break;
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
      break;
    }
    case 'THROW_RESOLVE_STACK': {
      const e = effect as ThrowResolveStackEffect;
      const owner = e.owner;
      const player = engine.state.players[owner];
      if (!player || player.resolveStack.length === 0) break;

      const entry = player.resolveStack.pop();
      if (!entry) break;

      const card = entry.card;
      let dest = entry.dest;

      // dest 가 명시되지 않은 경우, 카드 메타를 조회하여
      // 재앙(catatastrophe)이면 catastropheGrave, 아니면 일반 grave 로 보낸다.
      if (!dest) {
        const meta = await engine.ctx.lookupCard(card.cardId);
        if (meta && meta.type === 'catastrophe') {
          dest = 'cata_grave';
        } else {
          dest = 'grave';
        }
      }

      switch (dest) {
        case 'grave':
          player.grave.push(card);
          diff.log.push(`카드 ${card.cardId}가 무덤으로 이동했습니다.`);
          break;
        case 'cata_grave':
          engine.state.catastropheGrave.push(card);
          diff.log.push(`재앙 카드 ${card.cardId}가 재앙 묘지로 이동했습니다.`);
          break;
        case 'hand':
          player.hand.push(card);
          diff.log.push(`카드 ${card.cardId}가 손패로 돌아갔습니다.`);
          break;
        case 'board':
          // 리추얼 설치 등: 실제 보드에는 RitualInstance 로 이미 표현되어 있으므로
          // resolveStack 에서만 제거하고 별도 이동은 하지 않는다.
          diff.log.push(
            `카드 ${card.cardId}의 최종 목적지가 보드(board)로 처리되었습니다.`,
          );
          break;
        case 'burn':
          // 완전 소멸: 어떤 컬렉션에도 넣지 않고 제거
          diff.log.push(`카드 ${card.cardId}가 완전히 소멸(burn)되었습니다.`);
          break;
        default:
          break;
      }
      break;
    }
    case 'BURN': {
      const e = effect as BurnEffect;
      const { owner } = e;
      const { players } = engine.state;

      // condition 공통 처리
      if (!checkBurnCondition(engine, e)) break;

      // value > 1 이고, 자동 처리 모드(deck_random / deck_top)인 경우
      // 1장짜리 BURN 이펙트를 여러 개로 분할하여 스택에 올린다.
      {
        const count = e.value ?? 1;
        if (
          count > 1 &&
          (e.method === 'deck_random' || e.method === 'deck_top')
        ) {
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
          break;
        }
      }

      // 선택형 burn: 손패 등에서 소멸할 카드를 직접 선택
      if (e.selectMode === 'choose') {
        const targetId =
          e.target === 'self'
            ? owner
            : Object.keys(players).find((id) => id !== owner);
        if (!targetId) break;
        const target = players[targetId];
        if (!target) break;
        if (target.hand.length === 0) {
          diff.log.push(
            '소멸(burn)할 손패 카드가 없어 BURN 효과가 무효 처리되었습니다.',
          );
          break;
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
        break;
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

      // 인스턴스 지정 burn (손패/덱 등에서 특정 인스턴스를 소멸)
      if (e.method === 'instance' && e.instanceId) {
        const targetId =
          e.target === 'self'
            ? owner
            : Object.keys(players).find((id) => id !== owner);
        if (!targetId) break;
        const target = players[targetId];
        if (!target) break;

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
        break;
      }

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
    case 'RESOLVE_PLAYER_INPUT': {
      const e = effect as any;
      const { kind, answer } = e;

      // 1) 손패에서 골라 버리기 (choose_discard):
      //    선택된 카드 인스턴스들에 대해, instance 지정 DISCARD 이펙트를 push 한다.
      if (kind.type === 'option' && kind.kind === 'choose_discard') {
        const answers = Array.isArray(answer)
          ? (answer as any[])
          : [answer as any];

        answers.forEach((ans) => {
          let instId: string | undefined;
          let cardId: string | undefined;
          if (typeof ans === 'string') {
            // 과거 프로토콜(cardId 문자열) 호환
            cardId = ans;
          } else if (ans && typeof ans === 'object') {
            instId = (ans as { id?: string }).id;
            cardId = (ans as { cardId?: string }).cardId;
          }

          // 인스턴스 id 우선, 없으면 cardId 로 fallback 하여 나중에 처리.
          const discardEffect: DiscardEffect = {
            type: 'DISCARD',
            owner: e.owner,
            value: 1,
            target: 'self',
            method: 'instance',
            instanceId: instId,
            // condition 없음
          };

          // instanceId 가 없고 cardId 만 있는 경우를 위한 fallback:
          // resolve 시점에서 hand 에 있는 첫 번째 동일 cardId 를 제거하게 된다.
          if (!instId && cardId) {
            // instanceId 가 지정되지 않으면, resolve 시점에서 cardId 로만 찾을 수 있도록
            // 굳이 별도 필드는 두지 않고, owner/self 조합으로 판단한다.
            // 카드 id 기준으로 여러 장이 있을 경우, 첫 번째 한 장이 버려진다.
            discardEffect.instanceId = undefined;
            (discardEffect as any).cardId = cardId;
          }

          engine.effectStack.push(discardEffect);
        });

        break;
      }

      // 2) choose_burn: 선택된 카드 인스턴스들에 대해, instance 지정 BURN 이펙트를 push 한다.
      if (kind.type === 'option' && kind.kind === 'choose_burn') {
        const answers = Array.isArray(answer)
          ? (answer as any[])
          : [answer as any];

        answers.forEach((ans) => {
          let instId: string | undefined;
          let cardId: string | undefined;
          if (typeof ans === 'string') {
            cardId = ans;
          } else if (ans && typeof ans === 'object') {
            instId = (ans as { id?: string }).id;
            cardId = (ans as { cardId?: string }).cardId;
          }

          const burnEffect: BurnEffect = {
            type: 'BURN',
            owner: e.owner,
            target: 'self',
            method: 'instance',
            instanceId: instId as any,
          };

          if (!instId && cardId) {
            (burnEffect as any).cardId = cardId;
          }

          engine.effectStack.push(burnEffect);
        });

        break;
      }

      // 3) select_damage_target: 선택된 위치에 대해 고정 위치 데미지 이펙트를 push 한다.
      if (kind.type === 'map' && kind.kind === 'select_damage_target') {
        const posAns = Array.isArray(answer)
          ? { r: (answer as any)[0], c: (answer as any)[1] }
          : (answer as { r: number; c: number });
        const viewR = posAns.r;
        const viewC = posAns.c;
        const { r, c } = fromViewerPos(
          engine.state.board,
          engine.bottomSidePlayerId,
          { r: viewR, c: viewC },
          e.owner,
        );

        const pending = (e.meta ?? {}) as any;
        const value = pending.damageValue ?? 0;

        const dmgEffect: DamageEffect = {
          type: 'DAMAGE',
          owner: e.owner,
          value,
          target: 'enemy',
          pos: { r, c },
        };

        engine.effectStack.push(dmgEffect);

        break;
      }

      // 4) choose_move_direction: 선택된 좌표로 이동하는 고정 MOVE 이펙트를 push 한다.
      if (kind.type === 'map' && kind.kind === 'choose_move_direction') {
        const posAns = Array.isArray(answer)
          ? { r: (answer as any)[0], c: (answer as any)[1] }
          : (answer as { r: number; c: number });
        const viewR = posAns.r;
        const viewC = posAns.c;
        const { r, c } = fromViewerPos(
          engine.state.board,
          engine.bottomSidePlayerId,
          { r: viewR, c: viewC },
          e.owner,
        );

        const moveEffect: MoveEffect = {
          type: 'MOVE',
          owner: e.owner,
          to: { r, c },
        };

        engine.effectStack.push(moveEffect);
        break;
      }

      break;
    }
    default:
      // 아직 구현되지 않은 Effect 타입
      break;
  }
}
