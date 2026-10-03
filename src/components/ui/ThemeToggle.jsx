import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../../hooks/useTheme';

/**
 * ThemeToggle Component
 * Smooth interactive toggle between Light and Dark themes with Sun/Moon icons.
 */
export const ThemeToggle = ({ className = '' }) => {
  const { isDark, toggleTheme } = useTheme();

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={`Switch to ${isDark ? 'light' : 'dark'} mode`}
      title={`Switch to ${isDark ? 'light' : 'dark'} mode`}
      className={`relative inline-flex items-center justify-center w-10 h-10 rounded-xl bg-[var(--glass)] hover:bg-[var(--glass-hover)] border border-[var(--glass-border)] text-[var(--text)] backdrop-blur-md shadow-[var(--shadow-sm)] transition-all duration-300 hover:scale-105 active:scale-95 cursor-pointer overflow-hidden ${className}`}
    >
      <span
        className={`transform transition-all duration-300 ease-out inline-flex items-center justify-center ${isDark
            ? 'rotate-0 opacity-100 scale-100 text-amber-300'
            : '-rotate-90 opacity-0 scale-50 absolute'
          }`}
        aria-hidden="true"
      >
        <Moon className="w-5 h-5" />
      </span>

      <span
        className={`transform transition-all duration-300 ease-out inline-flex items-center justify-center ${!isDark
            ? 'rotate-0 opacity-100 scale-100 text-amber-500'
            : 'rotate-90 opacity-0 scale-50 absolute'
          }`}
        aria-hidden="true"
      >
        <Sun className="w-5 h-5" />
      </span>
    </button>
  );
};
