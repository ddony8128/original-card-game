import { createContext, useContext, useCallback } from 'react';
import { useNavigate, type NavigateOptions, type To } from 'react-router-dom';

export type Lang = 'ko' | 'en';

/**
 * 현재 언어(URL 접두사)를 하위 트리에 제공하는 컨텍스트.
 * Provider 가 없으면 기본값 'ko' 로 동작하므로(접두사 없음),
 * 기존 테스트처럼 LangLayout 없이 페이지를 단독 렌더해도 경로가 그대로 유지된다.
 */
export const LangContext = createContext<Lang>('ko');

export function useLang(): Lang {
  return useContext(LangContext);
}

/**
 * 문자열 경로를 현재 언어에 맞게 접두사 처리한다.
 * - en: `/en` 접두사를 붙인다. (예: `/lobby` -> `/en/lobby`)
 * - ko: 평문 경로를 그대로 둔다.
 * 이미 접두사가 붙어 있으면 중복으로 붙이지 않는다.
 */
export function withLang(path: string, lang: Lang): string {
  if (lang !== 'en') return path;
  // 절대 경로가 아니면(상대 경로) 접두사 처리를 생략한다.
  if (!path.startsWith('/')) return path;
  if (path === '/en' || path.startsWith('/en/')) return path;
  return path === '/' ? '/en' : `/en${path}`;
}

/** To 값이 문자열일 때만 withLang 을 적용한다(객체/숫자형 등은 그대로). */
export function applyLangToTo(to: To, lang: Lang): To {
  return typeof to === 'string' ? withLang(to, lang) : to;
}

/**
 * react-router 의 useNavigate 를 감싸 문자열 목적지에 언어 접두사를 적용한다.
 * navigate(-1) 같은 숫자형(뒤로 가기)은 그대로 전달한다.
 */
export function useLangNavigate() {
  const navigate = useNavigate();
  const lang = useLang();
  return useCallback(
    (to: To | number, options?: NavigateOptions) => {
      if (typeof to === 'number') {
        navigate(to);
        return;
      }
      navigate(applyLangToTo(to, lang), options);
    },
    [navigate, lang],
  );
}
