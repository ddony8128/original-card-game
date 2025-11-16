// import { StrictMode } from 'react'
// StrictMode is disabled because it causes a crash about the use of websocket in useEffect.
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(<App />);
