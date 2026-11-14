import type { ChartDrawingService } from '../services/api/chart-drawings';
import { ServiceError } from '../services/api/errors';
import type { ChartDrawing } from '../types/domain';

/** The most drawings one Trader keeps on one pair (D-149), as the backend. */
const MAX_PER_PAIR = 200;

function refuse(status: number, code: string, messageCode: string): never {
  throw new ServiceError(
    'Development chart drawing refusal.',
    'HTTP_ERROR',
    status,
    { status, code, messageCode, messageArgs: [], fieldErrors: {} },
  );
}

/**
 * DEVELOPMENT ONLY. In-memory `/chart-drawings/**` with the backend's
 * answers: MSG41 for an unknown drawing, 409 for a stale version, MSG43 at
 * the per-pair limit. The anchor rules are the server's and not repeated
 * here. A reload starts empty.
 */
export function createDevelopmentChartDrawings(): ChartDrawingService {
  const rows = new Map<string, ChartDrawing>();
  let next = 1;
  const owned = (id: string) =>
    rows.get(id) ?? refuse(404, 'RESOURCE_NOT_FOUND', 'MSG41');
  return {
    list: async (pairId) =>
      [...rows.values()].filter((row) => row.pairId === pairId),
    create: async (drawing) => {
      const held = [...rows.values()].filter(
        (row) => row.pairId === drawing.pairId,
      ).length;
      if (held >= MAX_PER_PAIR)
        refuse(409, 'CHART_DRAWING_LIMIT_REACHED', 'MSG43');
      const row: ChartDrawing = {
        ...drawing,
        id: 'dev-drawing-' + next++,
        version: 0,
      };
      rows.set(row.id, row);
      return row;
    },
    update: async (id, version, change) => {
      const row = owned(id);
      if (row.version !== version) refuse(409, 'DATA_CONFLICT', 'MSG43');
      const updated: ChartDrawing = {
        ...row,
        ...change,
        version: row.version + 1,
      };
      rows.set(id, updated);
      return updated;
    },
    remove: async (id) => {
      owned(id);
      rows.delete(id);
    },
    removeAll: async (pairId) => {
      for (const [id, row] of rows) if (row.pairId === pairId) rows.delete(id);
    },
  };
}
