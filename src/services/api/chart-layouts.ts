import type { ChartLayout, NewChartLayout } from '../../types/domain';
import { integer, list, nullableText, record, text } from './decode';
import { integrationPending } from './errors';
import type { HttpClient } from './http-client';

/**
 * The signed-in Trader's layouts on the chart of each pair (D-149): named
 * sets of drawings. A pair holds at most 10 layouts of one Trader.
 */
export interface ChartLayoutService {
  list(pairId: string, signal?: AbortSignal): Promise<readonly ChartLayout[]>;
  /** Takes the smallest number still free; MSG43 past the limit. */
  create(layout: NewChartLayout): Promise<ChartLayout>;
  /** A null or blank name brings back "Copy {number}". */
  rename(id: string, name: string | null): Promise<ChartLayout>;
  /** Removes the layout with its drawings. */
  remove(id: string): Promise<void>;
}

/** Used while no API base URL is configured. */
export function createPendingChartLayoutService(): ChartLayoutService {
  return {
    list: async () => integrationPending(),
    create: async () => integrationPending(),
    rename: async () => integrationPending(),
    remove: async () => integrationPending(),
  };
}

/** One layout, checked against the backend's `ChartLayoutResponse`. */
export function decodeChartLayout(body: unknown): ChartLayout {
  const value = record(body, 'layout');
  return {
    id: text(value.id, 'id'),
    pairId: text(value.pairId, 'pairId'),
    number: integer(value.number, 'number'),
    name: nullableText(value.name, 'name'),
    drawings: integer(value.drawings, 'drawings'),
  };
}

/** `GET /chart-layouts?pairId=`. */
export function decodeChartLayouts(body: unknown): readonly ChartLayout[] {
  return list(body, 'layouts').map(decodeChartLayout);
}

const ROOT = 'chart-layouts';
const one = (id: string) => ROOT + '/' + encodeURIComponent(id);

/** `/chart-layouts/**` with the bearer token (Trader only). */
export function createHttpChartLayoutService(
  http: HttpClient,
): ChartLayoutService {
  return {
    list: (pairId, signal) =>
      http.request({
        path: ROOT + '?' + new URLSearchParams({ pairId }).toString(),
        decode: decodeChartLayouts,
        ...(signal ? { signal } : {}),
      }),
    create: (layout) =>
      http.request({
        path: ROOT,
        method: 'POST',
        body: layout,
        decode: decodeChartLayout,
      }),
    rename: (id, name) =>
      http.request({
        path: one(id),
        method: 'PUT',
        body: { name },
        decode: decodeChartLayout,
      }),
    remove: (id) =>
      http.request({
        path: one(id),
        method: 'DELETE',
        decode: () => undefined,
      }),
  };
}
