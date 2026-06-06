import type { FoggedGameState, PlayerID, CardInstance } from '@/shared/types/game';

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
  | 'game_over'
  | 'chat';

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
  | 'card_play'
  | (string & {});

export interface AnimationSpec {
  kind: AnimationKind;
  player?: AnimationPlayer;
  amount?: number;
  from?: [number, number];
  to?: [number, number];
  [key: string]: unknown;
}

/**
 * 구조화된 게임 로그 1건. `code` 는 `gamelog.<code>` i18n 키, `params` 는 보간 변수.
 * 플레이어 id 는 `p`/`p2`, cardId 는 `c`, 수치는 `amount`, 좌표는 `r`/`cc` 등 원본 값.
 */
export interface LogEntry {
  code: string;
  params?: Record<string, string | number>;
}

export interface DiffPatch {
  animations: AnimationSpec[];
  log: LogEntry[];
}

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
  count?: number;
}

export interface InvalidActionPayload {
  reason: 'not_enough_mana' | 'invalid_target' | 'not_your_turn' | 'invalid_state' | (string & {});
}

export interface GameOverPayload {
  winner: PlayerID | 'draw' | null;
  reason: 'hp_zero' | 'surrender' | 'timeout' | (string & {});
}

// 대기실 실시간 채팅(서버 → 클라). DB 저장 없이 휘발성으로만 전파된다.
export interface ChatBroadcastPayload {
  userId: string;
  username: string;
  text: string;
}

export interface ServerToClientPayloadMap {
  game_init: GameInitPayload;
  ask_mulligan: AskMulliganPayload;
  state_patch: StatePatchPayload;
  request_input: RequestInputPayload;
  invalid_action: InvalidActionPayload;
  game_over: GameOverPayload;
  chat: ChatBroadcastPayload;
}

export type WsServerToClientMessage = {
  [E in ServerToClientEvent]: WsEventBase<E, ServerToClientPayloadMap[E]>;
}[ServerToClientEvent];

// ---- 클라이언트 → 서버 이벤트 ----

export type ClientToServerEvent =
  | 'ready'
  | 'start_solo'
  | 'set_solo_speed'
  | 'answer_mulligan'
  | 'player_action'
  | 'player_input'
  | 'join_chat'
  | 'chat';

export interface ReadyPayload {
  roomCode: string;
  userId?: string;
}

/** 솔로 게임 모드. tutorial = AI 가 사람 덱 클론 + default 프로필, pve = 스테이지 덱/프로필. */
export type SoloMode = 'tutorial' | 'pve';

/** AI 턴 진행 속도(사람이 AI 행동을 따라갈 수 있게 조절). */
export type SoloSpeed = 'slow' | 'normal' | 'fast';

// 싱글플레이(솔로 vs AI) 시작 요청
export interface StartSoloPayload {
  userId: string;
  deckId: string;
  /** 미지정 시 'tutorial'(기존 동작). 'pve' 면 stageId 의 스테이지 덱/프로필을 사용한다. */
  mode?: SoloMode;
  /** mode==='pve' 일 때 대상 스테이지 id. */
  stageId?: string;
  /** AI 턴 진행 속도(미지정 시 normal). */
  aiSpeed?: SoloSpeed;
}

// 진행 중인 솔로 게임의 AI 턴 속도를 실시간으로 변경
export interface SetSoloSpeedPayload {
  userId: string;
  aiSpeed: SoloSpeed;
}

// 채팅 전용 방 입장(게임 시작/ready 와 분리)
export interface JoinChatPayload {
  roomCode: string;
  userId?: string;
}

// 클라 → 서버 채팅 전송
export interface ChatPayload {
  text: string;
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
  | (PlayerActionPayloadBase & Record<string, unknown>);

export interface PlayerInputPayload {
  answer: unknown;
}

export interface ClientToServerPayloadMap {
  ready: ReadyPayload;
  start_solo: StartSoloPayload;
  set_solo_speed: SetSoloSpeedPayload;
  answer_mulligan: AnswerMulliganPayload;
  player_action: PlayerActionPayload;
  player_input: PlayerInputPayload;
  join_chat: JoinChatPayload;
  chat: ChatPayload;
}

export type WsClientToServerMessage = {
  [E in ClientToServerEvent]: WsEventBase<E, ClientToServerPayloadMap[E]>;
}[ClientToServerEvent];
