import { supabase } from '../lib/supabase';

export type PveProgressRow = {
  id: string;
  user_id: string;
  stage_id: string;
  cleared_at?: string;
  created_at?: string;
};

export const pveProgressService = {
  /** 유저가 클리어한 스테이지 id 목록을 반환한다. */
  async getClearedStageIds(userId: string): Promise<string[]> {
    const { data, error } = await supabase
      .from('pve_progress')
      .select('stage_id')
      .eq('user_id', userId);
    if (error) throw error;
    return ((data as Pick<PveProgressRow, 'stage_id'>[]) ?? []).map(
      (r) => r.stage_id,
    );
  },

  /**
   * 스테이지 클리어를 기록한다. (user_id, stage_id) 고유 제약으로 멱등하다.
   * 이미 기록되어 있으면 아무 것도 하지 않는다(중복 시 한 행만 유지, throw 없음).
   *
   * 동작 순서: 먼저 존재 여부를 확인하고 없을 때만 insert 한다.
   * 경합으로 동시 insert 가 발생해 고유 제약 위반(23505)이 나더라도 무시한다.
   */
  async markCleared(userId: string, stageId: string): Promise<void> {
    const { data: existing, error: findErr } = await supabase
      .from('pve_progress')
      .select('id')
      .eq('user_id', userId)
      .eq('stage_id', stageId)
      .maybeSingle();
    if (findErr) throw findErr;
    if (existing?.id) return; // 이미 클리어됨 → 멱등

    const { error: insErr } = await supabase
      .from('pve_progress')
      .insert({ user_id: userId, stage_id: stageId });
    // 경합으로 고유 제약 위반이 발생하면 이미 기록된 것이므로 무시한다.
    if (insErr && (insErr as { code?: string }).code !== '23505') {
      throw insErr;
    }
  },
};
