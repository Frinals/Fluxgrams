import React from 'react';

export default function App() {
  return (
    <div style={{ backgroundColor: 'white', color: 'black', minHeight: '100vh', padding: '20px', fontSize: '24px', fontWeight: 'bold' }}>
      <h1>ПРИЛОЖЕНИЕ ЗАПУСТИЛОСЬ!</h1>
      <p>Если ты видишь этот БЕЛЫЙ экран с черным текстом, значит сборка, GitHub и React работают идеально.</p>
      <p>Значит, проблема 100% была в контекстах (ThemeProvider, AuthProvider) или в темной теме.</p>
    </div>
  );
}
