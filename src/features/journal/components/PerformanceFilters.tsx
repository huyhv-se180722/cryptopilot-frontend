import { Input } from '../../../components/ui/Input';
import { SegmentedControl } from '../../../components/ui/SegmentedControl';
import { Select } from '../../../components/ui/Select';
import { useCopy } from '../../../hooks/use-copy';
import type { PerformanceSource } from '../../../types/domain';
import type { PairOption } from '../hooks/use-pair-options';
import {
  MARKET_CHOICES,
  PERIOD_PRESETS,
  SOURCES,
  type MarketChoice,
  type PerformanceView,
  type Period,
} from '../model/performance-view';
import type { FilterErrors } from './performance-errors';

const PERIODS: readonly Period[] = [...PERIOD_PRESETS, 'custom'];

export interface StrategyOption {
  id: string;
  label: string;
}

/**
 * The filter bar of SCR-23. There is no list of strategies to read, so
 * they come from the by-strategy breakdown: `strategies` is null without
 * it, on FREE, and the filter is left out.
 */
export function PerformanceFilters({
  view,
  pairs,
  strategies,
  errors,
  onChange,
}: {
  view: PerformanceView;
  pairs: readonly PairOption[];
  strategies: readonly StrategyOption[] | null;
  errors: FilterErrors;
  onChange: (change: Partial<PerformanceView>) => void;
}) {
  const copy = useCopy();
  const p = copy.performance;
  // A pair or strategy of the address that no list names stays selectable.
  const chosenPair =
    view.pairId && !pairs.some((pair) => pair.pairId === view.pairId);
  const chosenStrategy =
    view.strategyId &&
    strategies !== null &&
    !strategies.some((strategy) => strategy.id === view.strategyId);
  return (
    <section
      aria-label={p.filtersLabel}
      className="mb-4 rounded-xl border border-line bg-surface p-4"
    >
      <div className="mb-3 max-w-full overflow-x-auto">
        <SegmentedControl
          label={p.period}
          value={view.period}
          onChange={(period) => onChange({ period })}
          options={PERIODS.map((value) => ({
            value,
            label: p[`period${value}`],
          }))}
        />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {view.period === 'custom' && (
          <>
            <Input
              label={p.from}
              type="date"
              value={view.from}
              error={errors.from}
              onChange={(event) => onChange({ from: event.target.value })}
            />
            <Input
              label={p.to}
              type="date"
              value={view.to}
              error={errors.to}
              onChange={(event) => onChange({ to: event.target.value })}
            />
          </>
        )}
        <Select
          label={p.market}
          value={view.market}
          error={errors.market}
          onChange={(event) =>
            onChange({ market: event.target.value as MarketChoice })
          }
        >
          {MARKET_CHOICES.map((market) => (
            <option key={market} value={market}>
              {p[`market${market}`]}
            </option>
          ))}
        </Select>
        <Select
          label={p.source}
          value={view.source}
          error={errors.source}
          onChange={(event) =>
            onChange({ source: event.target.value as PerformanceSource })
          }
        >
          {SOURCES.map((source) => (
            <option key={source} value={source}>
              {p[`source${source}`]}
            </option>
          ))}
        </Select>
        <Select
          label={p.pair}
          value={view.pairId}
          error={errors.pairId}
          onChange={(event) => onChange({ pairId: event.target.value })}
        >
          <option value="">{p.pairAll}</option>
          {chosenPair && (
            <option value={view.pairId}>{copy.market.noValue}</option>
          )}
          {pairs.map((pair) => (
            <option key={pair.pairId} value={pair.pairId}>
              {pair.label}
            </option>
          ))}
        </Select>
        {strategies !== null && (
          <Select
            label={p.strategy}
            value={view.strategyId}
            error={errors.strategyId}
            onChange={(event) => onChange({ strategyId: event.target.value })}
          >
            <option value="">{p.strategyAll}</option>
            {chosenStrategy && (
              <option value={view.strategyId}>{copy.market.noValue}</option>
            )}
            {strategies.map((strategy) => (
              <option key={strategy.id} value={strategy.id}>
                {strategy.label}
              </option>
            ))}
          </Select>
        )}
      </div>
    </section>
  );
}
