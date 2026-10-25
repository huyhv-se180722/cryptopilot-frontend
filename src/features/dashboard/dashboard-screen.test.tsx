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
  TradingPlanService,
  WatchlistService,
} from '../../services/api/contracts';
import type {
  MarketOverview,
  MarketTicker,
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
  pairId: 'p-1',
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
  invalidationReason: null,
  positionStatus: status === 'EXECUTED' ? 'OPEN' : null,
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

async function open(locale: Locale = 'en') {
  let overview: ((value: MarketOverview) => void) | null = null;
  const market: MarketService = {
    listPairs: vi.fn(async () => PAIRS),
    getCandles: vi.fn(async () => []),
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
    row(id, 'ACTIVE'),
  );
  const tradingPlan = {
    list: vi.fn<TradingPlanService['list']>(async (query) => {
      const items = query.tab === 'ACTIVE' ? active : [row('e1', 'EXECUTED')];
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
    { market, marketFeed, tradingPlan, watchlist },
  );
  return {
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

describe('SCR-08 Trader dashboard (T-112)', () => {
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
    await waitFor(() => expect(screen.getByText('6 / 5')).toBeTruthy());
    expect(screen.getByText('Limit reached on PRO')).toBeTruthy();
    expect(screen.getByText('3 / 10')).toBeTruthy();
    expect(screen.getByText('7 slots left on PRO')).toBeTruthy();
    expect(screen.getByText(/6 of 5 active plans/)).toBeTruthy();
    expect(
      screen.getByRole('link', { name: 'New plan' }).getAttribute('href'),
    ).toBe('/plans/new');
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

  it('shows the watched pairs with live Spot prices, a dash for Futures only and a delisted pair', async () => {
    const { pushOverview } = await open();
    const block = await screen.findByRole('region', { name: 'Watchlist' });
    pushOverview([ticker('ETHUSDT', '2500.10', '-1.20')]);
    const links = await within(block).findAllByRole('link', {
      name: /USDT|XRPUSDT/,
    });
    await waitFor(() => expect(block.textContent).toContain('2,500.10'));
    expect(block.textContent).toContain('-1.20%');
    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      '/markets/spot/ETHUSDT',
      '/markets/futures/XRPUSDT',
    ]);
    // The delisted pair keeps its name, says so, and opens nothing.
    const delisted = within(block).getByText('Not listed').closest('li');
    expect(delisted?.textContent).toContain('MATIC/USDT');
    expect(delisted?.textContent).toContain('no longer enabled');
    expect(within(delisted as HTMLElement).queryByRole('link')).toBeNull();
  });

  it('says which blocks are not connected yet instead of inventing data', async () => {
    await open();
    for (const name of [
      'Recent notifications',
      'Performance summary',
      'Latest news',
    ]) {
      const block = await screen.findByRole('region', { name });
      await waitFor(() =>
        expect(block.textContent).toContain('not connected to the server yet'),
      );
    }
    expect(
      screen.getByRole('region', { name: 'Market snapshot' }),
    ).toBeTruthy();
  });
});
