이 프로젝트는 `client/`와 `server/`로 분리된 구조의 카드 게임 기본 세팅입니다.

- client: React 19 + TypeScript 5.9, Vite 7 기반. 상태관리는 Zustand, 라우팅은 React Router, HTTP 통신은 Axios를 사용합니다. ESLint 9 설정과 `dev/build/preview` 스크립트가 포함되어 빠른 개발·빌드를 지원합니다.
- server: Express 5와 CORS를 사용하는 최소 서버로, 추후 게임 API·세션 관리 등으로 확장 가능합니다.

역할 분리: 클라이언트는 UI/게임 로직을 담당하고, 서버는 백엔드 엔드포인트와 게임 상태 관리를 담당합니다. 폴더 구조는 간단하며, `client/`에는 프론트엔드 소스와 Vite/TS 설정이, `server/`에는 Express 의존성과 서버 코드가 위치합니다.