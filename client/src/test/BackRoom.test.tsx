import BackRoom from '@/pages/BackRoom';
import { Route } from 'react-router-dom';
import { renderWithProviders } from './render';
import { screen, fireEvent } from '@testing-library/react';

it('덱 제출 버튼 동작 및 leave 이동', async () => {
  renderWithProviders(<BackRoom />, {
    route: '/back-room/r1',
    routes: [
      <Route key="room" path="/back-room/:roomId" element={<BackRoom />} />,
      <Route key="lobby" path="/lobby" element={<div>LOBBY</div>} />,
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

  // 내 덱 선택 섹션에서 '선택' 버튼 클릭 → 토스트 후 상태 잠금
  const selectButtons = await screen.findAllByRole('button', { name: /선택|선택됨/ });
  fireEvent.click(selectButtons[0]);

  // 나가기 클릭 → /lobby 이동
  const leave = await screen.findByRole('button', { name: '나가기' });
  fireEvent.click(leave);
  expect(await screen.findByText('LOBBY')).toBeInTheDocument();
});
