import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';

const root = document.getElementById('root');

if (root) {
  // Красим фон в ярко-красный. Если ты это увидишь — значит JS работает.
  root.style.backgroundColor = '#cc0000';
  root.style.color = 'white';
  root.style.padding = '20px';
  root.style.fontFamily = 'sans-serif';
  root.style.minHeight = '100vh';
  root.innerHTML = '<h1>JS работает. Пытаемся загрузить App...</h1>';

  // Асинхронно загружаем App, чтобы поймать ошибку, если она есть
  import('./App.tsx')
    .then((module) => {
      const App = module.default;
      ReactDOM.createRoot(root).render(
        <React.StrictMode>
          <App />
        </React.StrictMode>
      );
    })
    .catch((err) => {
      // Если App упал при загрузке, показываем текст ошибки
      root.innerHTML = `
        <div style="color: white; padding: 20px; font-family: sans-serif;">
          <h1>🚨 ОШИБКА ЗАГРУЗКИ ПРИЛОЖЕНИЯ 🚨</h1>
          <p style="font-size: 18px; font-weight: bold; background: rgba(0,0,0,0.3); padding: 10px; border-radius: 8px;">
            ${err.message}
          </p>
          <p style="font-size: 12px; opacity: 0.8; margin-top: 20px;">
            ${err.stack || 'Стек ошибки скрыт'}
          </p>
        </div>
      `;
    });
} else {
  document.body.innerHTML = '<h1 style="color:red; background:white; padding:20px;">ОШИБКА: div#root не найден в index.html!</h1>';
}
