/**
 * 분석(GA4 + Microsoft Clarity) 경량 래퍼.
 *
 * 핵심 원칙:
 * - 환경변수(VITE_GA4_MEASUREMENT_ID / VITE_CLARITY_PROJECT_ID)가 있을 때만 동작.
 *   값이 없으면 모든 함수가 완전한 no-op 이라 개발/빌드/테스트가 안전하다.
 * - 절대 런타임 에러나 콘솔 스팸을 내지 않는다(SDK 미주입 시 optional chaining).
 * - PII 전송 금지: 식별은 서버 user id(익명)만 사용한다.
 */

const GA4_ID = import.meta.env.VITE_GA4_MEASUREMENT_ID as string | undefined;
// Clarity 프로젝트 ID. env 로 덮어쓸 수 있고, 없으면 프로덕션 빌드에서만 기본 ID 를 쓴다
// (개발/프리뷰에서는 세션 데이터 오염을 피하려고 비활성). Clarity ID 는 클라이언트에
// 노출되는 공개 식별자라 코드에 두어도 무방하다.
const CLARITY_ID =
  (import.meta.env.VITE_CLARITY_PROJECT_ID as string | undefined) ||
  (import.meta.env.PROD ? 'x2qkc89b9q' : undefined);

// init() 중복 실행 가드.
let initialized = false;

/** Clarity 로도 함께 보낼 주요 마일스톤 이벤트(필터/세션 리플레이용). */
const CLARITY_MILESTONES = new Set([
  'game_end',
  'badge_earned',
  'sign_up',
  'deck_create',
  'review_submit',
]);

function injectGtag(measurementId: string) {
  // 표준 gtag.js 스니펫. gtag 는 받은 인자를 그대로 dataLayer 에 push 한다.
  window.dataLayer = window.dataLayer || [];
  window.gtag = (...args: unknown[]) => {
    window.dataLayer!.push(args);
  };

  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`;
  document.head.appendChild(script);

  window.gtag('js', new Date());
  // SPA 라우팅을 직접 처리하므로 자동 페이지뷰는 끈다.
  window.gtag('config', measurementId, { send_page_view: false });
}

function injectClarity(projectId: string) {
  // 표준 Microsoft Clarity 스니펫: SDK 로드 전 호출을 큐(q)에 쌓는 shim.
  const queue: unknown[][] = [];
  const clarity = (...args: unknown[]) => {
    queue.push(args);
  };
  clarity.q = queue;
  window.clarity = clarity as Window['clarity'];

  const script = document.createElement('script');
  script.async = true;
  script.src = 'https://www.clarity.ms/tag/' + encodeURIComponent(projectId);
  const first = document.getElementsByTagName('script')[0];
  first?.parentNode?.insertBefore(script, first);
}

/**
 * 앱 부팅 시 1회 호출. env 가 모두 비어 있으면 아무것도 하지 않는다.
 */
export function init(): void {
  if (initialized) return;
  // SSR/비브라우저 환경 방어.
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  initialized = true;

  if (GA4_ID) injectGtag(GA4_ID);
  if (CLARITY_ID) injectClarity(CLARITY_ID);
}

/**
 * 커스텀 이벤트 전송. SDK 미주입 시 no-op.
 * 주요 마일스톤은 Clarity 에도 이벤트로 전송(필터/리플레이 검색용).
 */
export function track(event: string, params?: Record<string, unknown>): void {
  window.gtag?.('event', event, params);
  if (CLARITY_MILESTONES.has(event)) {
    window.clarity?.('event', event);
  }
}

/** SPA 페이지뷰 전송. */
export function trackPageview(path: string): void {
  window.gtag?.('event', 'page_view', { page_path: path });
}

/**
 * 사용자 식별. PII 금지 — 서버 user id(익명 식별자)만 전달할 것.
 */
export function identify(userId: string): void {
  window.clarity?.('identify', userId);
  window.gtag?.('set', { user_id: userId });
}
