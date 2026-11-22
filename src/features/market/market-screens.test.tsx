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
  CoinMarket,
  CoinMarketRow,
  MarketOverview,
  MarketPair,
  MarketTicker,
  MarketType,
} from '../../types/domain';
import { fakeAuth, page, renderRoutes } from '../../test/render';

const chart = vi.hoisted(() => ({
  setData: vi.fn(),
  locales: [] as (string | undefined)[],
}));
vi.mock('lightweight-charts', () => ({
  CandlestickSeries: {},
  ColorType: { Solid: 'solid' },
  createChart: (
    _container: unknown,
    options: { localization?: { locale?: string } },
  ) => {
    chart.locales.push(options.localization?.locale);
    return {
      addSeries: () => ({ setData: chart.setData, applyOptions: vi.fn() }),
      applyOptions: vi.fn(),
      timeScale: () => ({ fitContent: vi.fn() }),
      remove: vi.fn(),
    };
  },
}));

const pair = (
  base: string,
  market: MarketType,
  displayOrder: number,
): MarketPair => ({
  pairId: 'p-' + base,
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
    getChartCandles: vi.fn(async () => ({ candles: [], forming: null })),
    getCandles: vi.fn(async () => CANDLES),
    getCoinMarket: vi.fn(),
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

const coinRow = (
  symbol: string,
  name: string,
  rank: number,
  over: Partial<CoinMarketRow> = {},
): CoinMarketRow => ({
  symbol,
  name,
  logoUrl: null,
  rank,
  spotSymbol: symbol + 'USDT',
  futuresSymbol: null,
  circulatingSupply: null,
  price1hAgo: null,
  price7dAgo: null,
  sparkline7d: [],
  ...over,
});

const COIN_MARKET: CoinMarket = {
  asOf: '2026-11-17T05:49:03Z',
  global: {
    marketCapUsd: '2307025721623',
    marketCapChange24hPercent: '0.61',
    volume24hUsd: '310587923210',
    bitcoinDominancePercent: '56.57',
  },
  fearGreed: {
    value: 12,
    classification: 'Extreme Fear',
    asOf: '2026-11-17T00:00:00Z',
  },
  altcoinSeason: { index: 46, altcoins: 13, days: 90 },
  openInterest: {
    valueUsd: '12085150783.36',
    change24hPercent: '-0.05',
    lastDay: [
      { at: '2026-11-16T05:49:00Z', valueUsd: '12000000000' },
      { at: '2026-11-16T06:49:00Z', valueUsd: '12100000000' },
      { at: '2026-11-16T07:49:00Z', valueUsd: '12050000000' },
    ],
  },
  coins: [
    coinRow('BTC', 'Bitcoin', 1, {
      futuresSymbol: 'BTCUSDT',
      circulatingSupply: '20000000',
      price1hAgo: '62000',
      price7dAgo: '70000',
      sparkline7d: ['70000', '66000', '62000'],
    }),
    coinRow('ETH', 'Ethereum', 2, { circulatingSupply: '120000000' }),
    coinRow('SOL', 'Solana', 7),
    coinRow('PEPE', 'Pepe', 30, {
      spotSymbol: null,
      futuresSymbol: 'PEPEUSDT',
    }),
  ],
};

async function openCoins(status: FeedStatus = 'open') {
  const market = fakeMarket();
  vi.mocked(market.getCoinMarket).mockResolvedValue(COIN_MARKET);
  const { feed, publish } = fakeFeed(status);
  await renderRoutes(
    [
      page('/markets', <MarketsPage />),
      page('/markets/:market/:symbol', <p>analysis</p>),
    ],
    '/markets',
    fakeAuth(),
    { market, marketFeed: feed },
  );
  await screen.findByRole('link', { name: 'Bitcoin' });
  return { market, publish };
}

const coinRows = () => screen.getAllByRole('row').slice(1);
const nameOf = (row: HTMLElement) =>
  within(row).getAllByRole('cell')[1]?.textContent ?? '';

describe('SCR-09 Market List', () => {
  it('lists the coins by market cap with live prices and the changes computed from them', async () => {
    const { publish } = await openCoins();
    publish('spot', [
      spotTicker('BTC', '63000.016', '1.254'),
      spotTicker('ETH', '2500.5', '-0.5'),
    ]);
    const rows = coinRows();
    expect(rows.map(nameOf)).toEqual([
      expect.stringContaining('Bitcoin'),
      expect.stringContaining('Ethereum'),
      expect.stringContaining('Solana'),
      expect.stringContaining('Pepe'),
    ]);
    const btc = within(rows[0] as HTMLElement);
    expect(btc.getAllByText('$63,000.02').length).toBeGreaterThan(0);
    // 1h: 63000.016 against 62000; 24h from the ticker; 7d against 70000.
    expect(btc.getByText('1.61%')).toBeTruthy();
    expect(btc.getByText('1.25%')).toBeTruthy();
    expect(btc.getByText('10.00%')).toBeTruthy();
    // Market cap: the live price times the supply.
    expect(btc.getByText('$1.26T')).toBeTruthy();
    expect(btc.getByText('$1.14B')).toBeTruthy();
    expect(btc.getByText('20.00M BTC')).toBeTruthy();
    expect(
      btc.getByRole('img', { name: 'BTC price over the last 7 days' }),
    ).toBeTruthy();
    // SOL has no ticker yet: dashes, never an invented price.
    expect(
      within(rows[2] as HTMLElement).getAllByText('—').length,
    ).toBeGreaterThan(3);

    // The market's figures above the list.
    expect(
      screen.getByRole('img', {
        name: 'Fear and Greed Index 12 of 100: Extreme fear',
      }),
    ).toBeTruthy();
    expect(screen.getByText('$2.31T')).toBeTruthy();
    expect(screen.getByText('56.57%')).toBeTruthy();
    expect(screen.getByText('$12.09B')).toBeTruthy();
    const trending = within(
      screen.getByRole('region', { name: 'Trending Coins' }),
    );
    expect(trending.getAllByRole('link').map((a) => a.textContent)).toEqual([
      expect.stringContaining('BTC'),
      expect.stringContaining('ETH'),
    ]);
  });

  it('searches and sorts on the client, and links a coin to its analysis', async () => {
    const { publish } = await openCoins();
    publish('spot', [
      spotTicker('BTC', '63000', '1'),
      spotTicker('ETH', '2500', '3'),
      spotTicker('SOL', '140', '-2'),
    ]);
    await userEvent.click(
      screen.getByRole('button', { name: 'Sort by 24h %' }),
    );
    expect(nameOf(coinRows()[0] as HTMLElement)).toContain('Ethereum');
    await userEvent.click(screen.getByRole('radio', { name: 'Losers' }));
    expect(nameOf(coinRows()[0] as HTMLElement)).toContain('Solana');
    await userEvent.type(screen.getByRole('searchbox'), 'bitcoin');
    expect(coinRows()).toHaveLength(1);
    await userEvent.clear(screen.getByRole('searchbox'));
    await userEvent.type(screen.getByRole('searchbox'), 'zzz');
    expect(screen.getByText('No coin matches.')).toBeTruthy();
    await userEvent.clear(screen.getByRole('searchbox'));
    await userEvent.click(screen.getByRole('link', { name: 'Bitcoin' }));
    expect(await screen.findByText('analysis')).toBeTruthy();
  });

  it('prices a coin listed only on Futures by its mark price and opens its Futures analysis', async () => {
    const { publish } = await openCoins();
    publish('futures', [
      {
        ...spotTicker('PEPE', '0', '0'),
        market: 'futures',
        lastPrice: null,
        changePercent24h: '4.2',
        markPrice: '0.0000123456',
      },
    ]);
    const pepe = within(coinRows()[3] as HTMLElement);
    expect(pepe.getByText('Perp')).toBeTruthy();
    expect(pepe.getByText('$0.00001235')).toBeTruthy();
    await userEvent.click(pepe.getByRole('link', { name: 'Pepe' }));
    expect(await screen.findByText('analysis')).toBeTruthy();
  });

  it('is Delayed without a socket and polls the stored snapshots', async () => {
    const { market } = await openCoins('unavailable');
    expect(await screen.findByText('Delayed')).toBeTruthy();
    await waitFor(() =>
      expect(market.getTicker).toHaveBeenCalledWith(
        'spot',
        'BTCUSDT',
        expect.anything(),
      ),
    );
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
    // Month names on the axis in the interface language, not the browser's.
    expect(new Set(chart.locales)).toEqual(new Set(['en']));
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

    // Decision support and paper trading, as the SRS overview puts it:
    // nothing reads as trading for real on CryptoPilot.
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(
      'See the Market.Plan With Data.Practice Risk-Free.',
    );
    expect(screen.getByText('Decision support · Paper trading')).toBeTruthy();
    expect(screen.getByText(/No real orders, no funds held\./)).toBeTruthy();

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
    expect(radar.getByText('Market data · live')).toBeTruthy();
    // The points appear once the pairs and their tickers are in.
    await radar.findByRole('button', { name: /^SOL\/USDT/ });
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
