import type { DiffPatch } from '../../../type/wsProtocol';
import type { GameEngineCore } from '../gameEngineCore';
import type {
  TriggeredEffect,
  DiscardEffect,
  BurnEffect,
  DamageEffect,
  MoveEffect,
} from '../../effects/effectTypes';
import { fromViewerPos } from '../boardUtils';
import {
  buildEffectsFromConfigs,
  type TriggerConfig,
} from '../../effects/schema';

export async function resolveTriggeredEffect(
  engine: GameEngineCore,
  effect: TriggeredEffect,
  diff: DiffPatch,
) {
  const trig = effect;
  diff.log.push(
    `TriggeredEffect 실행: card={{c:${trig.cardId}}}, trigger=${trig.trigger}`,
  );

  const ref = trig.effectRef as TriggerConfig | undefined;
  if (!ref || !Array.isArray(ref.effects) || ref.effects.length === 0) return;

  const effects = buildEffectsFromConfigs(ref.effects, trig.owner, trig.cardId);
  if (effects.length > 0) {
    engine.effectStack.push(effects);
  }
}

export async function resolvePlayerInput(
  engine: GameEngineCore,
  effect: any,
  _diff: DiffPatch,
) {
  const e = effect as any;
  const { kind, answer } = e;

  // 1) 손패에서 골라 버리기 (choose_discard):
  //    선택된 카드 인스턴스들에 대해, instance 지정 DISCARD 이펙트를 push 한다.
  if (kind.type === 'option' && kind.kind === 'choose_discard') {
    const answers = Array.isArray(answer) ? (answer as any[]) : [answer as any];

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

    return;
  }

  // 2) choose_burn: 선택된 카드 인스턴스들에 대해, instance 지정 BURN 이펙트를 push 한다.
  if (kind.type === 'option' && kind.kind === 'choose_burn') {
    const answers = Array.isArray(answer) ? (answer as any[]) : [answer as any];

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

    return;
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

    return;
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
    return;
  }
}
