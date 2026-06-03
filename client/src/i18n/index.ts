import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

/**
 * i18next 초기화.
 *
 * 현재 단계에서는 프레임워크/라우팅만 구성하고 실제 문자열은 번역하지 않는다.
 * resources 는 비워 두며, en 은 ko 로 폴백되어 모든 화면이 한국어로 렌더된다.
 * (영어 문자열은 추후 작업에서 채운다.)
 */
const initialLang =
  (typeof localStorage !== 'undefined' && localStorage.getItem('lang')) || 'ko';

void i18n.use(initReactI18next).init({
  resources: {
    ko: { translation: {} },
    en: { translation: {} },
  },
  lng: initialLang,
  fallbackLng: 'ko',
  interpolation: { escapeValue: false },
});

export default i18n;
