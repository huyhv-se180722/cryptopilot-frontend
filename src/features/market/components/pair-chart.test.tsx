// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import { I18nProvider } from '../../../i18n/I18nProvider';
import type { Candle } from '../../../types/domain';
import { PairChart } from './PairChart';

const setData = vi.fn();
const applyOptions = vi.fn();
vi.mock('lightweight-charts', () => ({
  CandlestickSeries: { name: 'candles' },
  ColorType: { Solid: 'solid' },
  createChart: () => ({
    addSeries: () => ({ setData, applyOptions: vi.fn() }),
    applyOptions,
    timeScale: () => ({ fitContent: vi.fn() }),
    remove: vi.fn(),
  }),
}));

const candle: Candle = {
  openTime: '2026-11-21T00:00:00Z',
  open: '100',
  high: '110',
  low: '90',
  close: '105',
  baseVolume: '1',
  quoteVolume: '100',
};
const OPEN = Date.parse(candle.openTime) / 1000;

function draw(timeframe?: '1h' | '1d') {
  setData.mockClear();
  applyOptions.mockClear();
  render(
    <I18nProvider locale="en">
      <PairChart
        candles={[candle]}
        tickSize="0.01"
        label="BTCUSDT"
        {...(timeframe ? { timeframe } : {})}
      />
    </I18nProvider>,
  );
  return setData.mock.calls.at(-1)?.[0] as { time: number }[];
}

describe('PairChart time axis (T-139)', () => {
  it('keeps daily candles in UTC without hours', () => {
    expect(draw()[0]?.time).toBe(OPEN);
    expect(applyOptions).toHaveBeenCalledWith({
      timeScale: { timeVisible: false },
    });
  });

  it('draws intraday candles in local time with hours on the axis', () => {
    const offset = -new Date().getTimezoneOffset() * 60;
    expect(draw('1h')[0]?.time).toBe(OPEN + offset);
    expect(applyOptions).toHaveBeenCalledWith({
      timeScale: { timeVisible: true },
    });
  });
});
