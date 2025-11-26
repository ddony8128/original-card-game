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

describe('Reviews routes', () => {
  let app: any;
  let cookie: string;

  beforeAll(async () => {
    app = await setupApp();
    cookie = await loginCookie(app);
  });

  it('POST /api/reviews requires auth', async () => {
    const res = await request(app)
      .post('/api/reviews')
      .send({ review: 'no auth' });
    expect(res.status).toBe(401);
  });

  it('POST /api/reviews creates a review and returns 201 with fields', async () => {
    const res = await request(app)
      .post('/api/reviews')
      .set('Cookie', cookie)
      .send({ review: '이 게임 정말 재밌네요!' });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
    expect(res.body).toHaveProperty('writer_id');
    expect(res.body).toHaveProperty('review', '이 게임 정말 재밌네요!');
    expect(res.body).toHaveProperty('created_at');
  });
});
