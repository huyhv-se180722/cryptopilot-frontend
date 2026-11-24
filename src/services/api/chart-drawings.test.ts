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
  layoutId: '0199a0f0-1111-7aaa-8bbb-000000000001',
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
      layoutId: ROW.layoutId,
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
  it('lists the drawings of a layout', async () => {
    const { drawings, calls } = setup([ROW]);
    const list = await drawings.list(ROW.layoutId);
    expect(list).toHaveLength(1);
    expect(calls[0]?.url.pathname).toBe('/api/v1/chart-drawings');
    expect(calls[0]?.url.searchParams.get('layoutId')).toBe(ROW.layoutId);
  });

  it('creates, then replaces with the version it read', async () => {
    const created = setup(ROW);
    await created.drawings.create({
      ...CHANGE,
      layoutId: ROW.layoutId,
      type: 'TREND_LINE',
    });
    expect(created.calls[0]).toMatchObject({
      method: 'POST',
      body: { layoutId: ROW.layoutId, type: 'TREND_LINE', locked: true },
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

  it('removes one drawing or all of a layout', async () => {
    const { drawings, calls } = setup(undefined, 204);
    await drawings.remove(ROW.id);
    await drawings.removeAll(ROW.layoutId);
    expect(calls[0]).toMatchObject({ method: 'DELETE' });
    expect(calls[0]?.url.pathname).toBe('/api/v1/chart-drawings/' + ROW.id);
    expect(calls[1]?.url.pathname).toBe('/api/v1/chart-drawings');
    expect(calls[1]?.url.searchParams.get('layoutId')).toBe(ROW.layoutId);
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
      drawings.create({
        ...CHANGE,
        layoutId: ROW.layoutId,
        type: 'TREND_LINE',
      }),
    ).rejects.toMatchObject({
      problem: { code: 'CHART_DRAWING_LIMIT_REACHED' },
    });
  });

  it('is pending while no API is configured', async () => {
    await expect(
      createPendingChartDrawingService().list(ROW.layoutId),
    ).rejects.toMatchObject({ code: 'NOT_CONFIGURED' });
  });
});

describe('development chart drawings', () => {
  it('keeps drawings per layout and refuses a stale version', async () => {
    const { chartDrawings: dev, chartLayouts } =
      createDevelopmentChartDrawings();
    const a = await chartLayouts.create({ pairId: 'pair-a' });
    const b = await chartLayouts.create({ pairId: 'pair-a' });
    const first = await dev.create({
      ...CHANGE,
      layoutId: a.id,
      type: 'HORIZONTAL_LINE',
    });
    await dev.create({ ...CHANGE, layoutId: b.id, type: 'TEXT' });
    expect(await dev.list(a.id)).toHaveLength(1);
    const moved = await dev.update(first.id, 0, { ...CHANGE, locked: false });
    expect(moved.version).toBe(1);
    await expect(dev.update(first.id, 0, CHANGE)).rejects.toMatchObject({
      status: 409,
    });
    await dev.removeAll(a.id);
    expect(await dev.list(a.id)).toHaveLength(0);
    expect(await dev.list(b.id)).toHaveLength(1);
    await expect(dev.remove(first.id)).rejects.toMatchObject({ status: 404 });
    await expect(
      dev.create({ ...CHANGE, layoutId: 'nope', type: 'TEXT' }),
    ).rejects.toMatchObject({ status: 404 });
  });

  it('numbers layouts with the smallest number free, copies and removes them with their drawings', async () => {
    const { chartDrawings, chartLayouts } = createDevelopmentChartDrawings();
    const one = await chartLayouts.create({ pairId: 'pair-a' });
    const two = await chartLayouts.create({ pairId: 'pair-a', name: ' Plan ' });
    expect([one.number, two.number, two.name]).toEqual([1, 2, 'Plan']);
    await chartDrawings.create({ ...CHANGE, layoutId: two.id, type: 'TEXT' });
    const copy = await chartLayouts.create({
      pairId: 'pair-a',
      copyFrom: two.id,
    });
    expect(copy).toMatchObject({ number: 3, drawings: 1 });
    await chartLayouts.remove(two.id);
    expect(await chartDrawings.list(two.id)).toHaveLength(0);
    expect(await chartDrawings.list(copy.id)).toHaveLength(1);
    expect((await chartLayouts.create({ pairId: 'pair-a' })).number).toBe(2);
    expect((await chartLayouts.rename(one.id, '  ')).name).toBeNull();
    expect(
      (await chartLayouts.list('pair-a')).map((layout) => layout.number),
    ).toEqual([1, 2, 3]);
    for (let i = 0; i < 7; i++) await chartLayouts.create({ pairId: 'pair-a' });
    await expect(
      chartLayouts.create({ pairId: 'pair-a' }),
    ).rejects.toMatchObject({
      status: 409,
      problem: { code: 'CHART_LAYOUT_LIMIT_REACHED' },
    });
  });
});
