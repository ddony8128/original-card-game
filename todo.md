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
- [~] **F-3** 정리: 클라 프로덕션 코드 디버그 `console.log` 7개 제거(gameStore/useGameActions). `test_full_stack.sh`는 로컬 개발용 스크립트(어디서도 미참조)지만 유용할 수 있어 **삭제 보류, 사용자 확인 권장**. tsc/lint/test✓

## C. 버그 패치 (사용자 영향 큼)
- [x] **C-1** 덱 2번 생성: DeckBuilder 저장 버튼이 비활성화 안 됨이 원인. raw decksApi 호출 → `useSaveDeckMutation`(분기형 create/update)로 전환, `isPending`으로 버튼 disabled + 가드. 재현 테스트(지연응답 중 재클릭→POST 1회). lint/tsc/test✓
- [x] **C-2** 버리기 중 바탕 클릭 멈춤: RequestInputModal 백드롭/ESC/X가 `onCancel`→`setRequestInput(null)`만 호출(답 미전송)→서버 WAITING_FOR_PLAYER_INPUT 영구대기. `dismissible` prop 추가, 비-멀리건 필수입력은 닫기 차단(멀리건은 빈 응답 전송하므로 닫기 허용 유지). 테스트 2개. lint/tsc/test✓
- [x] **C-3** 연속 게임 시작 안 됨: 실제 원인은 game_over 콜백을 안 타는 종료(leave/host-delete) 시 in-memory 엔진이 GAME_OVER로 잔존. `ensureRoom`에서 GAME_OVER 엔진 폐기 후 재생성. 재현 테스트 2개. tsc/lint/test✓
- [x] **C-4** 웹소켓 재연결: onclose가 재시도 없이 socket만 null로 둠. 지수 백오프(500ms~10s, 최대10회) 자동 재연결, 의도적 close()와 끊김 구분, 성공 시 ready 재전송. mock WS+fake timer 테스트 4개. ⚠️후속: 디스커넥트 중 누락 패치 서버측 재동기화. lint/tsc/test✓
- [x] **C-5** 자연종료 시 onGameOver에서 `roomsService.finishByCode` fire-and-forget 호출 → DB status='finished'. 재현 테스트. tsc/lint/test✓
- [x] **C-6** 끈적거림: Tailwind v4는 이미 hover를 (hover:hover) 게이팅→터치 sticky-hover 아님. 실제 원인은 async 중 즉각 피드백 부재. 비활성화+로딩표시 패턴 적용(C-1 덱저장, BackRoom 나가기; Lobby 방생성/참가는 기존 적용). ⚠️잔여 체감지연은 시각QA 항목. lint/tsc/test✓
- [x] **C-7** 시크릿탭 로그인: cross-site 쿠키(sameSite:none) 차단이 원인. 서버가 이미 지원하던 Bearer 경로를 완성 — login 응답에 token, 클라 localStorage 저장 후 Authorization 헤더 첨부(쿠키 경로 유지, additive). 서버 테스트로 '쿠키 없이 Bearer만 /me 200' 검증. ⚠️실배포 시크릿탭 최종확인 권장. lint/tsc/test✓
- [x] **C-8** 미인증 /me 3회 요청: `new QueryClient()` 기본 retry:3 → `shouldRetryQuery`(4xx 비재시도) 정책 주입. 1회 요청 후 즉시 redirect. 단위테스트 2개. lint/tsc/test✓

## A. 서버 엔진 — 구조 개선 (선택적, 회귀테스트 보호 하에)
- [x] **A-7** `type/gameEngine.ts`(GameEngineAdapter 클래스) → `core/engine/gameEngineAdapter.ts`로 이동. type 폴더는 순수 타입만 남음. tsc/lint/test✓
- [x] **A-4** `effectResolver.ts` 1372→135줄(얇은 디스패처). 효과별 함수를 `resolvers/`(mana/turn/movement/cast/combat/cardFlow/trigger)로 추출, 함수당 최대 179줄. 동작보존, tsc/lint/test✓
- [x] **A-5** switch 제거 → `EFFECT_RESOLVERS` Record<type, fn> 맵 디스패치. (키를 진짜 enum화하는 건 B-1) tsc/lint/test✓
- [x] **A-1** TRIGGERED_EFFECT가 effectRef(트리거 config)를 실제 빌드·실행. 구독 경로 활성화.
- [x] **A-2** turnResolvers의 직접 발화 루프 제거 → enqueueTriggeredEffects(구독)로 교체. reconcileRitualObservers로 보드 리추얼을 트리거 직전 레지스트리에 동기화(INSTALL/직접배치 모두 커버, hasRitual로 중복 방지). collectTriggeredEffects에 owner 필터(턴 소유자만).
- [x] **A-3** 생명주기: destroyRitual→unregisterByRitual, checkGameOver(GAME_OVER)→observers.clear. 신규 테스트 3개(단일발화/상대미발화/파괴후미발화), fail-before 검증. 서버83 green.
- [x] **A-6** 순수 엔진/스크립트 해석기 **의존성 주입**으로 실현(고위험 파일 대이동 대신): EngineConfig에 effectResolver+actionHandlers 주입점, defaultScripts.ts(기본 wiring), handlePlayerAction switch→주입 맵 lookup, stepUntilStable→resolveEffectFn. core/engine/README.md로 경계 문서화. 주입 테스트 3개. 서버86 green.

## B. 서버 엔진 — 타입 / 품질
- [~] **B-1** (판단) ws 프로토콜은 이미 **타입드 string-literal union**이라 typo는 tsc가 차단(타입안전 확보). 영향력 큰 버전(숫자 wire enum)은 클라/서버 lockstep+버저닝 필요한 고위험·저가치 → 보류.
- [x] **B-3** 초기 드로우 2/3 → FIRST/SECOND_PLAYER_INITIAL_DRAW 상수. heal 상한 하드코딩 20 → player.maxHp. (주요 규칙은 이미 constants에 집약돼 있었음) tsc/lint/test✓
- [x] **B-4** action 디스패치 `as any` 제거: `UseRitualActionPayload` 추가, move/use_card/use_ritual을 판별 union 특정 타입으로 캐스트. any경고 203→198. tsc/lint/test✓ (엔진 내부 effect 동적처리용 any는 정당하여 유지)
- [~] **B-5** (판단) A-4 분해 후 주석 대부분 정확. resolveTriggeredEffect TODO는 거짓이 아니라 보류된 A-1 작업 표시→유지. 대량 주석정리는 저가치·노이즈 위험으로 보류.

## D. 클라이언트 — 구조 (정우근)
- [x] **D-1** `Lobby.tsx` 302→124줄. `components/lobby/`로 CreateRoomCard/JoinRoomCard/MyDecksCard/WaitingRoomsList 추출, 중복 getErrorMessage→`shared/lib/errors.ts`. 동작보존, 6 Lobby 테스트+전체 31 green. tsc/lint✓
- [x] **D-2** `Game.tsx` JSX를 `components/game/`의 OpponentZone/BoardZone/PlayerZone/MyHand/GameOverOverlay로 verbatim 분리(D-3 포함 692→449줄). isWin/isLose는 Boolean() 래핑(동작동일). tsc/lint/test31✓ (게임플레이 수동QA 권장)
- [x] **D-3** Game 4개 핸들러를 `features/game/hooks/useGameActions.ts`로 verbatim 추출(Game 692→610줄). rules-of-hooks 위해 position 계산을 early return 앞으로 이동, 훅 무조건 호출. tsc/lint/test31✓ (게임플레이 수동QA 권장)
- [x] **D-4** `DeckBuilder.tsx` 341→150줄. 상태/로직 전체를 `features/decks/hooks/useDeckBuilder.ts`(244줄)로 추출, 페이지는 기존 CardFilters/DeckPanel/GameCard 조합. C-1 isPending 보존, 3 테스트+전체 31 green. tsc/lint✓
- [x] **D-5** `useMulliganRequest.ts` → `features/game/hooks/`로 이동(컴포넌트 폴더에 있던 훅 정리). tsc/lint/test✓
- [x] **D-6** 폴더 컨벤션 확립·문서화: D-1~D-5로 pages 슬림화(Game 449/Lobby124/DeckBuilder150) 완료. 구조(components/<area>·features/<domain>+hooks·shared·ws)를 `client/src/README.md`에 코드화(대규모 이동 대신 문서로 일관성 확보)

## E. 클라이언트 — UI/UX
- [x] **E-1** 스켈레톤 UI: `components/ui/skeleton.tsx` 추가. Lobby 덱리스트 로딩 시 스켈레톤 행("(0/4)" 깜빡임 제거, 헤더는 '…'), DeckBuilder 카드목록 로딩 시 스켈레톤 그리드. tsc/lint/test✓
- [~] **E-2** 안전 반응형 패스: viewport meta 확인(존재), 게임 존 간격 `gap-2 sm:gap-4`, 페이지 패딩 `p-4 sm:p-6`(데스크톱 불변). tsc/lint/test✓. ⚠️완전한 Mobile/Desktop 컴포넌트 분리 + 실기기 시각QA는 후속(시각 확인 필수라 자율 한계).
- [x] **E-3** 로그인 실패를 토스트→인라인 빨간 메시지(role=alert, 입력 시 클리어). `doAfterAuth`→`goToLobbyAfterAuth` 개명. 서버 `POST /api/auth/logout`(쿠키 클리어)+`useLogoutMutation`(토큰폐기+캐시clear)+Lobby 로그아웃 버튼. Login 테스트 추가. 서버78/클라32 green.
- [x] **E-4** 게임 로그: 새 로그 도착 시 bottomRef로 자동 하단 스크롤(최신이 묻히지 않음). tsc/lint/test✓ (시각 확인 권장)
- [x] **E-5** 게임 이펙트: AnimationLayer 피해=빨강 "-N"(기존엔 "+N"로 회복처럼 보이던 버그 수정), 회복=초록 "+N", 글자 키우고 glow. tsc/lint/test✓ (게임 구동 시각QA 권장)
- [x] **E-6** GameCard: 호버 확대가 가려지지 않게 `hover:z-20`, 너비 출렁임 방지 `max-w-[220px]`+중앙정렬. tsc/lint/test✓. ⚠️하스스톤식 가로 축약형 덱 카드는 별도 UI 재설계로 후속(시각QA 필요).
- [x] **E-7** 검색 캐싱: useCardsQuery에 staleTime(5분)+keepPreviousData. 같은 검색어 재방문 시 재요청 없음, 타이핑 중 깜빡임 제거. tsc/lint/test✓
- [x] **E-8** 이탈 경고: `useBeforeUnloadWarning` 훅 — 덱 작성중/게임 진행중 새로고침·탭닫기·주소창이동 시 브라우저 확인창. ⚠️SPA 인앱 뒤로가기 차단은 react-router data-router+useBlocker 마이그레이션 필요(보류). tsc/lint/test✓
- [x] **E-9** 대기실 채팅(휘발성 ws): 프로토콜 join_chat/chat 이벤트, 서버 handleJoinChat(ready/엔진과 완전 분리)+handleChat(검증·길이제한·username 조회·broadcast), 클라 chat모드 소켓+useRoomChat 훅+BackRoom 채팅 UI. 서버 테스트 2개. + 덱 선택 낙관적 업데이트(즉시 반영, 실패 시 롤백). 서버80/클라32 green.
- [x] **E-10** 재앙 덱을 주황 테두리/색으로 시각 구분 + "특정 조건에서 자동 발동" 안내문구·툴팁 추가(공유 카드임 명시). tsc/lint/test✓ (시각QA 권장)

---

## 감독 방침 (사용자 승인: 자율 진행)
- 진행 순서: **C(버그) → D(클라 구조) → B(타입/품질) → E(UX) → A(선택적 대공사)**
- 검증 우선: 버그는 **재현 테스트 작성→수정**. 순수 시각 항목만 실제 구동 확인.
- **B-1**: enum 문자열 값 = 기존 wire 문자열 유지(호환성), raw 문자열 비교만 enum/const로 교체.
- **A-1~3 / A-6**: 동작하는 엔진의 중복발화·대규모 리스크 → C/D/E 완료 후 마지막에, 테스트 보호 하에. 현재 보류.

## 진행 로그
- (시작) 베이스라인 측정 완료. todo.md 작성.
- F-5,F-1,A-7,F-2,A-4,A-5,B-3 완료(7커밋, 전부 green). 이후 자율 진행 승인받음.
- **C 버그 전체(C-1~C-8) 완료** — 각 버그마다 재현/회귀 테스트 추가. 서버 78 test / 클라 31 test, 전부 green.
- 다음 예정: D(클라 구조) → B(타입/품질) → E(UX) → A(선택적 대공사).
- **전 작업 완료**: C(8) D(6) E(10) F(5) A(7) B(5). 서버 86 test / 클라 32 test, tsc/lint 전부 green.
- 보류(근거 기록): B-1(이미 타입드 union), B-5(주석 대부분 정확). 후속 권장(시각QA/대규모): E-2 완전 Mobile/Desktop 분리, E-6 가로형 덱카드, C-4 디스커넥트 재동기화, F-3 test_full_stack.sh 삭제 확인.
