import { http } from '@/shared/api/http';

export interface PveStage {
  id: string;
  name: string;
}

export interface PveStagesResponse {
  stages: PveStage[];
  total: number;
}

export interface PveProgressResponse {
  clearedStageIds: string[];
  allCleared: boolean;
}

export const pveApi = {
  getStages() {
    return http<PveStagesResponse>('/api/pve/stages');
  },
  getProgress() {
    return http<PveProgressResponse>('/api/pve/progress');
  },
};
