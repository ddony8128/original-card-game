import { useMutation } from '@tanstack/react-query';
import { reviewsApi, type CreateReviewPayload } from './api';

export function useCreateReviewMutation() {
  return useMutation({
    mutationFn: (input: CreateReviewPayload) => reviewsApi.create(input),
  });
}
