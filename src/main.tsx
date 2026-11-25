import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// РЕГИСТРАЦИЯ SERVICE WORKER ДЛЯ УВЕДОМЛЕНИЙ
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/Fluxgram/sw.js').then(reg => {
      console.log('SW registered:', reg.scope);
    }).catch(err => console.error('SW registration failed:', err));
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
