import type {
  MarketType,
  PerformanceFilter,
  PerformanceSource,
} from '../../../types/domain';
import { addDays, isDay } from '../../../utils/business-day';

export const PERIOD_PRESETS = ['7d', '30d', '90d', '1y', 'all'] as const;
export type Period = (typeof PERIOD_PRESETS)[number] | 'custom';
export type MarketChoice = 'all' | MarketType;

export const MARKET_CHOICES: readonly MarketChoice[] = [
  'all',
  'spot',
  'futures',
];
export const SOURCES: readonly PerformanceSource[] = [
  'SIMULATED',
  'MANUAL',
  'ALL',
];

const PRESET_DAYS = { '7d': 7, '30d': 30, '90d': 90, '1y': 365 } as const;

/** The filters of SCR-23 as the Trader sees them, kept in the URL. */
export interface PerformanceView {
  period: Period;
  /** Custom period: first and last day shown, both included. */
  from: string;
  to: string;
  market: MarketChoice;
  source: PerformanceSource;
  pairId: string;
  strategyId: string;
}

const dayOf = (value: string | null) =>
  value !== null && isDay(value) ? value : '';

export function marketOfParam(value: string | null): MarketChoice {
  return value === 'spot' || value === 'futures' ? value : 'all';
}

export function readView(params: URLSearchParams): PerformanceView {
  const from = dayOf(params.get('from'));
  const to = dayOf(params.get('to'));
  const period = params.get('period');
  const preset = PERIOD_PRESETS.find((each) => each === period);
  const source = SOURCES.find((each) => each === params.get('source'));
  return {
    period:
      period === 'custom' || (!preset && (from || to))
        ? 'custom'
        : (preset ?? 'all'),
    from,
    to,
    market: marketOfParam(params.get('market')),
    source: source ?? 'SIMULATED',
    pairId: params.get('pair') ?? '',
    strategyId: params.get('strategy') ?? '',
  };
}

/** Only what differs from the defaults, so a plain address means all time. */
export function viewParams(view: PerformanceView): URLSearchParams {
  const params = new URLSearchParams();
  if (view.period !== 'all') params.set('period', view.period);
  if (view.period === 'custom') {
    if (view.from) params.set('from', view.from);
    if (view.to) params.set('to', view.to);
  }
  if (view.market !== 'all') params.set('market', view.market);
  if (view.source !== 'SIMULATED') params.set('source', view.source);
  if (view.pairId) params.set('pair', view.pairId);
  if (view.strategyId) params.set('strategy', view.strategyId);
  return params;
}

/**
 * The request of a view. A preset counts today, so it sends `from` alone;
 * the API's `to` is the first day not counted, one after the last shown.
 */
export function viewFilter(
  view: PerformanceView,
  today: string,
  withStrategy: boolean,
): PerformanceFilter {
  const period =
    view.period === 'custom'
      ? {
          ...(view.from ? { from: view.from } : {}),
          ...(view.to ? { to: addDays(view.to, 1) } : {}),
        }
      : view.period === 'all'
        ? {}
        : { from: addDays(today, 1 - PRESET_DAYS[view.period]) };
  return {
    ...period,
    ...(view.market === 'all' ? {} : { market: view.market }),
    source: view.source,
    ...(view.pairId ? { pairId: view.pairId } : {}),
    ...(withStrategy && view.strategyId ? { strategyId: view.strategyId } : {}),
  };
}
