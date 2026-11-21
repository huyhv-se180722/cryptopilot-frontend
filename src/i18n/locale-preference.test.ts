import { describe, expect, it } from 'vitest';
import {
  APP_DEFAULT_LOCALE,
  LOCALE_STORAGE_KEY,
  parseLocale,
  readLocale,
  writeLocale,
} from './locale-preference';

const memory = () => {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => void values.set(key, value),
  };
};

describe('locale preference', () => {
  it('starts in Vietnamese', () => {
    expect(APP_DEFAULT_LOCALE).toBe('vi');
    expect(readLocale(memory())).toBe('vi');
    expect(readLocale(undefined)).toBe('vi');
  });

  it('keeps a chosen language and ignores anything else', () => {
    const storage = memory();
    writeLocale(storage, 'en');
    expect(storage.getItem(LOCALE_STORAGE_KEY)).toBe('en');
    expect(readLocale(storage)).toBe('en');
    expect(parseLocale('fr')).toBe('vi');
  });

  it('falls back when the storage refuses', () => {
    const broken = {
      getItem: () => {
        throw new Error('denied');
      },
      setItem: () => {
        throw new Error('denied');
      },
    };
    expect(readLocale(broken)).toBe('vi');
    expect(() => writeLocale(broken, 'en')).not.toThrow();
  });
});
