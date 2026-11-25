import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/Fluxgram/sw.js').then(reg => {
      console.log('SW registered:', reg.scope);
      if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
      }
    }).catch(err => console.error('SW registration failed:', err));
  });
}
