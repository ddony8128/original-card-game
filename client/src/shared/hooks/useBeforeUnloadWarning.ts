import { useEffect } from 'react';

/**
 * enabled 인 동안 새로고침/탭 닫기/주소창 이동 시 브라우저 기본 이탈 확인창을 띄운다.
 *
 * 참고: SPA 내부 라우팅(뒤로가기 버튼)까지 막으려면 react-router 의 data router +
 * useBlocker 가 필요하다. 현재 앱은 BrowserRouter 라 그 경로는 여기서 다루지 않는다.
 */
export function useBeforeUnloadWarning(enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [enabled]);
}
