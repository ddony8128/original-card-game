import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import ko from './locales/ko.json';
import en from './locales/en.json';

/**
 * i18next 초기화.
 *
 * 번역 리소스는 locales/*.json 에서 불러온다. 아직 추출되지 않은 문자열은
 * en 이 ko 로 폴백되어 한국어로 렌더된다(번역은 작업별로 점진적으로 채운다).
 */
const initialLang =
  (typeof localStorage !== 'undefined' && localStorage.getItem('lang')) || 'ko';

void i18n.use(initReactI18next).init({
  resources: {
    ko: { translation: ko },
    en: { translation: en },
  },
  lng: initialLang,
  fallbackLng: 'ko',
  interpolation: { escapeValue: false },
});

export default i18n;
