import { useEffect, type ReactNode } from 'react';
import i18n from './index';
import { LangContext, type Lang } from './nav';

type LangLayoutProps = {
  lang: Lang;
  children: ReactNode;
};

/**
 * URL 접두사로 결정된 언어를 i18next 와 localStorage 에 반영하고,
 * 하위 트리에 LangContext 로 현재 언어를 제공한다.
 */
export function LangLayout({ lang, children }: LangLayoutProps) {
  useEffect(() => {
    void i18n.changeLanguage(lang);
    try {
      localStorage.setItem('lang', lang);
    } catch {
      // localStorage 접근 불가 환경은 무시한다.
    }
  }, [lang]);

  return <LangContext.Provider value={lang}>{children}</LangContext.Provider>;
}
