import type { FoggedGameState, PlayerID, CardInstance } from './gameState';

// ---- 공통 기본 타입 ----

export type WsEventBase<E extends string, D> = {
  event: E;
  data: D;
};

// ---- 서버 → 클라이언트 이벤트 ----

export type ServerToClientEvent =
  | 'game_init'
  | 'ask_mulligan'
  | 'state_patch'
  | 'request_input'
  | 'invalid_action'
  | 'game_over';

// 애니메이션 / diff 패치 타입

export type AnimationPlayer = 'you' | 'opponent' | 'shared' | string;

export type AnimationKind =
  | 'draw'
  | 'move'
  | 'damage'
  | 'heal'
  | 'discard'
  | 'burn'
  | 'ritual_place'
  | 'ritual_destroy'
  | 'shuffle'
  | (string & {}); // 확장 가능성을 위해

export interface AnimationSpec {
  kind: AnimationKind;
  player?: AnimationPlayer;
  amount?: number;
  from?: [number, number];
  to?: [number, number];
  // 필요시 추가 메타데이터
  [key: string]: unknown;
}

export interface DiffPatch {
  animations: AnimationSpec[];
  log: string[];
}

// 서버 → 클라 개별 페이로드

export interface GameInitPayload {
  state: FoggedGameState;
  version: number;
}

export interface AskMulliganPayload {
  initialHand: CardInstance[];
}

export interface StatePatchPayload {
  version: number;
  fogged_state: FoggedGameState;
  diff_patch: DiffPatch;
}

export type RequestInputKind =
  | { type: 'map'; kind: 'select_install_position' }
  | { type: 'map'; kind: 'select_damage_target' }
  | { type: 'map'; kind: 'select_ritual_target' }
  | { type: 'option'; kind: 'choose_discard' }
  | { type: 'option'; kind: 'choose_burn' }
  | { type: 'map'; kind: 'choose_move_direction' }
  | { type: 'text'; kind: string };

export interface RequestInputPayload {
  kind: RequestInputKind;
  options: unknown[];
}

export interface InvalidActionPayload {
  reason:
    | 'not_enough_mana'
    | 'invalid_target'
    | 'not_your_turn'
    | 'invalid_state'
    | (string & {});
}

export interface GameOverPayload {
  winner: PlayerID | 'draw' | null;
  reason: 'hp_zero' | 'surrender' | 'timeout' | (string & {});
}

export interface ServerToClientPayloadMap {
  game_init: GameInitPayload;
  ask_mulligan: AskMulliganPayload;
  state_patch: StatePatchPayload;
  request_input: RequestInputPayload;
  invalid_action: InvalidActionPayload;
  game_over: GameOverPayload;
}

export type ServerToClientMessage = {
  [E in ServerToClientEvent]: WsEventBase<E, ServerToClientPayloadMap[E]>;
}[ServerToClientEvent];

// ---- 클라이언트 → 서버 이벤트 ----

export type ClientToServerEvent =
  | 'ready'
  | 'answer_mulligan'
  | 'player_action'
  | 'player_input';

export interface ReadyPayload {
  roomCode: string;
  userId: string;
}

export interface AnswerMulliganPayload {
  replaceIndices: number[];
}

export type PlayerActionKind =
  | 'use_card'
  | 'use_ritual'
  | 'move'
  | 'end_turn'
  | 'surrender'
  | (string & {});

export interface PlayerActionPayloadBase {
  action: PlayerActionKind;
}

export interface UseCardActionPayload extends PlayerActionPayloadBase {
  action: 'use_card';
  cardInstance: CardInstance;
  target?: [number, number];
}

export interface MoveActionPayload extends PlayerActionPayloadBase {
  action: 'move';
  to: [number, number];
}

export interface EndTurnActionPayload extends PlayerActionPayloadBase {
  action: 'end_turn';
}

export interface SurrenderActionPayload extends PlayerActionPayloadBase {
  action: 'surrender';
}

export type PlayerActionPayload =
  | UseCardActionPayload
  | MoveActionPayload
  | EndTurnActionPayload
  | SurrenderActionPayload
  | (PlayerActionPayloadBase & Record<string, unknown>); // 확장용

export interface PlayerInputPayload {
  answer: unknown;
}

export interface ClientToServerPayloadMap {
  ready: ReadyPayload;
  answer_mulligan: AnswerMulliganPayload;
  player_action: PlayerActionPayload;
  player_input: PlayerInputPayload;
}

export type ClientToServerMessage = {
  [E in ClientToServerEvent]: WsEventBase<E, ClientToServerPayloadMap[E]>;
}[ClientToServerEvent];
