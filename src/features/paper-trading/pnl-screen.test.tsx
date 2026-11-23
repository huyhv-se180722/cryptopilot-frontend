// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createDevelopmentPaperTrading } from '../../dev/dev-paper-trading';
import { TradePnlPage } from '../../pages/trader/TradePnlPage';
import type {
  MarketService,
  PaperTradingService,
} from '../../services/api/contracts';
import type { MarketTicker } from '../../types/domain';
import { fakeAuth, page, renderRoutes, testTrader } from '../../test/render';

const drawn = vi.hoisted(() => ({
  /** The equity line's points: the first line series of a chart. */
  points: [] as number[],
  /** The analysis chart's bars, with their colours. */
  bars: [] as { value: number; color?: string }[],
}));
vi.mock('lightweight-charts', () => ({
  LineSeries: { name: 'line' },
  HistogramSeries: { name: 'histogram' },
  ColorType: { Solid: 'solid' },
  createChart: () => ({
    addSeries: (kind: { name: string }) => ({
      setData: (data: { value: number; color?: string }[]) => {
        if (kind.name === 'histogram') drawn.bars = data;
        else drawn.points = data.map((point) => point.value);
      },
    }),
    timeScale: () => ({ fitContent: vi.fn() }),
    remove: vi.fn(),
  }),
}));

const PRICES: Record<string, string> = {
  BTCUSDT: '63000',
  ETHUSDT: '2500',
  BNBUSDT: '580',
};

async function setup(overrides: Partial<PaperTradingService> = {}) {
  const market: MarketService = {
    listPairs: vi.fn(async () => []),
    getChartCandles: vi.fn(async () => ({ candles: [], forming: null })),
    getCandles: vi.fn(async () => []),
    getCoinMarket: vi.fn(),
    getFuturesMetrics: vi.fn(),
    getTicker: vi.fn(
      async (_m, symbol) =>
        ({ lastPrice: PRICES[symbol] ?? '1' }) as MarketTicker,
    ),
  };
  const { paperTrading } = createDevelopmentPaperTrading(
    async () => testTrader,
    market,
  );
  const equity = vi.spyOn(paperTrading, 'equity');
  const service = { ...paperTrading, ...overrides };
  await renderRoutes(
    [page('/trade/pnl', <TradePnlPage />)],
    '/trade/pnl',
    fakeAuth({ restoreSession: async () => testTrader }),
    { market, paperTrading: service },
  );
  return { equity, user: userEvent.setup() };
}

describe('Demo PnL analysis (TR-F5, TR-13)', () => {
  it('shows the worth, its daily history and each Spot coin at its cost', async () => {
    const { equity, user } = await setup();
    await waitFor(() =>
      expect(
        screen.getByText('Account worth').parentElement?.textContent,
      ).toContain('USDT'),
    );
    const coins = await screen.findByRole('region', { name: 'Spot coins' });
    const btc = (await within(coins).findByText('BTC')).closest(
      'tr',
    ) as HTMLElement;
    // 0.1 BTC at 63,000 against the scripted cost of 61,110.
    expect(btc.textContent).toContain('61,110.00');
    expect(btc.textContent).toContain('+189.00');
    expect(btc.textContent).toContain('+3.09%');
    await waitFor(() => expect(drawn.points).toHaveLength(30));
    await user.click(screen.getByRole('radio', { name: '7D' }));
    await waitFor(() =>
      expect(equity).toHaveBeenLastCalledWith(7, expect.anything()),
    );
    await waitFor(() => expect(drawn.points).toHaveLength(7));
  });

  it('analyses the period: daily PnL bars, the deepest fall and the closed trades, of one wallet or both', async () => {
    const analysis = vi.fn<PaperTradingService['pnlAnalysis']>(
      async (market, days) => ({
        market,
        days,
        todayPnl: '12.5',
        cumulativePnl: '-40.25',
        maxDrawdown: '-120',
        maxDrawdownPercent: '-0.8',
        complete: false,
        daily: [
          { date: '2026-11-21', pnl: '30', cumulativePnl: '30' },
          { date: '2026-11-22', pnl: '-82.75', cumulativePnl: '-52.75' },
          { date: '2026-11-23', pnl: '12.5', cumulativePnl: '-40.25' },
        ],
        trades: {
          closed: 4,
          wins: 3,
          losses: 1,
          winRate: '75',
          totalPnl: '50',
          averageWin: '20',
          averageLoss: '-10',
          profitFactor: '6',
        },
      }),
    );
    const { user } = await setup({ pnlAnalysis: analysis });
    const section = await screen.findByRole('region', { name: 'Analysis' });
    await waitFor(() =>
      expect(
        within(section).getByText('PnL, last 30 days').parentElement
          ?.textContent,
      ).toContain('-40.25'),
    );
    expect(
      within(section).getByText('Max drawdown').parentElement?.parentElement
        ?.textContent,
    ).toContain('-0.8%');
    expect(within(section).getByText('4 closed: 3 won, 1 lost')).toBeTruthy();
    expect(
      within(section).getByText('Profit factor').parentElement?.textContent,
    ).toContain('6');
    expect(within(section).getByText(/Some days had no snapshot/)).toBeTruthy();
    expect(drawn.bars.map((bar) => bar.value)).toEqual([30, -82.75, 12.5]);
    expect(analysis).toHaveBeenLastCalledWith(null, 30, expect.anything());

    await user.click(
      within(section).getByRole('radio', { name: 'Futures wallet' }),
    );
    await waitFor(() =>
      expect(analysis).toHaveBeenLastCalledWith(
        'FUTURES',
        30,
        expect.anything(),
      ),
    );
    await user.click(screen.getByRole('radio', { name: '7D' }));
    await waitFor(() =>
      expect(analysis).toHaveBeenLastCalledWith(
        'FUTURES',
        7,
        expect.anything(),
      ),
    );
  });

  it('says when totals leave coins out and when today has no snapshot', async () => {
    await setup({
      spotPnl: async () => ({
        coins: [
          {
            coinId: 'c-bnb',
            asset: 'BNB',
            quantity: '10',
            averageCost: null,
            costBasis: null,
            lastPrice: '580',
            value: '5800',
            unrealizedPnl: null,
            unrealizedPnlPercent: null,
          },
        ],
        totalValue: '5800',
        totalUnrealizedPnl: '0',
        complete: false,
      }),
      equity: async () => ({
        spotEquity: '10000',
        futuresEquity: '5000',
        totalEquity: '15000',
        todayPnl: null,
        todayPnlPercent: null,
        history: [
          {
            date: '2026-10-21',
            spotEquity: '10000',
            futuresEquity: '5000',
            totalEquity: '15000',
          },
        ],
      }),
    });
    expect(
      await screen.findByText(/Some coins have no cost or price yet/),
    ).toBeTruthy();
    expect(screen.getByText('Known once today has a snapshot.')).toBeTruthy();
    expect(
      screen.getByText('The chart starts once two days have a snapshot.'),
    ).toBeTruthy();
  });
});
