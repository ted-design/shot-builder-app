import React from 'react';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';

/**
 * ThemeToggle - Button to switch between light and dark mode
 *
 * Features:
 * - Sun icon for light mode, Moon icon for dark mode
 * - Smooth transition animation
 * - Accessible with ARIA labels
 * - Keyboard accessible
 * - Tooltip-style title attribute
 */
export default function ThemeToggle({ className = '' }) {
  const { resolvedTheme, toggleTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  return (
    <button
      onClick={toggleTheme}
      className={`rounded-md p-2 transition-colors hover:bg-slate-100 dark:hover:bg-slate-800 focus-visible:ring-2 focus-visible:ring-primary ${className}`}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {isDark ? (
        <Sun className="h-5 w-5 text-slate-400 transition-transform hover:rotate-12" />
      ) : (
        <Moon className="h-5 w-5 text-slate-600 transition-transform hover:-rotate-12" />
      )}
    </button>
  );
}
