import { describe, expect, it, vi } from 'vitest';
import { createHttpClient } from './http-client';
import {
  createHttpAnalysisService,
  createPendingAnalysisService,
} from './analysis';
import { decodeAnalysis } from './analysis-dto';

/** Spot shape of `GET /analysis/spot/{symbol}` on develop @ 0d92def. */
const SPOT = {
  symbol: 'BTCUSDT',
  market: 'SPOT',
  timeframe: '4h',
  openTime: '2026-10-03T00:00:00Z',
  calculatedAt: '2026-10-03T04:00:03.412Z',
  indicators: {
    sma20: '62711.1250000000',
    ema20: '62790.4410000000',
    ema50: '62402.0090000000',
    ema200: null,
    rsi14: '61.2045000000',
    macdLine: '141.2200000000',
    macdSignal: '120.0100000000',
    macdHistogram: '21.2100000000',
    bbUpper: '63420.0000000000',
    bbMiddle: '62711.1250000000',
    bbLower: '62002.2500000000',
    volumeSma20: '790.1200000000',
  },
  nearestSupport: '62400.00',
  nearestResistance: null,
  components: {
    formulaVersion: 'v1',
    trend: '75.00',
    momentum: '60.00',
    volume: '55.00',
    level: '40.00',
  },
  setupScore: {
    score: 62,
    preset: 'DAY_TRADING',
    presetVersion: 'v1',
    timeframe: '1h',
    openTime: '2026-10-03T03:00:00Z',
    components: {
      formulaVersion: 'v1',
      trend: '75.00',
      momentum: '60.00',
      volume: '55.00',
      level: '40.00',
    },
  },
};

describe('analysis decoder', () => {
  it('keeps nulls as insufficient data and the score on the preset timeframe', () => {
    const analysis = decodeAnalysis(SPOT);
    expect(analysis.market).toBe('spot');
    expect(analysis.timeframe).toBe('4h');
    expect(analysis.indicators.ema200).toBeNull();
    expect(analysis.nearestResistance).toBeNull();
    expect(analysis.setupScore).toMatchObject({
      score: 62,
      preset: 'DAY_TRADING',
      presetVersion: 'v1',
      timeframe: '1h',
      components: { trend: '75.00' },
    });
    expect(
      decodeAnalysis({
        ...SPOT,
        setupScore: { ...SPOT.setupScore, score: null },
      }).setupScore.score,
    ).toBeNull();
  });

  it('rejects an unknown preset or a score outside 0–100', () => {
    expect(() =>
      decodeAnalysis({
        ...SPOT,
        setupScore: { ...SPOT.setupScore, preset: 'HODL' },
      }),
    ).toThrow();
    expect(() =>
      decodeAnalysis({
        ...SPOT,
        setupScore: { ...SPOT.setupScore, score: 101 },
      }),
    ).toThrow();
  });
});

describe('HTTP analysis adapter', () => {
  it('asks with the bearer token and the chart timeframe', async () => {
    const calls: { url: URL; auth: string | null }[] = [];
    const http = createHttpClient({
      baseUrl: 'https://api.example.test/api/v1',
      fetcher: vi.fn<typeof fetch>(async (input, init = {}) => {
        calls.push({
          url: new URL(String(input)),
          auth: new Headers(init.headers).get('Authorization'),
        });
        return new Response(JSON.stringify(SPOT), { status: 200 });
      }),
      session: { accessToken: () => 'token-1', refresh: async () => 'renewed' },
    });
    await createHttpAnalysisService(http).get('spot', 'BTCUSDT', '4h');
    expect(calls[0]?.url.pathname + (calls[0]?.url.search ?? '')).toBe(
      '/api/v1/analysis/spot/BTCUSDT?tf=4h',
    );
    expect(calls[0]?.auth).toBe('Bearer token-1');
  });

  it('is pending while no API is configured', async () => {
    await expect(
      createPendingAnalysisService().get('spot', 'BTCUSDT', '1h'),
    ).rejects.toMatchObject({ code: 'NOT_CONFIGURED' });
  });
});
