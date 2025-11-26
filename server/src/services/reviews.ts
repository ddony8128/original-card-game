import { supabase } from '../lib/supabase';

export type ReviewRow = {
  id: string;
  writer_id: string;
  review: string;
  created_at: string;
};

export const reviewsService = {
  async create(writer_id: string, review: string): Promise<ReviewRow> {
    const { data, error } = await supabase
      .from('reviews')
      .insert({ writer_id, review })
      .select('*')
      .single();
    if (error) throw error;
    const row = data as ReviewRow;
    // Supabase mock에서는 created_at이 자동으로 안 채워질 수 있으므로 보정
    if (!row.created_at) {
      row.created_at = new Date().toISOString();
    }
    return row;
  },
};
