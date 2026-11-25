import './index.css';

const rootElement = document.getElementById('root');

if (rootElement) {
  import('./App.tsx')
    .then(({ default: App }) => {
      import('react').then((React) => {
        import('react-dom/client').then((ReactDOM) => {
          ReactDOM.createRoot(rootElement).render(
            React.createElement(React.StrictMode, null, React.createElement(App))
          );
        });
      });
    })
    .catch((error) => {
      rootElement.innerHTML = `
        <div style="color: white; background: #cc0000; padding: 20px; font-family: sans-serif; min-height: 100vh;">
          <h2 style="font-size: 24px;">🚨 ОШИБКА ПРИ ЗАГРУЗКЕ!</h2>
          <p style="font-size: 16px;">Приложение упало до запуска React.</p>
          <p style="font-size: 16px; font-weight: bold; word-break: break-all;">Текст: ${error.message}</p>
          <p style="font-size: 12px; opacity: 0.8;">${error.stack || ''}</p>
        </div>
      `;
    });
}
