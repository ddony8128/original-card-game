# 오카게 QA / 리팩토링 작업 추적 (todo.md)

> 감독: Claude (Opus). 각 작업은 서브에이전트에 위임 → 감독 검토 → 테스트/린트 → 커밋.
> 정정 사항: **엔진은 버그 없이 정상 동작 중.** 구독(Observer) 아키텍처는 "의도한 설계지만 현재 미사용"
> (트리거 카드는 직접 effect-build 방식으로 동작). 따라서 A 그룹은 버그 수정이 아닌 **선택적 구조 개선**.

## 작업 규약
1. **git**: 단일 작업 브랜치(`chore/qa-refactor`)에서 작업마다 1커밋. 메시지는 `type(scope): ...`.
2. **검증**: 작업마다 관련 `test` + `typecheck(tsc)` + `lint` 통과 필수. 서버는 lint 미구성(F-5에서 추가).
3. **검토**: 각 작업 완료 후 감독이 diff 검토 → 통과해야 다음 작업.
4. 베이스라인(시작 시점): 서버 test 74✓ / tsc✓, 클라 lint✓ / test 20✓.

## 상태 범례
- [ ] 대기  · [~] 진행중  · [x] 완료(검토+커밋)  · [!] 보류/이슈

---

## F. 인프라 / 안정화 (먼저)
- [x] **F-5** 서버 ESLint 구성 + `lint` 스크립트 추가 (양쪽 동일 규약)  — *eslint.config.mjs, 0 errors/200 warns. warn 규칙은 B-4/B-5에서 error화*
- [x] **F-1** Node 버전 정리: README "18+" → ">=24.13.0 <25" (engines와 일치)
- [x] **F-2** 회귀 테스트: 기존 cardsSimulation(17카드, 전 effect타입) + 74스위트로 동작보존 리팩토링 안전망 충분 판단. A-4 진행 중 공백 발견 시 보강
- [ ] **F-3** 레포 전반 정리(불필요 파일: `test_full_stack.sh` 등 점검)

## C. 버그 패치 (사용자 영향 큼)
- [x] **C-1** 덱 2번 생성: DeckBuilder 저장 버튼이 비활성화 안 됨이 원인. raw decksApi 호출 → `useSaveDeckMutation`(분기형 create/update)로 전환, `isPending`으로 버튼 disabled + 가드. 재현 테스트(지연응답 중 재클릭→POST 1회). lint/tsc/test✓
- [x] **C-2** 버리기 중 바탕 클릭 멈춤: RequestInputModal 백드롭/ESC/X가 `onCancel`→`setRequestInput(null)`만 호출(답 미전송)→서버 WAITING_FOR_PLAYER_INPUT 영구대기. `dismissible` prop 추가, 비-멀리건 필수입력은 닫기 차단(멀리건은 빈 응답 전송하므로 닫기 허용 유지). 테스트 2개. lint/tsc/test✓
- [x] **C-3** 연속 게임 시작 안 됨: 실제 원인은 game_over 콜백을 안 타는 종료(leave/host-delete) 시 in-memory 엔진이 GAME_OVER로 잔존. `ensureRoom`에서 GAME_OVER 엔진 폐기 후 재생성. 재현 테스트 2개. tsc/lint/test✓
- [ ] **C-4** 웹소켓 연결 재시도 로직
- [x] **C-5** 자연종료 시 onGameOver에서 `roomsService.finishByCode` fire-and-forget 호출 → DB status='finished'. 재현 테스트. tsc/lint/test✓
- [x] **C-6** 끈적거림: Tailwind v4는 이미 hover를 (hover:hover) 게이팅→터치 sticky-hover 아님. 실제 원인은 async 중 즉각 피드백 부재. 비활성화+로딩표시 패턴 적용(C-1 덱저장, BackRoom 나가기; Lobby 방생성/참가는 기존 적용). ⚠️잔여 체감지연은 시각QA 항목. lint/tsc/test✓
- [x] **C-7** 시크릿탭 로그인: cross-site 쿠키(sameSite:none) 차단이 원인. 서버가 이미 지원하던 Bearer 경로를 완성 — login 응답에 token, 클라 localStorage 저장 후 Authorization 헤더 첨부(쿠키 경로 유지, additive). 서버 테스트로 '쿠키 없이 Bearer만 /me 200' 검증. ⚠️실배포 시크릿탭 최종확인 권장. lint/tsc/test✓
- [x] **C-8** 미인증 /me 3회 요청: `new QueryClient()` 기본 retry:3 → `shouldRetryQuery`(4xx 비재시도) 정책 주입. 1회 요청 후 즉시 redirect. 단위테스트 2개. lint/tsc/test✓

## A. 서버 엔진 — 구조 개선 (선택적, 회귀테스트 보호 하에)
- [x] **A-7** `type/gameEngine.ts`(GameEngineAdapter 클래스) → `core/engine/gameEngineAdapter.ts`로 이동. type 폴더는 순수 타입만 남음. tsc/lint/test✓
- [x] **A-4** `effectResolver.ts` 1372→135줄(얇은 디스패처). 효과별 함수를 `resolvers/`(mana/turn/movement/cast/combat/cardFlow/trigger)로 추출, 함수당 최대 179줄. 동작보존, tsc/lint/test✓
- [x] **A-5** switch 제거 → `EFFECT_RESOLVERS` Record<type, fn> 맵 디스패치. (키를 진짜 enum화하는 건 B-1) tsc/lint/test✓
- [ ] **A-1** (선택) 구독 아키텍처 실사용: `TRIGGERED_EFFECT`에서 effectRef 실제 실행
- [ ] **A-2** (선택) 옵저버 등록 범위 확장(모든 트리거)
- [ ] **A-3** (선택) 옵저버 생명주기(파괴 시 unregister, 종료 시 clear)
- [ ] **A-6** (대규모) 순수 엔진 / 스크립트 해석기 폴더 분리 + 주입

## B. 서버 엔진 — 타입 / 품질
- [ ] **B-1** 문자열 → enum/const 전환 (wsProtocol 메시지·액션·사유, TriggerType, AnimationKind)
- [x] **B-3** 초기 드로우 2/3 → FIRST/SECOND_PLAYER_INITIAL_DRAW 상수. heal 상한 하드코딩 20 → player.maxHp. (주요 규칙은 이미 constants에 집약돼 있었음) tsc/lint/test✓
- [ ] **B-4** `as any` 캐스팅 정리 / 타입 안정화
- [ ] **B-5** 설명 주석 → 함수명화, 죽은 TODO 정리

## D. 클라이언트 — 구조 (정우근)
- [ ] **D-1** `Lobby.tsx`(302줄) → 방생성·참가/덱리스트/대기방 컴포넌트 분리
- [ ] **D-2** `Game.tsx`(692줄) → 상대존/게임판/내존/오버레이 컴포넌트 분리
- [ ] **D-3** `Game.tsx` 핸들러 커스텀 훅화 (handlePlayCard/EndTurn/MoveToSelected/UseRitualAtSelected)
- [ ] **D-4** `DeckBuilder.tsx`(341줄) 분리
- [ ] **D-5** `useMulliganRequest.ts` 위치 정리 (features/game)
- [ ] **D-6** 폴더 컨벤션 마무리 (pages 얇게 / features / shared / ws)

## E. 클라이언트 — UI/UX
- [ ] **E-1** 로딩 스켈레톤 (Lobby 덱리스트, DeckBuilder isLoading)
- [ ] **E-2** 모바일 반응형 (Mobile/Desktop 분리, 화면너비 기준)
- [ ] **E-3** 로그인 에러 인라인 표시 + 로그아웃 버튼
- [ ] **E-4** 게임 로그 가시성 (최신 하단 고정/자동 스크롤)
- [ ] **E-5** 게임 이펙트 (피해 숫자/마법·덫 표시)
- [ ] **E-6** 덱빌더 카드 크기 고정 + 호버 z-index + 축약형 덱 카드
- [ ] **E-7** 검색 useQuery 캐싱
- [ ] **E-8** 페이지 이탈 경고 (덱수정/게임중 뒤로가기)
- [ ] **E-9** 대기실 채팅 + 덱 선택 낙관적 업데이트
- [ ] **E-10** 재앙 카드 작동 직관화 (UI)

---

## 감독 방침 (사용자 승인: 자율 진행)
- 진행 순서: **C(버그) → D(클라 구조) → B(타입/품질) → E(UX) → A(선택적 대공사)**
- 검증 우선: 버그는 **재현 테스트 작성→수정**. 순수 시각 항목만 실제 구동 확인.
- **B-1**: enum 문자열 값 = 기존 wire 문자열 유지(호환성), raw 문자열 비교만 enum/const로 교체.
- **A-1~3 / A-6**: 동작하는 엔진의 중복발화·대규모 리스크 → C/D/E 완료 후 마지막에, 테스트 보호 하에. 현재 보류.

## 진행 로그
- (시작) 베이스라인 측정 완료. todo.md 작성.
- F-5,F-1,A-7,F-2,A-4,A-5,B-3 완료(7커밋, 전부 green). 이후 자율 진행 승인받음.
