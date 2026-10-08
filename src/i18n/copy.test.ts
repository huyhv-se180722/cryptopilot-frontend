import { describe, expect, it } from 'vitest';
import { en } from './locales/en';
import { formatCopy, resolveCopy } from './copy';

describe('resolveCopy', () => {
  it('returns English by default', () => {
    expect(resolveCopy('en').messages.MSG42).toBe(en.messages.MSG42);
  });

  it('falls back to English for keys the Vietnamese stub lacks', () => {
    const vi = resolveCopy('vi');
    expect(vi.common.loading).toBe(en.common.loading);
    expect(Object.keys(vi.messages)).toEqual(Object.keys(en.messages));
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
