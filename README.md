이 프로젝트는 `client/`와 `server/`로 분리된 구조의 카드 게임 기본 세팅입니다.

- client: React + TypeScript + Vite. 상태관리는 Zustand + React Query, 라우팅은 React Router.
- server: Express 5. 쿠키 기반 인증(JWT httpOnly)과 CORS를 사용합니다.

역할 분리: 클라이언트는 UI을 담당하고, 서버는 백엔드 엔드포인트와 게임 상태 관리를 담당합니다. `client/`에는 프론트엔드 소스와 Vite/TS 설정이, `server/`에는 Express 의존성과 서버 코드가 위치합니다.

## 서버 API 개요

Base URL: `/api`

- Auth (`/api/auth`)

  - POST `/register` body: `{ username, password }` → 201
  - POST `/login` body: `{ username, password }` → 200 + httpOnly 쿠키(`auth_token`) 설정
  - GET `/me` → 200 현재 사용자 조회 (Authorization Bearer 또는 쿠키 인증 지원)

- Cards (`/api/cards`) [인증 필요]

  - GET `/` 쿼리: `mana?: number`(5면 5+), `name?: string`, `token?: boolean`, `type?: instant|ritual|catastrophe|summon|item`, `page?: number`, `limit?: number`
    - 응답: `{ cards: [...], total, page?, limit? }`
  - GET `/:id` → 카드 상세

- Decks (`/api/decks`) [인증 필요]

  - GET `/` → 사용자 덱 목록
  - POST `/` body: `{ name: string, main_cards: string[], cata_cards: string[] }` → 201
  - PUT `/:deckId` body: `{ name, main_cards, cata_cards }` → 200
  - DELETE `/:deckId` → 204

- Match (`/api/match`) [인증 필요]

  - POST `/create` → 방 생성(코드 반환)
  - POST `/join` body: `{ roomId }` → 방 참가
  - PATCH `/deck` body: `{ roomId, deckId }` → 덱 제출
  - GET `/:roomId` → 방 상태 조회(폴링)
  - POST `/leave` body: `{ roomId }` → 참가자 이탈
  - DELETE `/:roomId` → 방장 방 삭제

- Logs (`/api/game`)
  - GET `/result/:roomId` [인증 또는 내부] → 완료된 게임 결과 조회
  - GET `/log/:roomId` [인증 또는 내부] → 턴 로그 조회 (로그 없으면 204)
  - POST/PUT(내부용) 엔드포인트는 서버 내부 연동용 비공개

인증: httpOnly 쿠키(`auth_token`) 또는 `Authorization: Bearer <token>`. 클라이언트는 쿠키 기반 사용 권장(모든 요청에 `credentials: "include"`).

## 클라이언트 화면 개요

- `/login`: 아이디/비밀번호 입력, 로그인/회원가입(모달). 성공 시 `/lobby` 이동.
- `/lobby`: 방 만들기/참가, 내 덱 섹션(로컬/서버 덱 표시). 덱 없으면 경고.
- `/deck-builder`: 서버 카드 검색/필터로 덱 구성(메인 16장·재앙 4장 분리 표시). 저장/수정 가능.
- `/back-room`: Host/Guest 표시, 덱 선택 제출(잠금), 상태 폴링. `playing`이면 게임 시작 활성화.
- `/game`: 게임 화면(WS 테스트 버튼 및 상태 표시 추가).
- `*` → NotFound: 로그인 여부에 따라 `/login` 또는 `/lobby`로 이동 버튼.

상태 관리

- 서버 데이터: React Query 훅(`features/*/queries.ts`)
- UI/세션: Zustand(`store/useGameStore.ts`, `store/useDeckStore.ts`), 덱 로컬 저장 병행

환경 변수

- `client/.env`에 `VITE_API_BASE_URL` 설정 필요. 모든 요청은 `credentials: "include"`로 쿠키 인증 사용.

## 테스트

### 프론트엔드(client)

- 사전 준비

  - 의존성 설치: `cd client && npm i`
  - Vitest 설정: `vite.config.ts`의 `test` 섹션(`environment: 'jsdom'`, `setupFiles: 'src/test/setup.ts'`)을 사용합니다.
  - MSW 설정: `src/test/testServer.ts`, `src/test/testHandlers.ts`에서 API를 가짜로 응답합니다. 절대/상대 경로 둘 다 매칭하도록 핸들러가 준비되어 있습니다.

- 실행

  - 단위/통합 테스트:
    ```bash
    cd client
    npm run test
    ```
  - 워치 모드(필요 시):
    ```bash
    npm run test -- --watch
    ```
  - 커버리지(필요 시):
    ```bash
    npm run test -- --coverage
    ```

- 참고
  - 테스트 유틸: `src/test/render.tsx`의 `renderWithProviders`로 `QueryClientProvider`/`MemoryRouter`를 감쌉니다. `seed` 옵션으로 쿼리 캐시 초기화가 가능합니다.
  - 가드 테스트: `RequireAuth`, `RequireParticipant`는 `/api/auth/me`, `/api/match/:roomId`를 MSW로 모킹하여 리다이렉트/권한 체크를 검증합니다.

### 백엔드(server)

- 사전 준비

  - 의존성 설치: `cd server && npm i`
  - 환경 변수: 테스트는 `cross-env DOTENV_CONFIG_PATH=.env.test`로 실행됩니다. 최소한 아래 값을 `server/.env.test`에 설정하세요.
    ```env
    JWT_SECRET=dev-secret
    NODE_ENV=test
    ```
  - 외부 DB 필요 없음: `src/test/__mocks__/supabase.ts`가 인메모리 목을 제공합니다.

- 실행

  - 일회성 실행:
    ```bash
    cd server
    npm run test
    ```
  - 워치 모드:
    ```bash
    npm run test:watch
    ```
  - 커버리지:
    ```bash
    npm run test:coverage
    ```

- 참고
  - 라우트/서비스/타입 단위로 테스트가 구성되어 있습니다(`src/test/*`).
  - JWT 쿠키 동작은 `auth` 라우트 테스트에서 검증합니다. 테스트 실행 시 쿠키/헤더 인증이 모두 지원됩니다.

## 로컬 실행 (개발)

### 서버(server) 실행

사전 준비

- Node.js 18+ 권장
- 의존성 설치:

```bash
cd server
npm install
```

- 환경 변수(`server/.env`):

```env
PORT=3000              # 선택, 기본 3000
JWT_SECRET=dev-secret  # 필수
```

실행

```bash
# TypeScript 빌드 후 실행
npm run build
npm start
# 서버는 기본적으로 http://localhost:3000 에서 동작
```

참고

- WebSocket 엔드포인트: `/api/match/socket`
- CORS는 `http://localhost:5173`를 허용하도록 설정되어 있습니다.

### 클라이언트(client) 실행

사전 준비

```bash
cd client
npm install
```

- 환경 변수(`client/.env`):

```env
VITE_API_BASE_URL=http://localhost:3000
```

실행

```bash
npm run dev
# 기본 포트: http://localhost:5173
```

동시 실행 요약

1. 터미널 A: `cd server && npm i && npm run build && npm start`
2. 터미널 B: `cd client && npm i && npm run dev`
