import Game from '@/pages/Game';
import { Route } from 'react-router-dom';
import { renderWithProviders } from './render';
import { screen } from '@testing-library/react';

it('FoggedGameState가 없을 때 로딩 메시지를 표시한다', async () => {
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

  // FoggedGameState가 설정되지 않았으므로 로딩 안내 문구가 보여야 한다.
  expect(
    await screen.findByText(/게임 상태를 불러오는 중입니다\./),
  ).toBeInTheDocument();
});
