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
