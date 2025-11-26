import type {
  PlayerID,
  CardID,
  CardInstance,
  CardInstanceId,
} from '../../type/gameState';

export type EffectType =
  // 턴/플로우 제어
  | 'TURN_START'
  | 'TURN_END'
  | 'CHANGE_TURN'
  // 마나
  | 'MANA_PAY'
  | 'MANA_GAIN'
  // 이동/설치
  | 'MOVE'
  | 'INSTALL'
  // 카드 사용/리추얼 사용
  | 'CAST_START'
  | 'CAST_EXECUTE'
  | 'USE_RITUAL_START'
  // 카드 효과 기반
  | 'DRAW'
  | 'DRAW_CATA'
  | 'DAMAGE'
  | 'HEAL'
  | 'DISCARD'
  | 'BURN'
  // 플레이어 입력 해석용 내부 이펙트
  | 'RESOLVE_PLAYER_INPUT'
  // resolveStack 처리용 내부 이펙트
  | 'THROW_RESOLVE_STACK'
  // 트리거
  | 'TRIGGERED_EFFECT';

export interface BaseEffect {
  type: EffectType;
  owner: PlayerID;
}

// ---- 엔진 내부용 Effect ----

export interface TurnStartEffect extends BaseEffect {
  type: 'TURN_START';
}

export interface TurnEndEffect extends BaseEffect {
  type: 'TURN_END';
}

export interface ChangeTurnEffect extends BaseEffect {
  type: 'CHANGE_TURN';
  nextPlayer: PlayerID;
}

export interface MoveEffect extends BaseEffect {
  type: 'MOVE';
  // 플레이어 액션 이동에서 사용하는 절대 좌표
  to?: { r: number; c: number };
  // 카드 효과 기반 이동에서 사용하는 필드 (optional)
  direction?: 'choose' | 'forward';
  value?: number;
}

export interface InstallEffect extends BaseEffect {
  type: 'INSTALL';
  /**
   * 설치할 오브젝트 (카드 인스턴스)
   */
  object: CardInstance;
  /**
   * range 가 있고 pos 가 없으면, 선택 설치 모드로 해석한다.
   * range 가 없고 pos 도 없으면, 기본적으로 시전자 위치에 설치한다.
   */
  range?: number;
  /**
   * pos 가 명시된 경우, 고정 위치 설치 (fix 모드).
   */
  pos?: { r: number; c: number };
}

export interface CastExecuteEffect extends BaseEffect {
  type: 'CAST_EXECUTE';
  cardId: CardID;
  /**
   * 이 CAST_EXECUTE 를 유발한 카드 인스턴스 id
   * - burn this 등에서 instance 지정이 필요할 때 사용
   */
  sourceInstanceId?: CardInstanceId;
}

export interface TriggeredEffect extends BaseEffect {
  type: 'TRIGGERED_EFFECT';
  cardId: CardID;
  trigger: string;
  effectRef: unknown;
  context?: unknown;
}

export interface ManaPayEffect extends BaseEffect {
  type: 'MANA_PAY';
  amount: number;
}

export interface ManaGainEffect extends BaseEffect {
  type: 'MANA_GAIN';
  value: number;
  target: 'self' | 'enemy';
}

// ---- 카드 효과 기반 Effect ----

export interface DamageEffect extends BaseEffect {
  type: 'DAMAGE';
  value: number | string;
  target: 'enemy' | 'near_enemy' | 'self';
  range?: number;
  condition?: string;
  /**
   * 선택형 데미지 모드 (예: select_damage_target 사용 시)
   */
  selectMode?: 'choose_target';
  /**
   * select_damage_target 처리 후, 고정된 대상 위치
   */
  pos?: { r: number; c: number };
}

export interface HealEffect extends BaseEffect {
  type: 'HEAL';
  value: number;
  target: 'self' | 'enemy';
  condition?: string;
}

export interface DrawEffect extends BaseEffect {
  type: 'DRAW';
  value: number;
  target: 'self' | 'enemy';
}

export interface DrawCataEffect extends BaseEffect {
  type: 'DRAW_CATA';
  value: number;
  condition?: string;
}

/**
 * resolveStack 에 쌓인 카드 인스턴스를 최종 위치로 이동시키는 내부 이펙트.
 */
export interface ThrowResolveStackEffect extends BaseEffect {
  type: 'THROW_RESOLVE_STACK';
}

export interface DiscardEffect extends BaseEffect {
  type: 'DISCARD';
  value: number;
  target: 'enemy' | 'self';
  /**
   * discard 동작 방식
   * - deck_random / deck_top / hand_random / hand_choose : 카드 효과 JSON에서 오는 공용 모드
   * - instance : 엔진 내부에서 특정 인스턴스를 지정해서 버릴 때 사용
   * - hand_max : 엔진 내부에서 손패 최대 개수를 강제할 때 사용
   */
  method:
    | 'deck_random'
    | 'deck_top'
    | 'hand_choose'
    | 'hand_random'
    | 'instance'
    | 'hand_max';
  condition?: string;
  /** method === 'instance' 인 경우, 어떤 인스턴스를 버릴지 지정 */
  instanceId?: CardInstanceId;
}

export interface BurnEffect extends BaseEffect {
  type: 'BURN';
  target: 'self' | 'enemy';
  /**
   * burn 동작 방식
   * - deck_random / deck_top : 카드 효과 JSON에서 오는 공용 모드
   * - instance : 엔진 내부에서 특정 인스턴스를 지정해서 소멸시킬 때 사용
   */
  method?:
    | 'deck_random'
    | 'deck_top'
    | 'hand_choose'
    | 'hand_random'
    | 'instance';
  value?: number;
  condition?: string;
  /** 카드 효과로 사용된 경우, 소스 카드 id (필요 시 burn this 등에서 사용) */
  cardId?: CardID;
  /** method === 'instance' 인 경우, 어떤 인스턴스를 소멸시킬지 지정 */
  instanceId?: CardInstanceId;
  /** 선택형 burn 모드 (예: choose_burn 사용 시) */
  selectMode?: 'choose';
}

/**
 * 플레이어 입력(choose_discard / choose_move / choose_burn 등)을
 * 실제 게임 행위 이펙트들로 변환하기 위한 내부용 이펙트.
 *
 * - 여기서는 상태를 바로 바꾸지 않고,
 *   MOVE / DISCARD / BURN 등의 실제 이펙트들을 다시 push 한다.
 */
export interface ResolvePlayerInputEffect extends BaseEffect {
  type: 'RESOLVE_PLAYER_INPUT';
  kind:
    | { type: 'option'; kind: 'choose_discard' }
    | { type: 'option'; kind: 'choose_burn' }
    | { type: 'map'; kind: 'select_damage_target' }
    | { type: 'map'; kind: 'choose_move_direction' };
  /**
   * 클라이언트에서 전달된 원본 answer.
   * (예: CardInstance 배열, 좌표 등)
   */
  answer: unknown;
  /** 필요 시 추가 메타데이터 (원본 pendingInput 정보 등) */
  meta?: unknown;
}

// ---- 통합 Effect union ----

export type Effect =
  | BaseEffect
  | TurnStartEffect
  | TurnEndEffect
  | ChangeTurnEffect
  | MoveEffect
  | InstallEffect
  | CastExecuteEffect
  | TriggeredEffect
  | ManaPayEffect
  | ManaGainEffect
  | DamageEffect
  | HealEffect
  | DrawEffect
  | DrawCataEffect
  | ThrowResolveStackEffect
  | DiscardEffect
  | BurnEffect
  | ResolvePlayerInputEffect;

export interface EngineLogEntry {
  turn: number;
  text: string;
  actor?: PlayerID | null;
  timestamp?: number;
}
