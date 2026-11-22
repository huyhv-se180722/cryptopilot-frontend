import { describe, expect, it } from 'vitest';

// One type scale on every page (D-161, T-142): Tailwind's size tokens from
// 12 px up, no arbitrary pixel size, no 18 px step, no uppercase
// letter-spaced labels, and chart labels at 12 px or more.
const sources = import.meta.glob<string>(
  ['../**/*.ts', '../**/*.tsx', '!**/*.test.ts', '!**/*.test.tsx'],
  { query: '?raw', import: 'default', eager: true },
);

// Not a label style: a search box of coin symbols shows what is typed in
// capitals, and the password rules name the uppercase-letter rule.
const UPPERCASE_ALLOWED = [
  '../features/news/components/NewsFilters.tsx',
  '../features/auth/password-policy.ts',
  '../i18n/locales/en.ts',
  '../i18n/locales/vi.ts',
];

const isComment = (line: string) => /^(\*|\/\/|\/\*)/.test(line);

/** Every `file:line: code` of the client whose code matches the rule. */
function offending(
  matches: (line: string) => boolean,
  skip: readonly string[] = [],
) {
  return Object.entries(sources)
    .filter(([file]) => !skip.includes(file))
    .flatMap(([file, text]) =>
      text
        .split('\n')
        .map((line, index) => ({ line: line.trim(), number: index + 1 }))
        .filter(({ line }) => !isComment(line) && matches(line))
        .map(({ line, number }) => `${file}:${number}: ${line}`),
    );
}

describe('type scale of the web client (D-161)', () => {
  it('scans the whole client', () => {
    expect(Object.keys(sources).length).toBeGreaterThan(300);
  });

  it('uses only the size tokens: no arbitrary px or em size, no text-lg', () => {
    expect(
      offending((line) =>
        /\btext-\[\d*\.?\d+(px|r?em)\]|\btext-lg\b/.test(line),
      ),
    ).toEqual([]);
  });

  it('has no uppercase or letter-spaced label', () => {
    const LABEL =
      /(^|[\s'"`])(uppercase|tracking-(wide|wider|widest|\[[\d.]+em\]))(?=[\s'"`]|$)/;
    expect(offending((line) => LABEL.test(line), UPPERCASE_ALLOWED)).toEqual(
      [],
    );
  });

  it('sets no chart font below 12 px', () => {
    const SIZE = /fontSize[:=]\s*["{]?\s*([\d.]+)/;
    expect(
      offending((line) => {
        const size = SIZE.exec(line)?.[1];
        return size !== undefined && Number(size) < 12;
      }),
    ).toEqual([]);
  });
});
