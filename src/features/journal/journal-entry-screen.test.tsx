// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import { JournalEntryPage } from '../../pages/trader/JournalEntryPage';
import type {
  JournalService,
  MarketService,
} from '../../services/api/contracts';
import { ServiceError } from '../../services/api/errors';
import type {
  JournalEntry,
  JournalTrade,
  MarketPair,
} from '../../types/domain';
import { page, renderRoutes } from '../../test/render';

const PAIR: MarketPair = {
  pairId: 'pair-1',
  symbol: 'BTCUSDT',
  market: 'futures',
  baseAsset: 'BTC',
  quoteAsset: 'USDT',
  baseAssetName: 'Bitcoin',
  logoUrl: null,
  tickSize: '0.10',
  stepSize: '0.001',
  minNotional: '5',
  displayOrder: 1,
};

export const ENTRY_TRADE: JournalTrade = {
  id: 'j-1',
  planId: 'plan-1',
  pairId: 'pair-1',
  market: 'futures',
  direction: 'SHORT',
  source: 'SIMULATED',
  status: 'CLOSED',
  leverage: 5,
  entryPrice: '62000.000000000000',
  quantity: '0.100000000000',
  entryTime: '2026-11-10T08:00:00Z',
  entryFee: '3.10000000',
  stopLoss: '63000.000000000000',
  takeProfit: '59000.000000000000',
  exitPrice: '59000.000000000000',
  exitTime: '2026-11-11T08:00:00Z',
  closeReason: 'TAKE_PROFIT',
  realizedPnl: '300.00000000',
  feeAmount: '6.10000000',
  fundingFeeAmount: '-1.50000000',
  netPnl: '292.40000000',
  provisional: false,
};

export const SIMULATED_ENTRY: JournalEntry = {
  trade: ENTRY_TRADE,
  strategyId: 's-1',
  strategyName: 'Breakout',
  setupDescription: 'Rejected at the weekly level.',
  lessonsLearned: null,
  mistakes: 'Moved the stop.',
  chartImageUrl: null,
  chartImageKey: null,
  learning: {
    plannedEntryPrice: '61950.000000000000',
    entryDeviationR: '0.05000000',
    entryLiquidity: 'TAKER',
    riskAmount: '100.00000000',
    analysisTimeframe: '4h',
    setupScorePreset: 'SWING v1',
    setupScoreAtPlan: '72.00',
    setupScoreAtFill: '55.00',
    setupScoreDropWarned: true,
    indicators: null,
    maxAdversePrice: '62600.000000000000',
    maxFavorablePrice: '58800.000000000000',
    rMultiple: '2.92400000',
    maeR: '0.60000000',
    mfeR: '3.20000000',
  },
};

export function fakeJournal(
  entry: JournalEntry | (() => Promise<JournalEntry>) = SIMULATED_ENTRY,
): JournalService {
  return {
    list: vi.fn(),
    get: vi.fn(typeof entry === 'function' ? entry : async () => entry),
    record: vi.fn(),
    edit: vi.fn(),
    remove: vi.fn(),
    review: vi.fn(async (_id, review) => ({
      ...SIMULATED_ENTRY,
      ...review,
      strategyName: review.strategyId === 's-2' ? 'Swing' : 'Breakout',
      chartImageUrl: review.chartImageKey
        ? 'https://res.cloudinary.com/d/image/upload/v1/' +
          review.chartImageKey +
          '.png'
        : null,
    })),
    uploadChartImage: vi.fn(),
    strategies: vi.fn(async () => [
      { id: 's-1', name: 'Breakout' },
      { id: 's-2', name: 'Swing' },
    ]),
  };
}

export function fakeMarket(): MarketService {
  return {
    listPairs: vi.fn(async (market) => (market === 'futures' ? [PAIR] : [])),
    getCandles: vi.fn(async () => []),
    getCoinMarket: vi.fn(),
    getFuturesMetrics: vi.fn(),
    getTicker: vi.fn(async () => null),
  };
}

export const openEntry = (journal: JournalService, id = 'j-1') =>
  renderRoutes(
    [page('/journal/:entryId', <JournalEntryPage />)],
    '/journal/' + id,
    undefined,
    { journal, market: fakeMarket() },
  );

describe('SCR-21 journal entry (T-052)', () => {
  it('shows the facts, what the trade teaches with the MSG55 warning, and the review', async () => {
    const journal = fakeJournal();
    await openEntry(journal);
    expect(
      await screen.findByRole('heading', { name: 'BTC/USDT · Futures' }),
    ).toBeTruthy();
    expect(journal.get).toHaveBeenCalledWith('j-1', expect.anything());
    expect(screen.getByText('Win')).toBeTruthy();
    expect(
      screen.getByRole('link', { name: 'Open the plan' }).getAttribute('href'),
    ).toBe('/plans/plan-1');
    // D-97: realized, fees, funding and net apart.
    expect(screen.getByText('Funding').parentElement?.textContent).toContain(
      '-1.50 USDT',
    );
    expect(screen.getByText('Net P/L').parentElement?.textContent).toContain(
      '+292.40 USDT',
    );
    expect(screen.getByRole('status').textContent).toBe(
      'BTC/USDT entry filled with a setup score of 55, down from 72 when planned.',
    );
    expect(
      screen.getByText('Entry deviation').closest('div')?.textContent,
    ).toContain('0.05 R');
    expect(
      screen.getByText('Setup score').closest('div')?.textContent,
    ).toContain('72 at plan · 55 at fill');
    expect(screen.getByText('Filled as').closest('div')?.textContent).toContain(
      'Taker',
    );
    expect(
      screen.getByText('R multiple').closest('div')?.textContent,
    ).toContain('+2.92 R');
    expect(screen.getByText('Strategy:').textContent).toContain('Breakout');
    expect(screen.getByText('Moved the stop.')).toBeTruthy();
    expect(screen.queryByText('Lessons learned')).toBeNull();
  });

  it('shows a manual trade without learning data, its review empty', async () => {
    await openEntry(
      fakeJournal({
        ...SIMULATED_ENTRY,
        trade: { ...ENTRY_TRADE, source: 'MANUAL', planId: null },
        strategyId: null,
        strategyName: null,
        setupDescription: null,
        mistakes: null,
        learning: null,
      }),
    );
    await screen.findByRole('heading', { name: 'BTC/USDT · Futures' });
    expect(screen.queryByText('What the trade teaches')).toBeNull();
    expect(screen.queryByRole('link', { name: 'Open the plan' })).toBeNull();
    expect(screen.getByText('No review yet.')).toBeTruthy();
  });

  it('answers a trade that is not the caller’s with MSG41', async () => {
    await openEntry(
      fakeJournal(async () => {
        throw new ServiceError('Not found', 'HTTP_ERROR', 404, {
          status: 404,
          code: 'RESOURCE_NOT_FOUND',
          messageCode: 'MSG41',
          messageArgs: [],
          fieldErrors: {},
        });
      }),
    );
    const alert = await screen.findByRole('alert');
    expect(within(alert).getByText('No results found.')).toBeTruthy();
  });
});
