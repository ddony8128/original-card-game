이 프로젝트는 **1:1 대전 마법 카드 게임**의 풀스택 구현입니다.  
프론트엔드는 `client/` (React + TypeScript + Vite), 백엔드는 `server/` (Express 5 + Supabase)로 구성되어 있습니다.

---

## 전체 구조

- **클라이언트 (`client/`)**

  - React + TypeScript + Vite
  - 상태 관리: **Zustand** (게임/덱 상태), **React Query** (서버 상태)
  - 라우팅: **React Router**
  - WebSocket: 게임 진행 상태 실시간 동기화 (`ws/gameSocket.ts`)

- **서버 (`server/`)**
  - Express 5 + TypeScript
  - 인증: **JWT httpOnly 쿠키**
  - 데이터: Supabase(Postgres)를 추상화한 `lib/supabase`
  - 게임 엔진: `src/core/*` (보드/턴/카드 효과/재앙 처리)

역할 분리: 클라이언트는 UI·애니메이션·입력을 담당하고, 서버는 **덱/매치/게임 흐름/로그/리뷰**를 책임집니다.

---

## 주요 기능

- **회원가입 & 로그인**

  - `POST /api/auth/register` – `{ username, password }` 로 회원가입
  - `POST /api/auth/login` – 로그인 시 JWT를 `auth_token` httpOnly 쿠키에 저장
  - `GET /api/auth/me` – 현재 로그인한 사용자 정보 조회

- **카드 목록 (`/api/cards`)**

  - 카드 검색/필터 (마나, 이름, 타입, 토큰 여부 등)
  - 상세 조회

- **덱 빌더 (`/api/decks` + `/deck-builder` 페이지)**

  - 메인 덱 16장 / 재앙 덱 4장 **규칙 검증** 포함
  - 토큰/재앙 카드는 메인에 넣을 수 없음
  - 서버에 덱 저장/수정/삭제, 클라이언트에서는 미리보기/로컬 상태 유지

- **매치 & 게임**

  - `/api/match/create` – 방 생성, 방 코드 발급
  - `/api/match/join` – 방 코드로 참가, Host/Guest 매칭
  - `/api/match/deck` – 각자 덱 제출, 양쪽 제출 완료 시 `playing` 상태로 전환
  - `/api/match/:roomCode` – 매치 상태 폴링
  - WebSocket – 실제 턴 진행, 카드 사용, 이동, 재앙 카드(onDrawn), 리추얼 설치/파괴 등 게임 엔진과 동기화

- **게임 로그 & 결과 (`/api/game`)**

  - `GET /api/game/result/:roomCode` – 게임 종료 후 결과 조회
  - `GET /api/game/log/:roomCode` – 턴 로그 조회 (없으면 204)

- **게임 리뷰 (`/api/reviews` + `/review` 페이지)**
  - `POST /api/reviews` – 게임 후 소감을 남기는 간단 리뷰 작성 (인증 필요)
  - 프론트 `/review` 페이지에서 텍스트 입력 후 서버로 전송, 서버는 Supabase `reviews` 테이블에 저장

---

## 주요 화면 흐름 (클라이언트)

- **`/login`**

  - 로그인 / 회원가입 폼
  - 성공 시 `/lobby` 로 이동

- **`/lobby`**

  - 현재 사용자 정보 / 내 덱 목록
  - 방 만들기(Host) / 방 코드로 참가(Guest)
  - 만들어둔 덱이 없으면 게임 시작 불가 안내

- **`/deck-builder`**

  - 서버 카드 검색/필터, 카드 상세 툴팁
  - 메인/재앙 슬롯에 드래그 또는 클릭 추가
  - 덱 저장/수정 → 서버 `/api/decks` 호출

- **`/back-room`**

  - Host/Guest 상태, 각자 덱 선택 및 제출
  - `waiting / playing / finished` 상태 표시
  - 둘 다 덱을 제출하면 **게임 시작 버튼** 활성화

- **`/game`**

  - WebSocket으로 게임 상태(fogged state) 수신
  - 보드(마법사 위치/마법진), 손패, 덱/묘지, 재앙 덱 정보 표시
  - 버튼으로 **카드 사용, 이동, 마법진 사용, 턴 종료** 수행
  - 재앙 카드 onDrawn / 토큰 설치 / 보호 토큰과 같은 특수 효과도 엔진에서 처리된 결과만 반영
  - 게임 종료 시 승/패/무승부 오버레이 및 **리뷰 페이지로 이동 버튼**

- **`/review`**
  - 최신 종료 게임에 대한 한 줄 리뷰를 작성
  - `POST /api/reviews` 호출 후 성공 시 토스트/리다이렉트

---

## 서버 API 요약

Base URL: `/api`

- **Auth** – `/api/auth`
- **Cards** – `/api/cards`
- **Decks** – `/api/decks`
- **Match** – `/api/match`
- **Game Logs/Result** – `/api/game`
- **Reviews** – `/api/reviews` (POST, 인증 필요)

인증은 **httpOnly 쿠키(`auth_token`)** 또는 `Authorization: Bearer <token>` 둘 다 지원하지만, 프론트에서는 쿠키 기반 + `credentials: "include"` 사용을 권장합니다.

---

## 테스트

### 클라이언트 (`client`)

- 준비

  - 의존성 설치: `cd client && npm i`
  - Vitest + jsdom 환경, MSW 로 서버 API 모킹 (`src/test/*`)

- 실행
  - 일반 실행
    ```bash
    cd client
    npm run test
    ```
  - 워치 모드
    ```bash
    npm run test -- --watch
    ```
  - 커버리지
    ```bash
    npm run test -- --coverage
    ```

### 서버 (`server`)

- 준비

  - 의존성 설치: `cd server && npm i`
  - `server/.env.test` 예시
    ```env
    JWT_SECRET=dev-secret
    NODE_ENV=test
    ```
  - Supabase 는 실제 서버 대신 **인메모리 목** 사용 (`src/test/__mocks__/supabase.ts`)

- 실행
  - 일반 실행
    ```bash
    cd server
    npm run test
    ```
  - 워치 모드
    ```bash
    npm run test:watch
    ```
  - 커버리지
    ```bash
    npm run test:coverage
    ```

---

## 로컬 개발 실행

### 서버 (`server`)

- 필요 조건

  - Node.js 18+

- 설치

  ```bash
  cd server
  npm install
  ```

- 환경 변수 (`server/.env` 예시)

  ```env
  PORT=3000
  JWT_SECRET=dev-secret
  ```

- 실행
  ```bash
  npm run build
  npm start
  # http://localhost:3000
  ```

### 클라이언트 (`client`)

- 설치

  ```bash
  cd client
  npm install
  ```

- 환경 변수 (`client/.env` 예시)

  ```env
  VITE_API_BASE_URL=http://localhost:3000
  ```

- 실행
  ```bash
  npm run dev
  # http://localhost:5173
  ```

### 빠른 실행 요약

1. 터미널 A
   ```bash
   cd server
   npm i
   npm run build
   npm start
   ```
2. 터미널 B
   ```bash
   cd client
   npm i
   npm run dev
   ```
