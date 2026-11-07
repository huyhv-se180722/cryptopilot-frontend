import type { Copy } from '../../../i18n/locales/en';
import { fieldErrorText, messageText } from '../../../i18n/messages';
import { problemOf } from '../../../services/api/errors';

export type FilterField =
  'from' | 'to' | 'market' | 'source' | 'pairId' | 'strategyId';
export type FilterErrors = Partial<Record<FilterField, string>>;

/** The tier a refused plan gate names, when the error is a refused gate. */
export function lockedTier(error: unknown): string | undefined {
  const problem = problemOf(error);
  return problem?.messageCode === 'MSG29'
    ? (problem.messageArgs[0] ?? 'PRO')
    : undefined;
}

/**
 * The text under each filter of a 400. MSG15 names no limits on the wire,
 * so a period starting too late is read against the first trade and
 * `lastDay`, the last day that `from` could be.
 */
export function filterErrors(
  copy: Copy,
  error: unknown,
  lastDay: string,
): FilterErrors {
  const p = copy.performance;
  const labels: Record<FilterField, string> = {
    from: p.from,
    to: p.to,
    market: p.market,
    source: p.source,
    pairId: p.pair,
    strategyId: p.strategy,
  };
  const errors: FilterErrors = {};
  const fields = problemOf(error)?.fieldErrors ?? {};
  for (const field of Object.keys(labels) as FilterField[]) {
    const id = fields[field];
    if (!id) continue;
    errors[field] =
      id === 'MSG15'
        ? messageText(copy, id, [], {
            field: labels[field],
            min: p.firstTrade,
            max: lastDay,
          })
        : fieldErrorText(copy, id, labels[field]);
  }
  return errors;
}
