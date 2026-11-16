import React from 'react';
import { AppShell } from './components/AppShell';
import { ThemeProvider } from './providers'; 
import { LanguageProvider } from './providers';
import { AuthProvider } from './providers';

export default function App() {
  return (
    <ThemeProvider>
      <LanguageProvider>
        <AuthProvider>
          <AppShell />
        </AuthProvider>
      </LanguageProvider>
    </ThemeProvider>
  );
}
