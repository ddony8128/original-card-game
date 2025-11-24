import type { DiffPatch } from '../../type/wsProtocol';
import type { GameEngineCore } from './index';
import { GamePhase } from '../../type/gameState';
import type {
  Effect,
  MoveEffect,
  TurnEndEffect,
  TurnStartEffect,
  InstallAfterSelectionEffect,
  CastExecuteEffect,
  TriggeredEffect,
} from '../effectTypes';
import { parseCardEffectJson } from '../effects/schema';

export async function resolveEffectInternal(
  engine: GameEngineCore,
  effect: Effect,
  diff: DiffPatch,
) {
  switch (effect.type) {
    case 'MOVE': {
      const move = effect as MoveEffect;
      const wizard = engine.state.board.wizards[effect.owner];
      if (wizard) {
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
      }
      break;
    }
    case 'TURN_END': {
      const turnEnd = effect as TurnEndEffect;
      diff.log.push(`플레이어 ${turnEnd.owner} 턴 종료`);
      // 리추얼 onTurnEnd 트리거 실행
      for (const r of engine.state.board.rituals.filter(
        (r) => r.owner === turnEnd.owner,
      )) {
        await engine.executeCardTrigger(
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
      // 최대 마나 증가 및 현재 마나 회복 (간단한 규칙)
      player.maxMana += 1;
      player.mana = player.maxMana;
      diff.log.push(
        `플레이어 ${turnStart.owner} 턴 시작 (마나 ${player.mana}/${player.maxMana})`,
      );
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
    case 'CAST_EXECUTE': {
      const cast = effect as CastExecuteEffect;
      diff.log.push(
        `플레이어 ${cast.owner}가 인스턴트 카드를 사용 (id=${cast.cardId})`,
      );
      // effect_json의 onCast 트리거 실행
      await engine.executeCardTrigger(cast.cardId, 'onCast', cast.owner, diff);
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
