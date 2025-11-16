import { http, ApiError } from '@/shared/api/http';
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
