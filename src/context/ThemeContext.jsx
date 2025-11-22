import React, { createContext, useContext, useEffect, useState } from 'react';

const SUPPORTED_THEMES = ['light', 'dark', 'system'];

const ThemeContext = createContext(null);

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
}

/**
 * ThemeProvider - Manages dark/light theme with localStorage persistence
 *
 * Features:
 * - Persists theme preference (light, dark, or system) to localStorage
 * - Respects system preference when set to "system" and updates on change
 * - Applies 'dark' class to document element for Tailwind
 * - Provides toggle and explicit set functions for theme switching
 * - Prevents flash of unstyled content with early initialization
 */
export function ThemeProvider({ children }) {
  const getSystemTheme = () => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return 'light';
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  };
  const readStoredTheme = () => {
    if (typeof localStorage === 'undefined') return null;
    const stored = localStorage.getItem('theme');
    if (SUPPORTED_THEMES.includes(stored)) {
      return stored;
    }
    return null;
  };

  const [theme, setThemeState] = useState(() => readStoredTheme() || 'system');
  const [systemTheme, setSystemTheme] = useState(() => getSystemTheme());

  const resolvedTheme = theme === 'system' ? systemTheme : theme;

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return undefined;
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (event) => setSystemTheme(event.matches ? 'dark' : 'light');

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', handleChange);
    } else if (typeof mediaQuery.addListener === 'function') {
      mediaQuery.addListener(handleChange);
    }

    return () => {
      if (typeof mediaQuery.removeEventListener === 'function') {
        mediaQuery.removeEventListener('change', handleChange);
      } else if (typeof mediaQuery.removeListener === 'function') {
        mediaQuery.removeListener(handleChange);
      }
    };
  }, []);

  useEffect(() => {
    // Apply theme class to document element
    const root = document.documentElement;
    if (resolvedTheme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }

    // Persist to localStorage
    try {
      localStorage.setItem('theme', theme);
    } catch (error) {
      console.warn('Failed to persist theme preference', error);
    }
  }, [theme, resolvedTheme]);

  const setTheme = (nextTheme) => {
    if (!SUPPORTED_THEMES.includes(nextTheme)) return;
    setThemeState(nextTheme);
  };

  const toggleTheme = () => {
    setThemeState((prevTheme) => {
      const activeTheme = prevTheme === 'system' ? systemTheme : prevTheme;
      return activeTheme === 'dark' ? 'light' : 'dark';
    });
  };

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}
