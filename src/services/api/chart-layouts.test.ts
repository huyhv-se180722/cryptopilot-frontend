import { describe, expect, it, vi } from 'vitest';
import {
  createHttpChartLayoutService,
  createPendingChartLayoutService,
  decodeChartLayout,
} from './chart-layouts';
import { createHttpClient } from './http-client';

const ROW = {
  id: '0199a0f0-2222-7aaa-8bbb-000000000001',
  pairId: '0199a0f0-1111-7aaa-8bbb-000000000001',
  number: 2,
  name: null,
  drawings: 4,
  createdAt: '2026-11-19T00:00:00Z',
  updatedAt: '2026-11-19T00:00:00Z',
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
  return { layouts: createHttpChartLayoutService(http), calls };
}

describe('chart layout decoder', () => {
  it('reads a layout without a name', () => {
    expect(decodeChartLayout(ROW)).toEqual({
      id: ROW.id,
      pairId: ROW.pairId,
      number: 2,
      name: null,
      drawings: 4,
    });
    expect(() => decodeChartLayout({ ...ROW, number: 'two' })).toThrow();
  });
});

describe('HTTP chart layout adapter', () => {
  it('lists the layouts of a pair', async () => {
    const { layouts, calls } = setup([ROW]);
    expect(await layouts.list(ROW.pairId)).toHaveLength(1);
    expect(calls[0]?.url.pathname).toBe('/api/v1/chart-layouts');
    expect(calls[0]?.url.searchParams.get('pairId')).toBe(ROW.pairId);
  });

  it('creates a copy, renames and removes a layout', async () => {
    const created = setup(ROW);
    await created.layouts.create({ pairId: ROW.pairId, copyFrom: 'source' });
    expect(created.calls[0]).toMatchObject({
      method: 'POST',
      body: { pairId: ROW.pairId, copyFrom: 'source' },
    });
    const renamed = setup({ ...ROW, name: 'Plan' });
    expect((await renamed.layouts.rename(ROW.id, 'Plan')).name).toBe('Plan');
    expect(renamed.calls[0]).toMatchObject({
      method: 'PUT',
      body: { name: 'Plan' },
    });
    expect(renamed.calls[0]?.url.pathname).toBe(
      '/api/v1/chart-layouts/' + ROW.id,
    );
    const removed = setup(undefined, 204);
    await removed.layouts.remove(ROW.id);
    expect(removed.calls[0]).toMatchObject({ method: 'DELETE' });
  });

  it('is pending while no API is configured', async () => {
    await expect(
      createPendingChartLayoutService().list(ROW.pairId),
    ).rejects.toMatchObject({ code: 'NOT_CONFIGURED' });
  });
});
