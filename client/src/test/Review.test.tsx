import Review from '@/pages/Review';
import { Route } from 'react-router-dom';
import { renderWithProviders } from './render';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { server } from './testServer';
import { http, HttpResponse } from 'msw';

it('빈 리뷰 전송 시 에러 토스트를 표시한다', async () => {
  renderWithProviders(<Review />, {
    route: '/review',
    routes: [
      <Route key="review" path="/review" element={<Review />} />,
      <Route key="lobby" path="/lobby" element={<div>LOBBY</div>} />,
    ],
  });

  const submitBtn = await screen.findByRole('button', { name: '리뷰 등록' });
  fireEvent.click(submitBtn);

  expect(await screen.findByText('리뷰를 입력해주세요.')).toBeInTheDocument();
});

it('정상 리뷰 전송 시 성공 토스트와 함께 /lobby 로 이동한다', async () => {
  server.use(
    http.post('/api/reviews', async ({ request }) => {
      const body = (await request.json()) as { review: string };
      // 서버에 전달된 payload 검증
      if (!body.review || body.review.trim().length === 0) {
        return HttpResponse.json({ message: 'invalid review' }, { status: 400 });
      }
      return HttpResponse.json({
        id: 'r1',
        writer_id: 'u1',
        review: body.review,
        created_at: new Date().toISOString(),
      });
    }),
  );

  renderWithProviders(<Review />, {
    route: '/review',
    routes: [
      <Route key="review" path="/review" element={<Review />} />,
      <Route key="lobby" path="/lobby" element={<div>LOBBY</div>} />,
    ],
  });

  const textarea = await screen.findByPlaceholderText('여기에 리뷰를 작성해주세요...');
  fireEvent.change(textarea, { target: { value: '이 게임 정말 재밌어요!' } });

  const submitBtn = await screen.findByRole('button', { name: '리뷰 등록' });
  fireEvent.click(submitBtn);

  // 성공 토스트 텍스트
  expect(await screen.findByText('리뷰가 등록되었습니다.')).toBeInTheDocument();
  expect(await screen.findByText('소중한 의견 감사합니다!')).toBeInTheDocument();

  // 라우팅 결과 확인
  await waitFor(async () => {
    expect(await screen.findByText('LOBBY')).toBeInTheDocument();
  });
});
