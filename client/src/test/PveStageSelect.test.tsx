import PveStageSelect from '@/pages/PveStageSelect';
import { Route } from 'react-router-dom';
import { renderWithProviders } from './render';
import { screen, within } from '@testing-library/react';
import { server } from './testServer';
import { http, HttpResponse } from 'msw';

const seedMe = (qc: import('@tanstack/react-query').QueryClient) => {
  qc.setQueryData(['auth', 'me'], {
    id: 'u1',
    username: 'tester',
    message: 'ok',
    created_at: '',
  });
};

it('3개의 스테이지 카드 렌더 + 클리어 스테이지의 클리어 표시 + 도전 버튼', async () => {
  server.use(
    http.get('/api/pve/stages', () =>
      HttpResponse.json({
        stages: [
          { id: 'stage-1', name: '불의 시련' },
          { id: 'stage-2', name: '얼음 협곡' },
          { id: 'stage-3', name: '폭풍의 정점' },
        ],
        total: 3,
      }),
    ),
    http.get('/api/pve/progress', () =>
      HttpResponse.json({ clearedStageIds: ['stage-1'], allCleared: false }),
    ),
  );

  renderWithProviders(<PveStageSelect />, {
    route: '/pve',
    routes: [
      <Route key="pve" path="/pve" element={<PveStageSelect />} />,
      <Route key="play" path="/pve/play/:stageId" element={<div>PLAY</div>} />,
    ],
    seed: seedMe,
  });

  // 3개 스테이지가 이름으로 렌더
  expect(await screen.findByText('불의 시련')).toBeInTheDocument();
  expect(screen.getByText('얼음 협곡')).toBeInTheDocument();
  expect(screen.getByText('폭풍의 정점')).toBeInTheDocument();

  // 클리어된 스테이지(stage-1)는 "클리어!" 표시
  const clearedCard = screen.getByText('불의 시련').closest('div')!.parentElement as HTMLElement;
  expect(within(clearedCard).getByText('클리어!')).toBeInTheDocument();

  // 도전 어포던스 존재(미클리어 스테이지 = "도전")
  expect(screen.getAllByRole('button', { name: '도전' }).length).toBeGreaterThanOrEqual(1);
});

it('모든 스테이지 클리어 시 황금 축하 배너 노출', async () => {
  server.use(
    http.get('/api/pve/stages', () =>
      HttpResponse.json({
        stages: [
          { id: 'stage-1', name: '불의 시련' },
          { id: 'stage-2', name: '얼음 협곡' },
          { id: 'stage-3', name: '폭풍의 정점' },
        ],
        total: 3,
      }),
    ),
    http.get('/api/pve/progress', () =>
      HttpResponse.json({
        clearedStageIds: ['stage-1', 'stage-2', 'stage-3'],
        allCleared: true,
      }),
    ),
  );

  renderWithProviders(<PveStageSelect />, {
    route: '/pve',
    routes: [<Route key="pve" path="/pve" element={<PveStageSelect />} />],
    seed: seedMe,
  });

  expect(await screen.findByText(/모든 스테이지 클리어/)).toBeInTheDocument();
});
