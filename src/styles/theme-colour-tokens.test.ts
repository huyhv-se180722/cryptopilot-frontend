import { describe, expect, it } from 'vitest';

// The assistant and Academy screens draw their fixed panels and pictures
// from theme tokens (T-141), so a hex or rgb value written in them again
// fails here instead of drifting from the stylesheet.
const sources = import.meta.glob<string>(
  [
    '../features/ai-assistant/**/*.tsx',
    '../features/academy/**/*.tsx',
    '../pages/guest/Academy*.tsx',
    '../pages/trader/AiAssistantPage.tsx',
    '!**/*.test.tsx',
  ],
  { query: '?raw', import: 'default', eager: true },
);

const HARD_CODED = /#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/i;

describe('colour tokens of the assistant and Academy (T-141)', () => {
  it('scans the screens it guards', () => {
    expect(Object.keys(sources).length).toBeGreaterThan(5);
  });

  it.each(Object.entries(sources))('%s has no hard-coded colour', (_, text) => {
    const lines = text
      .split('\n')
      .map((line, index) => `${index + 1}: ${line.trim()}`)
      .filter((line) => HARD_CODED.test(line));
    expect(lines).toEqual([]);
  });
});
