import type {
  ChartDrawing,
  ChartDrawingChange,
  NewChartDrawing,
} from '../../types/domain';
import { decodeChartDrawing, decodeChartDrawings } from './chart-drawings-dto';
import { integrationPending } from './errors';
import type { HttpClient } from './http-client';

/**
 * The signed-in Trader's drawings on the chart of each pair (D-149).
 * A pair's drawings are shared by its Spot and Futures charts.
 */
export interface ChartDrawingService {
  list(pairId: string, signal?: AbortSignal): Promise<readonly ChartDrawing[]>;
  create(drawing: NewChartDrawing): Promise<ChartDrawing>;
  /**
   * Replaces the drawing; `version` is the one last read. The server refuses
   * a stale one with 409 and writes nothing.
   */
  update(
    id: string,
    version: number,
    change: ChartDrawingChange,
  ): Promise<ChartDrawing>;
  remove(id: string): Promise<void>;
  /** Removes every drawing of the Trader on the pair. */
  removeAll(pairId: string): Promise<void>;
}

/** Used while no API base URL is configured. */
export function createPendingChartDrawingService(): ChartDrawingService {
  return {
    list: async () => integrationPending(),
    create: async () => integrationPending(),
    update: async () => integrationPending(),
    remove: async () => integrationPending(),
    removeAll: async () => integrationPending(),
  };
}

const ROOT = 'chart-drawings';
const byPair = (pairId: string) =>
  ROOT + '?' + new URLSearchParams({ pairId }).toString();
const noContent = () => undefined;

/** `/chart-drawings/**` with the bearer token (Trader only). */
export function createHttpChartDrawingService(
  http: HttpClient,
): ChartDrawingService {
  return {
    list: (pairId, signal) =>
      http.request({
        path: byPair(pairId),
        decode: decodeChartDrawings,
        ...(signal ? { signal } : {}),
      }),
    create: (drawing) =>
      http.request({
        path: ROOT,
        method: 'POST',
        body: drawing,
        decode: decodeChartDrawing,
      }),
    update: (id, version, change) =>
      http.request({
        path: ROOT + '/' + encodeURIComponent(id),
        method: 'PUT',
        body: { version, ...change },
        decode: decodeChartDrawing,
      }),
    remove: (id) =>
      http.request({
        path: ROOT + '/' + encodeURIComponent(id),
        method: 'DELETE',
        decode: noContent,
      }),
    removeAll: (pairId) =>
      http.request({
        path: byPair(pairId),
        method: 'DELETE',
        decode: noContent,
      }),
  };
}
