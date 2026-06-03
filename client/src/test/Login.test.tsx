import Login from '@/pages/Login';
import { Route } from 'react-router-dom';
import { renderWithProviders } from './render';
import { screen, fireEvent } from '@testing-library/react';

it('빈 입력으로 로그인 시 인라인 에러 메시지를 보여준다 (토스트 아님)', async () => {
  renderWithProviders(<Login />, {
    route: '/login',
    routes: [
      <Route key="login" path="/login" element={<Login />} />,
      <Route key="lobby" path="/lobby" element={<div>LOBBY</div>} />,
    ],
  });

  const loginBtn = await screen.findByRole('button', { name: '로그인' });
  fireEvent.click(loginBtn);

  const alert = await screen.findByRole('alert');
  expect(alert.textContent).toMatch(/아이디와 비밀번호를 입력하세요/);
});
