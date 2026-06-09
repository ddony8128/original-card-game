# Magic! Doom! (매직! 둠!)

격자 보드 위에서 펼치는 **1:1 대전 마법 카드 게임**의 풀스택 구현.
마법사를 움직이고, 즉발/마법진/재앙 카드를 조합해 상대의 HP를 0으로 만드세요.

🔗 **Live:** https://cardgame.perfect.ai.kr ( `/en` 으로 영어 버전 )

- **클라이언트** `client/` — React + TypeScript + Vite (Vercel 배포)
- **서버** `server/` — Express 5 + TypeScript + Supabase (Render 배포)

---

## 핵심 특징

- **3가지 플레이 모드**
  - **튜토리얼** — 코치 오버레이로 규칙을 익히는 AI 연습전(기본 덱 제공, 끝나면 덱 빌더 안내)
  - **PvE** — 성격이 다른 AI 보스 **6 스테이지**(일반 3 + 하드 3, 하드는 보스 HP 30). 전부 클리어 시 황금 뱃지
  - **PvP** — 방 생성/참가 후 WebSocket 실시간 대전
- **게임 엔진** — 보드/턴/마나/이동, 즉발·마법진(ritual)·재앙(catastrophe) 카드 효과, 80턴 무승부 규칙. 효과는 `EffectStack` + resolver 모듈로 처리
- **AI 상대** — 합법 수 열거 + 규칙 인지 휴리스틱(사거리/킬각/회복/마법진 함정), 스테이지별 프로필
- **덱 빌더** — 메인 16 / 재앙 4 규칙 검증, 39종 카드 검색·필터
- **다국어(한/영)** — `react-i18next` + `/en` 라우팅, 카드명·설명·게임 로그·PvE 스테이지명까지 현지화, 용어집 제공
- **한 화면 인게임 UI** — 보드 중심 반응형 레이아웃(PC 한 화면 / 모바일 스크롤), 카드 타입·마나 가독성, 행동 가이드/이벤트 배너
- **분석** — GA4 + Microsoft Clarity(env-gated, 프로덕션 자동 활성). 핵심 퍼널 이벤트는 PvE/PvP/튜토리얼 모드 구분
- **밸런스 도구** — 셀프플레이 시뮬레이션 하네스로 승률·턴수 측정 (`docs/balance-report.md`)

---

## 기술 스택

| | |
|---|---|
| **Client** | React, TypeScript, Vite, Zustand(게임/덱 상태), React Query(서버 상태), React Router, react-i18next, Radix UI + Tailwind, lucide-react, sonner |
| **Server** | Express 5, TypeScript, `ws`(WebSocket), jsonwebtoken(JWT), Supabase(Postgres) |
| **Test** | Vitest (+ jsdom/MSW 클라, 인메모리 Supabase 목 서버) |

---

## 프로젝트 구조

```
client/   React 앱 (pages, components/game, features, i18n, ws, shared)
server/   Express + 게임 엔진
  src/core/        게임 엔진(engine·effects·ai·resources·rules)
  src/routes/      REST: auth/cards/decks/match/game/reviews/pve
  src/ws/          WebSocket 게임 매니저(PvP/solo)
  resources/       cards.json(39종), pveStages.json(6 스테이지)
  migrations/       001~006 SQL (Supabase 수동 적용)
docs/     balance-report.md, analytics-plan.md
```

---

## 로컬 개발

요구: **Node.js >=24.13.0 <25**

```bash
# 터미널 A — 서버 (http://localhost:3000)
cd server && npm i && npm run build && npm start

# 터미널 B — 클라이언트 (http://localhost:5173)
cd client && npm i && npm run dev
```

환경 변수
```env
# server/.env
PORT=3000
JWT_SECRET=dev-secret
SUPABASE_URL=...
SUPABASE_SERVICE_KEY=...

# client/.env
VITE_API_BASE_URL=http://localhost:3000
# 분석(비우면 비활성, 프로덕션 빌드는 기본 ID 사용)
VITE_GA4_MEASUREMENT_ID=
VITE_CLARITY_PROJECT_ID=
```

---

## 테스트

```bash
cd client && npm test     # Vitest + jsdom + MSW
cd server && npm test     # Vitest, Supabase 인메모리 목
```

---

## 서버 API 요약 (Base: `/api`)

| 그룹 | 경로 | 비고 |
|---|---|---|
| Auth | `/auth/register·login·me` | JWT — httpOnly 쿠키 또는 `Authorization: Bearer` |
| Cards | `/cards` | 검색/필터/상세 |
| Decks | `/decks` | 메인 16 / 재앙 4 검증 |
| Match | `/match/create·join·deck·:roomCode` | 방 생성·참가·덱 제출·상태 |
| Game | `/game/result·log/:roomCode` | 결과·턴 로그 |
| Reviews | `/reviews` | 게임 후 리뷰(인증) |
| PvE | `/pve/stages·progress` | 스테이지 목록·클리어 진행도 |

실시간 게임 진행(카드 사용/이동/마법진/재앙/턴)은 **WebSocket**으로 동기화하며, 프로덕션에서는 클라이언트가 백엔드에 직접 연결한다.

---

## 데이터 / 배포 노트

- 카드 데이터의 **원본은 Supabase `cards` 테이블**, `server/resources/cards.json`은 런타임이 읽는 동기화 리소스다. 수치 변경 시 cards.json + `migrations/*.sql`(DB) 양쪽을 맞춘다.
- 클라이언트는 **Vercel**, 서버는 **Render** 배포. 런타임 서버가 cards.json/pveStages.json을 읽으므로, 리소스 변경의 라이브 반영에는 서버 재배포가 필요하다.
