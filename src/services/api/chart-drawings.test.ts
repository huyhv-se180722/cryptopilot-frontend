import { describe, expect, it, vi } from 'vitest';
import { createDevelopmentChartDrawings } from '../../dev/dev-chart-drawings';
import type { ChartDrawingChange } from '../../types/domain';
import {
  createHttpChartDrawingService,
  createPendingChartDrawingService,
} from './chart-drawings';
import { decodeChartDrawing } from './chart-drawings-dto';
import { createHttpClient } from './http-client';

/** The shape of the backend's `ChartDrawingResponse` (T-119). */
const ROW = {
  id: '019a7e10-0000-7000-8000-000000000001',
  pairId: '0199a0f0-1111-7aaa-8bbb-000000000001',
  type: 'TREND_LINE',
  points: [
    { time: '2026-11-10T00:00:00Z', price: '66000.5' },
    { time: '2026-11-20T00:00:00Z', price: '70000' },
  ],
  style: {
    lineColor: '#2962FF',
    lineWidth: 2,
    lineStyle: 'SOLID',
    extendLeft: false,
    extendRight: true,
  },
  locked: false,
  hidden: false,
  version: 3,
  createdAt: '2026-11-14T03:00:00Z',
  updatedAt: '2026-11-14T03:05:00Z',
};

const CHANGE: ChartDrawingChange = {
  points: ROW.points,
  style: {
    lineColor: '#EF5350',
    lineWidth: 1,
    lineStyle: 'DASHED',
    fillColor: null,
    extendLeft: false,
    extendRight: false,
    fontSize: null,
    fibLevels: null,
  },
  text: 'support',
  locked: true,
  hidden: false,
};

function setup(reply: unknown, status = 200) {
  const calls: { url: URL; method: string; body: unknown }[] = [];
  const http = createHttpClient({
    baseUrl: 'https://api.example.test/api/v1',
    fetcher: vi.fn<typeof fetch>(async (input, init = {}) => {
      calls.push({
        url: new URL(String(input)),
        method: init.method ?? 'GET',
        body: init.body ? JSON.parse(String(init.body)) : undefined,
      });
      return status === 204
        ? new Response(null, { status })
        : new Response(JSON.stringify(reply), { status });
    }),
    session: { accessToken: () => 'token-1', refresh: async () => 'renewed' },
  });
  return { drawings: createHttpChartDrawingService(http), calls };
}

describe('chart drawing decoder', () => {
  it('reads a drawing, leaving the omitted style values null', () => {
    expect(decodeChartDrawing(ROW)).toEqual({
      id: ROW.id,
      pairId: ROW.pairId,
      type: 'TREND_LINE',
      points: ROW.points,
      style: {
        lineColor: '#2962FF',
        lineWidth: 2,
        lineStyle: 'SOLID',
        fillColor: null,
        extendLeft: false,
        extendRight: true,
        fontSize: null,
        fibLevels: null,
      },
      text: null,
      locked: false,
      hidden: false,
      version: 3,
    });
  });

  it('refuses an unknown type and a price that is not a decimal', () => {
    expect(() => decodeChartDrawing({ ...ROW, type: 'PITCHFORK' })).toThrow();
    expect(() =>
      decodeChartDrawing({
        ...ROW,
        points: [{ time: ROW.points[0]!.time, price: 66000 }],
      }),
    ).toThrow();
    expect(
      decodeChartDrawing({
        ...ROW,
        style: { ...ROW.style, fibLevels: ['0', '0.618'] },
      }).style.fibLevels,
    ).toEqual(['0', '0.618']);
  });
});

describe('HTTP chart drawing adapter', () => {
  it('lists the drawings of a pair', async () => {
    const { drawings, calls } = setup([ROW]);
    const list = await drawings.list(ROW.pairId);
    expect(list).toHaveLength(1);
    expect(calls[0]?.url.pathname).toBe('/api/v1/chart-drawings');
    expect(calls[0]?.url.searchParams.get('pairId')).toBe(ROW.pairId);
  });

  it('creates, then replaces with the version it read', async () => {
    const created = setup(ROW);
    await created.drawings.create({
      ...CHANGE,
      pairId: ROW.pairId,
      type: 'TREND_LINE',
    });
    expect(created.calls[0]).toMatchObject({
      method: 'POST',
      body: { pairId: ROW.pairId, type: 'TREND_LINE', locked: true },
    });
    const updated = setup(ROW);
    await updated.drawings.update(ROW.id, 3, CHANGE);
    expect(updated.calls[0]?.url.pathname).toBe(
      '/api/v1/chart-drawings/' + ROW.id,
    );
    expect(updated.calls[0]).toMatchObject({
      method: 'PUT',
      body: { version: 3, text: 'support', locked: true },
    });
  });

  it('removes one drawing or all of a pair', async () => {
    const { drawings, calls } = setup(undefined, 204);
    await drawings.remove(ROW.id);
    await drawings.removeAll(ROW.pairId);
    expect(calls[0]).toMatchObject({ method: 'DELETE' });
    expect(calls[0]?.url.pathname).toBe('/api/v1/chart-drawings/' + ROW.id);
    expect(calls[1]?.url.pathname).toBe('/api/v1/chart-drawings');
    expect(calls[1]?.url.searchParams.get('pairId')).toBe(ROW.pairId);
  });

  it('keeps the limit refusal for the screen', async () => {
    const { drawings } = setup(
      {
        status: 409,
        code: 'CHART_DRAWING_LIMIT_REACHED',
        messageCode: 'MSG43',
        messageArgs: [200],
      },
      409,
    );
    await expect(
      drawings.create({ ...CHANGE, pairId: ROW.pairId, type: 'TREND_LINE' }),
    ).rejects.toMatchObject({
      problem: { code: 'CHART_DRAWING_LIMIT_REACHED' },
    });
  });

  it('is pending while no API is configured', async () => {
    await expect(
      createPendingChartDrawingService().list(ROW.pairId),
    ).rejects.toMatchObject({ code: 'NOT_CONFIGURED' });
  });
});

describe('development chart drawings', () => {
  it('keeps drawings per pair and refuses a stale version', async () => {
    const dev = createDevelopmentChartDrawings();
    const first = await dev.create({
      ...CHANGE,
      pairId: 'pair-a',
      type: 'HORIZONTAL_LINE',
    });
    await dev.create({ ...CHANGE, pairId: 'pair-b', type: 'TEXT' });
    expect(await dev.list('pair-a')).toHaveLength(1);
    const moved = await dev.update(first.id, 0, { ...CHANGE, locked: false });
    expect(moved.version).toBe(1);
    await expect(dev.update(first.id, 0, CHANGE)).rejects.toMatchObject({
      status: 409,
    });
    await dev.removeAll('pair-a');
    expect(await dev.list('pair-a')).toHaveLength(0);
    await expect(dev.remove(first.id)).rejects.toMatchObject({ status: 404 });
  });
});
