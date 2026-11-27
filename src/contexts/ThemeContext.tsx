import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

export const themes = {
  pitch_black: { bg: '#000000', surface: 'rgba(20, 20, 20, 0.6)', text: '#ffffff', muted: '#666666', border: 'rgba(255,255,255,0.1)', accent: '#3b82f6' },
  light: { bg: '#f3f4f6', surface: 'rgba(255, 255, 255, 0.6)', text: '#111827', muted: '#6b7280', border: 'rgba(0,0,0,0.1)', accent: '#2563eb' },
  violet: { bg: '#0b0312', surface: 'rgba(60, 20, 100, 0.5)', text: '#ffffff', muted: '#b58bff', border: 'rgba(180, 100, 255, 0.3)', accent: '#8b5cf6' }, // <-- НОВАЯ ТЕМА
  new_year: { bg: '#0a192f', surface: 'rgba(17, 34, 64, 0.6)', text: '#ffffff', muted: '#8892b0', border: 'rgba(35, 53, 84, 0.5)', accent: '#64ffda' }, 
  halloween: { bg: '#0a0505', surface: 'rgba(40, 15, 10, 0.6)', text: '#ff9900', muted: '#cc5500', border: 'rgba(255, 153, 0, 0.2)', accent: '#ff5500' },
  cyberpunk: { bg: '#050510', surface: 'rgba(15, 0, 30, 0.6)', text: '#00f0ff', muted: '#ff007f', border: 'rgba(255, 0, 127, 0.4)', accent: '#ff007f' },
  dark: { bg: '#0f1115', surface: 'rgba(30, 34, 42, 0.6)', text: '#ffffff', muted: '#9ca3af', border: 'rgba(255, 255, 255, 0.1)', accent: '#3b82f6' },
};

type ThemeKeys = keyof typeof themes;

interface ThemeContextValue {
  theme: ThemeKeys;
  setTheme: (t: ThemeKeys) => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<ThemeKeys>(() => {
    const saved = localStorage.getItem('app_theme') as ThemeKeys;
    return (saved && themes[saved]) ? saved : 'dark';
  });

  useEffect(() => {
    localStorage.setItem('app_theme', theme);
    const t = themes[theme];
    if (!t) return;
    
    const root = document.documentElement;
    root.setAttribute('data-theme', theme);
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
      {theme === 'new_year' && (
        <div className="snow-container">
          {Array.from({ length: 50 }).map((_, i) => (
            <div key={i} className="snow-particle" style={{ left: `${Math.random() * 100}%`, width: `${Math.random() * 5 + 2}px`, height: `${Math.random() * 5 + 2}px`, filter: Math.random() > 0.5 ? `blur(${Math.random() * 2 + 1}px)` : 'none', animationDuration: `${Math.random() * 6 + 7}s`, animationDelay: `${Math.random() * 8}s` }} />
          ))}
        </div>
      )}
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
