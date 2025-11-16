import { describe, it, expect, beforeAll, vi } from 'vitest';
import request from 'supertest';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
vi.mock('../lib/supabase', async () => await import('./__mocks__/supabase.js'));

async function setupApp() {
  const mod = await import('../app.js');
  return mod.app as any;
}

async function loginCookie(app: any) {
  const username = `u_${Date.now()}`;
  await request(app)
    .post('/api/auth/register')
    .send({ username, password: 'pw' });
  const res = await request(app)
    .post('/api/auth/login')
    .send({ username, password: 'pw' });
  return res.headers['set-cookie']?.[0] as string;
}

describe('Cards routes', () => {
  let app: any;
  let cookie: string;

  beforeAll(async () => {
    app = await setupApp();
    cookie = await loginCookie(app);
  });

  it('GET /api/cards without auth -> 401', async () => {
    const res = await request(app).get('/api/cards');
    expect(res.status).toBe(401);
  });

  it('GET /api/cards without page/limit -> returns all', async () => {
    const res = await request(app).get('/api/cards').set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('cards');
    expect(res.body).toHaveProperty('total');
    expect(res.body.cards.length).toBe(res.body.total);
  });

  it('GET /api/cards?page=2 without limit -> 400', async () => {
    const res = await request(app)
      .get('/api/cards?page=2')
      .set('Cookie', cookie);
    expect(res.status).toBe(400);
  });

  it('filters token=false&type=instant&mana=0&page=1&limit=5', async () => {
    const res = await request(app)
      .get('/api/cards')
      .query({
        token: 'false',
        type: 'instant',
        mana: 0,
        page: 1,
        limit: 5,
      })
      .set('Cookie', cookie);
    expect(res.status).toBe(200);
    for (const c of res.body.cards) {
      expect(c.token).toBe(false);
      expect(c.type).toBe('instant');
      expect(c.mana === null || c.mana === 0).toBe(true);
    }
  });

  it('pagination works', async () => {
    const res1 = await request(app)
      .get('/api/cards')
      .query({ page: 1, limit: 3 })
      .set('Cookie', cookie);
    const res2 = await request(app)
      .get('/api/cards')
      .query({ page: 2, limit: 3 })
      .set('Cookie', cookie);
    expect(res1.status).toBe(200);
    expect(res2.status).toBe(200);
    expect(res1.body.cards.length).toBeLessThanOrEqual(3);
    expect(res2.body.cards.length).toBeLessThanOrEqual(3);
    expect(res1.body.total).toBe(res2.body.total);
  });
});
