// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FuturesAnalysisPage } from '../../pages/trader/FuturesAnalysisPage';
import type { MarketFeed, MarketService } from '../../services/api/contracts';
import type {
  FuturesMetrics,
  MarketTicker,
  PairAnalysis,
  PlanEntitlements,
  Session,
} from '../../types/domain';
import { fakeAuth, page, renderRoutes, testTrader } from '../../test/render';

/** The locale each chart is created with. */
const charts = vi.hoisted(() => ({ locales: [] as (string | undefined)[] }));

vi.mock('lightweight-charts', () => ({
  createSeriesMarkers: () => ({ setMarkers: vi.fn() }),
  CandlestickSeries: { name: 'candles' },
  LineSeries: { name: 'line' },
  HistogramSeries: { name: 'histogram' },
  ColorType: { Solid: 'solid' },
  createChart: (
    _container: unknown,
    options: { localization?: { locale?: string } },
  ) => {
    charts.locales.push(options.localization?.locale);
    return {
      addSeries: () => ({
        setData: vi.fn(),
        priceScale: () => ({ applyOptions: vi.fn() }),
        priceToCoordinate: vi.fn(() => null),
        createPriceLine: vi.fn(),
        removePriceLine: vi.fn(),
      }),
      panes: () => [0, 1, 2, 3].map(() => ({ setStretchFactor: vi.fn() })),
      timeScale: () => ({ fitContent: vi.fn() }),
      remove: vi.fn(),
    };
  },
}));

const ANALYSIS: PairAnalysis = {
  symbol: 'BTCUSDT',
  market: 'futures',
  timeframe: '1h',
  openTime: '2026-10-09T09:00:00Z',
  indicators: {
    sma20: null,
    ema20: null,
    ema50: null,
    ema200: null,
    rsi14: null,
    macdLine: null,
    macdSignal: null,
    macdHistogram: null,
    bbUpper: null,
    bbMiddle: null,
    bbLower: null,
    volumeSma20: null,
  },
  nearestSupport: '62400.00',
  nearestResistance: '63500.00',
  setupScore: {
    score: 62,
    preset: 'DAY_TRADING',
    presetVersion: 'v1',
    timeframe: '1h',
    openTime: '2026-10-09T09:00:00Z',
    components: {
      formulaVersion: 'v1',
      trend: '75.00',
      momentum: '60.00',
      volume: '55.00',
      level: '40.00',
      derivatives: '50.00',
    },
    dominantSide: 'SHORT',
  },
};

const METRICS: FuturesMetrics = {
  symbol: 'BTCUSDT',
  from: '2026-10-08T12:00:00Z',
  to: '2026-10-09T12:00:00Z',
  openInterest: [
    {
      time: '2026-10-09T11:50:00Z',
      openInterest: '80911.004',
      openInterestValue: '5090112003.55',
    },
    {
      time: '2026-10-09T11:55:00Z',
      openInterest: '81234.512',
      openInterestValue: '5118221330.10',
    },
  ],
  longShortRatio: [
    {
      time: '2026-10-09T11:55:00Z',
      longShortRatio: '1.8421',
      longAccountRatio: '0.6481',
      shortAccountRatio: '0.3519',
    },
  ],
  fundingSettlements: [],
  availableFrom: {
    openInterest: '2026-10-09T06:00:00Z',
    longShortRatio: '2026-09-01T00:00:00Z',
    fundingSettlements: null,
  },
};

const plan = (tier: 'FREE' | 'PRO'): PlanEntitlements => ({
  tier,
  features: tier === 'PRO' ? ['FUTURES_ANALYSIS', 'SCORE_COMPONENTS'] : [],
  limits: { AI_CHAT_DAILY: tier === 'PRO' ? 30 : 0 },
});

async function open({
  tier = 'PRO' as 'FREE' | 'PRO',
  metrics = METRICS,
}: { tier?: 'FREE' | 'PRO'; metrics?: FuturesMetrics } = {}) {
  let ticker: ((value: MarketTicker) => void) | null = null;
  const market: MarketService = {
    listPairs: vi.fn(async () => [
      {
        pairId: '0199a0f0-1111-7aaa-8bbb-000000000001',
        symbol: 'BTCUSDT',
        market: 'futures' as const,
        baseAsset: 'BTC',
        quoteAsset: 'USDT',
        baseAssetName: 'Bitcoin',
        logoUrl: null,
        tickSize: '0.10',
        stepSize: '0.00001',
        minNotional: '5',
        displayOrder: 1,
      },
    ]),
    getCandles: vi.fn(async () => []),
    getTicker: vi.fn(async () => null),
    getFuturesMetrics: vi.fn(async () => metrics),
  };
  const marketFeed: MarketFeed = {
    status: () => 'open',
    onStatus: () => () => undefined,
    subscribeOverview: () => () => undefined,
    subscribeKline: () => () => undefined,
    subscribeTicker: (_m, _s, listener) => {
      ticker = listener;
      return () => undefined;
    },
  };
  const analysis = { get: vi.fn(async () => ANALYSIS) };
  const session: Session = { ...testTrader, entitlements: plan(tier) };
  await renderRoutes(
    [page('/markets/futures/:symbol', <FuturesAnalysisPage />)],
    '/markets/futures/BTCUSDT',
    fakeAuth({ restoreSession: async () => session }),
    { market, marketFeed, analysis },
  );
  await screen.findByRole('heading', { level: 1 });
  return {
    market,
    analysis,
    push: (value: MarketTicker) => act(() => ticker?.(value)),
  };
}

const region = async (name: string) =>
  within(await screen.findByRole('region', { name }));

describe('SCR-11 Futures analysis (T-034)', () => {
  it('shows the derivatives component and the dominant side beside the score', async () => {
    await open();
    const card = await region('Setup score');
    expect(card.getByText('62')).toBeTruthy();
    expect(card.getByText('Derivatives').nextSibling?.textContent).toBe('50');
    expect(card.getByText('Dominant side:').parentElement?.textContent).toBe(
      'Dominant side: Short',
    );
    expect(card.getByText(/not investment advice/)).toBeTruthy();
  });

  it('counts down to the next funding time read from the source', async () => {
    const { push } = await open();
    const next = new Date(Date.now() + 3_723_000).toISOString();
    push({
      market: 'futures',
      symbol: 'BTCUSDT',
      sourceTime: new Date().toISOString(),
      lastPrice: null,
      bestBid: null,
      bestAsk: null,
      high24h: null,
      low24h: null,
      changePercent24h: null,
      baseVolume24h: null,
      quoteVolume24h: null,
      markPrice: '63010.2',
      indexPrice: '63005.8',
      fundingRate: '-0.00012500',
      nextFundingTime: next,
    });
    const panel = await region('Mark price and funding');
    expect(panel.getByText('Index price').nextSibling?.textContent).toBe(
      '63,005.8',
    );
    expect(panel.getByText('Funding rate').nextSibling?.textContent).toBe(
      '-0.0125%',
    );
    expect(panel.getByText('Next funding in').nextSibling?.textContent).toMatch(
      /^01:02:0[0-3]at /,
    );
    // M-09: the header leads with the mark price, not a last price.
    expect(screen.getAllByText('63,010.2')).toHaveLength(2);
  });

  it('charts open interest and states the shorter available period', async () => {
    const { market } = await open();
    const panel = await region('Futures data');
    expect(
      (await panel.findByText('Open interest (BTC)')).nextSibling?.textContent,
    ).toBe('81,234.512');
    expect(
      panel.getByText('Open interest value (USDT)').nextSibling?.textContent,
    ).toBe('5.12B');
    expect(
      panel.getByText(
        'Data is stored from 2026-10-09 06:00 UTC only, a shorter period than the one selected.',
      ),
    ).toBeTruthy();
    expect(market.getFuturesMetrics).toHaveBeenCalledWith(
      'BTCUSDT',
      expect.any(String),
      expect.anything(),
    );
    // The candle chart and the open interest chart name months in English.
    expect(charts.locales.length).toBeGreaterThanOrEqual(2);
    expect(new Set(charts.locales)).toEqual(new Set(['en']));
  });

  it('switches to the long/short ratio and to a 7-day range', async () => {
    const { market } = await open();
    const panel = await region('Futures data');
    await panel.findByText('Open interest (BTC)');
    await userEvent.click(
      panel.getByRole('radio', { name: 'Long/short ratio' }),
    );
    expect(
      panel.getByText('Long/short account ratio').nextSibling?.textContent,
    ).toBe('1.8421');
    expect(panel.getByText('Long accounts').nextSibling?.textContent).toBe(
      '64.81%',
    );
    // That series is stored for longer than the range: no note.
    expect(panel.queryByText(/shorter period/)).toBeNull();
    await userEvent.click(panel.getByRole('radio', { name: '7D' }));
    await waitFor(() => {
      const from = vi.mocked(market.getFuturesMetrics).mock.calls.at(-1)?.[1];
      const days = (Date.now() - Date.parse(from ?? '')) / 86_400_000;
      expect(days).toBeGreaterThan(6.99);
      expect(days).toBeLessThanOrEqual(7);
    });
  });

  it('says so when no metric is stored for the period', async () => {
    await open({
      metrics: {
        ...METRICS,
        openInterest: [],
        longShortRatio: [],
        availableFrom: {
          openInterest: null,
          longShortRatio: null,
          fundingSettlements: null,
        },
      },
    });
    const panel = await region('Futures data');
    expect(
      await panel.findByText('No data stored for this period yet.'),
    ).toBeTruthy();
  });

  it('carries the market into Ask AI and keeps Create trading plan disabled', async () => {
    await open();
    expect(
      (await screen.findByRole('link', { name: 'Ask AI' })).getAttribute(
        'href',
      ),
    ).toBe('/ai?symbol=BTCUSDT&market=futures');
    // SRS 3.3.3: SCR-17 pre-filled with the pair and market FUTURES.
    expect(
      screen
        .getByRole('link', { name: 'Create trading plan' })
        .getAttribute('href'),
    ).toBe('/plans/new?symbol=BTCUSDT&market=futures');
  });

  it('shows MSG29 on FREE and reads no analysis', async () => {
    const { market, analysis } = await open({ tier: 'FREE' });
    expect(
      screen.getByRole('heading', { level: 1, name: 'Futures analysis' }),
    ).toBeTruthy();
    expect(
      screen.getByText(
        'This feature is available on the PRO plan or higher. View plans?',
      ),
    ).toBeTruthy();
    expect(screen.getByRole('link', { name: 'View plans' })).toBeTruthy();
    expect(analysis.get).not.toHaveBeenCalled();
    expect(market.getFuturesMetrics).not.toHaveBeenCalled();
  });
});
