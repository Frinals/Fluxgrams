import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { ThemeName, themes, ThemeColors } from '@/lib/types';

interface ThemeContextValue {
  theme: ThemeName;
  colors: ThemeColors;
  setTheme: (t: ThemeName) => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeName>(() => {
    const saved = localStorage.getItem('fluxgram-theme') as ThemeName | null;
    return saved ?? 'dark';
  });

  const setTheme = (t: ThemeName) => {
    setThemeState(t);
    localStorage.setItem('fluxgram-theme', t);
  };

  const colors = themes[theme];

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--app-bg', colors.bg);
    root.style.setProperty('--app-bg-gradient', colors.bgGradient);
    root.style.setProperty('--app-text', colors.text);
    root.style.setProperty('--app-text-muted', colors.textMuted);
    root.style.setProperty('--app-surface', colors.surface);
    root.style.setProperty('--app-surface-hover', colors.surfaceHover);
    root.style.setProperty('--app-border', colors.border);
    root.style.setProperty('--app-accent', colors.accent);
    root.style.setProperty('--app-accent-gradient', colors.accentGradient);
    root.style.setProperty('--app-bubble-sent', colors.bubbleSent);
    root.style.setProperty('--app-bubble-recv', colors.bubbleRecv);
    root.style.setProperty('--app-bubble-sent-text', colors.bubbleSentText);
    root.style.setProperty('--app-bubble-recv-text', colors.bubbleRecvText);
    root.style.setProperty('--app-nav-bg', colors.navBg);
    root.style.setProperty('--app-nav-active', colors.navActive);
    root.style.setProperty('--app-success', colors.success);
    root.style.setProperty('--app-danger', colors.danger);
    root.style.setProperty('--app-glow', colors.glow);
    root.style.setProperty('--app-glass', colors.glass);
    root.style.setProperty('--app-glass-bright', colors.glassBright);
    root.style.setProperty('--app-border-glass', colors.borderGlass);
    document.body.style.background = colors.bgGradient;
    document.body.style.color = colors.text;
  }, [colors]);

  return (
    <ThemeContext.Provider value={{ theme, colors, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
