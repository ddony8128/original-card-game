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
- [ ] **C-1** 덱 2번 생성 (버튼 클릭 후 비활성화 안 함 → isLoading)
- [ ] **C-2** 버리기 상황에서 바탕(빈 칸) 클릭 시 게임 멈춤
- [ ] **C-3** 연속 게임 진행 시 게임 시작 안 됨 (상태/initialized 리셋)
- [ ] **C-4** 웹소켓 연결 재시도 로직
- [ ] **C-5** 게임 종료 후 state가 finished로 정확히 전환 안 됨
- [ ] **C-6** 버튼 클릭 반응성("끈적거림")
- [ ] **C-7** 시크릿탭 로그인 안 됨 (쿠키/스토리지 의존)
- [ ] **C-8** 미인증 lobby 접근 시 `/api/auth/me` 3회 요청

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
- [ ] **B-3** 매직넘버 → `rules/constants.ts` 수집
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

## 진행 로그
- (시작) 베이스라인 측정 완료. todo.md 작성.
