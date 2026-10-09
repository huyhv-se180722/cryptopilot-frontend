// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SpotAnalysisPage } from '../../pages/trader/SpotAnalysisPage';
import { ServiceError } from '../../services/api/errors';
import type {
  AnalysisService,
  MarketFeed,
  MarketService,
} from '../../services/api/contracts';
import type {
  MarketTicker,
  PairAnalysis,
  PlanEntitlements,
  Session,
} from '../../types/domain';
import { fakeAuth, page, renderRoutes, testTrader } from '../../test/render';

// jsdom has no modal dialog; the component only needs open/close.
beforeAll(() => {
  HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) {
    this.removeAttribute('open');
  };
});

const priceLines = vi.hoisted(() => [] as { price: number; title: string }[]);
vi.mock('lightweight-charts', () => ({
  CandlestickSeries: { name: 'candles' },
  LineSeries: { name: 'line' },
  HistogramSeries: { name: 'histogram' },
  ColorType: { Solid: 'solid' },
  createChart: () => ({
    addSeries: () => ({
      setData: vi.fn(),
      createPriceLine: (line: { price: number; title: string }) =>
        priceLines.push(line),
    }),
    panes: () => [0, 1, 2, 3].map(() => ({ setStretchFactor: vi.fn() })),
    timeScale: () => ({ fitContent: vi.fn() }),
    remove: vi.fn(),
  }),
}));

const ANALYSIS: PairAnalysis = {
  symbol: 'BTCUSDT',
  market: 'spot',
  timeframe: '1h',
  openTime: '2026-10-09T09:00:00Z',
  indicators: {
    sma20: '62711.12',
    ema20: '62790.44',
    ema50: '62402.00',
    ema200: '60120.77',
    rsi14: '61.2',
    macdLine: '141.22',
    macdSignal: '120.01',
    macdHistogram: '21.21',
    bbUpper: '63420.00',
    bbMiddle: '62711.12',
    bbLower: '62002.25',
    volumeSma20: '790.12',
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
    },
  },
};

const TICKER: MarketTicker = {
  market: 'spot',
  symbol: 'BTCUSDT',
  sourceTime: new Date().toISOString(),
  lastPrice: '63000.01',
  bestBid: '63000.00',
  bestAsk: '63000.05',
  high24h: '63950.00',
  low24h: '61820.50',
  changePercent24h: '1.254',
  quoteVolume24h: '1139455120.42',
  markPrice: null,
  indexPrice: null,
  fundingRate: null,
  nextFundingTime: null,
};

const plan = (tier: 'FREE' | 'PRO'): PlanEntitlements => ({
  tier,
  features: tier === 'PRO' ? ['SCORE_COMPONENTS'] : [],
  limits: { AI_CHAT_DAILY: tier === 'PRO' ? 30 : 0 },
});

async function open({
  tier = 'PRO' as 'FREE' | 'PRO',
  analysis = async () => ANALYSIS,
}: {
  tier?: 'FREE' | 'PRO';
  analysis?: AnalysisService['get'];
} = {}) {
  let ticker: ((value: MarketTicker) => void) | null = null;
  const market: MarketService = {
    listPairs: vi.fn(async () => [
      {
        symbol: 'BTCUSDT',
        market: 'spot' as const,
        baseAsset: 'BTC',
        quoteAsset: 'USDT',
        baseAssetName: 'Bitcoin',
        logoUrl: null,
        tickSize: '0.01',
        displayOrder: 1,
      },
    ]),
    getCandles: vi.fn(async () =>
      [0, 1, 2].map((i) => ({
        openTime: new Date(Date.UTC(2026, 9, 9, i)).toISOString(),
        open: '63000',
        high: '63100',
        low: '62900',
        close: '63050',
        baseVolume: '10',
        quoteVolume: '630500',
      })),
    ),
    getTicker: vi.fn(async () => null),
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
  const session: Session = { ...testTrader, entitlements: plan(tier) };
  await renderRoutes(
    [
      page('/markets/spot/:symbol', <SpotAnalysisPage />),
      page('/markets', <p>market list</p>),
    ],
    '/markets/spot/BTCUSDT',
    fakeAuth({ restoreSession: async () => session }),
    { market, marketFeed, analysis: { get: vi.fn(analysis) } },
  );
  await screen.findByRole('heading', { level: 1 });
  return { push: (value: MarketTicker) => act(() => ticker?.(value)) };
}

afterEach(() => {
  priceLines.length = 0;
});

describe('SCR-10 Spot analysis (T-033)', () => {
  it('shows the score with preset, version, components and the disclaimer', async () => {
    await open();
    const card = within(
      await screen.findByRole('region', { name: 'Setup score' }),
    );
    expect(card.getByText('62')).toBeTruthy();
    expect(card.getByText('Day trading v1 · 1h')).toBeTruthy();
    expect(card.getByText('Trend').nextSibling?.textContent).toBe('75');
    expect(
      card.getByText(
        'Information on CryptoPilot is for reference and education only and is not investment advice.',
      ),
    ).toBeTruthy();
  });

  it('shows live statistics with the exact spread, and the BR-14 levels', async () => {
    const { push } = await open();
    push(TICKER);
    const stats = within(
      screen.getByRole('region', { name: 'Market statistics' }),
    );
    expect(stats.getByText('Spread').nextSibling?.textContent).toBe('0.05');
    expect(stats.getByText('Best ask').nextSibling?.textContent).toBe(
      '63,000.05',
    );
    expect(stats.getByText('24h volume (USDT)').nextSibling?.textContent).toBe(
      '1.14B',
    );
    const levels = within(screen.getByRole('region', { name: 'Key levels' }));
    expect(levels.getByText('Support').nextSibling?.textContent).toBe(
      '62,400.00',
    );
    // The same levels are drawn on the chart as horizontal lines.
    await waitFor(() =>
      expect(priceLines.filter((line) => line.title !== '')).toEqual([
        expect.objectContaining({ price: 62400, title: 'Support' }),
        expect.objectContaining({ price: 63500, title: 'Resistance' }),
      ]),
    );
    expect(screen.getByText('Live')).toBeTruthy();
  });

  it('locks the components on FREE and answers Ask AI with MSG29', async () => {
    await open({ tier: 'FREE' });
    const card = within(
      await screen.findByRole('region', { name: 'Setup score' }),
    );
    expect(card.getByText(/available on the PRO plan or higher/)).toBeTruthy();
    expect(card.queryByText('Trend')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Ask AI' }));
    expect(
      within(screen.getByRole('dialog')).getByText(
        'This feature is available on the PRO plan or higher. View plans?',
      ),
    ).toBeTruthy();
  });

  it('keeps the pair actions disabled while the pair id is not exposed', async () => {
    await open();
    for (const name of [
      'Add to watchlist',
      'Create alert',
      'Create trading plan',
    ])
      expect(
        (screen.getByRole('button', { name }) as HTMLButtonElement).disabled,
      ).toBe(true);
    expect(
      screen.getByRole('link', { name: 'Ask AI' }).getAttribute('href'),
    ).toBe('/ai?symbol=BTCUSDT&market=spot');
    expect(
      await screen.findByText(
        'This feature is not connected to the server yet. Please try again later.',
      ),
    ).toBeTruthy();
  });

  it('says Insufficient data instead of a zero score', async () => {
    await open({
      analysis: async () => ({
        ...ANALYSIS,
        setupScore: { ...ANALYSIS.setupScore, score: null },
      }),
    });
    const card = within(
      await screen.findByRole('region', { name: 'Setup score' }),
    );
    expect(card.getByText('Insufficient data')).toBeTruthy();
    expect(card.queryByRole('meter')).toBeNull();
  });

  it('returns to the market list when the pair is disabled (MSG41)', async () => {
    await open({
      analysis: async () => {
        throw new ServiceError('gone', 'HTTP_ERROR', 404, {
          status: 404,
          code: 'RESOURCE_NOT_FOUND',
          messageCode: 'MSG41',
          messageArgs: [],
          fieldErrors: {},
        });
      },
    });
    expect(await screen.findByText('market list')).toBeTruthy();
    await waitFor(() =>
      expect(
        screen.getByText(
          'This pair is no longer available. Back to the market list.',
        ),
      ).toBeTruthy(),
    );
  });
});
