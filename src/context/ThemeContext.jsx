import React, { useEffect, useState } from 'react';
import { THEME_MODES, THEME_STORAGE_KEY } from '../config/theme';
import { ThemeContext } from './themeContextDef';

export const ThemeProvider = ({ children }) => {
  const [theme, setThemeState] = useState(() => {
    // 1. Check localStorage first
    try {
      const saved = localStorage.getItem(THEME_STORAGE_KEY);
      if (saved === THEME_MODES.LIGHT || saved === THEME_MODES.DARK) {
        return saved;
      }
    } catch {
      // Ignore localStorage access issues
    }

    // 2. Check document attribute initialized by index.html script
    if (typeof document !== 'undefined') {
      const existing = document.documentElement.getAttribute('data-theme');
      if (existing === THEME_MODES.LIGHT || existing === THEME_MODES.DARK) {
        return existing;
      }
    }

    // 3. Fallback to system preference
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-color-scheme: dark)').matches
        ? THEME_MODES.DARK
        : THEME_MODES.LIGHT;
    }

    return THEME_MODES.DARK;
  });

  useEffect(() => {
    try {
      document.documentElement.setAttribute('data-theme', theme);
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // Handle storage restrictions
    }
  }, [theme]);

  // Listen to OS theme changes if user hasn't explicitly set one
  useEffect(() => {
    if (!window.matchMedia) return;
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const handleChange = (e) => {
      const hasStoredPreference = localStorage.getItem(THEME_STORAGE_KEY);
      if (!hasStoredPreference) {
        setThemeState(e.matches ? THEME_MODES.DARK : THEME_MODES.LIGHT);
      }
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  const toggleTheme = () => {
    setThemeState((prev) =>
      prev === THEME_MODES.DARK ? THEME_MODES.LIGHT : THEME_MODES.DARK
    );
  };

  const setTheme = (newTheme) => {
    if (newTheme === THEME_MODES.LIGHT || newTheme === THEME_MODES.DARK) {
      setThemeState(newTheme);
    }
  };

  const value = {
    theme,
    isDark: theme === THEME_MODES.DARK,
    toggleTheme,
    setTheme,
  };

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};
