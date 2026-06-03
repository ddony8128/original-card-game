/**
 * AI 행동 프로필(스테이지별 성격) 정의.
 *
 * 프로필은 기존 9단 휴리스틱 사다리 위에 얇게 얹히는 "파라미터 묶음"이다.
 * - default 프로필은 모든 override 가 비어 있어, 휴리스틱이 오늘과 100% 동일하게 동작한다.
 * - 각 스테이지 프로필은 todo-phase3.md "스테이지 AI 프로필" 의 플레이스타일을
 *   파라미터로 인코딩한다.
 *
 * chooseAIAction 은 이 파라미터들을 다음과 같이 해석한다:
 *  - holdUntilKill : 킬각(이번 턴 치사 데미지)이 아니면 해당 카드들을 후보에서 제외.
 *  - spamPriority  : 킬각이 아니고 affordable 하면 해당 카드를 최우선으로 사용.
 *  - prioritizeRituals : ritual 설치/사용을 일반 데미지보다 먼저 시도(킬각 제외).
 *  - aggressionManaThreshold : maxMana 가 임계 미만이면 버스트를 아끼고 셋업/거리유지.
 *  - preferredDistance : 마땅한 공격이 없을 때 이 거리 이상을 유지(접근 대신 후퇴/대기).
 *  - cycleCards    : 달리 할 게 없을 때 덱 사이클(힐/드로우)용으로 사용할 카드.
 */
export interface AIProfile {
  id: string;
  /** 킬각이 아닐 때 유지하려는 최소 거리. */
  preferredDistance?: number;
  /** maxMana 가 이 값 이상이 되기 전에는 버스트를 아끼고 셋업/거리유지를 선호. */
  aggressionManaThreshold?: number;
  /** 킬각이 아니면 절대 사용하지 않을 카드 id 목록. */
  holdUntilKill?: string[];
  /** affordable & 킬각 아닐 때 최우선으로 사용할 카드 id 목록(교란/엔진). */
  spamPriority?: string[];
  /** ritual 설치/사용을 셋업으로 우선시할지. */
  prioritizeRituals?: boolean;
  /** 달리 할 게 없을 때 덱 사이클용으로 사용할 힐/드로우 카드 id 목록. */
  cycleCards?: string[];
}

/** default = 현재 휴리스틱과 100% 동일(모든 override 비어 있음). */
const DEFAULT_PROFILE: AIProfile = { id: 'default' };

/**
 * stage-1 무투법사: 적정 거리 유지, 킬각 볼 때 버스트.
 * 마나담긴찌르기/각력강화/병주고약주기/카드날리기는 킬각에만 사용.
 */
const BRUISER_PROFILE: AIProfile = {
  id: 'bruiser',
  preferredDistance: 2,
  holdUntilKill: ['c01-002', 'c01-004', 'c01-024', 'c01-012'],
};

/**
 * stage-2 게임 개같이 하네: 킬각 없으면 치킨게임/게임개같이하네 스팸.
 * 당장 못 쓰면 3칸 이상 거리 유지.
 */
const DISRUPTOR_PROFILE: AIProfile = {
  id: 'disruptor',
  preferredDistance: 3,
  spamPriority: ['c01-007', 'c01-021'],
};

/**
 * stage-3 노루 약해요: 5마나 될 때까지 거리유지 / 지맥·지력흡수 설치.
 * 이후 좋은게임/전력질주/운기조식/독서로 사이클, 지진/운석 반복.
 */
const CONTROL_PROFILE: AIProfile = {
  id: 'control',
  preferredDistance: 3,
  aggressionManaThreshold: 5,
  prioritizeRituals: true,
  cycleCards: ['c01-027', 'c01-029', 'c01-003', 'c01-008'],
};

const PROFILES: Record<string, AIProfile> = {
  default: DEFAULT_PROFILE,
  bruiser: BRUISER_PROFILE,
  disruptor: DISRUPTOR_PROFILE,
  control: CONTROL_PROFILE,
};

/**
 * 프로필 id 로 프로필을 조회한다.
 * 알 수 없거나 미지정이면 default(=현재 동작) 를 반환한다.
 */
export function getProfile(profileId?: string): AIProfile {
  if (!profileId) return DEFAULT_PROFILE;
  return PROFILES[profileId] ?? DEFAULT_PROFILE;
}
