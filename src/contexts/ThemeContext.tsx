import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

const themes = {
  pitch_black: { bg: '#000000', surface: '#0a0a0a', text: '#ffffff', muted: '#666666', border: '#1a1a1a', accent: '#3b82f6' },
  light: { bg: '#f3f4f6', surface: '#ffffff', text: '#111827', muted: '#6b7280', border: '#e5e7eb', accent: '#2563eb' },
  new_year: { bg: '#0a192f', surface: '#112240', text: '#ffffff', muted: '#8892b0', border: '#233554', accent: '#64ffda' },
  halloween: { bg: '#1a0b0b', surface: '#2b1313', text: '#ff9900', muted: '#c06c00', border: '#ff990033', accent: '#ff5500' },
  cyberpunk: { bg: '#0d0221', surface: '#1b0b3b', text: '#00f0ff', muted: '#ff007f', border: '#ff007f', accent: '#ff007f' },
  dark: { bg: '#0f1115', surface: '#1a1a1a', text: '#ffffff', muted: '#9ca3af', border: '#2d3748', accent: '#3b82f6' },
};

type ThemeKeys = keyof typeof themes;

interface ThemeContextValue {
  theme: ThemeKeys;
  setTheme: (t: ThemeKeys) => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<ThemeKeys>(() => {
    return (localStorage.getItem('app_theme') as ThemeKeys) || 'dark';
  });

  useEffect(() => {
    localStorage.setItem('app_theme', theme);
    const t = themes[theme];
    const root = document.documentElement;
    
    root.style.setProperty('--app-bg', t.bg);
    root.style.setProperty('--app-surface', t.surface);
    root.style.setProperty('--app-text', t.text);
    root.style.setProperty('--app-text-muted', t.muted);
    root.style.setProperty('--app-border', t.border);
    root.style.setProperty('--app-accent', t.accent);
    
    document.body.style.backgroundColor = t.bg;
    document.body.style.color = t.text;
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {/* Эффекты для тем */}
      {theme === 'new_year' && <div className="snowflakes" aria-hidden="true">{Array.from({length: 20}).map((_, i) => <div key={i} className="snowflake">❅</div>)}</div>}
      {theme === 'halloween' && <div className="spiderweb">🕸️</div>}
      
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
