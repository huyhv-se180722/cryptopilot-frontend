import { describe, expect, it } from 'vitest';
import {
  DEFAULT_THEME_PREFERENCE,
  THEME_STORAGE_KEY,
  parseThemePreference,
  readThemePreference,
  resolveTheme,
  writeThemePreference,
} from './theme';

describe('theme preference', () => {
  it('defaults to light for missing or unknown values', () => {
    expect(DEFAULT_THEME_PREFERENCE).toBe('light');
    expect(parseThemePreference(null)).toBe('light');
    expect(parseThemePreference('sepia')).toBe('light');
  });

  it('resolves system from the media preference', () => {
    expect(resolveTheme('system', true)).toBe('dark');
    expect(resolveTheme('system', false)).toBe('light');
    expect(resolveTheme('dark', false)).toBe('dark');
    expect(resolveTheme('light', true)).toBe('light');
  });

  it('round-trips through storage and survives storage failures', () => {
    const store = new Map<string, string>();
    const storage = {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => void store.set(key, value),
    };
    writeThemePreference(storage, 'system');
    expect(store.get(THEME_STORAGE_KEY)).toBe('system');
    expect(readThemePreference(storage)).toBe('system');

    const broken = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    };
    expect(readThemePreference(broken)).toBe('light');
    expect(() => writeThemePreference(broken, 'dark')).not.toThrow();
  });
});
