// gtag / clarity 전역 타입 선언.
// 분석 SDK 는 런타임에 동적 주입되므로 컴파일 타임 타입은 느슨하게(any) 둔다.
export {};

declare global {
  interface Window {
    // GA4 (gtag.js)
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
    // Microsoft Clarity
    clarity?: (...args: unknown[]) => void;
  }
}
