# 클라이언트 폴더 구조 컨벤션

새 코드를 어디에 둘지 판단하는 기준. "잘 바뀌지 않는 것 / 자주 바뀌는 것"과
"역할(데이터 / 표현 / 조합)"로 나눈다.

```
src/
├─ pages/        # 라우트 단위 화면. 컴포넌트 조합 + 훅 사용만. 로직 최소화.
├─ components/   # 표현(presentational) 컴포넌트
│  ├─ ui/        # 전역 재사용 프리미티브 (button, dialog, input ...)
│  └─ <area>/    # 특정 화면 전용 컴포넌트 (game, lobby, deck-builder, auth)
├─ features/     # 도메인별 데이터 계층 + 도메인 훅
│  └─ <domain>/  # auth, cards, decks, match, reviews, logs, game
│     ├─ api.ts     # 서버 호출 wrapper (http 사용)
│     ├─ queries.ts # react-query 훅 (use...Query / use...Mutation)
│     └─ hooks/     # 그 도메인에서만 쓰는 커스텀 훅 (useDeckBuilder, useGameActions ...)
├─ shared/       # 횡단 관심사
│  ├─ api/       # http wrapper, 공용 DTO 타입, authToken
│  ├─ lib/       # 순수 유틸 (cn, getErrorMessage ...)
│  ├─ store/     # 전역 zustand 스토어 (gameStore, cardMetaStore)
│  └─ types/     # 공용 타입 (game, ws, deck)
├─ ws/           # 웹소켓 클라이언트 (gameSocket) 와 연결 훅 (useGameSocket)
└─ test/         # vitest + msw 테스트
```

## 원칙

- **pages 는 얇게.** 상태/핸들러가 길어지면 `features/<domain>/hooks/` 의 커스텀 훅으로,
  반복되는 마크업은 `components/<area>/` 컴포넌트로 뺀다.
- **표현과 데이터를 섞지 않는다.** `components/<area>/` 는 props 로 받은 값만 그린다.
  서버 호출/스토어 접근은 `features/` 또는 페이지/훅에서 한다.
- **도메인 전용 vs 전역.** 한 화면에서만 쓰면 `components/<area>/`,
  여러 곳에서 쓰면 `components/ui/` 또는 `shared/`.
- REST 도메인은 `features/<domain>/` 에 `api.ts` + `queries.ts` 를 둔다.
  게임처럼 ws 기반이라 REST 가 없으면 `hooks/` 만 둘 수 있다 (`features/game/`).
