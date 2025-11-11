import { supabase } from "../lib/supabase";
import { Json, coerceJson } from "../type/json";

export type CardRow = {
  id: string;
  name_dev: string;
  name_ko: string;
  description_ko: string | null;
  type: "instant" | "ritual" | "catastrophe" | "summon" | "item";
  mana: number | null;
  token: boolean;
  effect_json: Json | null;
};

export const cardsService = {
  async listAll(): Promise<CardRow[]> {
    const { data, error } = await supabase.from("cards").select("*");
    if (error) throw error;
    const rows = (data ?? []) as Array<Omit<CardRow, "effect_json"> & { effect_json: unknown }>;
    return rows.map((r) => ({ ...r, effect_json: coerceJson(r.effect_json) }));
  },

  async getById(id: string): Promise<CardRow | null> {
    const { data, error } = await supabase.from("cards").select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    if (!data) return null;
    const row = data as Omit<CardRow, "effect_json"> & { effect_json: unknown };
    return { ...row, effect_json: coerceJson(row.effect_json) };
  },

  async list(params: {
    mana?: number;
    name?: string;
    token?: boolean;
    type?: CardRow["type"];
    page?: number;
    limit?: number;
  }): Promise<{
    items: CardRow[];
    total: number;
    page: number;
    limit: number;
  }> {
    const paginate = !(params.page === undefined && params.limit === undefined);
    const page = paginate ? Math.max(1, Number(params.page ?? 1)) : 1;
    const limit = paginate ? Math.min(3000, Math.max(1, Number(params.limit ?? 20))) : 0;
    const from = paginate ? (page - 1) * limit : 0;
    const to = paginate ? from + limit - 1 : 0;

    let query = supabase
      .from("cards")
      .select("*", { count: "exact" })
      .order("mana", { ascending: true, nullsFirst: true })
      .order("name_ko", { ascending: true });

    if (typeof params.mana === "number" && Number.isFinite(params.mana)) {
      query = query.eq("mana", params.mana);
    }

    if (params.name && params.name.trim() !== "") {
      const q = params.name.trim();
      // name_dev 또는 name_ko 에 대해 부분 일치
      query = query.or(
        `name_dev.ilike.%${q.replaceAll(".", "").replaceAll("%", "")}%,name_ko.ilike.%${q
          .replaceAll(".", "")
          .replaceAll("%", "")}%`
      );
    }

    if (typeof params.token === "boolean") {
      query = query.eq("token", params.token);
    }

    if (params.type) {
      query = query.eq("type", params.type);
    }

    const { data, error, count } = paginate ? await query.range(from, to) : await query;
    if (error) throw error;
    const rows = (data ?? []) as Array<Omit<CardRow, "effect_json"> & { effect_json: unknown }>;
    return {
      items: rows.map((r) => ({ ...r, effect_json: coerceJson(r.effect_json) })),
      total: count ?? rows.length,
      page,
      limit: paginate ? limit : rows.length,
    };
  },
};
