import { http } from '@/shared/api/http';
import type { GameResultDto, TurnLogDto } from '@/shared/api/types';

export const logsApi = {
  getResult(roomId: string) {
    return http<GameResultDto>(`/api/game/result/${roomId}`);
  },
  getLogs(roomId: string) {
    // 204일 수 있으므로 any 처리 후 상위 훅에서 undefined 허용
    return http<TurnLogDto>(`/api/game/log/${roomId}`);
  },
};
