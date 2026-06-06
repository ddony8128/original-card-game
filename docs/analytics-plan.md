# 분석 연동 설계: Microsoft Clarity + Google Analytics 4

> 현재 클라이언트에 analytics 미설치(그린필드). 아래는 **무엇을 어떻게 붙일지** 설계안.
> 역할 분담: **GA4 = 정량(퍼널·전환·이벤트 수치)**, **Clarity = 정성(세션 리플레이·히트맵·rage click)**. 둘 다 같은 핵심 이벤트에 태그를 달아 GA4에서 "어디서 이탈" 보고 Clarity에서 "그 세션 영상" 확인하는 흐름.

## 1. 셋업

### 환경변수 (client/.env)
```
VITE_GA4_MEASUREMENT_ID=G-XXXXXXXXXX
VITE_CLARITY_PROJECT_ID=xxxxxxxxxx
```
- 둘 다 **있을 때만** 스크립트 로드(개발/프리뷰에선 비워서 끔). 배포는 Vercel 환경변수로 주입.

### 로딩 방식 (권장: 런타임 동적 주입)
`index.html` 하드코딩 대신, 작은 `analytics` 모듈이 앱 부팅 시 env 가 있으면 gtag/clarity 스크립트를 주입. 이유: env 게이트 + SPA 라우팅 대응이 쉬움.

- **GA4**: `gtag('config', ID, { send_page_view: false })` 로 자동 페이지뷰 끄고, **라우터 변경마다 수동 `page_view`** 전송(SPA라 자동 페이지뷰는 첫 로드만 잡음).
- **Clarity**: 표준 스니펫 주입. 세션 리플레이/히트맵은 자동. 추가로 커스텀 태그/이벤트/identify API 사용.

### SPA 페이지뷰
React Router `useLocation` 변경 시 `track_pageview(path)` 호출하는 `useAnalyticsPageviews()` 훅을 `App` 최상단에 1회 마운트.

## 2. 이벤트 카탈로그

표기: GA4 이벤트명(snake_case) · 발생 시점 · 파라미터. Clarity 열은 그 시점에 함께 보낼 커스텀 태그/이벤트.

| GA4 이벤트 | 발생 시점 | 파라미터 | Clarity |
|---|---|---|---|
| `sign_up` | 회원가입 성공 | `method:"password"` | event `sign_up` |
| `login` | 로그인 성공 | `method:"password"` | `identify(userId)` |
| `deck_create` | 덱빌더 저장(신규) | `main_count`,`cata_count`,`avg_mana` | event `deck_create` |
| `deck_edit` | 덱 수정 저장 | `deck_id` | — |
| `tutorial_start` | /tutorial 진입·게임시작 | — | tag `mode=tutorial` |
| `tutorial_complete` | 튜토리얼 종료(아웃트로) | `result` | event `tutorial_complete` |
| `tutorial_skip` | 튜토리얼 건너뛰기 | `step` | event `tutorial_skip` |
| `pve_stage_view` | /pve 스테이지 화면 | `cleared_count`,`total` | — |
| `pve_challenge_start` | 스테이지 도전 시작 | `stage_id`,`stage_index`,`deck_id` | tag `stage=stage_id` |
| `game_start` | 게임 보드 진입(첫 상태수신) | `mode`(tutorial/pve/pvp),`stage_id?` | tag `mode`,`stage` |
| `game_end` | GAME_OVER | `mode`,`result`(win/lose/draw),`turns`,`stage_id?` | event `game_end_{result}` |
| `card_play` | 카드 사용 | `card_id`,`mana`,`turn` (※ 고빈도 — 4번 참고) | — |
| `turn_speed_change` | 솔로 속도 변경 | `speed` | — |
| `language_switch` | 한/영 전환 | `lang` | — |
| `glossary_open` | 용어집 열기 | `context` | event `glossary_open` |
| `badge_earned` | 전 스테이지 클리어(allCleared 최초) | — | event `badge_earned` |
| `room_create` / `room_join` | PvP 방 생성/참가 | `room_code?` | — |
| `review_submit` | 리뷰 등록 | `length` | event `review_submit` |
| `match_abandon` | 게임 중 이탈(beforeunload 경고 발생) | `mode`,`turn` | event `abandon` |

### 핵심 퍼널 (GA4 Funnel exploration 용)
`sign_up → deck_create → tutorial_start → tutorial_complete → pve_challenge_start → game_end(win)` (+ retention: `login` 재방문)
보조 퍼널(PvP): `room_create/join → game_start(pvp) → game_end`

## 3. 구현 스케치

```
client/src/shared/analytics/
  index.ts        // init(), track(event, params), trackPageview(path), identify(id), setTag(k,v)
  useAnalytics.ts // useAnalyticsPageviews() 라우터 훅
```
- `init()`: env 읽어 gtag/clarity 주입(없으면 no-op). main.tsx 또는 App 부팅 시 1회.
- `track(name, params)`: `window.gtag?.('event', name, params)` + (지정 이벤트만) `window.clarity?.('event', name)`.
- `identify(userId)`: 로그인/`me` 로드 시 `window.clarity?.('identify', userId)`. **GA4 user_id 는 PII 주의** — 익명 식별자(서버 user id)만, username/email 금지.
- 호출 지점: 각 이벤트는 해당 동작의 성공 핸들러/`useEffect`에 1줄 추가(예: `game_end` 는 Game.tsx 의 `isGameOver` 분기, `deck_create` 는 저장 mutation onSuccess).

## 4. 주의 / 권장
- **고빈도 이벤트(`card_play`)**: GA4 무료 한도(이벤트/일)와 노이즈 고려 → 처음엔 빼거나, "게임당 사용 카드 수"를 `game_end` 파라미터로 집계하는 편이 가성비 좋음. 카드별 사용 분석이 꼭 필요하면 나중에 추가.
- **PII 금지**: username/email/방 이름 등은 보내지 말 것. 식별은 서버 user id(익명)만.
- **동의/지역**: 한국 위주면 큰 이슈 없으나, EU 트래픽 생기면 Consent Mode 고려.
- **개발 분리**: 프리뷰/로컬은 env 비워 추적 끄기(데이터 오염 방지).
- **검증**: GA4 DebugView + Clarity 실시간으로 이벤트 수신 확인.

## 5. 다음 단계 (구현 시)
1. `analytics` 모듈 + `useAnalyticsPageviews` 추가, `init()` 연결.
2. 위 표의 이벤트를 해당 핸들러에 1줄씩 삽입(우선순위: sign_up/login/deck_create/game_start/game_end/badge_earned/review_submit 부터).
3. env 주입(Vercel) 후 DebugView 로 검증.
