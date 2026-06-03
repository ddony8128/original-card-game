import { http, ApiError, shouldRetryQuery } from '@/shared/api/http';
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
