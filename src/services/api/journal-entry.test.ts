// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import type { JournalReview, ManualTradeInput } from '../../types/domain';
import type { HttpClient } from './http-client';
import { createHttpJournalService } from './journal';
import {
  chartImageKeyOf,
  decodeChartImageForm,
  decodeJournalEntry,
  decodeStrategies,
} from './journal-dto';

const IMAGE =
  'https://res.cloudinary.com/demo/image/upload/v1763690000/cryptopilot/journal/01a18806-f703-7786-8f90-8c7c34ce23e8/0b6f2f0e-1d2c-4c5b-9a8e-7f6e5d4c3b2a.png';
const KEY =
  'cryptopilot/journal/01a18806-f703-7786-8f90-8c7c34ce23e8/0b6f2f0e-1d2c-4c5b-9a8e-7f6e5d4c3b2a';

const SIMULATED = {
  id: 'j-1',
  planId: 'p-1',
  strategyId: 's-1',
  strategyName: 'Breakout',
  pairId: 'pair-1',
  market: 'FUTURES',
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
  setupDescription: 'Rejected at the weekly level.',
  lessonsLearned: '',
  mistakes: null,
  chartImageUrl: IMAGE,
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
    indicators: {
      timeframe: '4h',
      openTime: '2026-11-10T04:00:00Z',
      macdLine: '-120.5',
      macdSignal: '-80.1',
      macdHistogram: '-40.4',
    },
    maxAdversePrice: '62600.000000000000',
    maxFavorablePrice: '58800.000000000000',
    rMultiple: '2.92400000',
    maeR: '-0.60000000',
    mfeR: '3.20000000',
  },
};

const MANUAL = {
  ...SIMULATED,
  id: 'j-2',
  planId: null,
  strategyId: null,
  strategyName: null,
  source: 'MANUAL',
  chartImageUrl: null,
  learning: null,
};

function client(answer: unknown = SIMULATED) {
  const request = vi.fn(
    async ({ decode }: { decode: (body: unknown) => unknown }) =>
      decode(answer),
  );
  return { http: { request } as unknown as HttpClient, request };
}

describe('GET /journal/{id} decoder (SCR-21)', () => {
  it('reads the trade, its review and what it teaches', () => {
    const entry = decodeJournalEntry(SIMULATED);
    expect(entry.trade).toMatchObject({
      id: 'j-1',
      market: 'futures',
      direction: 'SHORT',
      netPnl: '292.40000000',
    });
    expect(entry.strategyName).toBe('Breakout');
    expect(entry.setupDescription).toBe('Rejected at the weekly level.');
    // A blank review text is no text.
    expect(entry.lessonsLearned).toBeNull();
    expect(entry.mistakes).toBeNull();
    expect(entry.chartImageKey).toBe(KEY);
    expect(entry.learning).toMatchObject({
      entryDeviationR: '0.05000000',
      entryLiquidity: 'TAKER',
      setupScoreAtPlan: '72.00',
      setupScoreAtFill: '55.00',
      setupScoreDropWarned: true,
      maeR: '-0.60000000',
    });
    expect(entry.learning?.indicators?.macdHistogram).toBe('-40.4');
  });

  it('reads a manual trade without learning data or image', () => {
    const entry = decodeJournalEntry(MANUAL);
    expect(entry.trade.source).toBe('MANUAL');
    expect(entry.learning).toBeNull();
    expect(entry.chartImageKey).toBeNull();
  });

  it('refuses an image that is not https and a role it does not know', () => {
    expect(() =>
      decodeJournalEntry({ ...SIMULATED, chartImageUrl: 'http://x/y.png' }),
    ).toThrow(/https/);
    expect(() =>
      decodeJournalEntry({
        ...SIMULATED,
        learning: { ...SIMULATED.learning, entryLiquidity: 'BOTH' },
      }),
    ).toThrow(/entryLiquidity/);
    expect(() =>
      decodeJournalEntry({ ...SIMULATED, entryPrice: 'cheap' }),
    ).toThrow(/entryPrice/);
  });
});

describe('chart image key read from its address (Q-97)', () => {
  it('reads the key of a stored image, with or without a version', () => {
    expect(chartImageKeyOf(IMAGE)).toBe(KEY);
    expect(chartImageKeyOf(IMAGE.replace('/v1763690000', ''))).toBe(KEY);
    expect(chartImageKeyOf(IMAGE + '?t=1')).toBe(KEY);
  });

  it('gives no key for an address of another shape', () => {
    expect(chartImageKeyOf(null)).toBeNull();
    expect(chartImageKeyOf('https://cdn.example.com/chart.png')).toBeNull();
    expect(
      chartImageKeyOf('https://res.cloudinary.com/d/image/upload/v1/a/b.png'),
    ).toBeNull();
  });
});

describe('strategies and the signed chart image form', () => {
  it('reads the strategies', () => {
    expect(decodeStrategies([{ id: 's-1', name: 'Breakout' }])).toEqual([
      { id: 's-1', name: 'Breakout' },
    ]);
    expect(() => decodeStrategies([{ id: 's-1' }])).toThrow(/name/);
  });

  it('reads the form and refuses one that is not https', () => {
    const form = {
      uploadUrl: 'https://api.cloudinary.com/v1_1/demo/image/upload',
      apiKey: 'k',
      timestamp: 1763690000,
      signature: 'sig',
      publicId: KEY,
      allowedFormats: ['JPG', 'png', 'webp'],
      maxBytes: 5242880,
    };
    expect(decodeChartImageForm(form).allowedFormats).toEqual([
      'jpg',
      'png',
      'webp',
    ]);
    expect(() =>
      decodeChartImageForm({ ...form, uploadUrl: 'http://x' }),
    ).toThrow(/https/);
  });
});

describe('journal adapter', () => {
  const input: ManualTradeInput = {
    pairId: 'pair-1',
    market: 'futures',
    direction: 'LONG',
    leverage: 3,
    entryPrice: '100',
    quantity: '2',
    entryTime: '2026-11-20T01:00:00.000Z',
    stopLoss: '95',
    takeProfit: null,
    exitPrice: null,
    exitTime: null,
    feeAmount: null,
    fundingFeeAmount: null,
    strategyId: null,
    setupDescription: 'Breakout retest',
    lessonsLearned: null,
    mistakes: null,
  };

  it('records and edits a manual trade with the market as the API writes it', async () => {
    const { http, request } = client(MANUAL);
    const service = createHttpJournalService(http);
    await service.record(input);
    await service.edit('j 2', input);
    expect(request.mock.calls[0]?.[0]).toMatchObject({
      path: 'journal',
      method: 'POST',
      body: { ...input, market: 'FUTURES' },
    });
    expect(request.mock.calls[1]?.[0]).toMatchObject({
      path: 'journal/j%202',
      method: 'PUT',
    });
  });

  it('sends every review field, a null clearing it, and the image key', async () => {
    const { http, request } = client();
    const review: JournalReview = {
      strategyId: 's-1',
      setupDescription: null,
      lessonsLearned: 'Wait for the close.',
      mistakes: null,
      chartImageKey: KEY,
    };
    await createHttpJournalService(http).review('j-1', review);
    expect(request.mock.calls[0]?.[0]).toMatchObject({
      path: 'journal/j-1/review',
      method: 'PUT',
    });
    expect(
      (request.mock.calls[0]?.[0] as unknown as { body: unknown }).body,
    ).toEqual({
      strategyId: 's-1',
      setupDescription: null,
      lessonsLearned: 'Wait for the close.',
      mistakes: null,
      chartImagePublicId: KEY,
    });
  });

  it('deletes a trade and reads the strategies', async () => {
    const { http, request } = client([]);
    const service = createHttpJournalService(http);
    await service.remove('j-2');
    await service.strategies();
    expect(request.mock.calls.map(([call]) => call)).toMatchObject([
      { path: 'journal/j-2', method: 'DELETE' },
      { path: 'strategies' },
    ]);
  });

  it('refuses a file the signed form does not accept before uploading it', async () => {
    const { http } = client({
      uploadUrl: 'https://api.cloudinary.com/v1_1/demo/image/upload',
      apiKey: 'k',
      timestamp: 1763690000,
      signature: 'sig',
      publicId: KEY,
      allowedFormats: ['jpg', 'png', 'webp'],
      maxBytes: 10,
    });
    const send = vi.spyOn(XMLHttpRequest.prototype, 'send');
    const big = new File(['x'.repeat(11)], 'chart.png', { type: 'image/png' });
    const gif = new File(['x'], 'chart.gif', { type: 'image/gif' });
    const service = createHttpJournalService(http);
    await expect(service.uploadChartImage('j-1', big)).rejects.toMatchObject({
      problem: { messageCode: 'MSG32' },
    });
    await expect(service.uploadChartImage('j-1', gif)).rejects.toMatchObject({
      problem: { messageCode: 'MSG32' },
    });
    expect(send).not.toHaveBeenCalled();
    send.mockRestore();
  });
});
