import { useContext } from 'react';
import { ThemeContext } from '../app/providers/theme-context';

export function useTheme() {
  const theme = useContext(ThemeContext);
  if (!theme) throw new Error('Theme provider is missing.');
  return theme;
}
