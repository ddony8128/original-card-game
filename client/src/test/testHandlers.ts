import { http, HttpResponse } from 'msw'

// helpers to match both relative and absolute URLs
const authMeMatchers = [
  '/api/auth/me',
  /https?:\/\/.*\/api\/auth\/me$/,
]
const matchStateMatchers = [
  '/api/match/:roomId',
  /https?:\/\/.*\/api\/match\/.+$/,
]

export const handlers = [
  // me
  ...authMeMatchers.map((m) =>
    http.get(m, () =>
      HttpResponse.json({ id: 'u1', username: 'tester', message: 'ok', created_at: new Date().toISOString() })
    )
  ),
  // match state (participant by default)
  ...matchStateMatchers.map((m) =>
    http.get(m, ({ params }) =>
      HttpResponse.json({
        roomId: (params as Record<string, string | undefined>).roomId ?? 'r1',
        status: 'waiting',
        host: { id: 'u1', username: 'tester' },
        guest: null,
      })
    )
  ),
  // cards list
  http.get('/api/cards', ({ request }) => {
    const url = new URL(request.url)
    const mana = url.searchParams.get('mana')
    const name = url.searchParams.get('name') || ''
    const cards = [
      { id: 'c1', name_dev: 'fire_dev', name_ko: '파이어볼', description_ko: '불덩이', type: 'instant', mana: 1 },
      { id: 'c2', name_dev: 'blaze_dev', name_ko: '블레이즈', description_ko: '강한 불', type: 'ritual', mana: 5 },
      { id: 'c3', name_dev: 'doom_dev', name_ko: '파멸', description_ko: '재앙', type: 'catastrophe', mana: 3 },
      { id: 'c4', name_dev: 'wind', name_ko: '질풍', description_ko: '', type: 'instant', mana: 1 },
      { id: 'c5', name_dev: 'ice', name_ko: '서리', description_ko: '', type: 'instant', mana: 2 },
      { id: 'c6', name_dev: 'spark', name_ko: '스파크', description_ko: '', type: 'instant', mana: 0 },
      { id: 'c7', name_dev: 'bolt', name_ko: '라이트닝', description_ko: '', type: 'instant', mana: 2 },
      { id: 'c8', name_dev: 'heal', name_ko: '치유', description_ko: '', type: 'ritual', mana: 2 },
      { id: 'c9', name_dev: 'shield', name_ko: '방패', description_ko: '', type: 'ritual', mana: 1 },
      { id: 'c10', name_dev: 'haste', name_ko: '신속', description_ko: '', type: 'ritual', mana: 1 },
      { id: 'c11', name_dev: 'freeze', name_ko: '빙결', description_ko: '', type: 'instant', mana: 3 },
      { id: 'c12', name_dev: 'quake', name_ko: '대지진', description_ko: '', type: 'catastrophe', mana: 5 },
      { id: 'c13', name_dev: 'tsunami', name_ko: '해일', description_ko: '', type: 'catastrophe', mana: 5 },
      { id: 'c14', name_dev: 'meteor', name_ko: '운석', description_ko: '', type: 'catastrophe', mana: 6 },
      { id: 'c15', name_dev: 'eruption', name_ko: '분화', description_ko: '', type: 'catastrophe', mana: 4 },
    ]
    const filtered = cards.filter(c => (mana ? (Number(mana) >= 5 ? (c.mana ?? 0) >= 5 : (c.mana ?? 0) === Number(mana)) : true) && c.name_ko.includes(name))
    return HttpResponse.json({ cards: filtered, total: filtered.length })
  }),
  http.get(/https?:\/\/.*\/api\/cards$/, ({ request }) => {
    const url = new URL(request.url)
    const mana = url.searchParams.get('mana')
    const name = url.searchParams.get('name') || ''
    const cards = [
      { id: 'c1', name_dev: 'fire_dev', name_ko: '파이어볼', description_ko: '불덩이', type: 'instant', mana: 1 },
      { id: 'c2', name_dev: 'blaze_dev', name_ko: '블레이즈', description_ko: '강한 불', type: 'ritual', mana: 5 },
      { id: 'c3', name_dev: 'doom_dev', name_ko: '파멸', description_ko: '재앙', type: 'catastrophe', mana: 3 },
      { id: 'c4', name_dev: 'wind', name_ko: '질풍', description_ko: '', type: 'instant', mana: 1 },
      { id: 'c5', name_dev: 'ice', name_ko: '서리', description_ko: '', type: 'instant', mana: 2 },
      { id: 'c6', name_dev: 'spark', name_ko: '스파크', description_ko: '', type: 'instant', mana: 0 },
      { id: 'c7', name_dev: 'bolt', name_ko: '라이트닝', description_ko: '', type: 'instant', mana: 2 },
      { id: 'c8', name_dev: 'heal', name_ko: '치유', description_ko: '', type: 'ritual', mana: 2 },
      { id: 'c9', name_dev: 'shield', name_ko: '방패', description_ko: '', type: 'ritual', mana: 1 },
      { id: 'c10', name_dev: 'haste', name_ko: '신속', description_ko: '', type: 'ritual', mana: 1 },
      { id: 'c11', name_dev: 'freeze', name_ko: '빙결', description_ko: '', type: 'instant', mana: 3 },
      { id: 'c12', name_dev: 'quake', name_ko: '대지진', description_ko: '', type: 'catastrophe', mana: 5 },
      { id: 'c13', name_dev: 'tsunami', name_ko: '해일', description_ko: '', type: 'catastrophe', mana: 5 },
      { id: 'c14', name_dev: 'meteor', name_ko: '운석', description_ko: '', type: 'catastrophe', mana: 6 },
      { id: 'c15', name_dev: 'eruption', name_ko: '분화', description_ko: '', type: 'catastrophe', mana: 4 },
    ]
    const filtered = cards.filter(c => (mana ? (Number(mana) >= 5 ? (c.mana ?? 0) >= 5 : (c.mana ?? 0) === Number(mana)) : true) && c.name_ko.includes(name))
    return HttpResponse.json({ cards: filtered, total: filtered.length })
  }),
  // decks list
  http.get('/api/decks', () => {
    return HttpResponse.json([
      {
        id: 'd1',
        name: '기본 덱',
        main_cards: [{ id: 'c1', count: 2, name_dev: 'fire_dev', name_ko: '파이어볼', description_ko: '불덩이', type: 'instant', mana: 1 }],
        cata_cards: [{ id: 'c3', count: 1, name_dev: 'doom_dev', name_ko: '파멸', description_ko: '재앙', type: 'catastrophe', mana: 3 }],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ])
  }),
  http.get(/https?:\/\/.*\/api\/decks$/, () => {
    return HttpResponse.json([
      {
        id: 'd1',
        name: '기본 덱',
        main_cards: [{ id: 'c1', count: 2, name_dev: 'fire_dev', name_ko: '파이어볼', description_ko: '불덩이', type: 'instant', mana: 1 }],
        cata_cards: [{ id: 'c3', count: 1, name_dev: 'doom_dev', name_ko: '파멸', description_ko: '재앙', type: 'catastrophe', mana: 3 }],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ])
  }),
  // decks delete failure example (can be overridden in tests)
  http.delete('/api/decks/fail', () => HttpResponse.json({ message: 'delete failed' }, { status: 500 })),
  // decks create/update/delete
  http.post('/api/decks', async ({ request }) => {
    const body = (await request.json()) as { name: string }
    return HttpResponse.json({ id: 'dx', name: body.name, main_cards: [], cata_cards: [], created_at: new Date().toISOString(), updated_at: new Date().toISOString() })
  }),
  http.post(/https?:\/\/.*\/api\/decks$/, async ({ request }) => {
    const body = (await request.json()) as { name: string }
    return HttpResponse.json({ id: 'dx', name: body.name, main_cards: [], cata_cards: [], created_at: new Date().toISOString(), updated_at: new Date().toISOString() })
  }),
  http.put('/api/decks/:deckId', async ({ request, params }) => {
    const body = (await request.json()) as { name: string; main_cards: unknown; cata_cards: unknown }
    const deckId = (params as { deckId?: string }).deckId ?? 'd1'
    return HttpResponse.json({ id: deckId, name: body.name, main_cards: body.main_cards, cata_cards: body.cata_cards, created_at: new Date().toISOString(), updated_at: new Date().toISOString() })
  }),
  http.delete('/api/decks/:deckId', () => HttpResponse.text(null, { status: 204 })),
  http.delete(/https?:\/\/.*\/api\/decks\/.+$/, () => HttpResponse.text(null, { status: 204 })),
  // match create/join/leave/deck
  http.post('/api/match/create', () => HttpResponse.json({ roomId: 'r1', status: 'waiting', host: { id: 'u1' } })),
  http.post(/https?:\/\/.*\/api\/match\/create$/, () => HttpResponse.json({ roomId: 'r1', status: 'waiting', host: { id: 'u1' } })),
  http.post('/api/match/join', async ({ request }) => {
    const { roomId } = (await request.json()) as { roomId: string }
    return HttpResponse.json({ roomId, status: 'waiting', host: { id: 'u1', username: 'tester' } })
  }),
  http.post(/https?:\/\/.*\/api\/match\/join$/, async ({ request }) => {
    const { roomId } = (await request.json()) as { roomId: string }
    return HttpResponse.json({ roomId, status: 'waiting', host: { id: 'u1', username: 'tester' } })
  }),
  http.patch('/api/match/deck', async ({ request }) => {
    const { roomId } = (await request.json()) as { roomId: string }
    return HttpResponse.json({ roomId, status: 'waiting', host: { id: 'u1', username: 'tester' } })
  }),
  http.patch(/https?:\/\/.*\/api\/match\/deck$/, async ({ request }) => {
    const { roomId } = (await request.json()) as { roomId: string }
    return HttpResponse.json({ roomId, status: 'waiting', host: { id: 'u1', username: 'tester' } })
  }),
  http.post('/api/match/leave', async ({ request }) => {
    const { roomId } = (await request.json()) as { roomId: string }
    return HttpResponse.json({ roomId, status: 'left' })
  }),
  http.post(/https?:\/\/.*\/api\/match\/leave$/, async ({ request }) => {
    const { roomId } = (await request.json()) as { roomId: string }
    return HttpResponse.json({ roomId, status: 'left' })
  }),
]


