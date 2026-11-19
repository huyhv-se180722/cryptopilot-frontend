import { useCallback, useMemo, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useServices } from '../../../hooks/use-services';
import type {
  ChartDrawing,
  ChartDrawingChange,
  NewChartDrawing,
} from '../../../types/domain';

export const chartDrawingsKey = (layoutId: string) =>
  ['chart-drawings', layoutId] as const;

/**
 * The drawings of the layout shown and the writes on them (D-149 (5)).
 * Every change is shown at once and saved in the background; writes run one
 * after another, so an update always sends the version the last one
 * returned. A failed write reads the drawings again and is thrown. Without
 * a layout yet, the first drawing asks `ensureLayout` to open one.
 */
export function useChartDrawings(
  layoutId: string | undefined,
  ensureLayout: () => Promise<string>,
) {
  const { chartDrawings } = useServices();
  const client = useQueryClient();
  const key = useMemo(() => chartDrawingsKey(layoutId ?? ''), [layoutId]);
  const query = useQuery({
    queryKey: key,
    enabled: Boolean(layoutId),
    queryFn: ({ signal }) => chartDrawings.list(layoutId ?? '', signal),
    // A layout just opened starts from what is known of it; reading it again
    // at once could answer before its first drawing is saved.
    staleTime: 30_000,
  });
  const queue = useRef<Promise<unknown>>(Promise.resolve());

  const enqueue = useCallback(<T>(write: () => Promise<T>): Promise<T> => {
    const next = queue.current.then(write, write);
    queue.current = next.catch(() => undefined);
    return next;
  }, []);

  const setIn = useCallback(
    (
      target: readonly unknown[],
      change: (list: readonly ChartDrawing[]) => readonly ChartDrawing[],
    ) =>
      client.setQueryData<readonly ChartDrawing[]>(target, (old) =>
        change(old ?? []),
      ),
    [client],
  );

  const set = useCallback(
    (change: (list: readonly ChartDrawing[]) => readonly ChartDrawing[]) =>
      setIn(key, change),
    [key, setIn],
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
    (drawing: Omit<NewChartDrawing, 'layoutId'>) =>
      guarded(async () => {
        const target = layoutId ?? (await ensureLayout());
        const created = await chartDrawings.create({
          ...drawing,
          layoutId: target,
        });
        setIn(chartDrawingsKey(target), (list) => [...list, created]);
        return created;
      }),
    [chartDrawings, ensureLayout, guarded, layoutId, setIn],
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
    if (!layoutId) return Promise.resolve();
    set(() => []);
    return guarded(() => chartDrawings.removeAll(layoutId));
  }, [chartDrawings, guarded, layoutId, set]);

  return { query, create, update, remove, removeAll };
}
