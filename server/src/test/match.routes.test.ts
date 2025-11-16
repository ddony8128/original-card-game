import request from 'supertest';
import { describe, it, expect, beforeAll, vi } from 'vitest';
import { __getTables } from './__mocks__/supabase.js';

// mock supabase before importing app
vi.mock('../lib/supabase', async () => await import('./__mocks__/supabase.js'));

let app: any;

async function registerAndLogin(suffix: string) {
  const username = `u_${Date.now()}_${suffix}`;
  await request(app)
    .post('/api/auth/register')
    .send({ username, password: 'pw' });
  const res = await request(app)
    .post('/api/auth/login')
    .send({ username, password: 'pw' });
  const cookie = res.headers['set-cookie']?.[0] as string;
  const me = await request(app).get('/api/auth/me').set('Cookie', cookie);
  return { cookie, userId: me.body.id as string, username };
}

function seedDeck(userId: string, deckId: string) {
  const tables = __getTables();
  tables.decks.push({
    id: deckId,
    user_id: userId,
    name: `deck-${deckId}`,
    main_cards: [],
    cata_cards: [],
    deleted: false,
    created_at: new Date().toISOString(),
  });
}

describe('Match routes', () => {
  let host: { cookie: string; userId: string; username: string };
  let guest: { cookie: string; userId: string; username: string };

  beforeAll(async () => {
    const mod = await import('../app.js');
    app = mod.app;
    host = await registerAndLogin('host');
    guest = await registerAndLogin('guest');
  });

  it('POST /api/match/create -> 201', async () => {
    const res = await request(app)
      .post('/api/match/create')
      .set('Cookie', host.cookie);
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('roomId');
    expect(res.body).toHaveProperty('host.username', host.username);
    expect(res.body.status).toBe('waiting');
  });

  it('POST /api/match/join not found -> 404', async () => {
    const res = await request(app)
      .post('/api/match/join')
      .set('Cookie', guest.cookie)
      .send({ roomId: 'NO_SUCH_ROOM' });
    expect(res.status).toBe(404);
  });

  it('join success -> 200 with host/guest', async () => {
    const created = await request(app)
      .post('/api/match/create')
      .set('Cookie', host.cookie);
    const roomId = created.body.roomId as string;
    const res = await request(app)
      .post('/api/match/join')
      .set('Cookie', guest.cookie)
      .send({ roomId });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('roomId', roomId);
    expect(res.body.host.username).toBe(host.username);
    expect(res.body.guest.username).toBe(guest.username);
    expect(res.body.status).toBe('waiting');
  });

  it('join conflict -> 409', async () => {
    const created = await request(app)
      .post('/api/match/create')
      .set('Cookie', host.cookie);
    const roomId = created.body.roomId as string;
    const joined = await request(app)
      .post('/api/match/join')
      .set('Cookie', guest.cookie)
      .send({ roomId });
    expect(joined.status).toBe(200);
    const u3 = await registerAndLogin('third');
    const res = await request(app)
      .post('/api/match/join')
      .set('Cookie', u3.cookie)
      .send({ roomId });
    expect(res.status).toBe(409);
  });

  it('GET /api/match/:roomId -> state', async () => {
    const created = await request(app)
      .post('/api/match/create')
      .set('Cookie', host.cookie);
    const roomId = created.body.roomId as string;
    await request(app)
      .post('/api/match/join')
      .set('Cookie', guest.cookie)
      .send({ roomId });
    const res = await request(app)
      .get(`/api/match/${roomId}`)
      .set('Cookie', host.cookie);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('roomId', roomId);
    expect(res.body.status).toBe('waiting');
  });

  it('PATCH /api/match/deck -> 403 when deck not owned', async () => {
    const created = await request(app)
      .post('/api/match/create')
      .set('Cookie', host.cookie);
    const roomId = created.body.roomId as string;
    await request(app)
      .post('/api/match/join')
      .set('Cookie', guest.cookie)
      .send({ roomId });
    // seed deck for host, try submit as guest
    seedDeck(host.userId, 'deck-host-x');
    const res = await request(app)
      .patch('/api/match/deck')
      .set('Cookie', guest.cookie)
      .send({ roomId, deckId: 'deck-host-x' });
    expect(res.status).toBe(403);
  });

  it('PATCH /api/match/deck -> playing when both submitted', async () => {
    const created = await request(app)
      .post('/api/match/create')
      .set('Cookie', host.cookie);
    const roomId = created.body.roomId as string;
    await request(app)
      .post('/api/match/join')
      .set('Cookie', guest.cookie)
      .send({ roomId });
    seedDeck(host.userId, 'deck-h1');
    seedDeck(guest.userId, 'deck-g1');
    const r1 = await request(app)
      .patch('/api/match/deck')
      .set('Cookie', host.cookie)
      .send({ roomId, deckId: 'deck-h1' });
    expect(r1.status).toBe(200);
    expect(r1.body.host.deckId).toBe('deck-h1');
    expect(r1.body.status).toBe('waiting');
    const r2 = await request(app)
      .patch('/api/match/deck')
      .set('Cookie', guest.cookie)
      .send({ roomId, deckId: 'deck-g1' });
    expect(r2.status).toBe(200);
    expect(r2.body.host.deckId).toBe('deck-h1');
    expect(r2.body.guest.deckId).toBe('deck-g1');
    expect(r2.body.status).toBe('playing');
  });

  it('POST /api/match/leave -> finished', async () => {
    const created = await request(app)
      .post('/api/match/create')
      .set('Cookie', host.cookie);
    const roomId = created.body.roomId as string;
    await request(app)
      .post('/api/match/join')
      .set('Cookie', guest.cookie)
      .send({ roomId });
    const res = await request(app)
      .post('/api/match/leave')
      .set('Cookie', guest.cookie)
      .send({ roomId });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ roomId, status: 'finished' });
  });

  it('DELETE /api/match/:roomId -> 403 for guest, 200 for host', async () => {
    const created = await request(app)
      .post('/api/match/create')
      .set('Cookie', host.cookie);
    const roomId = created.body.roomId as string;
    await request(app)
      .post('/api/match/join')
      .set('Cookie', guest.cookie)
      .send({ roomId });
    const resGuest = await request(app)
      .delete(`/api/match/${roomId}`)
      .set('Cookie', guest.cookie);
    expect(resGuest.status).toBe(403);
    const resHost = await request(app)
      .delete(`/api/match/${roomId}`)
      .set('Cookie', host.cookie);
    expect(resHost.status).toBe(200);
    expect(resHost.body).toEqual({ roomId, status: 'finished' });
  });
});
