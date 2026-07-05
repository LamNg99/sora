import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { type ThemeColors, type Theme, THEMES, DEFAULT_THEME } from '../../theme';

const CONFIG_DIR = join(homedir(), '.sora');
const THEME_PREFERENCE_FILE = join(CONFIG_DIR, 'theme.json');

type ThemePreference = {
  themeName: string;
};

function getInitialTheme(): Theme {
  try {
    const preferences = JSON.parse(
      readFileSync(THEME_PREFERENCE_FILE, 'utf-8'),
    ) as Partial<ThemePreference>;
    const savedTheme = THEMES.find((theme) => theme.name === preferences.themeName);
    return savedTheme ?? DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
}

function persistTheme(theme: Theme) {
  try {
    mkdirSync(CONFIG_DIR, { recursive: true });
    writeFileSync(
      THEME_PREFERENCE_FILE,
      JSON.stringify({ themeName: theme.name } satisfies ThemePreference, null, 2),
      'utf-8',
    );
  } catch (error) {
    console.error('Failed to persist theme preference:', error);
  }
}

type ThemeContextValue = {
  colors: ThemeColors;
  theme: Theme;
  setTheme: (theme: Theme) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function useTheme(): ThemeContextValue {
  const value = useContext(ThemeContext);
  if (!value) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return value;
}

type ThemeProviderProps = {
  children: ReactNode;
};

export function ThemeProvider({ children }: ThemeProviderProps) {
  const [currentTheme, setCurrentTheme] = useState<Theme>(getInitialTheme());

  const setTheme = useCallback((theme: Theme) => {
    setCurrentTheme(theme);
    persistTheme(theme);
  }, []);

  return (
    <ThemeContext.Provider value={{ colors: currentTheme.colors, theme: currentTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}
