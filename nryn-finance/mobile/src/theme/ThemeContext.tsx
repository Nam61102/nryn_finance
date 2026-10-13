import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme, StyleSheet } from 'react-native';
import {
  lightColors,
  darkColors,
  ThemeColors,
  spacing,
  radius,
  typography,
  getShadows,
} from './tokens';
import { getItem, setItem } from '../services/storage';

export type ThemeMode = 'system' | 'light' | 'dark';

export interface Theme extends ThemeColors {
  colors: ThemeColors;
  spacing: typeof spacing;
  radius: typeof radius;
  typography: typeof typography;
  shadows: ReturnType<typeof getShadows>;
  isDark: boolean;
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
}

const STORAGE_KEY = 'app_theme_mode';

const ThemeContext = createContext<Theme | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemColorScheme = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>('system');
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    getItem(STORAGE_KEY).then((saved) => {
      if (saved === 'light' || saved === 'dark' || saved === 'system') {
        setModeState(saved);
      }
      setIsLoaded(true);
    }).catch(() => setIsLoaded(true));
  }, []);

  const setMode = (newMode: ThemeMode) => {
    setModeState(newMode);
    setItem(STORAGE_KEY, newMode).catch(() => {});
  };

  const isDark =
    mode === 'dark' ? true : mode === 'light' ? false : systemColorScheme === 'dark';

  const themeValue = useMemo<Theme>(() => {
    const colors = isDark ? darkColors : lightColors;
    const shadows = getShadows(isDark);
    return {
      ...colors,
      colors,
      spacing,
      radius,
      typography,
      shadows,
      isDark,
      mode,
      setMode,
    };
  }, [isDark, mode]);

  return <ThemeContext.Provider value={themeValue}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    // Graceful fallback for components mounted outside provider (tests/isolated)
    const colors = lightColors;
    return {
      ...colors,
      colors,
      spacing,
      radius,
      typography,
      shadows: getShadows(false),
      isDark: false,
      mode: 'light',
      setMode: () => {},
    };
  }
  return ctx;
}

export function makeStyles<T extends StyleSheet.NamedStyles<T> | StyleSheet.NamedStyles<any>>(
  stylesFactory: (theme: Theme) => T
) {
  return function useStyles(): T {
    const theme = useTheme();
    return useMemo(() => stylesFactory(theme), [theme]);
  };
}
