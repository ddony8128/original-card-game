import type { DiffPatch } from '../../../type/wsProtocol';
import type { GameEngineCore } from '../gameEngineCore';
import { GamePhase } from '../../../type/gameState';
import type {
  Effect,
  TurnEndEffect,
  TurnStartEffect,
  DiscardEffect,
  DrawEffect,
  ManaGainEffect,
} from '../../effects/effectTypes';
import { MANA_CEILING, MANA_INC_PER_TURN } from '../../rules/constants';

export async function resolveTurnEnd(
  engine: GameEngineCore,
  effect: TurnEndEffect,
  diff: DiffPatch,
) {
  const turnEnd = effect;
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
}

export async function resolveTurnStart(
  engine: GameEngineCore,
  effect: TurnStartEffect,
  diff: DiffPatch,
) {
  const turnStart = effect;
  const player = engine.state.players[turnStart.owner];
  if (!player) return;

  // 턴이 시작될 때, 해당 플레이어 소유 마법진의 사용 여부를 초기화
  engine.state.board.rituals.forEach((ritual) => {
    if (ritual.owner === turnStart.owner) {
      ritual.usedThisTurn = false;
    }
  });

  // 최대 마나 증가
  player.maxMana = Math.min(player.maxMana + MANA_INC_PER_TURN, MANA_CEILING);

  diff.log.push(`플레이어 ${turnStart.owner} 턴 시작`);

  // 리추얼 onTurnStart 트리거 실행 이펙트를 먼저 스택에 올린다.
  for (const r of engine.state.board.rituals.filter(
    (ritual) => ritual.owner === turnStart.owner,
  )) {
    await engine.enqueueCardTriggerEffects(
      r.cardId,
      'onTurnStart',
      turnStart.owner,
      diff,
    );
  }

  // 마나 회복은 별도 Effect로 처리 (스택을 통해 일관성 유지)
  const manaGain: ManaGainEffect = {
    type: 'MANA_GAIN',
    owner: turnStart.owner,
    value: player.maxMana - player.mana,
    target: 'self',
  };
  engine.effectStack.push(manaGain);

  // 일반 드로우 1장은 이제 DRAW 이펙트로 스택에 올린다.
  const drawEffect: DrawEffect = {
    type: 'DRAW',
    owner: turnStart.owner,
    value: 1,
    target: 'self',
  };
  engine.effectStack.push(drawEffect);
}

export async function resolveChangeTurn(
  engine: GameEngineCore,
  effect: Effect,
  _diff: DiffPatch,
) {
  engine.state.turn += 1;
  engine.state.activePlayer = effect.owner;
  engine.state.phase = GamePhase.WAITING_FOR_PLAYER_ACTION;
  // 턴 시작 처리
  const ts: TurnStartEffect = { type: 'TURN_START', owner: effect.owner };
  engine.effectStack.push(ts);
}
