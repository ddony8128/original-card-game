import { describe, it, expect, beforeAll, vi } from 'vitest';

// Ensure env before importing app/routers
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

// Mock supabase with in-memory implementation
vi.mock('../lib/supabase', async () => await import('./__mocks__/supabase.js'));

import request from 'supertest';

describe('Auth routes', () => {
  let app: any;
  const username = `u_${Date.now()}`;
  const password = 'pw1234';
  const badUsername = 'bad-username';
  const badPassword = 'bad-password';

  beforeAll(async () => {
    const mod = await import('../app.js');
    app = mod.app;
  });

  it('register -> 201', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ username, password });
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('username', username);
  });

  it('register -> auto-creates a "기본 덱" default deck for the new user', async () => {
    const u = `u_deck_${Date.now()}`;
    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: u, password });
    expect(res.status).toBe(201);
    const userId = res.body.id as string;
    expect(userId).toBeTruthy();

    const { __getTables } = await import('./__mocks__/supabase.js');
    const decks = __getTables().decks.filter((d: any) => d.user_id === userId);
    expect(decks).toHaveLength(1);
    const deck = decks[0];
    expect(deck.name).toBe('기본 덱');
    // 검증 규칙: main 16장 / cata 4장
    const mainSum = (deck.main_cards as Array<{ count: number }>).reduce(
      (s, e) => s + e.count,
      0,
    );
    const cataSum = (deck.cata_cards as Array<{ count: number }>).reduce(
      (s, e) => s + e.count,
      0,
    );
    expect(mainSum).toBe(16);
    expect(cataSum).toBe(4);
  });

  it('login -> httpOnly cookie set', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username, password });
    expect(res.status).toBe(200);
    const setCookie = res.headers['set-cookie']?.[0] ?? '';
    expect(setCookie).toMatch(/auth_token=/);
  });

  it('login with bad credentials -> 401', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: badUsername, password: badPassword });
    expect(res.status).toBe(401);
  });

  it('me -> 200 with cookie', async () => {
    const login = await request(app)
      .post('/api/auth/login')
      .send({ username, password });
    const cookie = login.headers['set-cookie']?.[0];
    const res = await request(app).get('/api/auth/me').set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('username', username);
  });

  // 시크릿탭 등 cross-site 쿠키가 차단되는 환경 대비:
  // login 응답에 token 을 내려주고, 쿠키 없이 Bearer 헤더만으로도 /me 가 동작해야 한다.
  it('login -> returns token; me -> 200 with Bearer header only (no cookie)', async () => {
    const login = await request(app)
      .post('/api/auth/login')
      .send({ username, password });
    expect(login.status).toBe(200);
    expect(login.body).toHaveProperty('token');
    const token = login.body.token as string;

    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('username', username);
  });
});
