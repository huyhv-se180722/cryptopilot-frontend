// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PriceLadder } from './PriceLadder';

const part = (name: string) =>
  document.querySelector(`[data-part="${name}"]`) as HTMLElement | null;

describe('PriceLadder (T-141)', () => {
  it('draws a Long from the stop loss to the take profit with the current price', () => {
    render(
      <PriceLadder
        stopLoss="60500"
        entry="61500"
        takeProfit="64500"
        current="63043.41"
        label="Stop loss 60,500, entry 61,500, take profit 64,500"
      />,
    );
    expect(
      screen.getByRole('img', {
        name: 'Stop loss 60,500, entry 61,500, take profit 64,500',
      }),
    ).toBeTruthy();
    expect(part('risk')?.style.left).toBe('0%');
    expect(part('risk')?.style.width).toBe('25%');
    expect(part('reward')?.style.left).toBe('25%');
    expect(part('reward')?.style.width).toBe('75%');
    expect(part('entry')?.style.left).toBe('25%');
    // (63,043.41 − 60,500) ÷ 4,000 = 63.585… %, half up to 63.59 %.
    expect(part('current')?.style.left).toBe('63.59%');
  });

  it('draws a Short with the take profit below and the stop loss above', () => {
    render(
      <PriceLadder
        stopLoss="149"
        entry="146.2"
        takeProfit="138"
        label="Short"
      />,
    );
    // 138 … 149: take profit at 0 %, entry at 74.55 %, stop loss at 100 %.
    expect(part('reward')?.style.left).toBe('0%');
    expect(part('reward')?.style.width).toBe('74.55%');
    expect(part('risk')?.style.left).toBe('74.55%');
    expect(part('current')).toBe(null);
  });

  it('widens the range to a current price beyond the take profit', () => {
    render(
      <PriceLadder
        stopLoss="100"
        entry="110"
        takeProfit="140"
        current="150"
        label="Beyond"
      />,
    );
    expect(part('current')?.style.left).toBe('100%');
    expect(part('reward')?.style.width).toBe('60%');
  });

  it('draws nothing when the prices span no range', () => {
    const { container } = render(
      <PriceLadder stopLoss="1" entry="1" takeProfit="1" label="Flat" />,
    );
    expect(container.innerHTML).toBe('');
  });
});
