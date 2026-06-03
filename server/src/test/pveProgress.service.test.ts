import { describe, it, expect, vi } from 'vitest';
import { pveProgressService } from '../services/pveProgress';
import { __getTables } from './__mocks__/supabase.js';

vi.mock('../lib/supabase', async () => await import('./__mocks__/supabase.js'));

describe('pveProgressService', () => {
  it('markCleared 후 getClearedStageIds 가 해당 스테이지를 반환한다', async () => {
    const userId = `user_${Date.now()}_a`;

    await pveProgressService.markCleared(userId, 'stage-1');

    const cleared = await pveProgressService.getClearedStageIds(userId);
    expect(cleared).toContain('stage-1');

    const tables = __getTables();
    const rows = tables.pve_progress.filter((r) => r.user_id === userId);
    expect(rows.length).toBe(1);
    expect(rows[0].stage_id).toBe('stage-1');
    expect(typeof rows[0].cleared_at).toBe('string');
  });

  it('같은 user+stage 를 두 번 markCleared 해도 한 행만 유지되고 throw 하지 않는다(멱등)', async () => {
    const userId = `user_${Date.now()}_b`;

    await pveProgressService.markCleared(userId, 'stage-2');
    await expect(
      pveProgressService.markCleared(userId, 'stage-2'),
    ).resolves.toBeUndefined();

    const tables = __getTables();
    const rows = tables.pve_progress.filter(
      (r) => r.user_id === userId && r.stage_id === 'stage-2',
    );
    expect(rows.length).toBe(1);

    const cleared = await pveProgressService.getClearedStageIds(userId);
    expect(cleared.filter((s) => s === 'stage-2').length).toBe(1);
  });

  it('getClearedStageIds 는 다른 유저의 기록을 섞지 않는다', async () => {
    const userA = `user_${Date.now()}_c`;
    const userB = `user_${Date.now()}_d`;

    await pveProgressService.markCleared(userA, 'stage-3');

    const clearedB = await pveProgressService.getClearedStageIds(userB);
    expect(clearedB).not.toContain('stage-3');
  });
});
