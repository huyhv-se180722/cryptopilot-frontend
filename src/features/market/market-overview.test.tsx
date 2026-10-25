// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type {
  FeedStatus,
  MarketFeed,
  MarketService,
} from '../../services/api/contracts';
import type {
  Candle,
  MarketOverview as OverviewMessage,
  MarketPair,
  MarketTicker,
  MarketType,
} from '../../types/domain';
import { fakeAuth, page, renderRoutes } from '../../test/render';
import { MarketOverview } from './components/MarketOverview';
import {
  OVERVIEW_ROWS,
  absoluteChange,
  overviewRows,
} from './components/market-overview';

const chart = vi.hoisted(() => ({ setData: vi.fn() }));
vi.mock('lightweight-charts', () => ({
  AreaSeries: {},
  ColorType: { Solid: 'solid' },
  LineStyle: { Dashed: 2 },
  createChart: () => ({
    addSeries: () => ({
      setData: chart.setData,
      applyOptions: vi.fn(),
      priceLines: () => [],
      removePriceLine: vi.fn(),
      createPriceLine: vi.fn(),
    }),
    applyOptions: vi.fn(),
    timeScale: () => ({ fitContent: vi.fn() }),
    remove: vi.fn(),
  }),
}));

const pair = (base: string, market: MarketType, order: number): MarketPair => ({
  pairId: 'p-' + base,
  symbol: base + 'USDT',
  market,
  baseAsset: base,
  quoteAsset: 'USDT',
  baseAssetName: null,
  logoUrl: null,
  tickSize: '0.01',
  stepSize: '0.001',
  minNotional: '5',
  displayOrder: order,
});

const ticker = (
  base: string,
  market: MarketType,
  price: string,
  change: string,
): MarketTicker => ({
  market,
  symbol: base + 'USDT',
  sourceTime: new Date().toISOString(),
  lastPrice: market === 'spot' ? price : null,
  bestBid: null,
  bestAsk: null,
  high24h: null,
  low24h: null,
  changePercent24h: change,
  baseVolume24h: null,
  quoteVolume24h: null,
  markPrice: market === 'futures' ? price : null,
  indexPrice: null,
  fundingRate: null,
  nextFundingTime: null,
});

const CANDLES: Candle[] = ['100', '110', '105'].map((close, i) => ({
  openTime: new Date(Date.UTC(2026, 9, 25, i)).toISOString(),
  open: close,
  high: close,
  low: close,
  close,
  baseVolume: '1',
  quoteVolume: '1',
}));

function fakeMarket(): MarketService {
  return {
    listPairs: vi.fn(async (market: MarketType) =>
      market === 'spot'
        ? [
            pair('BTC', 'spot', 1),
            pair('ETH', 'spot', 2),
            pair('SOL', 'spot', 3),
          ]
        : [pair('BTC', 'futures', 1)],
    ),
    getCandles: vi.fn(async () => CANDLES),
    getFuturesMetrics: vi.fn(),
    getTicker: vi.fn(async () => null),
  };
}

function fakeFeed(status: FeedStatus = 'open') {
  const listeners = new Map<MarketType, (overview: OverviewMessage) => void>();
  const feed: MarketFeed = {
    status: () => status,
    onStatus: () => () => {},
    subscribeOverview: (market, listener) => {
      listeners.set(market, listener);
      return () => listeners.delete(market);
    },
    subscribeTicker: () => () => {},
    subscribeKline: () => () => {},
  };
  const publish = (market: MarketType, tickers: MarketTicker[]) =>
    act(() =>
      listeners.get(market)?.({
        market,
        serverTime: new Date().toISOString(),
        tickers,
      }),
    );
  return { feed, publish };
}

async function open() {
  const market = fakeMarket();
  const { feed, publish } = fakeFeed();
  await renderRoutes([page('/news', <MarketOverview />)], '/news', fakeAuth(), {
    market,
    marketFeed: feed,
  });
  await screen.findByRole('button', { name: 'BTC/USDT' });
  return { market, publish };
}

const rowOf = (name: string) =>
  screen.getByRole('button', { name }).closest('tr') as HTMLElement;

describe('market overview (D-126)', () => {
  it('derives the 24-hour change in price from the price and its percent', () => {
    expect(absoluteChange('110', '10', '0.01')).toBe('+10.00');
    expect(absoluteChange('52269', '-1.13', '1')).toBe('-597');
  });

  it('ranks the gainers and losers by their 24-hour change, pairs without a ticker left out', () => {
    const pairs = ['A', 'B', 'C'].map((b, i) => pair(b, 'spot', i));
    const tickers = new Map([
      ['AUSDT', ticker('A', 'spot', '1', '-3')],
      ['BUSDT', ticker('B', 'spot', '1', '5')],
    ]);
    const names = (tab: 'gainers' | 'losers' | 'spot') =>
      overviewRows(tab, pairs, tickers).map((r) => r.pair.baseAsset);

    expect(names('gainers')).toEqual(['B', 'A']);
    expect(names('losers')).toEqual(['A', 'B']);
    expect(names('spot')).toEqual(['A', 'B', 'C']);
    expect(OVERVIEW_ROWS).toBe(8);
  });

  it('lists live prices with their change and charts the selected pair over the chosen range', async () => {
    const user = userEvent.setup();
    const { market, publish } = await open();
    publish('spot', [
      ticker('BTC', 'spot', '110', '10'),
      ticker('ETH', 'spot', '2500', '-0.5'),
    ]);

    const btc = within(rowOf('BTC/USDT'));
    expect(btc.getByText('110.00')).toBeTruthy();
    expect(btc.getByText('+10.00')).toBeTruthy();
    expect(btc.getByText('+10.00%')).toBeTruthy();
    expect(within(rowOf('ETH/USDT')).getByText('-0.50%')).toBeTruthy();
    expect(chart.setData).toHaveBeenLastCalledWith([
      expect.objectContaining({ value: 100 }),
      expect.objectContaining({ value: 110 }),
      expect.objectContaining({ value: 105 }),
    ]);
    expect(market.getCandles).toHaveBeenLastCalledWith(
      expect.objectContaining({
        symbol: 'BTCUSDT',
        timeframe: '15m',
        limit: 96,
      }),
    );

    await user.click(screen.getByRole('radio', { name: '1M' }));
    await user.click(screen.getByRole('button', { name: 'ETH/USDT' }));
    expect(market.getCandles).toHaveBeenLastCalledWith(
      expect.objectContaining({
        symbol: 'ETHUSDT',
        timeframe: '4h',
        limit: 180,
      }),
    );
  });

  it('flashes a price green when it rises and red when it falls', async () => {
    const { publish } = await open();
    publish('spot', [ticker('BTC', 'spot', '110', '10')]);
    publish('spot', [ticker('BTC', 'spot', '111', '10.5')]);
    expect(
      within(rowOf('BTC/USDT')).getByText('111.00').getAttribute('data-flash'),
    ).toBe('up');

    publish('spot', [ticker('BTC', 'spot', '109', '9')]);
    expect(
      within(rowOf('BTC/USDT')).getByText('109.00').getAttribute('data-flash'),
    ).toBe('down');
  });

  it('shows the top gainers from the Spot prices and the Futures pairs at their mark price', async () => {
    const user = userEvent.setup();
    const { publish } = await open();
    publish('spot', [
      ticker('BTC', 'spot', '110', '1'),
      ticker('ETH', 'spot', '2500', '7'),
      ticker('SOL', 'spot', '150', '-4'),
    ]);

    await user.click(screen.getByRole('tab', { name: 'Top gainers' }));
    const names = screen
      .getAllByRole('row')
      .slice(1)
      .map((row) => row.querySelector('button')?.textContent);
    expect(names).toEqual(['ETH/USDT', 'BTC/USDT', 'SOL/USDT']);

    await user.click(screen.getByRole('tab', { name: 'Futures' }));
    await screen.findByRole('button', { name: 'BTC/USDT' });
    publish('futures', [ticker('BTC', 'futures', '120', '2')]);
    expect(within(rowOf('BTC/USDT')).getByText('120.00')).toBeTruthy();
  });
});
