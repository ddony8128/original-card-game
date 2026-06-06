// import { StrictMode } from 'react'
// StrictMode is disabled because it causes a crash about the use of websocket in useEffect.
import { createRoot } from 'react-dom/client';
import './i18n'; // i18next 초기화(부수효과 import) — App 렌더 전에 수행
import App from './App.tsx';
import './index.css';
import { init as initAnalytics } from './shared/analytics';

// 분석 초기화(env 없으면 no-op) — 앱 렌더 전에 1회.
initAnalytics();

createRoot(document.getElementById('root')!).render(<App />);
