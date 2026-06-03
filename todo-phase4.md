# Phase 4 — UI 개선 + 영어 지원(i18n) + 밸런스/규칙 (todo-phase4.md)

> 감독: Claude (검토/제어 중심). 구현은 서브에이전트 위임 → 감독 diff 검토 → test/lint → 스크린샷 검증 → 커밋.
> 핵심 규칙(잊지 말 것):
> - **카드 데이터의 원본은 Supabase `cards` 테이블, `server/resources/cards.json`은 동기화된 런타임 리소스.** 서버는 json을 읽음. DDL은 service key 불가(migrations 수동), 단순 UPDATE(DML)는 PostgREST로 가능.
> - cards.json에는 DB에 없는 `name_en`/`description_en`(영어 번역)이 추가돼 있음 → **DB 재export 시 영어 필드 보존/병합 필수.**
> - i18n 문자열은 `client/src/i18n/locales/{ko,en}.json`. ko 값은 화면 한국어 그대로. 카드명/설명은 서버가 ko/en 둘 다 전달 → 클라가 언어로 선택.

## 상태: [ ]대기 [~]진행 [x]완료(검토+커밋) [!]보류

## A. UI 개선 (스크린샷 기반)
- [x] **A-1** Playwright 캡처 하네스 — `client/scripts/capture.mjs`(정적/메뉴), `capture-game.mjs`(게임보드). 서버:3000+vite:5173 구동 후 실행, PNG는 `client/screenshots/`(gitignore). 커밋 `73b3c45`/`6d9e4b5`
- [x] **A-2** 덱빌더 모바일 카드 목록 찌부 수정(고정높이를 lg에만 적용). `1e31a82`
- [x] **A-3** 모바일 게임 보드 스탯/헤더 오버플로 수정(HP "20/20" 잘림 등). `845dd2e`
- 정적/메뉴 6페이지(login/lobby/deckbuilder/review/pve/notfound)는 데스크톱·모바일 양호 확인.

## B. 영어 지원 (/en, react-i18next)
- [x] **B-1** i18n 스캐폴드 + `/en` 라우팅 + lang-aware 네비게이션(useLangNavigate/LangLink) + KO/EN 토글. `client/src/i18n/`. `60a9d6f`
- [x] **B-2** 카드 39장 `name_en`/`description_en` 추가(cards.json). `d57ebb1`
- [x] **B-3** 용어집(GlossaryModal, 17개 용어 ko/en) — 로비·게임 헤더·튜토리얼에서 진입. `50e561f`
- [x] **B-4** 메인 페이지 영어화(login/lobby/deckbuilder/review/pve/notfound/backroom). `1c9f23e`
- [x] **B-5** 게임 보드 + 튜토리얼 영어화(game.* 80키, tutorial.* 23키). `7fffdcd`
- [x] **B-6** 카드 이름/설명 언어별 배선(서버 view.ts/cards.ts가 en 전달, 클라 cardMetaStore.getById가 i18n.language로 선택, 멀리건 포함). `36587f8`
- [x] **B-7** 소소한 정리(튜토리얼 영어 중복 제거, 멀리건/튜토리얼 팝업 겹침 방지, 기본 덱 이름 로케일화). `a9cf4ca`
- /en 전 화면 영어 + / 한국어 불변 스크린샷 검증 완료.

## C. 카드 데이터 / 밸런스
- [x] **C-1** 고통 동기화(c01-011) 데미지 4→5, 지맥(c01-020) 설치 거리 1→2 (설명↔효과 불일치 정정, 사용자 확정값). cards.json + DB(PostgREST) 양쪽 반영. `d9f4bb9` / `migrations/002`
- [x] **C-2** 하드 스테이지 4/5/6(HP30) — Phase 3 연장, 이미 반영.

## D. 엔진 / 게임 규칙
- [x] **D-1** 인게임 카드명 버그 — 손패/멀리건이 `c01-008` 같은 ID로 뜨던 것(서버가 손패 메타 미전달) 수정. 모든 게임 영향. `764ee1f`
- [x] **D-2** self-play hang — 빈 손패 discard softlock(phase=WAITING+pendingInput=null) 수정. (Phase 3 후반)
- [x] **D-3** **80턴 무승부 규칙** — `MAX_GAME_TURNS=80`, 초과 시 winner=null(reason `turn_limit`). 자기대전상 결판 게임 천장 ~68턴이라 정상 게임 안 자름. **PvE는 클리어 실패 처리(winner!==humanId).** 결정적 테스트 `turnLimitDraw.test.ts`. `961de0b`

## E. AI 개선 (로그 분석)
- [x] **E-1** 만피 오버힐 제거 — 힐 전용 리추얼(지력흡수)을 만피에서 안 쓰고 데미지/셋업으로 진행. `ritualUseValue(…, countSelfHeal)`. `239d263`
- [x] **E-2** 프로필 재설계/튜닝, rung 5b(유해 리추얼 접근 파괴), 측정 전용 basic 프로필 등 (Phase 3 후반 커밋들).

## 밸런스 현황 (6스테이지 vs 튜닝 basic, 각 30판, AI 승률)
- S1 bruiser 40% · S2 disruptor 33% · S3 control 83% · S4 bruiser/HP30 77% · S5 disruptor/HP30 60%(교착은 80턴 무승부=클리어실패) · S6 control/HP30 100%

## 선택 / 후속 (필수 아님)
- [ ] **F-1** stage-5 disruptor 마무리 화력 보강(덱 수정) — 교착 무승부 줄이려면. (현재는 80턴 무승부로 수용 가능)
- [ ] **F-2** stage-6 control 100% 소폭 약화 검토(최종 보스로는 적절).
- [ ] **F-3** 로그인 시 기본 덱 백필(Phase 3 P0-2 보류 항목).

## Dev 참조
- 스크린샷: 서버 build→`node dist/index.js`(:3000) + `npm run dev`(:5173) → `node client/scripts/capture*.mjs` → PNG를 Read로 검토. 서버 코드 변경 시 재빌드·재기동 필요.
- DB 동기화: `migrations/*.sql` 또는 service key + PostgREST PATCH(DML). DDL은 사용자가 Supabase SQL Editor에서 실행.
