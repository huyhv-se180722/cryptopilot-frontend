import { formatCopy } from '../../../i18n/copy';
import type { ChartLayout } from '../../../types/domain';

/**
 * The name a chart copy is shown under: the Trader's, else "Copy {n}" from
 * `defaultName`. A pair without copies shows the "Copy 1" its first drawing
 * opens.
 */
export function layoutName(
  layout: Pick<ChartLayout, 'name' | 'number'> | null,
  defaultName: string,
): string {
  return layout?.name ?? formatCopy(defaultName, { n: layout?.number ?? 1 });
}
