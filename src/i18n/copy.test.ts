import { describe, expect, it } from 'vitest';
import { en } from './locales/en';
import { vi } from './locales/vi';
import { formatCopy, resolveCopy } from './copy';

describe('resolveCopy', () => {
  it('returns English by default', () => {
    expect(resolveCopy('en').messages.MSG42).toBe(en.messages.MSG42);
  });

  it('translates every key of the English copy', () => {
    const missing: string[] = [];
    const walk = (base: unknown, local: unknown, path: string) => {
      if (typeof base === 'string') {
        if (typeof local !== 'string' || local.trim() === '')
          missing.push(path);
        return;
      }
      for (const [key, value] of Object.entries(base as object))
        walk(
          value,
          (local as Record<string, unknown> | undefined)?.[key],
          path + '.' + key,
        );
    };
    walk(en, vi, 'vi');
    expect(missing).toEqual([]);
  });

  it('keeps the placeholders of each English string', () => {
    const holes = (text: string) =>
      [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
    const resolved = resolveCopy('vi');
    const differ: string[] = [];
    const walk = (base: unknown, local: unknown, path: string) => {
      if (typeof base === 'string') {
        if (holes(base).join() !== holes(local as string).join())
          differ.push(path);
        return;
      }
      for (const [key, value] of Object.entries(base as object))
        walk(value, (local as Record<string, unknown>)[key], path + '.' + key);
    };
    walk(en, resolved, 'vi');
    expect(differ).toEqual([]);
  });

  it('keeps lists as lists in Vietnamese', () => {
    const rules = resolveCopy('vi').community.rulesPage;
    expect(Array.isArray(rules.sections)).toBe(true);
    expect(rules.sections).toHaveLength(en.community.rulesPage.sections.length);
    expect(rules.sections[0]?.title).toBe('Không phải lời khuyên đầu tư');
  });

  it('falls back to English for a key a locale leaves blank', () => {
    expect(Object.keys(resolveCopy('vi').messages)).toEqual(
      Object.keys(en.messages),
    );
  });
});

describe('formatCopy', () => {
  it('fills named placeholders', () => {
    expect(
      formatCopy(en.messages.MSG27, {
        max: 5,
        items: 'watchlist items',
        plan: 'FREE',
      }),
    ).toBe(
      'You have reached the limit of 5 watchlist items of the FREE plan. Upgrade to increase the limit?',
    );
  });

  it('keeps unknown placeholders visible', () => {
    expect(formatCopy('Ref: {code}', {})).toBe('Ref: {code}');
  });
});
