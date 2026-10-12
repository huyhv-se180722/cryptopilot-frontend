import type { WatchlistItem } from '../../../types/domain';

export interface Group {
  label: string | null;
  items: WatchlistItem[];
}

/** Rows grouped by label (SRS 3.4.1), labels in order of first row, unlabelled last. */
export function groupRows(items: readonly WatchlistItem[]): Group[] {
  const groups = new Map<string | null, WatchlistItem[]>();
  for (const item of items) {
    const key = item.label?.trim() || null;
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => Number(a === null) - Number(b === null))
    .map(([label, rows]) => ({ label, items: rows }));
}

/** The display order after moving `id` before `beforeId` (or by one step). */
export function moveWithinGroup(
  groups: readonly Group[],
  id: string,
  target: { step: -1 | 1 } | { beforeId: string },
): string[] | null {
  const next = groups.map((group) => group.items.map((item) => item.id));
  const group = next.find((ids) => ids.includes(id));
  if (!group) return null;
  const from = group.indexOf(id);
  let to: number;
  if ('step' in target) to = from + target.step;
  else {
    if (!group.includes(target.beforeId) || target.beforeId === id) return null;
    to = group.indexOf(target.beforeId);
  }
  if (to < 0 || to >= group.length || to === from) return null;
  group.splice(from, 1);
  group.splice(to, 0, id);
  return next.flat();
}
