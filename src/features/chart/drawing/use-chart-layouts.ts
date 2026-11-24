import { useCallback, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useServices } from '../../../hooks/use-services';
import type { ChartDrawing, ChartLayout } from '../../../types/domain';
import { chartDrawingsKey } from './use-chart-drawings';

/** The most layouts one Trader keeps on one pair (D-149), as the backend. */
export const MAX_LAYOUTS_PER_PAIR = 10;

export const chartLayoutsKey = (pairId: string) =>
  ['chart-layouts', pairId] as const;

const STORAGE_PREFIX = 'cp-chart-layout:';

function readChosen(pairId: string): string | null {
  try {
    return window.localStorage.getItem(STORAGE_PREFIX + pairId);
  } catch {
    return null;
  }
}

function writeChosen(pairId: string, layoutId: string) {
  try {
    window.localStorage.setItem(STORAGE_PREFIX + pairId, layoutId);
  } catch {
    // Storage may be blocked; the choice then lasts as long as the page.
  }
}

const byNumber = (list: readonly ChartLayout[]) =>
  [...list].sort((a, b) => a.number - b.number);

/**
 * The Trader's layouts on a pair's chart and the one shown (D-149). The
 * layout shown last on the pair is remembered in this browser; without one,
 * the lowest number is shown. A pair the Trader never drew on has no layout:
 * `ensure` opens "Copy 1" when the first drawing is made.
 */
export function useChartLayouts(pairId: string | undefined) {
  const { chartLayouts } = useServices();
  const client = useQueryClient();
  const pair = pairId ?? '';
  const key = useMemo(() => chartLayoutsKey(pair), [pair]);
  const query = useQuery({
    queryKey: key,
    enabled: Boolean(pairId),
    queryFn: ({ signal }) => chartLayouts.list(pair, signal),
  });
  const [chosen, setChosen] = useState<{ pair: string; id: string | null }>(
    () => ({ pair, id: pairId ? readChosen(pair) : null }),
  );
  const chosenId = chosen.pair === pair ? chosen.id : readChosen(pair);
  const list = useMemo(() => query.data ?? [], [query.data]);
  const active =
    list.find((layout) => layout.id === chosenId) ?? list[0] ?? null;
  const opening = useRef<Promise<ChartLayout> | null>(null);
  // The choice as it is now, for `ensure`, which may run from an old render.
  const chosenNow = useRef(chosen);

  const select = useCallback(
    (id: string) => {
      writeChosen(pair, id);
      chosenNow.current = { pair, id };
      setChosen({ pair, id });
    },
    [pair],
  );

  const put = useCallback(
    (change: (old: readonly ChartLayout[]) => readonly ChartLayout[]) =>
      client.setQueryData<readonly ChartLayout[]>(key, (old) =>
        byNumber(change(old ?? [])),
      ),
    [client, key],
  );

  /** Opens a layout, empty or a copy of `copyFrom`, and shows it. */
  const create = useCallback(
    async (copyFrom?: string): Promise<ChartLayout> => {
      const created = await chartLayouts.create({
        pairId: pair,
        ...(copyFrom ? { copyFrom } : {}),
      });
      // The new layout's drawings are known: none, or those of the copy.
      if (!copyFrom) client.setQueryData(chartDrawingsKey(created.id), []);
      put((old) => [...old, created]);
      select(created.id);
      return created;
    },
    [chartLayouts, client, pair, put, select],
  );

  /**
   * The layout shown, opening "Copy 1" first when the pair has none. It reads
   * the layouts known now, not those of the render it was made in: a second
   * drawing saved right after the first holds an `ensure` from before "Copy 1"
   * existed, and must not open "Copy 2".
   */
  const ensure = useCallback(async (): Promise<string> => {
    const known = client.getQueryData<readonly ChartLayout[]>(key) ?? [];
    const choice =
      chosenNow.current.pair === pair ? chosenNow.current.id : readChosen(pair);
    const shown = known.find((layout) => layout.id === choice) ?? known[0];
    if (shown) return shown.id;
    opening.current ??= create().finally(() => {
      opening.current = null;
    });
    return (await opening.current).id;
  }, [client, create, key, pair]);

  const rename = useCallback(
    async (id: string, name: string | null) => {
      const renamed = await chartLayouts.rename(id, name);
      put((old) => old.map((each) => (each.id === id ? renamed : each)));
      return renamed;
    },
    [chartLayouts, put],
  );

  const remove = useCallback(
    async (id: string) => {
      await chartLayouts.remove(id);
      put((old) => old.filter((each) => each.id !== id));
      client.removeQueries({ queryKey: chartDrawingsKey(id) });
    },
    [chartLayouts, client, put],
  );

  /** Keeps the count of the layout shown in step with its drawings. */
  const counted = useCallback(
    (layoutId: string, drawings: readonly ChartDrawing[]) => {
      const stale = client
        .getQueryData<readonly ChartLayout[]>(key)
        ?.some(
          (each) => each.id === layoutId && each.drawings !== drawings.length,
        );
      if (stale)
        put((old) =>
          old.map((each) =>
            each.id === layoutId
              ? { ...each, drawings: drawings.length }
              : each,
          ),
        );
    },
    [client, key, put],
  );

  return {
    query,
    list,
    active,
    full: list.length >= MAX_LAYOUTS_PER_PAIR,
    select,
    create,
    ensure,
    rename,
    remove,
    counted,
  };
}

export type ChartLayouts = ReturnType<typeof useChartLayouts>;
