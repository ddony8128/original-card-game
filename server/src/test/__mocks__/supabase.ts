// Minimal in-memory Supabase mock for route tests
import crypto from 'node:crypto';

type TableName =
  | 'users'
  | 'cards'
  | 'decks'
  | 'rooms'
  | 'game_results'
  | 'game_turn_logs'
  | 'reviews';

type Row = Record<string, any>;

const tables: Record<TableName, Row[]> = {
  users: [],
  cards: [],
  decks: [],
  rooms: [],
  game_results: [],
  game_turn_logs: [],
  reviews: [],
};

// Seed cards for filtering and deck validation (requested list)
if (tables.cards.length === 0) {
  const base: Row[] = [
    {
      id: 'c01-001',
      name_dev: 'mana_battery',
      name_ko: '마나 보조 배터리',
      description_ko: '마나를 하나 얻습니다.',
      type: 'instant',
      mana: 0,
      token: false,
      effect_json: {
        type: 'instant',
        triggers: [
          {
            effects: [{ type: 'managain', value: 1, target: 'self' }],
            trigger: 'onCast',
          },
        ],
      },
    },
    {
      id: 'c01-002',
      name_dev: 'pierce_with_mana',
      name_ko: '마나가 담긴 찌르기',
      description_ko: '거리 1 내에 피해를 2 줍니다.',
      type: 'instant',
      mana: 0,
      token: false,
      effect_json: {
        type: 'instant',
        triggers: [
          {
            effects: [
              { type: 'damage', range: 1, value: 2, target: 'near_enemy' },
            ],
            trigger: 'onCast',
          },
        ],
      },
    },
    {
      id: 'c01-003',
      name_dev: 'breath_focus',
      name_ko: '운기조식',
      description_ko: '내 마법사가 3 피해를 회복합니다.',
      type: 'instant',
      mana: 0,
      token: false,
      effect_json: {
        type: 'instant',
        triggers: [
          {
            effects: [{ type: 'heal', value: 3, target: 'self' }],
            trigger: 'onCast',
          },
        ],
      },
    },
    {
      id: 'c01-004',
      name_dev: 'leg_muscle_boost',
      name_ko: '각력 강화',
      description_ko: '1칸 이동합니다.',
      type: 'instant',
      mana: 0,
      token: false,
      effect_json: {
        type: 'instant',
        triggers: [
          {
            effects: [
              { type: 'move', value: 1, target: 'self', direction: 'choose' },
            ],
            trigger: 'onCast',
          },
        ],
      },
    },
    {
      id: 'c01-005',
      name_dev: 'intruder_sensor',
      name_ko: '침입자 감지',
      description_ko:
        '거리 2 내에 설치. 파괴되면 카드를 한 장 뽑고 적 마법사에게 2 피해를 줍니다.',
      type: 'ritual',
      mana: 0,
      token: false,
      effect_json: {
        type: 'ritual',
        install: { range: 2 },
        triggers: [
          {
            effects: [
              { type: 'draw', value: 1, target: 'self' },
              { type: 'damage', value: 2, target: 'enemy' },
            ],
            trigger: 'onDestroy',
          },
        ],
      },
    },
    {
      id: 'c01-006',
      name_dev: 'magic_bolt',
      name_ko: '마력탄',
      description_ko: '거리 2 내에 피해를 3 줍니다.',
      type: 'instant',
      mana: 1,
      token: false,
      effect_json: {
        type: 'instant',
        triggers: [
          {
            effects: [
              { type: 'damage', range: 2, value: 3, target: 'near_enemy' },
            ],
            trigger: 'onCast',
          },
        ],
      },
    },
    {
      id: 'c01-007',
      name_dev: 'chicken_game',
      name_ko: '치킨 게임',
      description_ko:
        '상대 덱에서 무작위로 8장을 버리고, 내가 재앙카드를 한 장 뽑습니다.',
      type: 'instant',
      mana: 1,
      token: true,
      effect_json: {
        type: 'instant',
        triggers: [
          {
            effects: [
              {
                type: 'discard',
                value: 8,
                method: 'deck_random',
                target: 'enemy',
              },
              { type: 'cata_draw', value: 1, target: 'self' },
            ],
            trigger: 'onCast',
          },
        ],
      },
    },
    {
      id: 'c01-008',
      name_dev: 'reading_time',
      name_ko: '독서의 시간',
      description_ko: '2장을 뽑고, 1장을 선택해 버립니다.',
      type: 'instant',
      mana: 1,
      token: false,
      effect_json: {
        type: 'instant',
        triggers: [
          {
            effects: [
              { type: 'draw', value: 2, target: 'self' },
              {
                type: 'discard',
                value: 1,
                method: 'hand_choose',
                target: 'self',
              },
            ],
            trigger: 'onCast',
          },
        ],
      },
    },
    {
      id: 'c01-009',
      name_dev: 'magic_sniper',
      name_ko: '마력 저격',
      description_ko: '거리 4 내에 피해를 2 줍니다.',
      type: 'instant',
      mana: 1,
      token: false,
      effect_json: {
        type: 'instant',
        triggers: [
          {
            effects: [
              { type: 'damage', range: 4, value: 2, target: 'near_enemy' },
            ],
            trigger: 'onCast',
          },
        ],
      },
    },
    {
      id: 'c01-010',
      name_dev: 'installed_voodoo_doll',
      name_ko: '설치형 저주인형',
      description_ko:
        '거리 2 내에 설치. 턴 종료 시와 파괴 시 적 마법사에게 각각 1 피해를 줍니다.',
      type: 'ritual',
      mana: 1,
      token: false,
      effect_json: {
        type: 'ritual',
        install: { range: 2 },
        triggers: [
          {
            effects: [{ type: 'damage', value: 1, target: 'enemy' }],
            trigger: 'onTurnEnd',
          },
          {
            effects: [{ type: 'damage', value: 1, target: 'enemy' }],
            trigger: 'onDestroy',
          },
        ],
      },
    },
    {
      id: 'c99-001',
      name_dev: 'meteor_fall',
      name_ko: '대재앙: 운석 낙하',
      description_ko: '운석이 떨어진다.',
      type: 'catastrophe',
      mana: null,
      token: false,
      effect_json: { type: 'catastrophe' },
    },
    {
      id: 'c99-002',
      name_dev: 'earthquake',
      name_ko: '대재앙: 지진',
      description_ko: '땅이 흔들린다.',
      type: 'catastrophe',
      mana: null,
      token: false,
      effect_json: { type: 'catastrophe' },
    },
    {
      id: 'c99-003',
      name_dev: 'plague',
      name_ko: '대재앙: 역병',
      description_ko: '역병이 번진다.',
      type: 'catastrophe',
      mana: null,
      token: false,
      effect_json: { type: 'catastrophe' },
    },
    {
      id: 'c99-004',
      name_dev: 'time_distortion',
      name_ko: '대재앙: 시간 왜곡',
      description_ko: '시간이 왜곡된다.',
      type: 'catastrophe',
      mana: null,
      token: false,
      effect_json: { type: 'catastrophe' },
    },
  ];
  tables.cards.push(...base);
}

function applyFilters(rows: Row[], filters: any[]): Row[] {
  let out = rows.slice();
  for (const f of filters) {
    if (f.op === 'eq') {
      out = out.filter((r) => r[f.col] === f.val);
    } else if (f.op === 'in') {
      out = out.filter((r) => (f.vals as any[]).includes(r[f.col]));
    } else if (f.op === 'or_ilike') {
      // expr like: name_dev.ilike.%q%,name_ko.ilike.%q%
      const m = /name_dev\.ilike\.%(.+)%.*,name_ko\.ilike\.%(.+)%/.exec(f.expr);
      if (m) {
        const q = (m[1] || '').toLowerCase();
        out = out.filter(
          (r) =>
            String(r.name_dev ?? '')
              .toLowerCase()
              .includes(q) ||
            String(r.name_ko ?? '')
              .toLowerCase()
              .includes(q),
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
  const base: any = { id: payload.id ?? crypto.randomUUID(), ...payload };
  const now = new Date().toISOString();
  if (table === 'decks') {
    if (base.deleted === undefined) base.deleted = false;
    if (base.created_at === undefined) base.created_at = now;
    if (base.updated_at === undefined) base.updated_at = now;
  }
  const row = base;
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
    const ctx: any = {
      table,
      filters: [],
      range: null,
      selectCount: false,
      lastRow: null,
      lastRows: null,
    };
    const api: any = {
      then(onFulfilled: (v: any) => any) {
        const { rows, count } = runQuery(ctx);
        return Promise.resolve(onFulfilled({ data: rows, error: null, count }));
      },
      select(_cols?: string, opts?: { count?: 'exact' }) {
        ctx.selectCount = !!opts?.count;
        return api;
      },
      eq(col: string, val: any) {
        ctx.filters.push({ op: 'eq', col, val });
        return api;
      },
      in(col: string, vals: any[]) {
        ctx.filters.push({ op: 'in', col, vals });
        return api;
      },
      or(expr: string) {
        ctx.filters.push({ op: 'or_ilike', expr });
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
export function __getTables() {
  return tables;
}
