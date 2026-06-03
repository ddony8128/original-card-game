import { describe, it, expect, beforeAll, vi } from 'vitest';
import request from 'supertest';

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

vi.mock('../lib/supabase', async () => await import('./__mocks__/supabase.js'));

async function setupApp() {
  const mod = await import('../app.js');
  return mod.app as any;
}

// 새 유저를 등록/로그인해 쿠키와 userId 를 함께 반환한다.
async function registerAndLogin(
  app: any,
): Promise<{ cookie: string; userId: string }> {
  const username = `u_pve_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  const reg = await request(app)
    .post('/api/auth/register')
    .send({ username, password: 'pw' });
  const userId = reg.body.id as string;
  const res = await request(app)
    .post('/api/auth/login')
    .send({ username, password: 'pw' });
  const cookie = res.headers['set-cookie']?.[0] as string;
  return { cookie, userId };
}

describe('PvE routes', () => {
  let app: any;

  beforeAll(async () => {
    app = await setupApp();
  });

  it('GET /api/pve/stages 는 인증 없이 401', async () => {
    const res = await request(app).get('/api/pve/stages');
    expect(res.status).toBe(401);
  });

  it('GET /api/pve/stages 는 6개 스테이지(id+name)를 반환하고 덱/프로필을 노출하지 않는다', async () => {
    const { cookie } = await registerAndLogin(app);
    const res = await request(app)
      .get('/api/pve/stages')
      .set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('total', 6);
    expect(Array.isArray(res.body.stages)).toBe(true);
    expect(res.body.stages.length).toBe(6);
    for (const s of res.body.stages) {
      expect(typeof s.id).toBe('string');
      expect(typeof s.name).toBe('string');
      // AI 덱/프로필은 노출되면 안 된다.
      expect(s).not.toHaveProperty('deck');
      expect(s).not.toHaveProperty('profileId');
    }
  });

  it('GET /api/pve/progress 는 인증 없이 401', async () => {
    const res = await request(app).get('/api/pve/progress');
    expect(res.status).toBe(401);
  });

  it('GET /api/pve/progress 는 clearedStageIds 와 allCleared 를 반환한다(전부 클리어 시에만 true)', async () => {
    const { cookie, userId } = await registerAndLogin(app);
    const { pveProgressService } = await import('../services/pveProgress.js');

    // 처음에는 비어 있고 allCleared=false.
    const res0 = await request(app)
      .get('/api/pve/progress')
      .set('Cookie', cookie);
    expect(res0.status).toBe(200);
    expect(res0.body.clearedStageIds).toEqual([]);
    expect(res0.body.allCleared).toBe(false);

    // 일부만 클리어 → 여전히 allCleared=false.
    await pveProgressService.markCleared(userId, 'stage-1');
    await pveProgressService.markCleared(userId, 'stage-2');
    const res1 = await request(app)
      .get('/api/pve/progress')
      .set('Cookie', cookie);
    expect(res1.status).toBe(200);
    expect(res1.body.clearedStageIds.sort()).toEqual(['stage-1', 'stage-2']);
    expect(res1.body.allCleared).toBe(false);

    // 전체 스테이지(일반 1~3 + 하드 4~6) 클리어 → allCleared=true (골드 뱃지 조건).
    await pveProgressService.markCleared(userId, 'stage-3');
    await pveProgressService.markCleared(userId, 'stage-4');
    await pveProgressService.markCleared(userId, 'stage-5');
    await pveProgressService.markCleared(userId, 'stage-6');
    const res2 = await request(app)
      .get('/api/pve/progress')
      .set('Cookie', cookie);
    expect(res2.status).toBe(200);
    expect(res2.body.clearedStageIds.sort()).toEqual([
      'stage-1',
      'stage-2',
      'stage-3',
      'stage-4',
      'stage-5',
      'stage-6',
    ]);
    expect(res2.body.allCleared).toBe(true);
  });
});
