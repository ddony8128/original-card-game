import Game from '@/pages/Game';
import { Route } from 'react-router-dom';
import { renderWithProviders } from './render';
import { screen } from '@testing-library/react';

it('초기 핸드 5장 및 roomId 표시', async () => {
  renderWithProviders(<Game />, {
    route: '/game/r1',
    routes: [
      <Route key="game" path="/game/:roomId" element={<Game />} />,
      <Route key="login" path="/login" element={<div>LOGIN</div>} />,
    ],
    seed: (qc) => {
      qc.setQueryData(['auth', 'me'], {
        id: 'u1',
        username: 'tester',
        message: 'ok',
        created_at: '',
      });
    },
  });

  // roomId 텍스트
  expect(await screen.findByText(/방 코드:/)).toBeInTheDocument();

  // 손패 타이틀 표시
  const handTitle = await screen.findByText(/내 손패/);
  expect(handTitle).toBeInTheDocument();
});
