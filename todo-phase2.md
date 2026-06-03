# Phase 2 — 시각·연출 완성도 + 튜토리얼 (todo-phase2.md)

> 목표: "프로젝트 수준 높다"는 인상을 주는 시각·연출 완성도 + 튜토리얼(휴리스틱 AI 대결).
> 감독: Claude. **모든 설계 결정은 아래에 확정** — 사용자 판단 불필요. 작업마다 1커밋 + 검증.
> 한계: 애니메이션/게임 연출의 최종 시각 확인은 헤드리스 불가 → 합리적 기본값 구현 + 로직은 테스트로 보호. 실플레이 시각 QA만 사용자 몫(차단 아님).

## 확정한 설계 결정 (decision-free)
- **턴 타이머**: 클라이언트 측 시각 카운트다운 90초/턴. 색 green→amber(≤30s)→red(≤10s). **서버 강제 타임아웃 없음**(시각 표시 전용, 엔진 리스크 회피).
- **이펙트 애니메이션**: 데미지/회복 숫자를 대상 마법사 보드 셀 위에서 rise+fade(~1s)로 띄움. Tailwind keyframe 추가.
- **카드 강조**: 사용가능(마나 충분 & 내 턴) 카드=ring+불투명, 불가=흐리게, 선택=살짝 떠오름. 보드 이동가능 셀 하이라이트 유지/개선.
- **튜토리얼**: 휴리스틱 AI와 솔로 대결 + 게임 이벤트에 연동된 coach-mark 단계 설명. 스킵/재시작 가능. 스크립트는 정적.
- **AI**: greedy 휴리스틱(사거리 내 데미지 카드 우선 → 상대쪽 이동 → 가장 싼 카드 → 턴 종료).
- **솔로/AI 룸**: 2인 경로 수정 대신 **별도 솔로 경로** 추가(리스크 격리). player2='AI', human ready 시 AI 자동 ready, AI 턴엔 서버측 드라이버가 액션 주입.
- **진입점**: Lobby "튜토리얼" 버튼 → 솔로 AI 게임 + 튜토리얼 오버레이.

## 상태 범례: [ ]대기 [~]진행 [x]완료(검토+커밋) [!]보류

---

## Epic A — UI/UX 연출 (client, 저위험·빠른 가치)
- [x] **A1** 턴 상태/타이머: useTurnTimer(90s 카운트다운, 색단계 순수함수+테스트), GameHeader 강화(내턴/상대턴 배지+ring, 타이머 색전환). tsc/lint/test✓
- [x] **A2** 데미지/회복 floating: SimpleAnimation에 side(나/상대), 대상 측 상/하단에서 `animate-float-up`(rise+fade, index.css keyframe) + 다중 가로 분산. 기존 no-op animate-* 대체. tsc/lint/build/test✓
- [x] **A3** 카드 강조: MyHand에 canAfford prop. 사용가능(내턴- [ ] **A3** 카드 강조/선택 연출: 손패 playable 강조/불가 dim/선택 lift. (시각)마나충분) 카드=ring 강조, 불가=흐리게(opacity/saturate), 선택=lift 유지. tsc/lint/test✓
- [x] **A4** 로그 발동 피드백: 최신 로그 항목 fade-in(animate-log-appear)+강조(좌측 accent border/배경/굵게). tsc/lint/build/test✓

## Epic B — 튜토리얼 + 휴리스틱 AI (server+client, 대형)
- [x] **B1** `core/ai/legalActions.ts` 순수 헬퍼(move/use_card/use_ritual/end_turn, 실핸들러 검증 미러링).
- [x] **B2** `core/ai/heuristic.ts` chooseAIAction(greedy: 비싼 카드→접근 이동→턴종료, 종료보장). B1+B2 테스트 15개. tsc/lint/test✓
- [x] **B3** 솔로/AI 룸: `ws/soloGameManager.ts`(in-memory, AI=휴먼덱 클론, AI 자동멀리건, 콜백은 사람 이벤트만 전달). AI 턴 드라이버=스텝cap(30)+매스텝 try/catch+종료 안전망(hang/throw 불가), 좌표변환(toViewerPos), 입력 기본응답. socket.ts solo 라우팅 + start_solo 이벤트. 통합테스트 4개. 서버109/1skip green.
- [x] **B4** 튜토리얼 오버레이: 하단 도킹 coach 패널(6단계 수동진행, 이전/다음/건너뛰기, 닫은 뒤 재열기). 게임이벤트 비의존(견고). 테스트 3개.
- [x] **B5** 진입: gameSocket `mode:solo`+deckId→start_solo, useGameSocket enabled 게이팅, Game `solo` prop(첫 덱 사용, DB룸 불필요), `/tutorial`(RequireAuth) 라우트, Lobby 튜토리얼 버튼. 2인 경로 불변. 클라38 green.

## 진행 로그
- (시작) phase-2 브랜치 생성, 계획 확정.
- **Phase 2 전체 완료**: Epic A(4) + Epic B(5). 서버 109 test/1skip, 클라 38 test, tsc/lint/build 전부 green.
- ⚠️ 실플레이 시각 QA(애니메이션 체감, 솔로 AI 대국 흐름)는 사용자 몫. 로직은 테스트로 보호됨.

## B2+ — AI 휴리스틱 게임규칙 종합화 (사용자 피드백 반영)
- [x] **B2+** naive '비싼 카드' → 데이터 주도 per-card 평가. (onCast 데미지 도달=enemy직격/near_enemy·choose_target는 거리≤range, 자기피해 제외; evalStepOnRitual=onDestroy 반전규칙으로 함정/파괴 판별; ongoingHarm). 우선순위 9단계: 치명타→내 공격 리추얼 사용→사거리내 데미지→체력낮으면 회복→해로운 상대리추얼 파괴(net이득)→사거리 진입 이동→유틸→전진→턴종료. 함정(onDestroy enemy=밟은이 피해) 회피, 파괴가치(onDestroy self/ongoing harm) 밟기. 테스트 +31(총140). 네트워크 차단으로 라이브 카드리스트 직접조회는 불가→스키마/엔진규칙 기반 일반화.

