import { describe, it, expect } from 'vitest';
import 'dotenv/config';

// 실제 Supabase 통합 테스트 (환경 변수 없으면 skip)
const hasEnv = !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY);

describe.skipIf(!hasEnv)('Supabase integration', () => {
  it('cards table: fetch 10 rows', async () => {
    const mod = await import('../lib/supabase.js');
    const supabase = (mod as any).supabase as any;
    const { data, error } = await supabase.from('cards').select('id').limit(10);
    if (error) throw error;
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBe(10);
  });
});
