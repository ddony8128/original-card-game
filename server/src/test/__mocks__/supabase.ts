// Minimal in-memory Supabase mock for route tests
import crypto from "node:crypto";

type TableName = "users" | "cards" | "decks" | "rooms" | "game_results" | "game_turn_logs";

type Row = Record<string, any>;

const tables: Record<TableName, Row[]> = {
  users: [],
  cards: [],
  decks: [],
  rooms: [],
  game_results: [],
  game_turn_logs: [],
};

// Seed some cards for filtering and deck validation
if (tables.cards.length === 0) {
  const make = (p: Partial<Row>) => ({
    id: p.id!,
    name_dev: p.name_dev ?? p.id,
    name_ko: p.name_ko ?? p.id,
    description_ko: p.description_ko ?? null,
    type: p.type ?? "instant",
    mana: p.mana ?? 0,
    token: p.token ?? false,
    effect_json: p.effect_json ?? null,
  });
  const base: Row[] = [
    make({ id: "c01-001", name_dev: "mana_battery", name_ko: "마나 보조 배터리", type: "instant", mana: 0 }),
    make({ id: "c01-002", type: "instant", mana: 0 }),
    make({ id: "c01-003", type: "instant", mana: 1 }),
    make({ id: "c01-004", type: "ritual", mana: 2 }),
    make({ id: "c01-005", type: "summon", mana: 3 }),
    make({ id: "c01-006", type: "item", mana: 1 }),
    make({ id: "c01-007", type: "instant", mana: 0, token: true }),
    make({ id: "c99-001", type: "catastrophe", mana: null }),
    make({ id: "c99-002", type: "catastrophe", mana: null }),
    make({ id: "c99-003", type: "catastrophe", mana: null }),
    make({ id: "c99-004", type: "catastrophe", mana: null }),
  ];
  tables.cards.push(...base);
}

function applyFilters(rows: Row[], filters: any[]): Row[] {
  let out = rows.slice();
  for (const f of filters) {
    if (f.op === "eq") {
      out = out.filter((r) => r[f.col] === f.val);
    } else if (f.op === "in") {
      out = out.filter((r) => (f.vals as any[]).includes(r[f.col]));
    } else if (f.op === "or_ilike") {
      // expr like: name_dev.ilike.%q%,name_ko.ilike.%q%
      const m = /name_dev\.ilike\.%(.+)%.*,name_ko\.ilike\.%(.+)%/.exec(f.expr);
      if (m) {
        const q = (m[1] || "").toLowerCase();
        out = out.filter(
          (r) => String(r.name_dev ?? "").toLowerCase().includes(q) || String(r.name_ko ?? "").toLowerCase().includes(q)
        );
      }
    }
  }
  return out;
}

function runQuery(ctx: any): { rows: Row[]; count?: number } {
  const all = tables[ctx.table as TableName] ?? [];
  let rows = applyFilters(all, ctx.filters);
  // order: not strictly needed, but mimic
  // range: slice
  const count = ctx.selectCount ? rows.length : undefined;
  if (ctx.range) {
    rows = rows.slice(ctx.range.from, ctx.range.to + 1);
  }
  return { rows, count };
}

function insertRow(table: TableName, payload: any): Row {
  const row = { id: payload.id ?? crypto.randomUUID(), ...payload };
  tables[table].push(row);
  return row;
}

function updateRows(table: TableName, payload: any, filters: any[]): Row[] {
  const rows = applyFilters(tables[table], filters);
  rows.forEach((r) => Object.assign(r, payload));
  return rows;
}

export const supabase = {
  from(table: TableName) {
    const ctx: any = { table, filters: [], range: null, selectCount: false, lastRow: null, lastRows: null };
    const api: any = {
      then(onFulfilled: (v: any) => any) {
        const { rows, count } = runQuery(ctx);
        return Promise.resolve(onFulfilled({ data: rows, error: null, count }));
      },
      select(_cols?: string, opts?: { count?: "exact" }) {
        ctx.selectCount = !!opts?.count;
        return api;
      },
      eq(col: string, val: any) {
        ctx.filters.push({ op: "eq", col, val });
        return api;
      },
      in(col: string, vals: any[]) {
        ctx.filters.push({ op: "in", col, vals });
        return api;
      },
      or(expr: string) {
        ctx.filters.push({ op: "or_ilike", expr });
        return api;
      },
      order(_col: string) {
        return api;
      },
      range(from: number, to: number) {
        ctx.range = { from, to };
        return api;
      },
      async maybeSingle() {
        if (ctx.lastRow) return { data: ctx.lastRow, error: null } as any;
        const { rows } = runQuery(ctx);
        return { data: rows[0] ?? null, error: null } as any;
      },
      async single() {
        if (ctx.lastRow) return { data: ctx.lastRow, error: null } as any;
        const { rows } = runQuery(ctx);
        return { data: rows[0] ?? null, error: null } as any;
      },
      insert(payload: any) {
        const row = insertRow(ctx.table as TableName, payload);
        ctx.lastRow = row;
        return api;
      },
      update(payload: any) {
        const rows = updateRows(ctx.table as TableName, payload, ctx.filters);
        ctx.lastRows = rows;
        ctx.lastRow = rows[0] ?? null;
        return api;
      },
    };
    return api;
  },
};

export type __SupabaseMockTables = typeof tables;
export function __getTables() { return tables; }


