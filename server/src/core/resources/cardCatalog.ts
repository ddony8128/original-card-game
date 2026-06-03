import type { CardID } from '../../type/gameState';
import { cardsService, type CardRow } from '../../services/cards';
import type { CardMeta } from '../context';

/**
 * 카드 카탈로그 리소스.
 *
 * 카드 정보(텍스트/타입/마나/effectJson)는 플레이 도중 바뀌지 않는 리소스이므로,
 * 매 조회마다 DB 를 치지 않고 서버 메모리에 한 번만 적재해 들고 있는다(<1MB).
 * 게임 엔진의 lookupCard 는 이 카탈로그에서 동기적으로 카드를 찾는다.
 */

function rowToMeta(row: CardRow): CardMeta {
  return {
    id: row.id as CardID,
    name_dev: row.name_dev,
    name_ko: row.name_ko,
    name_en: row.name_en,
    description_ko: row.description_ko,
    description_en: row.description_en,
    type: row.type,
    mana: row.mana,
    token: row.token,
    effectJson: row.effect_json,
  };
}

let catalog: Map<CardID, CardMeta> | null = null;
let loadingPromise: Promise<Map<CardID, CardMeta>> | null = null;

/**
 * 카탈로그를 1회 로드해 메모리에 적재한다(이미 로드됐으면 즉시 반환).
 * 동시 호출(여러 게임 동시 시작)에도 단 한 번만 DB 를 조회하도록 promise 를 공유한다.
 */
export async function ensureCardCatalog(): Promise<Map<CardID, CardMeta>> {
  if (catalog) return catalog;
  if (!loadingPromise) {
    loadingPromise = (async () => {
      const rows = await cardsService.listAll();
      const loaded = new Map<CardID, CardMeta>();
      for (const row of rows) loaded.set(row.id as CardID, rowToMeta(row));
      catalog = loaded;
      return loaded;
    })();
  }
  return loadingPromise;
}

/** 적재된 카탈로그에서 카드 메타를 동기 조회한다(미적재/미존재 시 null). */
export function getCardMeta(id: CardID): CardMeta | null {
  return catalog?.get(id) ?? null;
}

export function isCardCatalogLoaded(): boolean {
  return catalog !== null;
}

/** 테스트/리로드용: 적재 상태를 초기화한다. */
export function resetCardCatalog(): void {
  catalog = null;
  loadingPromise = null;
}
