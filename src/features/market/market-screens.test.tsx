// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MarketsPage } from '../../pages/trader/MarketsPage';
import { PublicHomePage } from '../../pages/guest/PublicHomePage';
import type {
  FeedStatus,
  MarketFeed,
  MarketService,
} from '../../services/api/contracts';
import { createPendingMarketService } from '../../services/api/market';
import type {
  Candle,
  MarketOverview,
  MarketPair,
  MarketTicker,
  MarketType,
} from '../../types/domain';
import { fakeAuth, page, renderRoutes } from '../../test/render';

const chart = vi.hoisted(() => ({
  setData: vi.fn(),
}));
vi.mock('lightweight-charts', () => ({
  CandlestickSeries: {},
  ColorType: { Solid: 'solid' },
  createChart: () => ({
    addSeries: () => ({ setData: chart.setData, applyOptions: vi.fn() }),
    applyOptions: vi.fn(),
    timeScale: () => ({ fitContent: vi.fn() }),
    remove: vi.fn(),
  }),
}));

const pair = (
  base: string,
  market: MarketType,
  displayOrder: number,
): MarketPair => ({
  symbol: base + 'USDT',
  market,
  baseAsset: base,
  quoteAsset: 'USDT',
  baseAssetName:
    base === 'BTC' ? 'Bitcoin' : base === 'ETH' ? 'Ethereum' : null,
  logoUrl: null,
  tickSize: '0.01000000',
  stepSize: '0.00001',
  minNotional: '5',
  displayOrder,
});

const spotTicker = (
  base: string,
  lastPrice: string,
  change: string,
): MarketTicker => ({
  market: 'spot',
  symbol: base + 'USDT',
  sourceTime: new Date().toISOString(),
  lastPrice,
  bestBid: null,
  bestAsk: null,
  high24h: lastPrice,
  low24h: lastPrice,
  changePercent24h: change,
  baseVolume24h: '17325.48210000',
  quoteVolume24h: '1139455120.42',
  markPrice: null,
  indexPrice: null,
  fundingRate: null,
  nextFundingTime: null,
});

const CANDLES: Candle[] = [
  {
    openTime: '2026-10-07T00:00:00Z',
    open: '62000.00',
    high: '63500.00',
    low: '61800.00',
    close: '63000.01',
    baseVolume: '10',
    quoteVolume: '1000',
  },
];

function fakeMarket(): MarketService {
  return {
    listPairs: vi.fn(async (market: MarketType) =>
      market === 'spot'
        ? [
            pair('ETH', 'spot', 2),
            pair('BTC', 'spot', 1),
            pair('SOL', 'spot', 3),
          ]
        : [pair('BTC', 'futures', 1)],
    ),
    getCandles: vi.fn(async () => CANDLES),
    getFuturesMetrics: vi.fn(),
    getTicker: vi.fn(async () => null),
  };
}

function fakeFeed(status: FeedStatus) {
  const listeners = new Map<MarketType, (overview: MarketOverview) => void>();
  const feed: MarketFeed = {
    status: () => status,
    onStatus: () => () => undefined,
    subscribeTicker: () => () => undefined,
    subscribeKline: () => () => undefined,
    subscribeOverview: (market, listener) => {
      listeners.set(market, listener);
      return () => listeners.delete(market);
    },
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

async function openMarkets(status: FeedStatus = 'open', path = '/markets') {
  const market = fakeMarket();
  const { feed, publish } = fakeFeed(status);
  await renderRoutes(
    [
      page('/markets', <MarketsPage />),
      page('/markets/:market/:symbol', <p>analysis</p>),
    ],
    path,
    fakeAuth(),
    { market, marketFeed: feed },
  );
  await screen.findByText('Bitcoin');
  return { market, publish };
}

describe('SCR-09 Market List', () => {
  it('lists pairs in display order with live prices from the overview (CR-09)', async () => {
    const { publish } = await openMarkets();
    publish('spot', [
      spotTicker('BTC', '63000.016', '1.254'),
      spotTicker('ETH', '2500.5', '-0.5'),
    ]);
    const rows = screen.getAllByRole('row').slice(1);
    expect(
      rows.map((row) => within(row).getAllByRole('cell')[0]?.textContent),
    ).toEqual([
      expect.stringContaining('BTC'),
      expect.stringContaining('ETH'),
      expect.stringContaining('SOL'),
    ]);
    const btc = within(rows[0] as HTMLElement);
    expect(btc.getAllByText('63,000.02')).toHaveLength(3);
    expect(btc.getByText('+1.25%')).toBeTruthy();
    expect(btc.getByText('1.14B')).toBeTruthy();
    expect(within(rows[1] as HTMLElement).getByText('-0.50%')).toBeTruthy();
    // SOL has no ticker yet: a dash, never an invented price.
    expect(within(rows[2] as HTMLElement).getAllByText('—').length).toBe(5);
    expect(screen.getByRole('status', { name: '' }).textContent).toContain(
      'Live',
    );
  });

  it('searches and sorts on the client, and links a pair to its analysis', async () => {
    const { publish } = await openMarkets();
    publish('spot', [
      spotTicker('BTC', '63000', '1'),
      spotTicker('ETH', '2500', '3'),
      spotTicker('SOL', '140', '-2'),
    ]);
    await userEvent.click(screen.getByRole('button', { name: /24h change/ }));
    const firstCells = () =>
      screen
        .getAllByRole('row')
        .slice(1)
        .map((row) => within(row).getAllByRole('cell')[0]?.textContent ?? '');
    expect(firstCells()[0]).toContain('ETH');
    expect(firstCells()[2]).toContain('SOL');
    await userEvent.type(screen.getByRole('searchbox'), 'bitcoin');
    expect(firstCells()).toHaveLength(1);
    await userEvent.clear(screen.getByRole('searchbox'));
    await userEvent.type(screen.getByRole('searchbox'), 'zzz');
    expect(screen.getByText('No results found.')).toBeTruthy();
    await userEvent.clear(screen.getByRole('searchbox'));
    await userEvent.click(screen.getByRole('link', { name: /^BTC/ }));
    expect(await screen.findByText('analysis')).toBeTruthy();
  });

  it('shows Futures with mark price, funding in percent and the M-09 note', async () => {
    const { publish } = await openMarkets('open', '/markets?market=futures');
    publish('futures', [
      {
        ...spotTicker('BTC', '0', '0'),
        market: 'futures',
        lastPrice: null,
        changePercent24h: null,
        baseVolume24h: null,
        quoteVolume24h: null,
        markPrice: '63010.2',
        indexPrice: '63005.8',
        fundingRate: '-0.00007500',
        nextFundingTime: new Date(Date.now() + 3_600_000).toISOString(),
      },
    ]);
    expect(screen.getByText('Perp')).toBeTruthy();
    expect(screen.getByText('63,010.20')).toBeTruthy();
    expect(screen.getByText('-0.0075%')).toBeTruthy();
    expect(screen.getByText(/not provided for Futures yet/)).toBeTruthy();
  });

  it('is Delayed without a socket and polls the stored snapshots', async () => {
    const { market } = await openMarkets('unavailable');
    expect(await screen.findByText('Delayed')).toBeTruthy();
    await waitFor(() => expect(market.getTicker).toHaveBeenCalledTimes(3));
  });
});

describe('SCR-01 Public Home', () => {
  it('draws the basic 1d chart of the selected pair and invites to register', async () => {
    const market = fakeMarket();
    const { feed } = fakeFeed('open');
    await renderRoutes([page('/', <PublicHomePage />)], '/', fakeAuth(), {
      market,
      marketFeed: feed,
    });
    expect(
      await screen.findByText('Select a pair to see its daily chart.'),
    ).toBeTruthy();
    await userEvent.click(await screen.findByRole('button', { name: /^BTC/ }));
    // One in the hero's live market card, one in the list's preview.
    expect(
      await screen.findAllByRole('img', {
        name: 'Daily price chart of BTCUSDT, last 90 closed days',
      }),
    ).toHaveLength(2);
    expect(market.getCandles).toHaveBeenCalledWith(
      expect.objectContaining({
        market: 'spot',
        symbol: 'BTCUSDT',
        timeframe: '1d',
        limit: 90,
      }),
    );
    await waitFor(() =>
      expect(chart.setData).toHaveBeenLastCalledWith([
        expect.objectContaining({ close: 63000.01 }),
      ]),
    );
    expect(
      screen.getByRole('link', {
        name: 'Create a free account for the full analysis',
      }),
    ).toBeTruthy();
  });

  it('shows what the product does and the live Spot market in the hero', async () => {
    const market = fakeMarket();
    const { feed, publish } = fakeFeed('open');
    const scrolled = vi.fn();
    Element.prototype.scrollIntoView = scrolled;
    await renderRoutes([page('/', <PublicHomePage />)], '/', fakeAuth(), {
      market,
      marketFeed: feed,
    });
    publish('spot', [
      { ...spotTicker('BTC', '63000.01', '1.25'), quoteVolume24h: '900000000' },
      { ...spotTicker('ETH', '2441.80', '-0.62'), quoteVolume24h: '500000000' },
      { ...spotTicker('SOL', '147.22', '5.31'), quoteVolume24h: '700000000' },
    ]);

    // The product's own capabilities, never "signals".
    const chips = within(
      screen.getByRole('list', { name: 'What CryptoPilot does' }),
    );
    expect(chips.getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      'Technical analysis & setup score',
      'Risk-calculated trading plans',
      'Watchlist & alerts',
      'Simulated execution & journal',
      'AI assistant',
    ]);
    expect(screen.queryByText(/signal/i)).toBeNull();

    // The radar of the day's biggest moves: rising pairs on the right,
    // falling at the upper left, each a button named with its change.
    const radar = within(
      screen.getByRole('region', {
        name: 'Biggest 24h moves of the Spot pairs',
      }),
    );
    expect(await radar.findByText('3 Spot pairs monitored')).toBeTruthy();
    expect(radar.getByText('Market data · live')).toBeTruthy();
    const node = (name: string) =>
      radar.getByRole('button', { name: `${name} in 24h. Open its chart.` });
    const left = (name: string) => parseFloat(node(name).style.left);
    expect(left('SOL/USDT +5.31%')).toBeGreaterThan(50);
    expect(left('BTC/USDT +1.25%')).toBeGreaterThan(50);
    expect(left('ETH/USDT -0.62%')).toBeLessThan(50);

    // The two cards over its corners, from the same live tickers.
    const live = within(radar.getByRole('region', { name: 'Live market' }));
    expect(await live.findByText('63,000.01')).toBeTruthy();
    expect(live.getByText('+1.25%')).toBeTruthy();
    expect(
      await live.findByRole('img', {
        name: 'Daily price chart of BTCUSDT, last 90 closed days',
      }),
    ).toBeTruthy();
    expect(
      live
        .getByRole('link', { name: /Analyze with a free account/ })
        .getAttribute('href'),
    ).toBe('/register');
    const breadth = within(
      radar.getByRole('region', { name: 'Market breadth' }),
    );
    const figure = (term: string) =>
      breadth.getByText(term, { selector: 'dt' }).nextElementSibling
        ?.textContent;
    expect(figure('Rising')).toBe('2');
    expect(figure('Falling')).toBe('1');
    // 900M + 500M + 700M USDT.
    expect(figure('Spot volume 24h')).toBe('2.10B');
    expect(
      breadth
        .getByRole('meter', { name: 'Share rising' })
        .getAttribute('aria-valuenow'),
    ).toBe('67');

    // The running tape: every pair once for assistive tech (the second,
    // looping copy is hidden), and a button to stop it.
    const tape = screen.getByRole('region', {
      name: 'Live prices of the Spot pairs',
    });
    const lists = tape.querySelectorAll('ul');
    expect(lists).toHaveLength(2);
    expect(lists[1]?.getAttribute('aria-hidden')).toBe('true');
    expect(
      [...lists[0]!.querySelectorAll('li')].map((li) => li.textContent),
    ).toEqual([
      'BTC/USDT63,000.01+1.25%',
      'ETH/USDT2,441.80-0.62%',
      'SOL/USDT147.22+5.31%',
    ]);
    const stop = screen.getByRole('button', {
      name: 'Pause the running prices',
    });
    await userEvent.click(stop);
    expect(tape.getAttribute('data-paused')).toBe('true');
    expect(stop.getAttribute('aria-pressed')).toBe('true');
    expect(stop.getAttribute('aria-label')).toBe('Run the prices again');

    // The most traded pairs, by 24h quote volume.
    const pulse = within(
      screen.getByRole('region', { name: 'Live market pulse' }),
    );
    expect(
      pulse
        .getAllByRole('button')
        .filter((button) => button.textContent?.includes('/'))
        .map((button) => button.textContent),
    ).toEqual([
      'BTC/USDT63,000.01+1.25%',
      'SOL/USDT147.22+5.31%',
      'ETH/USDT2,441.80-0.62%',
    ]);

    // A point of the radar opens its basic chart in the list's preview.
    await userEvent.click(node('SOL/USDT +5.31%'));
    expect(
      await screen.findByRole('img', {
        name: 'Daily price chart of SOLUSDT, last 90 closed days',
      }),
    ).toBeTruthy();

    await userEvent.click(
      screen.getByRole('button', { name: 'Explore live markets' }),
    );
    expect(scrolled).toHaveBeenCalledWith({
      behavior: 'smooth',
      block: 'start',
    });
    expect(
      screen
        .getByRole('link', { name: /Start analyzing free/ })
        .getAttribute('href'),
    ).toBe('/register');
  });

  it('says the market data is not connected while no API is configured', async () => {
    await renderRoutes([page('/', <PublicHomePage />)], '/', fakeAuth(), {
      market: createPendingMarketService(),
    });
    expect(
      await screen.findByText(
        'This feature is not connected to the server yet. Please try again later.',
      ),
    ).toBeTruthy();
  });
});
