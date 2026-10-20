import { RotateCcw } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { SegmentedControl } from '../../../components/ui/SegmentedControl';
import { Select } from '../../../components/ui/Select';
import { useCopy } from '../../../hooks/use-copy';
import type { MarketPair, MarketType } from '../../../types/domain';
import { pairLabel } from '../../../utils/pair-label';
import { PLAN_PERIODS, type PlanPeriod } from './plan-format';

/**
 * SCR-16 filters (SRS 3.5.2): pair (by the id the market lists give,
 * FEQ-01), market and creation period.
 */
export function PlanFilters({
  pairs,
  pairId,
  market,
  period,
  onPairChange,
  onMarketChange,
  onPeriodChange,
  onReset,
}: {
  /** Every pair of both market lists, once each. */
  pairs: readonly MarketPair[];
  /** The chosen pair, or '' for all. */
  pairId: string;
  market: MarketType | 'all';
  period: PlanPeriod;
  onPairChange: (pairId: string) => void;
  onMarketChange: (market: MarketType | 'all') => void;
  onPeriodChange: (period: PlanPeriod) => void;
  onReset: () => void;
}) {
  const copy = useCopy();
  const p = copy.plan;
  const labels: Record<PlanPeriod, string> = {
    '7': p.period7,
    '30': p.period30,
    '90': p.period90,
    all: p.periodAll,
  };
  return (
    <div className="mb-3 flex flex-wrap items-end gap-3">
      <Select
        label={p.filterPair}
        value={pairId}
        onChange={(event) => onPairChange(event.target.value)}
        className="w-44"
      >
        <option value="">{p.filterAllPairs}</option>
        {pairs.map((pair) => (
          <option key={pair.pairId} value={pair.pairId}>
            {pairLabel(pair.symbol)}
          </option>
        ))}
      </Select>
      <Select
        label={p.filterMarket}
        value={market}
        onChange={(event) =>
          onMarketChange(event.target.value as MarketType | 'all')
        }
        className="w-44"
      >
        <option value="all">{p.filterAllMarkets}</option>
        <option value="spot">{copy.market.spot}</option>
        <option value="futures">{copy.market.futures}</option>
      </Select>
      <div>
        <span
          className="mb-1.5 block text-xs font-medium text-fg-2"
          aria-hidden="true"
        >
          {p.filterPeriod}
        </span>
        <SegmentedControl
          label={p.filterPeriod}
          value={period}
          onChange={onPeriodChange}
          options={PLAN_PERIODS.map((value) => ({
            value,
            label: labels[value],
          }))}
        />
      </div>
      <Button variant="ghost" onClick={onReset}>
        <RotateCcw size={13} aria-hidden="true" />
        {p.reset}
      </Button>
    </div>
  );
}
