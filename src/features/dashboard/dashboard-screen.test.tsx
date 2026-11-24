// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Locale } from '../../i18n/copy';
import { I18nProvider } from '../../i18n/I18nProvider';
import { DashboardPage } from '../../pages/trader/DashboardPage';
import type {
  MarketFeed,
  MarketService,
  NewsService,
  PerformanceService,
  TradingPlanService,
  WatchlistService,
} from '../../services/api/contracts';
import type {
  MarketOverview,
  MarketTicker,
  PerformanceSummary,
  PlanEntitlements,
  Session,
  TradingPlanSummary,
  WatchlistItem,
} from '../../types/domain';
import { fakeAuth, page, renderRoutes, testTrader } from '../../test/render';

vi.mock('lightweight-charts', () => ({
  CandlestickSeries: { name: 'candles' },
  HistogramSeries: { name: 'histogram' },
  LineSeries: { name: 'line' },
  ColorType: { Solid: 'solid' },
  createChart: () => ({
    addSeries: () => ({ setData: vi.fn(), applyOptions: vi.fn() }),
    applyOptions: vi.fn(),
    timeScale: () => ({ fitContent: vi.fn() }),
    priceScale: () => ({ applyOptions: vi.fn() }),
    resize: vi.fn(),
    remove: vi.fn(),
  }),
}));

const pair = (symbol: string, base: string, displayOrder: number) => ({
  pairId: 'p-' + symbol,
  symbol,
  market: 'spot' as const,
  baseAsset: base,
  quoteAsset: 'USDT',
  baseAssetName: base,
  logoUrl: null,
  tickSize: '0.01',
  stepSize: '0.00001',
  minNotional: '5',
  displayOrder,
});
const PAIRS = [
  pair('BTCUSDT', 'BTC', 1),
  pair('ETHUSDT', 'ETH', 2),
  pair('SOLUSDT', 'SOL', 3),
];

const ticker = (
  symbol: string,
  lastPrice: string,
  change: string,
): MarketTicker => ({
  market: 'spot',
  symbol,
  sourceTime: new Date().toISOString(),
  lastPrice,
  bestBid: null,
  bestAsk: null,
  high24h: null,
  low24h: null,
  changePercent24h: change,
  baseVolume24h: null,
  quoteVolume24h: null,
  markPrice: null,
  indexPrice: null,
  fundingRate: null,
  nextFundingTime: null,
});

const row = (
  id: string,
  status: 'ACTIVE' | 'EXECUTED',
): TradingPlanSummary => ({
  id,
  pairId: 'p-BTCUSDT',
  market: 'spot',
  direction: 'LONG',
  entryType: 'LIMIT',
  entryPrice: '62000.000000000000',
  expectedFillPrice: null,
  stopLoss: '61000.000000000000',
  takeProfit: '65000.000000000000',
  leverage: null,
  riskAmount: '10.00000000',
  riskRewardRatio: '3.00000000',
  status,
  createdAt: '2026-10-12T02:00:00Z',
  activatedAt: '2026-10-12T02:05:00Z',
  expiresAt: null,
  invalidatedAt: null,
  positionStatus: status === 'EXECUTED' ? 'OPEN' : null,
  invalidationReason: null,
});

const watched = (symbol: string, spotListed = true): WatchlistItem => ({
  id: 'w-' + symbol,
  pairId: 'p-' + symbol,
  symbol,
  spotListed,
  futuresListed: !spotListed,
  label: null,
  note: null,
  sortOrder: 0,
  activeAlerts: 0,
  addedAt: '2026-10-01T00:00:00Z',
});

const entitlements: PlanEntitlements = {
  tier: 'PRO',
  features: [],
  limits: { ACTIVE_PLAN_MAX: 5, WATCHLIST_MAX: 10 },
};

async function open(
  locale: Locale = 'en',
  extra: { performance?: PerformanceService; news?: NewsService } = {},
) {
  let overview: ((value: MarketOverview) => void) | null = null;
  const market: MarketService = {
    listPairs: vi.fn(async () => PAIRS),
    getChartCandles: vi.fn(async () => ({ candles: [], forming: null })),
    getCandles: vi.fn(async () => []),
    getCoinMarket: vi.fn(),
    getFuturesOpenInterest: vi.fn(async () => null),
    getFuturesMetrics: vi.fn(),
    getTicker: vi.fn(async () => null),
  };
  const marketFeed: MarketFeed = {
    status: () => 'open',
    onStatus: () => () => undefined,
    subscribeOverview: (_market, listener) => {
      overview = listener;
      return () => undefined;
    },
    subscribeTicker: () => () => undefined,
    subscribeKline: () => () => undefined,
  };
  const active = ['a1', 'a2', 'a3', 'a4', 'a5', 'a6'].map((id) =>
    id === 'a2'
      ? { ...row(id, 'ACTIVE'), market: 'futures' as const, leverage: 5 }
      : row(id, 'ACTIVE'),
  );
  const tradingPlan = {
    list: vi.fn<TradingPlanService['list']>(async (query) => {
      const items =
        query.tab === 'ACTIVE'
          ? active
          : [
              row('e1', 'EXECUTED'),
              { ...row('e2', 'EXECUTED'), positionStatus: 'CLOSED' as const },
            ];
      return {
        items: items.slice(0, query.pageSize),
        page: 1,
        pageSize: query.pageSize,
        total: items.length,
      };
    }),
  } as unknown as TradingPlanService;
  const watchlist: WatchlistService = {
    get: vi.fn(async () => ({
      items: [
        watched('ETHUSDT'),
        watched('XRPUSDT', false),
        // No longer listed on either market, nor in the market list (Q-29).
        { ...watched('MATICUSDT', false), futuresListed: false },
      ],
      limit: 10,
    })),
    add: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
  };
  const session: Session = { ...testTrader, entitlements };
  await renderRoutes(
    [
      page(
        '/dashboard',
        <I18nProvider locale={locale}>
          <DashboardPage />
        </I18nProvider>,
      ),
    ],
    '/dashboard',
    fakeAuth({ restoreSession: async () => session }),
    { market, marketFeed, tradingPlan, watchlist, ...extra },
  );
  return {
    market,
    tradingPlan,
    pushOverview: (tickers: MarketTicker[]) =>
      act(() =>
        overview?.({
          market: 'spot',
          serverTime: new Date().toISOString(),
          tickers,
        }),
      ),
  };
}

/** The figure of a key-figure cell, by its label. */
const figure = (label: string) =>
  screen.getByText(label, { selector: 'dt' }).nextElementSibling?.textContent;

describe('SCR-08 Trader dashboard (T-112, T-139)', () => {
  it('dates the header in the interface language, not the browser one', async () => {
    // The date follows the interface's locale: Vietnamese copy (the 'vi'
    // stub) gets "14 thg 10, 2026", English copy "Oct 14, 2026", whatever
    // language the browser runs in.
    await open('vi');
    const date = new Intl.DateTimeFormat('vi', { dateStyle: 'medium' }).format(
      new Date(),
    );
    expect(
      await screen.findByText((text) => text.startsWith(`${date} · `)),
    ).toBeTruthy();
  });

  it('counts active plans, open positions and watched pairs against the plan limits', async () => {
    await open();
    await screen.findByRole('heading', { level: 1, name: 'Overview' });
    await waitFor(() => expect(figure('Active plans')).toBe('6 / 5'));
    expect(screen.getByText('Limit reached on PRO')).toBeTruthy();
    await waitFor(() => expect(figure('Watchlist')).toBe('3 / 10'));
    expect(screen.getByText('7 slots left on PRO')).toBeTruthy();
    expect(
      screen.getByRole('img', { name: '3 of 10 watchlist slots used' }),
    ).toBeTruthy();
    expect(screen.getByText(/6 of 5 active plans/)).toBeTruthy();
    // Only the executed plan whose position is still open counts.
    await waitFor(() => expect(figure('Open positions')).toBe('1'));
    expect(screen.getByText(/1 open simulated positions/)).toBeTruthy();
    expect(
      screen.getByRole('link', { name: 'New plan' }).getAttribute('href'),
    ).toBe('/plans/new');
    expect(
      screen
        .getByRole('link', { name: 'Record a manual trade' })
        .getAttribute('href'),
    ).toBe('/journal/new');
  });

  it('lists five plans of the chosen tab with a link to the rest', async () => {
    const user = userEvent.setup();
    const { tradingPlan } = await open();
    const block = await screen.findByRole('region', {
      name: 'Active plans and open positions',
    });
    await waitFor(() =>
      expect(within(block).getByText('5 of 6 shown')).toBeTruthy(),
    );
    expect(within(block).getAllByRole('row')).toHaveLength(6);
    await user.click(within(block).getByRole('radio', { name: 'Executed' }));
    await waitFor(() =>
      expect(tradingPlan.list).toHaveBeenCalledWith(
        expect.objectContaining({ tab: 'EXECUTED', page: 1 }),
        expect.anything(),
      ),
    );
    expect(
      within(block)
        .getByRole('link', { name: /Manage/ })
        .getAttribute('href'),
    ).toBe('/plans?tab=EXECUTED');
  });

  it('draws each plan from stop loss to take profit, with the live Spot price and its distance from the entry', async () => {
    const { pushOverview } = await open();
    const block = await screen.findByRole('region', {
      name: 'Active plans and open positions',
    });
    await waitFor(() =>
      expect(within(block).getAllByRole('row')).toHaveLength(6),
    );
    pushOverview([ticker('BTCUSDT', '63000.00', '1.00')]);
    const rows = within(block).getAllByRole('row').slice(1);
    const spot = rows[0] as HTMLElement;
    await waitFor(() =>
      expect(
        within(spot).getByRole('img', {
          name: 'Stop loss 61,000.00, entry 62,000.00, take profit 65,000.00, current price 63,000.00',
        }),
      ).toBeTruthy(),
    );
    // (63,000 - 62,000) / 62,000 = 1.6129 %
    expect(spot.textContent).toContain('+1.61%');
    // The page reads no Futures price: the line has no current price.
    const futures = rows[1] as HTMLElement;
    expect(
      within(futures).getByRole('img', {
        name: 'Stop loss 61,000.00, entry 62,000.00, take profit 65,000.00',
      }),
    ).toBeTruthy();
    expect(futures.textContent).toContain('Futures · 5x');
    expect(within(block).queryByText('Created')).toBeNull();
  });

  it('lists the watched pairs: a Spot pair charts, a Futures-only one links, a delisted one stays', async () => {
    const { pushOverview } = await open();
    const rail = await screen.findByRole('complementary', {
      name: 'Watchlist and movers',
    });
    pushOverview([ticker('ETHUSDT', '2500.10', '-1.20')]);
    await waitFor(() => expect(rail.textContent).toContain('2,500.10'));
    expect(rail.textContent).toContain('-1.20%');
    // The first watched Spot pair is charted and marked as picked.
    const eth = within(rail).getByRole('button', { name: /ETH\/USDT/ });
    expect(eth.getAttribute('aria-pressed')).toBe('true');
    expect(
      within(rail)
        .getByRole('link', { name: /XRP\/USDT/ })
        .getAttribute('href'),
    ).toBe('/markets/futures/XRPUSDT');
    // The delisted pair keeps its name, says so, and opens nothing.
    const delisted = within(rail).getByText('Not listed').closest('li');
    expect(delisted?.textContent).toContain('MATIC/USDT');
    expect(delisted?.textContent).toContain('no longer enabled');
    expect(within(delisted as HTMLElement).queryByRole('link')).toBeNull();
    expect(within(delisted as HTMLElement).queryByRole('button')).toBeNull();
  });

  it('reads one candle list on load, of the first watched Spot pair, and one more per pick', async () => {
    const user = userEvent.setup();
    const { market, pushOverview } = await open();
    const chart = await screen.findByRole('region', {
      name: 'Market snapshot',
    });
    await waitFor(() => expect(market.getCandles).toHaveBeenCalledTimes(1));
    expect(market.getCandles).toHaveBeenCalledWith(
      expect.objectContaining({
        market: 'spot',
        symbol: 'ETHUSDT',
        timeframe: '1h',
      }),
    );
    expect(chart.textContent).toContain('Times in');
    await user.click(within(chart).getByRole('radio', { name: '4h' }));
    await waitFor(() => expect(market.getCandles).toHaveBeenCalledTimes(2));
    expect(market.getCandles).toHaveBeenLastCalledWith(
      expect.objectContaining({ symbol: 'ETHUSDT', timeframe: '4h' }),
    );
    // The movers come from the tickers the page already reads.
    pushOverview([
      ticker('BTCUSDT', '63000', '2.11'),
      ticker('ETHUSDT', '2500', '-1.20'),
      ticker('SOLUSDT', '144', '4.82'),
    ]);
    const rail = screen.getByRole('complementary', {
      name: 'Watchlist and movers',
    });
    await user.click(within(rail).getByRole('button', { name: 'Top gainers' }));
    const gainers = within(rail)
      .getAllByRole('listitem')
      .map((item) => item.textContent?.slice(0, 3));
    expect(gainers).toEqual(['SOL', 'BTC', 'ETH']);
    await user.click(within(rail).getByRole('button', { name: 'Top losers' }));
    await user.click(within(rail).getByRole('button', { name: /BTC\/USDT/ }));
    await waitFor(() => expect(market.getCandles).toHaveBeenCalledTimes(3));
    expect(market.getCandles).toHaveBeenLastCalledWith(
      expect.objectContaining({ symbol: 'BTCUSDT', timeframe: '4h' }),
    );
    expect(within(chart).getByRole('heading').textContent).toContain('BTC');
  });

  it('says which blocks are not connected yet instead of inventing data', async () => {
    await open();
    for (const name of ['Recent notifications', 'Key figures', 'Latest news']) {
      const block = await screen.findByRole('region', { name });
      await waitFor(() =>
        expect(block.textContent).toContain('not connected to the server yet'),
      );
    }
    expect(
      screen.getByRole('region', { name: 'Market snapshot' }),
    ).toBeTruthy();
  });

  it('says in one line that the news failed, with a retry, while the rest works', async () => {
    const user = userEvent.setup();
    const feed = vi.fn(async () => {
      throw new Error('boom');
    });
    await open('en', {
      news: { feed, article: vi.fn() } as unknown as NewsService,
    });
    const block = await screen.findByRole('region', { name: 'Latest news' });
    const alert = await within(block).findByRole('alert');
    expect(alert.textContent).toContain('News could not load.');
    expect(
      within(block).queryByRole('heading', { level: 2, name: /wrong/ }),
    ).toBeNull();
    await user.click(within(alert).getByRole('button', { name: 'Try again' }));
    await waitFor(() => expect(feed.mock.calls.length).toBeGreaterThan(1));
    expect(feed).toHaveBeenCalledWith(
      { page: 1, pageSize: 5 },
      expect.anything(),
    );
  });

  describe('performance summary', () => {
    const summary = (
      over: Partial<PerformanceSummary> = {},
    ): PerformanceSummary => ({
      from: null,
      to: '2026-11-22',
      trades: 46,
      wins: 31,
      losses: 14,
      breakeven: 1,
      winRate: '0.67391304',
      totalNetPnl: '1642.50000000',
      provisionalTrades: 0,
      totalFees: '84.55000000',
      totalFunding: '-7.32000000',
      advanced: {
        averageWin: '120.00000000',
        averageLoss: '-80.00000000',
        profitFactor: '2.10000000',
        averagePlannedRiskReward: '2.40000000',
        averageRealizedR: '0.85000000',
        tradesWithR: 40,
        largestWin: '312.00000000',
        largestLoss: '-150.00000000',
        maxConsecutiveLosses: 3,
        maxDrawdown: '400.00000000',
        averageEntryDeviationR: null,
        costOfLateEntryR: null,
        averageMaeR: null,
        averageMfeR: null,
      },
      ...over,
    });
    const service = (
      result: () => Promise<PerformanceSummary>,
    ): PerformanceService =>
      ({
        summary: vi.fn(result),
        breakdown: vi.fn(),
        equityCurve: vi.fn(),
      }) as unknown as PerformanceService;
    const block = () => screen.findByRole('region', { name: 'Key figures' });

    it('reads the simulated trades of all time and shows the server figures', async () => {
      const performance = service(async () => summary());
      await open('en', { performance });
      const region = await block();
      await waitFor(() => expect(region.textContent).toContain('46'));
      expect(performance.summary).toHaveBeenCalledWith(
        { source: 'SIMULATED' },
        expect.anything(),
      );
      expect(region.textContent).toContain(
        'Performance of closed simulated trades · all time',
      );
      expect(figure('Net P/L')).toBe('+1,642.50 USDT');
      expect(region.textContent).toContain('46 closed trades');
      expect(figure('Win rate')).toBe('67.39%');
      expect(region.textContent).toContain('Wins 31 · Losses 14 · Breakeven 1');
      expect(figure('Average realized R')).toBe('0.85');
      expect(region.textContent).toContain('Profit factor 2.10');
      expect(
        within(region).getByRole('img', {
          name: '31 wins, 14 losses, 1 breakeven',
        }),
      ).toBeTruthy();
      expect(
        within(region)
          .getByRole('link', { name: /View performance/ })
          .getAttribute('href'),
      ).toBe('/performance');
    });

    it('signs a loss and leaves out the PRO figures the server does not send (FREE)', async () => {
      await open('en', {
        performance: service(async () =>
          summary({
            totalNetPnl: '-1148.99417816',
            winRate: '0.00000000',
            wins: 0,
            losses: 15,
            breakeven: 0,
            trades: 15,
            advanced: null,
          }),
        ),
      });
      const region = await block();
      await waitFor(() =>
        expect(region.textContent).toContain('-1,148.99 USDT'),
      );
      expect(region.textContent).not.toContain('Average realized R');
      expect(region.textContent).not.toContain('Profit factor');
    });

    it('says there are no results when no trade is closed yet', async () => {
      await open('en', {
        performance: service(async () =>
          summary({
            trades: 0,
            wins: 0,
            losses: 0,
            breakeven: 0,
            winRate: null,
            totalNetPnl: null,
            advanced: null,
          }),
        ),
      });
      const region = await block();
      await waitFor(() =>
        expect(region.textContent).toContain('No results found.'),
      );
    });

    it('shows the server error instead of figures', async () => {
      await open('en', {
        performance: service(async () => {
          throw new Error('boom');
        }),
      });
      const region = await block();
      await waitFor(() =>
        expect(region.textContent).toContain('Something went wrong'),
      );
      expect(region.textContent).not.toContain('USDT');
    });
  });
});
