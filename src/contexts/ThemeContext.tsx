import { createContext, useContext, useEffect, useState } from 'react';

const themes = {
  dark: { bg: '#0f1115', surface: '#1a1a1a', text: '#ffffff', muted: '#9ca3af', border: '#2d3748', accent: '#3b82f6' },
  light: { bg: '#f3f4f6', surface: '#ffffff', text: '#111827', muted: '#6b7280', border: '#e5e7eb', accent: '#2563eb' },
  neon: { bg: '#0a0a0a', surface: '#121212', text: '#00ffcc', muted: '#888888', border: '#00ffcc33', accent: '#00ffcc' },
  halloween: { bg: '#1a0b0b', surface: '#2b1313', text: '#ff9900', muted: '#c06c00', border: '#ff990033', accent: '#ff5500' },
  newyear: { bg: '#0a192f', surface: '#112240', text: '#ffffff', muted: '#8892b0', border: '#233554', accent: '#64ffda' },
  summer: { bg: '#fff7ed', surface: '#ffedd5', text: '#431407', muted: '#9a3412', border: '#fdba74', accent: '#f97316' },
  spring: { bg: '#f0fdf4', surface: '#dcfce7', text: '#14532d', muted: '#166534', border: '#bbf7d0', accent: '#22c55e' },
  black: { bg: '#000000', surface: '#111111', text: '#ffffff', muted: '#666666', border: '#222222', accent: '#3b82f6' },
};

type ThemeKeys = keyof typeof themes;

interface ThemeContextValue {
  theme: ThemeKeys;
  setTheme: (t: ThemeKeys) => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<ThemeKeys>(() => {
    return (localStorage.getItem('app_theme') as ThemeKeys) || 'dark';
  });

  useEffect(() => {
    localStorage.setItem('app_theme', theme);
    const t = themes[theme];
    const root = document.documentElement;
    
    // Применяем CSS-переменные
    root.style.setProperty('--app-bg', t.bg);
    root.style.setProperty('--app-surface', t.surface);
    root.style.setProperty('--app-text', t.text);
    root.style.setProperty('--app-text-muted', t.muted);
    root.style.setProperty('--app-border', t.border);
    root.style.setProperty('--app-accent', t.accent);
    
    // Меняем цвет фона body
    document.body.style.backgroundColor = t.bg;
    document.body.style.color = t.text;
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
