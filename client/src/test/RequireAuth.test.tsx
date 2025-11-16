import RequireAuth from '@/components/auth/RequireAuth';
import { Route } from 'react-router-dom';
import { screen } from '@testing-library/react';
import { renderWithProviders } from './render';
import { http, HttpResponse } from 'msw';
import { server } from './testServer';

it('미인증이면 /login 으로 리다이렉트', async () => {
  server.use(
    http.get('/api/auth/me', () => HttpResponse.json({ message: 'unauthorized' }, { status: 401 })),
    http.get(/https?:\/\/.*\/api\/auth\/me$/, () =>
      HttpResponse.json({ message: 'unauthorized' }, { status: 401 }),
    ),
  );
  renderWithProviders(
    <RequireAuth>
      <div>SECRET</div>
    </RequireAuth>,
    {
      route: '/secret',
      routes: [
        <Route
          key="secret"
          path="/secret"
          element={
            <RequireAuth>
              <div>SECRET</div>
            </RequireAuth>
          }
        />,
        <Route key="login" path="/login" element={<div>LOGIN</div>} />,
      ],
    },
  );
  expect(await screen.findByText('LOGIN')).toBeInTheDocument();
});

it('인증 시 children 렌더', async () => {
  renderWithProviders(
    <RequireAuth>
      <div>SECRET</div>
    </RequireAuth>,
    {
      route: '/secret',
      routes: [
        <Route
          key="secret"
          path="/secret"
          element={
            <RequireAuth>
              <div>SECRET</div>
            </RequireAuth>
          }
        />,
        <Route key="login" path="/login" element={<div>LOGIN</div>} />,
      ],
    },
  );
  expect(await screen.findByText('SECRET')).toBeInTheDocument();
});
