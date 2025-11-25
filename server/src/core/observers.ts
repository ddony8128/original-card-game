import type { PlayerID, CardID } from '../type/gameState';
import type { Effect } from './effects/effectTypes';

// 엔진 내부에서 사용하는 트리거 종류
export type TriggerType =
  | 'onTurnStart'
  | 'onTurnEnd'
  | 'onDraw'
  | 'onDrawn'
  | 'onCataDraw'
  | 'onMove'
  | 'onInstallRitual'
  | 'onCast'
  | 'onUseRitual'
  | 'onDamaged'
  | 'onHeal'
  | 'onDiscard'
  | 'onBurn'
  | 'onDestroy';

export interface TriggerContextBase {
  playerId: PlayerID;
}

export interface TriggerContext extends TriggerContextBase {
  // 상황에 따라 필요한 정보를 점진적으로 확장
  sourceCardId?: CardID;
  ritualId?: string;
  amount?: number;
}

// 카드 하나가 등록한 옵저버 정보
export interface ObserverEntry {
  id: string; // 유니크 키 (cardId + trigger + index 등)
  owner: PlayerID;
  cardId: CardID;
  trigger: TriggerType;
  /**
   * 어떤 effectJson을 실행할지 식별하기 위한 메타 정보
   * 실제 실행은 나중에 공통 실행기에서 처리한다.
   */
  effectRef: unknown;
}

/**
 * ObserverRegistry는 "특정 트리거가 발생했을 때 어떤 Effect들을 push해야 하는지"
 * 를 관리하는 테이블이다.
 *
 * 실제 카드 효과는 아직 구현되지 않았으므로,
 * 현재는 TriggeredEffect를 만들어 EffectStack에 올리기 위한 정보만 리턴한다.
 */
export class ObserverRegistry {
  private readonly map = new Map<TriggerType, ObserverEntry[]>();

  register(entry: ObserverEntry) {
    const list = this.map.get(entry.trigger) ?? [];
    list.push(entry);
    this.map.set(entry.trigger, list);
  }

  unregisterByCard(cardId: CardID) {
    this.map.forEach((list, trigger) => {
      const next = list.filter((e) => e.cardId !== cardId);
      this.map.set(trigger, next);
    });
  }

  clear() {
    this.map.clear();
  }

  getEntries(trigger: TriggerType): ObserverEntry[] {
    return this.map.get(trigger) ?? [];
  }

  /**
   * 현재로서는 ObserverEntry를 기반으로 `TRIGGERED_EFFECT` 타입의 Effect를 만들어 리턴한다.
   * 실제 effectJson 실행은 `resolveEffect`에서 처리할 TODO로 남겨둔다.
   */
  collectTriggeredEffects(trigger: TriggerType, ctx: TriggerContext): Effect[] {
    const entries = this.getEntries(trigger);
    return entries.map<Effect>((entry) => ({
      type: 'TRIGGERED_EFFECT',
      owner: entry.owner,
      cardId: entry.cardId,
      trigger,
      effectRef: entry.effectRef,
      context: ctx,
    } as Effect));
  }
}


