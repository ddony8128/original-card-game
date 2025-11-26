import { http } from '@/shared/api/http';

export type CreateReviewPayload = {
  review: string;
};

export const reviewsApi = {
  create(input: CreateReviewPayload) {
    return http<{
      id: string;
      writer_id: string;
      review: string;
      created_at?: string;
    }>('/api/reviews', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },
};
