import { useCallback, useMemo, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useServices } from '../../../hooks/use-services';
import type {
  ChartDrawing,
  ChartDrawingChange,
  NewChartDrawing,
} from '../../../types/domain';

export const chartDrawingsKey = (pairId: string) =>
  ['chart-drawings', pairId] as const;

/**
 * The Trader's drawings on a pair's chart and the writes on them (D-149
 * (5)). Every change is shown at once and saved in the background; writes
 * run one after another, so an update always sends the version the last
 * one returned. A failed write reads the drawings again and is thrown.
 */
export function useChartDrawings(pairId: string | undefined) {
  const { chartDrawings } = useServices();
  const client = useQueryClient();
  const key = useMemo(() => chartDrawingsKey(pairId ?? ''), [pairId]);
  const query = useQuery({
    queryKey: key,
    enabled: Boolean(pairId),
    queryFn: ({ signal }) => chartDrawings.list(pairId ?? '', signal),
  });
  const queue = useRef<Promise<unknown>>(Promise.resolve());

  const enqueue = useCallback(<T>(write: () => Promise<T>): Promise<T> => {
    const next = queue.current.then(write, write);
    queue.current = next.catch(() => undefined);
    return next;
  }, []);

  const set = useCallback(
    (change: (list: readonly ChartDrawing[]) => readonly ChartDrawing[]) =>
      client.setQueryData<readonly ChartDrawing[]>(key, (old) =>
        change(old ?? []),
      ),
    [client, key],
  );

  const guarded = useCallback(
    async <T>(write: () => Promise<T>): Promise<T> => {
      try {
        return await enqueue(write);
      } catch (error) {
        await client.invalidateQueries({ queryKey: key });
        throw error;
      }
    },
    [client, enqueue, key],
  );

  const create = useCallback(
    (drawing: Omit<NewChartDrawing, 'pairId'>) =>
      guarded(async () => {
        const created = await chartDrawings.create({
          ...drawing,
          pairId: pairId ?? '',
        });
        set((list) => [...list, created]);
        return created;
      }),
    [chartDrawings, guarded, pairId, set],
  );

  const update = useCallback(
    (id: string, change: ChartDrawingChange) => {
      set((list) =>
        list.map((each) => (each.id === id ? { ...each, ...change } : each)),
      );
      return guarded(async () => {
        const current = client
          .getQueryData<readonly ChartDrawing[]>(key)
          ?.find((each) => each.id === id);
        const saved = await chartDrawings.update(
          id,
          current?.version ?? 0,
          change,
        );
        set((list) => list.map((each) => (each.id === id ? saved : each)));
        return saved;
      });
    },
    [chartDrawings, client, guarded, key, set],
  );

  const remove = useCallback(
    (id: string) => {
      set((list) => list.filter((each) => each.id !== id));
      return guarded(() => chartDrawings.remove(id));
    },
    [chartDrawings, guarded, set],
  );

  const removeAll = useCallback(() => {
    set(() => []);
    return guarded(() => chartDrawings.removeAll(pairId ?? ''));
  }, [chartDrawings, guarded, pairId, set]);

  return { query, create, update, remove, removeAll };
}
