import { vi } from 'vitest';
import { JournalEntryPage } from '../pages/trader/JournalEntryPage';
import type { JournalService, MarketService } from '../services/api/contracts';
import type { JournalEntry, JournalTrade, MarketPair } from '../types/domain';
import { page, renderRoutes } from './render';

/** Journal fakes shared by the SCR-21 and SCR-22 tests (T-052). */
export const PAIR: MarketPair = {
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
