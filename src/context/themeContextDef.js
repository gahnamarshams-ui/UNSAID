import { createContext } from 'react';
import { THEME_MODES } from '../config/theme';

export const ThemeContext = createContext({
  theme: THEME_MODES.DARK,
  isDark: true,
  toggleTheme: () => {},
  setTheme: () => {},
});
