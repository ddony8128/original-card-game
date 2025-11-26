import Lobby from '@/pages/Lobby';
import { Route } from 'react-router-dom';
import { renderWithProviders } from './render';
import { screen, fireEvent } from '@testing-library/react';
import { server } from './testServer';
import { http, HttpResponse } from 'msw';

it('덱 없음 UI 표시', async () => {
  server.use(
    http.get('/api/decks', () => HttpResponse.json([])),
    http.get(/https?:\/\/.*\/api\/decks$/, () => HttpResponse.json([])),
  );
  renderWithProviders(<Lobby />, {
    route: '/lobby',
    routes: [
      <Route key="lobby" path="/lobby" element={<Lobby />} />,
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
  expect(await screen.findByText('아직 덱이 없습니다')).toBeInTheDocument();
});

it('방 생성 후 /back-room/:roomId 로 이동', async () => {
  server.use(
    http.post('/api/match/create', () =>
      HttpResponse.json({
        roomCode: 'R2',
        status: 'waiting',
        host: { id: 'u1', username: 'tester' },
      }),
    ),
  );
  renderWithProviders(<Lobby />, {
    route: '/lobby',
    routes: [
      <Route key="lobby" path="/lobby" element={<Lobby />} />,
      <Route key="room" path="/back-room/:roomId" element={<div>ROOM R2</div>} />,
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
  // 덱 목록이 로딩된 후 버튼 클릭
  await screen.findByText('기본 덱');
  // 방 이름 입력 필드에 값을 입력하여 버튼 활성화
  const roomNameInput = await screen.findByPlaceholderText('방 이름 입력');
  fireEvent.change(roomNameInput, { target: { value: '테스트 방' } });
  const createBtn = await screen.findByRole('button', { name: /방 생성/ });
  fireEvent.click(createBtn);
  expect(await screen.findByText('ROOM R2')).toBeInTheDocument();
});

it('미인증이면 /login 리다이렉트', async () => {
  server.use(
    http.get('/api/auth/me', () => HttpResponse.json({ message: 'unauthorized' }, { status: 401 })),
    http.get(/https?:\/\/.*\/api\/auth\/me$/, () =>
      HttpResponse.json({ message: 'unauthorized' }, { status: 401 }),
    ),
  );
  renderWithProviders(<Lobby />, {
    route: '/lobby',
    routes: [
      <Route key="lobby" path="/lobby" element={<Lobby />} />,
      <Route key="login" path="/login" element={<div>LOGIN</div>} />,
    ],
  });
  expect(await screen.findByText('LOGIN')).toBeInTheDocument();
});

it('덱이 없을 때 방 생성 클릭 시 에러 토스트 노출', async () => {
  server.use(
    http.get('/api/decks', () => HttpResponse.json([])),
    http.get(/https?:\/\/.*\/api\/decks$/, () => HttpResponse.json([])),
  );
  renderWithProviders(<Lobby />, {
    route: '/lobby',
    routes: [
      <Route key="lobby" path="/lobby" element={<Lobby />} />,
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
  // 덱 없음이 렌더된 이후 클릭해야 error 토스트 경로로 진입
  await screen.findByText('아직 덱이 없습니다');
  // 방 이름 입력 필드에 값을 입력하여 버튼 활성화
  const roomNameInput = await screen.findByPlaceholderText('방 이름 입력');
  fireEvent.change(roomNameInput, { target: { value: '테스트 방' } });
  const createBtn = await screen.findByRole('button', { name: /방 생성/ });
  fireEvent.click(createBtn);
  expect(await screen.findByText('덱을 먼저 만들어야 합니다.')).toBeInTheDocument();
});

it('방 참가 실패 시 에러 토스트 노출', async () => {
  server.use(
    http.get('/api/decks', () =>
      HttpResponse.json([
        {
          id: 'd1',
          name: '기본 덱',
          main_cards: [],
          cata_cards: [],
          created_at: '',
          updated_at: '',
        },
      ]),
    ),
    http.get(/https?:\/\/.*\/api\/decks$/, () =>
      HttpResponse.json([
        {
          id: 'd1',
          name: '기본 덱',
          main_cards: [],
          cata_cards: [],
          created_at: '',
          updated_at: '',
        },
      ]),
    ),
    http.post('/api/match/join', () =>
      HttpResponse.json({ message: 'join failed' }, { status: 500 }),
    ),
    http.post(/https?:\/\/.*\/api\/match\/join$/, () =>
      HttpResponse.json({ message: 'join failed' }, { status: 500 }),
    ),
  );
  renderWithProviders(<Lobby />, {
    route: '/lobby',
    routes: [<Route key="lobby" path="/lobby" element={<Lobby />} />],
    seed: (qc) => {
      qc.setQueryData(['auth', 'me'], {
        id: 'u1',
        username: 'tester',
        message: 'ok',
        created_at: '',
      });
    },
  });
  const input = await screen.findByPlaceholderText('방 코드 입력');
  fireEvent.change(input, { target: { value: 'r4' } });
  const joinBtn = await screen.findByRole('button', { name: '입장하기' });
  fireEvent.click(joinBtn);
  expect(await screen.findByText('join failed')).toBeInTheDocument();
});

it('덱 카드 섹션: 수정/삭제/새 덱 만들기 동작', async () => {
  // confirm 모킹
  const origConfirm = window.confirm;
  window.confirm = () => true;
  server.use(
    http.get('/api/decks', () =>
      HttpResponse.json([
        {
          id: 'd1',
          name: '기본 덱',
          main_cards: [
            {
              id: 'c1',
              count: 2,
              name_dev: 'fire_dev',
              name_ko: '파이어볼',
              description_ko: '불덩이',
              type: 'instant',
              mana: 1,
            },
          ],
          cata_cards: [
            {
              id: 'c3',
              count: 1,
              name_dev: 'doom_dev',
              name_ko: '파멸',
              description_ko: '재앙',
              type: 'catastrophe',
              mana: 3,
            },
          ],
          created_at: '',
          updated_at: '',
        },
      ]),
    ),
    http.get(/https?:\/\/.*\/api\/decks$/, () =>
      HttpResponse.json([
        {
          id: 'd1',
          name: '기본 덱',
          main_cards: [
            {
              id: 'c1',
              count: 2,
              name_dev: 'fire_dev',
              name_ko: '파이어볼',
              description_ko: '불덩이',
              type: 'instant',
              mana: 1,
            },
          ],
          cata_cards: [
            {
              id: 'c3',
              count: 1,
              name_dev: 'doom_dev',
              name_ko: '파멸',
              description_ko: '재앙',
              type: 'catastrophe',
              mana: 3,
            },
          ],
          created_at: '',
          updated_at: '',
        },
      ]),
    ),
  );
  renderWithProviders(<Lobby />, {
    route: '/lobby',
    routes: [
      <Route key="lobby" path="/lobby" element={<Lobby />} />,
      <Route key="builder" path="/deck-builder" element={<div>BUILDER</div>} />,
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

  await screen.findByText('기본 덱');

  // 삭제 성공 토스트
  const titleEl = await screen.findByText('기본 덱');
  const row = titleEl.closest('div')!.parentElement as HTMLElement;
  const buttons = Array.from(row.querySelectorAll('button'));
  const delBtn = buttons[buttons.length - 1];
  fireEvent.click(delBtn);
  expect(await screen.findByText('덱이 삭제되었습니다.')).toBeInTheDocument();

  // 삭제 실패 토스트
  server.use(
    http.delete('/api/decks/:deckId', () =>
      HttpResponse.json({ message: 'delete failed' }, { status: 500 }),
    ),
    http.delete(/https?:\/\/.*\/api\/decks\/.+$/, () =>
      HttpResponse.json({ message: 'delete failed' }, { status: 500 }),
    ),
  );
  fireEvent.click(delBtn);
  expect(await screen.findByText('delete failed')).toBeInTheDocument();

  // 새 덱 만들기 버튼 클릭
  const newDeckBtn = await screen.findByRole('button', { name: '새 덱 만들기' });
  fireEvent.click(newDeckBtn);
  await screen.findByText('BUILDER');

  // 수정 버튼 → /deck-builder 이동 (로비에서 동작 검증은 위로 충분하므로 생략 가능)

  window.confirm = origConfirm;
});
