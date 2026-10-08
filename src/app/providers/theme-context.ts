import { createContext } from 'react';
import type { ResolvedTheme, ThemePreference } from '../theme/theme';

export interface ThemeValue {
  preference: ThemePreference;
  resolved: ResolvedTheme;
  setPreference: (preference: ThemePreference) => void;
}

export const ThemeContext = createContext<ThemeValue | null>(null);
