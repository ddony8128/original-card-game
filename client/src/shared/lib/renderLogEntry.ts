import type { TFunction } from 'i18next';
import type { ClientSideActionLog, PlayerID } from '@/shared/types/game';
import type { GameCardMeta } from '@/shared/store/cardMetaStore';

/**
 * 구조화 로그 엔트리({ code, params })를 현재 언어 문자열로 렌더한다.
 *
 * - params 의 `p`/`p2`(플레이어 id)는 뷰어 기준 "나"/"상대"(game.logSelf/logOpponent)로 치환.
 * - params 의 `c`(cardId)는 현재 언어로 해석된 카드 이름으로 치환.
 * - 카드 이동/소멸/마법진 사용 로그는 카드 설명을 ` (설명)` 형태의 suffix(`desc`)로 덧붙인다
 *   (서버는 cardId 만 보내고, 설명은 클라가 card meta 에서 현재 언어로 가져온다).
 * - 최종적으로 `t('gamelog.' + code, mappedParams)` 를 반환한다.
 *
 * 결과는 React 가 텍스트로 렌더하며 DOM 이스케이프를 담당하므로,
 * 여기서는 i18next 의 추가 HTML 이스케이프를 끄고 원본 문구를 그대로 보존한다.
 */

/** 카드 설명 suffix(` (설명)`)를 붙이는 코드 목록. */
const DESC_SUFFIX_CODES = new Set([
  'card_to_grave',
  'cata_card_to_grave',
  'card_to_hand',
  'card_to_board',
  'card_burned_full',
  'ritual_use',
]);

export interface RenderLogEntryDeps {
  myId: PlayerID | undefined;
  t: TFunction;
  getCardMeta: (id: string) => GameCardMeta | undefined;
}

export function renderLogEntry(
  entry: Pick<ClientSideActionLog, 'code' | 'params'>,
  { myId, t, getCardMeta }: RenderLogEntryDeps,
): string {
  const mapped: Record<string, string | number> = { ...(entry.params ?? {}) };

  // 플레이어 id → 나/상대
  const mapPlayer = (key: 'p' | 'p2') => {
    const id = entry.params?.[key];
    if (id === undefined) return;
    mapped[key] =
      id === myId ? t('game.logSelf') : t('game.logOpponent');
  };
  mapPlayer('p');
  mapPlayer('p2');

  // cardId → 현재 언어 카드 이름
  const cardId = entry.params?.c;
  let cardMeta: GameCardMeta | undefined;
  if (cardId !== undefined) {
    cardMeta = getCardMeta(String(cardId));
    mapped.c = cardMeta?.name ?? String(cardId);
  }

  // 카드 설명 suffix
  if (DESC_SUFFIX_CODES.has(entry.code)) {
    const desc = cardMeta?.description;
    mapped.desc = desc ? ` (${desc})` : '';
  }

  return t(`gamelog.${entry.code}`, {
    ...mapped,
    interpolation: { escapeValue: false },
  }) as string;
}
