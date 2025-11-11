import { supabase } from "../lib/supabase";
import { coerceDeckList, DeckList } from "../type/deck";

export type DeckRow = {
  id: string;
  user_id: string;
  name: string;
  main_cards: DeckList;
  cata_cards: DeckList;
  deleted: boolean;
  created_at?: string;
  updated_at?: string;
};

export const decksService = {
  async validateAndHydrate(
    main: Array<{ id: string; count: number }>,
    cata: Array<{ id: string; count: number }>
  ): Promise<{ main: DeckList; cata: DeckList }> {
    // count 범위 체크 및 합계 검증
    const isValidCount = (n: number) => typeof n === "number" && Number.isFinite(n) && (n === 1 || n === 2);
    if (!Array.isArray(main) || !Array.isArray(cata)) throw new Error("invalid deck payload");
    if (!main.every((e) => typeof e.id === "string" && isValidCount(e.count))) throw new Error("invalid main_cards entries");
    if (!cata.every((e) => typeof e.id === "string" && isValidCount(e.count))) throw new Error("invalid cata_cards entries");

    const mainCountSum = main.reduce((s, e) => s + e.count, 0);
    const cataCountSum = cata.reduce((s, e) => s + e.count, 0);
    if (mainCountSum !== 16) throw new Error("main_cards must contain exactly 16 cards");
    if (cataCountSum !== 4) throw new Error("cata_cards must contain exactly 4 cards");

    // 카드 조회 (중복 제거 후 일괄 조회)
    const ids = Array.from(new Set([...main.map((e) => e.id), ...cata.map((e) => e.id)]));

    const { data, error } = await supabase
      .from("cards")
      .select("id,name_dev,name_ko,description_ko,type,mana,token")
      .in("id", ids);
    if (error) throw error;
    const byId = new Map<string, { id: string; name_dev: string; name_ko: string; description_ko: string | null; type: DeckList[number]["type"]; mana: number | null; token: boolean }>();
    for (const row of data ?? []) byId.set(row.id, row as any);

    // 공통 제약: token=false
    const ensureRow = (id: string) => {
      const row = byId.get(id);
      if (!row) throw new Error(`card not found: ${id}`);
      if (row.token === true) throw new Error(`token card not allowed: ${id}`);
      return row;
    };

    // main: type !== catastrophe
    const hydratedMain: DeckList = main.map((e) => {
      const row = ensureRow(e.id);
      if (row.type === "catastrophe") throw new Error(`catastrophe not allowed in main: ${e.id}`);
      return {
        id: e.id,
        count: e.count,
        name_dev: row.name_dev,
        name_ko: row.name_ko,
        description_ko: row.description_ko,
        type: row.type as any,
        mana: row.mana,
      };
    });

    // cata: type === catastrophe
    const hydratedCata: DeckList = cata.map((e) => {
      const row = ensureRow(e.id);
      if (row.type !== "catastrophe") throw new Error(`only catastrophe allowed in cata: ${e.id}`);
      return {
        id: e.id,
        count: e.count,
        name_dev: row.name_dev,
        name_ko: row.name_ko,
        description_ko: row.description_ko,
        type: row.type as any,
        mana: row.mana,
      };
    });

    return { main: hydratedMain, cata: hydratedCata };
  },
  async listByUser(userId: string): Promise<DeckRow[]> {
    const { data, error } = await supabase
      .from("decks")
      .select("id,user_id,name,main_cards,cata_cards,deleted,created_at,updated_at")
      .eq("user_id", userId)
      .eq("deleted", false)
      .order("created_at", { ascending: false });
    if (error) throw error;
    const rows = (data ?? []) as Array<Omit<DeckRow, "main_cards" | "cata_cards"> & {
      main_cards: unknown;
      cata_cards: unknown;
    }>;
    return rows.map((r) => ({
      ...r,
      main_cards: coerceDeckList(r.main_cards),
      cata_cards: coerceDeckList(r.cata_cards),
    }));
  },
  async create(
    userId: string,
    name: string,
    payload: { main_cards: DeckList; cata_cards: DeckList }
  ) {
    const toInsert = { user_id: userId, name, main_cards: payload.main_cards, cata_cards: payload.cata_cards };
    const { data, error } = await supabase.from("decks").insert(toInsert).select("*").single();
    if (error) throw error;
    return data as DeckRow;
  },
  async update(
    deckId: string,
    attrs: Pick<DeckRow, "name"> & { main_cards: DeckList; cata_cards: DeckList }
  ) {
    const next: Record<string, unknown> = {};
    next.name = attrs.name;
    next.main_cards = coerceDeckList(attrs.main_cards);
    next.cata_cards = coerceDeckList(attrs.cata_cards);
    const { data, error } = await supabase.from("decks").update(next).eq("id", deckId).select("*").single();
    if (error) throw error;
    return data as DeckRow;
  },
  async softDelete(deckId: string) {
    const { error } = await supabase.from("decks").update({ deleted: true }).eq("id", deckId);
    if (error) throw error;
  },
  async getById(deckId: string): Promise<DeckRow | null> {
    const { data, error } = await supabase.from("decks").select("*").eq("id", deckId).maybeSingle();
    if (error) throw error;
    if (!data) return null;
    const row = data as Omit<DeckRow, "main_cards" | "cata_cards"> & { main_cards: unknown; cata_cards: unknown };
    return {
      ...row,
      main_cards: coerceDeckList(row.main_cards),
      cata_cards: coerceDeckList(row.cata_cards),
    };
  },
};
