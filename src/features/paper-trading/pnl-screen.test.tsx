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

const drawn = vi.hoisted(() => ({ points: [] as number[] }));
vi.mock('lightweight-charts', () => ({
  LineSeries: { name: 'line' },
  ColorType: { Solid: 'solid' },
  createChart: () => ({
    addSeries: () => ({
      setData: (data: { value: number }[]) => {
        drawn.points = data.map((point) => point.value);
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
    getCandles: vi.fn(async () => []),
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
        history: [],
      }),
    });
    expect(
      await screen.findByText(/Some coins have no cost or price yet/),
    ).toBeTruthy();
    expect(screen.getByText('Known once today has a snapshot.')).toBeTruthy();
    expect(screen.getByText('No day has a snapshot yet.')).toBeTruthy();
  });
});
