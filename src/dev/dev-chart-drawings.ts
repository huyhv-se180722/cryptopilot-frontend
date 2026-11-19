import type { ChartDrawingService } from '../services/api/chart-drawings';
import type { ChartLayoutService } from '../services/api/chart-layouts';
import { ServiceError } from '../services/api/errors';
import type { ChartDrawing, ChartLayout } from '../types/domain';

/** The most drawings one layout holds (D-149), as the backend. */
const MAX_PER_LAYOUT = 200;
/** The most layouts one Trader keeps on one pair (D-149), as the backend. */
const MAX_LAYOUTS_PER_PAIR = 10;

function refuse(status: number, code: string, messageCode: string): never {
  throw new ServiceError(
    'Development chart drawing refusal.',
    'HTTP_ERROR',
    status,
    { status, code, messageCode, messageArgs: [], fieldErrors: {} },
  );
}

/**
 * DEVELOPMENT ONLY. In-memory `/chart-layouts/**` and `/chart-drawings/**`
 * with the backend's answers: MSG41 for an unknown layout or drawing, 409
 * for a stale version, MSG43 at the per-layout and per-pair limits. A
 * layout takes the smallest number free and takes its drawings with it.
 * The anchor rules are the server's and not repeated here. A reload starts
 * empty.
 */
export function createDevelopmentChartDrawings(): {
  chartDrawings: ChartDrawingService;
  chartLayouts: ChartLayoutService;
} {
  const layouts = new Map<string, Omit<ChartLayout, 'drawings'>>();
  const rows = new Map<string, ChartDrawing>();
  let next = 1;
  const owned = (id: string) =>
    rows.get(id) ?? refuse(404, 'RESOURCE_NOT_FOUND', 'MSG41');
  const layoutOf = (id: string) =>
    layouts.get(id) ?? refuse(404, 'RESOURCE_NOT_FOUND', 'MSG41');
  const inLayout = (layoutId: string) =>
    [...rows.values()].filter((row) => row.layoutId === layoutId);
  const withCount = (layout: Omit<ChartLayout, 'drawings'>): ChartLayout => ({
    ...layout,
    drawings: inLayout(layout.id).length,
  });
  const clean = (name: string | null | undefined) =>
    name && name.trim() ? name.trim() : null;

  const chartLayouts: ChartLayoutService = {
    list: async (pairId) =>
      [...layouts.values()]
        .filter((layout) => layout.pairId === pairId)
        .sort((a, b) => a.number - b.number)
        .map(withCount),
    create: async ({ pairId, name, copyFrom }) => {
      const source = copyFrom ? layoutOf(copyFrom) : null;
      const taken = [...layouts.values()]
        .filter((layout) => layout.pairId === pairId)
        .map((layout) => layout.number);
      if (taken.length >= MAX_LAYOUTS_PER_PAIR)
        refuse(409, 'CHART_LAYOUT_LIMIT_REACHED', 'MSG43');
      let number = 1;
      while (taken.includes(number)) number++;
      const layout = {
        id: 'dev-layout-' + next++,
        pairId,
        number,
        name: clean(name),
      };
      layouts.set(layout.id, layout);
      if (source)
        for (const row of inLayout(source.id)) {
          const copy = { ...row, id: 'dev-drawing-' + next++, version: 0 };
          rows.set(copy.id, { ...copy, layoutId: layout.id });
        }
      return withCount(layout);
    },
    rename: async (id, name) => {
      const layout = { ...layoutOf(id), name: clean(name) };
      layouts.set(id, layout);
      return withCount(layout);
    },
    remove: async (id) => {
      layoutOf(id);
      layouts.delete(id);
      for (const row of inLayout(id)) rows.delete(row.id);
    },
  };

  const chartDrawings: ChartDrawingService = {
    list: async (layoutId) => inLayout(layoutId),
    create: async (drawing) => {
      layoutOf(drawing.layoutId);
      if (inLayout(drawing.layoutId).length >= MAX_PER_LAYOUT)
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
    removeAll: async (layoutId) => {
      for (const row of inLayout(layoutId)) rows.delete(row.id);
    },
  };

  return { chartDrawings, chartLayouts };
}
