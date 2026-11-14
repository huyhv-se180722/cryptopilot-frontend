// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useLocation } from 'react-router-dom';
import { createDevelopmentChartDrawings } from '../../dev/dev-chart-drawings';
import { ChartPage } from '../../pages/trader/ChartPage';
import type { MarketFeed, MarketService } from '../../services/api/contracts';
import type { Candle, MarketPair, MarketType } from '../../types/domain';
import { fakeAuth, page, renderRoutes } from '../../test/render';
import { AnalysisChart } from './components/AnalysisChart';

vi.mock('lightweight-charts', () => {
  const kind = (name: string) => ({ name });
  return {
    CandlestickSeries: kind('candles'),
    LineSeries: kind('line'),
    HistogramSeries: kind('histogram'),
    ColorType: { Solid: 'solid' },
    createSeriesMarkers: () => ({ setMarkers: () => undefined }),
    createChart: () => ({
      addSeries: () => ({
        setData: () => undefined,
        update: () => undefined,
        createPriceLine: (options: object) =>
          Object.assign(options, { applyOptions: () => undefined }),
        removePriceLine: () => undefined,
        priceScale: () => ({ applyOptions: () => undefined }),
        priceToCoordinate: (price: number) => price,
        coordinateToPrice: (y: number) => y,
        attachPrimitive: () => undefined,
        detachPrimitive: () => undefined,
      }),
      panes: () =>
        [0, 1, 2, 3].map(() => ({
          setStretchFactor: () => undefined,
          getHeight: () => 320,
        })),
      timeScale: () => ({
        fitContent: () => undefined,
        width: () => 800,
        logicalToCoordinate: (logical: number) => logical,
        coordinateToLogical: (x: number) => x,
        setVisibleLogicalRange: () => undefined,
        getVisibleLogicalRange: () => null,
        subscribeVisibleLogicalRangeChange: () => undefined,
        unsubscribeVisibleLogicalRangeChange: () => undefined,
      }),
      applyOptions: () => undefined,
      remove: () => undefined,
    }),
  };
});

const pairOf = (
  symbol: string,
  market: MarketType,
  order: number,
): MarketPair => ({
  pairId: 'pair-' + symbol,
  symbol,
  market,
  baseAsset: symbol.replace('USDT', ''),
  quoteAsset: 'USDT',
  baseAssetName: symbol,
  logoUrl: null,
  tickSize: '0.01',
  stepSize: '0.001',
  minNotional: '5',
  displayOrder: order,
});

const candles: Candle[] = Array.from({ length: 60 }, (_, i) => ({
  openTime: new Date(Date.UTC(2026, 9, 1) + i * 3_600_000).toISOString(),
  open: '100',
  high: '101',
  low: '99',
  close: '100',
  baseVolume: '1',
  quoteVolume: '100',
}));

const market = {
  listPairs: vi.fn(async (type: MarketType) =>
    type === 'spot'
      ? [pairOf('BTCUSDT', 'spot', 1), pairOf('ETHUSDT', 'spot', 2)]
      : [pairOf('SOLUSDT', 'futures', 1)],
  ),
  getCandles: vi.fn(async () => candles),
  getFuturesMetrics: vi.fn(),
  getTicker: vi.fn(async () => null),
} as unknown as MarketService;
const marketFeed: MarketFeed = {
  status: () => 'open',
  onStatus: () => () => undefined,
  subscribeOverview: () => () => undefined,
  subscribeTicker: () => () => undefined,
  subscribeKline: () => () => undefined,
};

function Where() {
  const location = useLocation();
  return <output aria-label="location">{location.pathname}</output>;
}

function render(path: string) {
  return renderRoutes(
    [
      page(
        '/chart/:market?/:symbol?',
        <>
          <ChartPage />
          <Where />
        </>,
      ),
    ],
    path,
    fakeAuth(),
    { market, marketFeed, chartDrawings: createDevelopmentChartDrawings() },
  );
}

const location = () => screen.getByRole('status', { name: 'location' });

beforeAll(() => {
  HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) {
    this.removeAttribute('open');
  };
});

afterEach(() => {
  window.localStorage.clear();
});

describe('Chart screen (D-149, T-123)', () => {
  it('opens the first Spot pair with the drawing tools and remembers it', async () => {
    await render('/chart');
    await screen.findByRole('toolbar', { name: 'Drawing tools' });
    expect(location().textContent).toBe('/chart/spot/BTCUSDT');
    expect(
      screen.getByRole('button', { name: 'Choose a pair (current: BTC/USDT)' }),
    ).toBeTruthy();
    expect(JSON.parse(window.localStorage.getItem('cp-chart-pair')!)).toEqual({
      market: 'spot',
      symbol: 'BTCUSDT',
    });
    // No link to itself: the chart is already the Chart screen.
    expect(screen.queryByRole('link', { name: 'Open in Chart' })).toBeNull();
  });

  it('reopens the pair seen last', async () => {
    window.localStorage.setItem(
      'cp-chart-pair',
      JSON.stringify({ market: 'futures', symbol: 'SOLUSDT' }),
    );
    await render('/chart');
    await screen.findByRole('toolbar', { name: 'Drawing tools' });
    expect(location().textContent).toBe('/chart/futures/SOLUSDT');
  });

  it('switches pair and market from the header', async () => {
    await render('/chart/spot/BTCUSDT');
    await screen.findByRole('toolbar', { name: 'Drawing tools' });
    await userEvent.click(
      screen.getByRole('button', { name: 'Choose a pair (current: BTC/USDT)' }),
    );
    const list = await screen.findByRole('listbox');
    await userEvent.click(within(list).getByText(/ETH/));
    await waitFor(() =>
      expect(location().textContent).toBe('/chart/spot/ETHUSDT'),
    );
    await userEvent.click(screen.getByRole('radio', { name: 'Futures' }));
    await waitFor(() =>
      expect(location().textContent).toBe('/chart/futures/SOLUSDT'),
    );
  });

  it('says so when the pair is not listed on the market', async () => {
    await render('/chart/futures/BTCUSDT');
    expect((await screen.findByRole('alert')).textContent).toMatch(
      /not available on Futures/,
    );
    await render('/chart/options/BTCUSDT');
    await waitFor(() =>
      expect(
        screen.getAllByRole('status', { name: 'location' }).at(-1)?.textContent,
      ).toBe('/chart/spot/BTCUSDT'),
    );
  });

  it('offers full screen on the chart frame', async () => {
    const request = vi.fn(async () => undefined);
    HTMLElement.prototype.requestFullscreen = request;
    await render('/chart/spot/BTCUSDT');
    await userEvent.click(
      await screen.findByRole('button', { name: 'Full screen' }),
    );
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('links the other charts to the Chart screen of their pair', async () => {
    await renderRoutes(
      [
        page(
          '/x',
          <AnalysisChart
            market="spot"
            symbol="BTCUSDT"
            tickSize="0.01"
            timeframe="1h"
            onTimeframeChange={() => undefined}
            expandTo="/chart/spot/BTCUSDT"
          />,
        ),
      ],
      '/x',
      fakeAuth(),
      { market, marketFeed },
    );
    const link = await screen.findByRole('link', { name: 'Open in Chart' });
    expect(link.getAttribute('href')).toBe('/chart/spot/BTCUSDT');
  });
});
