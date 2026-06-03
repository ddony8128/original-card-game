// 게임 규칙 상수 정의

// 보드 크기
export const BOARD_WIDTH = 5;
export const BOARD_HEIGHT = 5;

// 초기 플레이어 상태
export const INITIAL_HP = 20;
export const INITIAL_MAX_HP = 20;
export const INITIAL_MANA = 0;
export const INITIAL_MAX_MANA = 0;
export const MANA_CEILING = 5;
export const INITIAL_HAND_LIMIT = 6;

// 마나 관련 규칙
export const MOVE_MANA_COST = 1;
export const MANA_INC_PER_TURN = 1;

// 선후공 초기 드로우 (선공은 1장 덜 받는다)
export const FIRST_PLAYER_INITIAL_DRAW = 2;
export const SECOND_PLAYER_INITIAL_DRAW = 3;

// 턴 상한: 이 턴 수를 넘겨도 승부가 안 나면 무승부 처리한다(무한 교착 방지).
// state.turn 은 resolveChangeTurn 에서 플레이어 턴마다 +1 된다. 자기대전 측정상
// 실제 결판 게임의 천장이 ~68턴이라 80 은 정상 게임을 자르지 않는다.
export const MAX_GAME_TURNS = 80;
