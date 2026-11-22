// @vitest-environment jsdom
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MixedText } from './MixedText';

function numbersOf(text: string) {
  const { container } = render(<MixedText text={text} />);
  return {
    container,
    numbers: [...container.querySelectorAll('[data-numeric]')].map(
      (node) => node.textContent,
    ),
  };
}

describe('MixedText (D-161)', () => {
  it('sets only the numbers of a sentence in the monospace font', () => {
    const { container, numbers } = numbersOf('Crosses above 75,293.00');
    expect(numbers).toEqual(['75,293.00']);
    expect(container.textContent).toBe('Crosses above 75,293.00');
    expect(container.querySelector('[data-numeric]')?.className).toBe(
      'font-mono tabular-nums',
    );
  });

  it('keeps signs and percents with the number', () => {
    expect(numbersOf('Net -1,148.99 USDT, +3.39% today').numbers).toEqual([
      '-1,148.99',
      '+3.39%',
    ]);
  });

  it('leaves numbers glued to letters as words', () => {
    expect(numbersOf('RSI (14) 1h · Below 30 on 4h').numbers).toEqual([
      '14',
      '30',
    ]);
  });

  it('renders a text without numbers unchanged', () => {
    const { container, numbers } = numbersOf('Free');
    expect(numbers).toEqual([]);
    expect(container.textContent).toBe('Free');
  });
});
