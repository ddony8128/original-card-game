import { http } from '@/shared/api/http';
import type { MatchStateDto, WaitingRoomDto } from '@/shared/api/types';

export const matchApi = {
  create(roomName?: string | null) {
    return http<{ roomCode: string; status: string; host: { id: string; username?: string } }>(
      '/api/match/create',
      {
        method: 'POST',
        body: JSON.stringify({ roomName: roomName ?? null }),
      },
    );
  },
  waiting() {
    return http<WaitingRoomDto[]>('/api/match/waiting');
  },
  join(roomCode: string) {
    return http<MatchStateDto>('/api/match/join', {
      method: 'POST',
      body: JSON.stringify({ roomCode }),
    });
  },
  submitDeck(roomCode: string, deckId: string) {
    return http<MatchStateDto>('/api/match/deck', {
      method: 'PATCH',
      body: JSON.stringify({ roomCode, deckId }),
    });
  },
  state(roomCode: string) {
    return http<MatchStateDto>(`/api/match/${roomCode}`);
  },
  leave(roomCode: string) {
    return http<{ roomCode: string; status: string }>('/api/match/leave', {
      method: 'POST',
      body: JSON.stringify({ roomCode }),
    });
  },
  delete(roomCode: string) {
    return http<{ roomCode: string; status: string }>(`/api/match/${roomCode}`, {
      method: 'DELETE',
    });
  },
};
