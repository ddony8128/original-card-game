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
