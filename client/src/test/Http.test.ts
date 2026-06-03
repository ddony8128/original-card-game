import { http, ApiError, shouldRetryQuery } from '@/shared/api/http';
import { setAuthToken, clearAuthToken } from '@/shared/api/authToken';
import { server } from './testServer';
import { http as mswHttp, HttpResponse } from 'msw';

it('http 에러 시 ApiError(message) 던짐', async () => {
  server.use(
    mswHttp.get('/api/auth/me', () =>
      HttpResponse.json({ message: 'invalid token' }, { status: 401 }),
    ),
    mswHttp.get(/https?:\/\/.*\/api\/auth\/me$/, () =>
      HttpResponse.json({ message: 'invalid token' }, { status: 401 }),
    ),
  );
  await expect(http('/api/auth/me')).rejects.toBeInstanceOf(ApiError);
  await expect(http('/api/auth/me')).rejects.toHaveProperty('message', 'invalid token');
});

describe('Bearer 토큰 폴백 (시크릿탭 대비)', () => {
  it('저장된 토큰이 있으면 Authorization 헤더를 붙인다', async () => {
    let seenAuth: string | null = 'missing';
    server.use(
      mswHttp.get('/api/ping', ({ request }) => {
        seenAuth = request.headers.get('authorization');
        return HttpResponse.json({ ok: true });
      }),
    );
    setAuthToken('tok-123');
    await http('/api/ping');
    expect(seenAuth).toBe('Bearer tok-123');
    clearAuthToken();
  });

  it('토큰이 없으면 Authorization 헤더를 붙이지 않는다', async () => {
    let seenAuth: string | null = 'missing';
    server.use(
      mswHttp.get('/api/ping', ({ request }) => {
        seenAuth = request.headers.get('authorization');
        return HttpResponse.json({ ok: true });
      }),
    );
    clearAuthToken();
    await http('/api/ping');
    expect(seenAuth).toBeNull();
  });
});

describe('shouldRetryQuery', () => {
  it('4xx ApiError 는 재시도하지 않는다 (미인증 /me 1회 요청)', () => {
    expect(shouldRetryQuery(0, new ApiError(401, 'unauthorized'))).toBe(false);
    expect(shouldRetryQuery(0, new ApiError(404, 'not found'))).toBe(false);
  });

  it('5xx/네트워크 오류는 제한적으로 재시도한다', () => {
    expect(shouldRetryQuery(0, new ApiError(500, 'server error'))).toBe(true);
    expect(shouldRetryQuery(1, new Error('network'))).toBe(true);
    expect(shouldRetryQuery(2, new Error('network'))).toBe(false);
  });
});
