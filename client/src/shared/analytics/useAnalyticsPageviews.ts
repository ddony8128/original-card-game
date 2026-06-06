import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { trackPageview } from './index';

/**
 * 라우터 경로 변경 시마다 SPA 페이지뷰를 전송한다.
 * `/en` 프리픽스를 포함한 pathname 을 그대로 보낸다(분석에서 언어별 구분 가능).
 * 라우터 내부 컴포넌트(App)에서 1회 마운트.
 */
export function useAnalyticsPageviews(): void {
  const location = useLocation();

  useEffect(() => {
    trackPageview(location.pathname);
  }, [location.pathname]);
}
