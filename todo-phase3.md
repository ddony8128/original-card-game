# Phase 3 — PvE + 튜토리얼 개선 + AI (todo-phase3.md)

> 감독: Claude (검토/제어 중심). 구현은 서브에이전트 위임 → 감독 diff 검토 → test/lint → 커밋.
> DDL은 service key로 불가 → `migrations/001_pve_progress.sql`을 사용자가 Supabase SQL Editor에서 실행.
> 카드 데이터는 `resources/cards.json`(39장). AI 프로필은 cards.json에 의존 OK / 역방향 금지.

## 확정 데이터 — 덱 (카드 id, 전부 16 main + 4 cata 검증됨)
- **기본 덱** main: c01-001x2 c01-005x2 c01-006x2 c01-003x1 c01-009x2 c01-014x1 c01-008x2 c01-016x2 c01-020x1 c01-026x1 | cata: c01-901x2 c01-902x2
- **stage1 무투법사** main: c01-001x1 c01-002x2 c01-014x1 c01-008x2 c01-011x2 c01-012x2 c01-004x2 c01-017x1 c01-018x2 c01-024x1 | cata: c01-901x2 c01-905x2
- **stage2 게임 개같이 하네** main: c01-001x2 c01-007x2 c01-005x2 c01-032x2 c01-019x1 c01-015x1 c01-021x2 c01-023x2 c01-027x2 | cata: c01-902x2 c01-903x2
- **stage3 노루 약해요** main: c01-001x2 c01-003x2 c01-008x2 c01-020x1 c01-015x1 c01-029x1 c01-023x2 c01-026x1 c01-027x2 c01-013x2 | cata: c01-902x2 c01-904x2

## 확정 — 스테이지 AI 프로필(플레이스타일)
- **S1 무투법사**: 적정 거리 유지, 킬각 볼 때 버스트. 마나담긴찌르기(c01-002)/각력강화(c01-004)는 킬각에만. 병주고약주기(c01-024)/카드날리기(c01-012)는 거의 킬각 전용.
- **S2 게임 개같이 하네**: 킬각 없으면 치킨게임(c01-007)/게임개같이하네(c01-021) 최대한 스팸. 당장 못 쓰면 3칸 이상 거리 유지.
- **S3 노루 약해요**: 5마나 될 때까지 거리 유지 / 또는 지맥(c01-020)·지력흡수(c01-015) 설치. 아무것도안합니다(c01-013)=덱압축. 이후 좋은게임오래오래(c01-027)+전력질주(c01-029)+운기조식(c01-003)+독서(c01-008)로 힐·드로우 사이클, 지진(c01-023)+운석(c01-026) 반복.

## 상태: [ ]대기 [~]진행 [x]완료(검토+커밋) [!]보류

## P0 — 데이터/DB 기반
- [x] **P0-1** `resources/pveStages.json`(3스테이지, 16/4 검증)+`pveStages.ts` 로더+테스트. profileId=bruiser/disruptor/control. tsc/lint/test✓
- [x] **P0-2** `resources/defaultDeck.json`+로더, `decksService.createDefaultDeckFor`, register에 비치명적 배선(실패해도 가입 성공). 테스트(가입→기본 덱 존재). 로그인 백필은 보류. tsc/lint/test✓
- [!] **P0-3** `pve_progress` 테이블 — **사용자가 migrations/001 실행 대기**. 그 후 service(getCleared/markCleared) 구현. (코드는 미리 작성 가능)

## P1 — AI
- [x] **P1-1** 킬각 정교화(이번 턴 도달 총데미지≥opp.hp), 거리 규율, 리추얼 셋업 타이밍, 마나 임계 게이팅.
- [x] **P1-2** `profiles.ts`: AIProfile + getProfile. default(레거시동일)/bruiser/disruptor/control. chooseAIAction(...,profile?)로 사다리에 얇게 적용.
- [x] **P1-3** `selfPlay.ts`: 시드드(mulberry32) 헤드리스 AI vs AI, 종료보장(스텝/턴 cap). runSelfPlay 승률 지표. 테스트 4. (bruiser vs control=control~65%)

## P2 — 솔로/PvE 서버
- [x] **P2-1** start_solo에 mode(tutorial|pve)+stageId. PvE는 AI덱=스테이지덱, AI프로필=스테이지프로필; 드라이버가 room.aiProfile를 chooseAIAction에 전달. 튜토리얼 불변. PvE 테스트 2. tsc/lint/test✓
- [ ] **P2-2** PvE 승리 시 markCleared.
- [ ] **P2-3** `GET /api/pve/progress`(클리어 목록 + allCleared).

## P3 — 클라 UI
- [ ] **P3-1** PvE 스테이지 선택 화면(클리어 예쁜 표시).
- [ ] **P3-2** PvE 플레이(Game solo + stageId), 승리 시 반영.
- [ ] **P3-3** 골드 뱃지(올클리어) / 미클리어 안내문.
- [ ] **P3-4** 로비 PvE 진입 버튼.

## P4 — 튜토리얼 개선
- [ ] **P4-1** 기본 덱으로 플레이.
- [ ] **P4-2** 전투 후 덱 구성 안내 단계.

## 진행 로그
- 4개 덱 카드 id 해석·검증 완료. pve_progress 미존재 확인 → 마이그레이션 SQL 제공.
