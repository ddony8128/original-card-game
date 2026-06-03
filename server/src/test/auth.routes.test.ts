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
