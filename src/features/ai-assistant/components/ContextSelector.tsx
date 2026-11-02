import { Checkbox } from '../../../components/ui/Checkbox';
import { Select } from '../../../components/ui/Select';
import { useCopy } from '../../../hooks/use-copy';
import { AI_TIMEFRAMES, type AiContextValue } from '../ai-context';
import type {
  MarketPair,
  MarketType,
  PlanTimeframe,
  TradingPlanSummary,
} from '../../../types/domain';

/**
 * The context selector of SCR-29: pair, market and timeframe, optionally
 * one of the Trader's plans, and on PREMIUM the performance summary
 * (BR-62). Only what is chosen here goes with the question, never personal
 * data (BR-51).
 */
export function ContextSelector({
  value,
  pairs,
  plans,
  performanceAllowed,
  onChange,
}: {
  value: AiContextValue;
  pairs: readonly MarketPair[];
  plans: readonly TradingPlanSummary[];
  performanceAllowed: boolean;
  onChange: (next: AiContextValue) => void;
}) {
  const t = useCopy().aiAssistant;
  const symbols = new Map(pairs.map((pair) => [pair.pairId, pair.symbol]));
  return (
    <aside
      aria-label={t.context}
      className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-3"
    >
      <div>
        <h2 className="m-0 text-sm font-semibold text-fg">{t.context}</h2>
        <p className="m-0 mt-1 text-[11px] text-muted-dim">{t.contextHint}</p>
      </div>
      <Select
        label={t.market}
        value={value.market}
        onChange={(event) =>
          onChange({
            ...value,
            market: event.target.value as MarketType,
            pairId: '',
          })
        }
      >
        <option value="spot">Spot</option>
        <option value="futures">Futures</option>
      </Select>
      <Select
        label={t.pair}
        value={value.pairId}
        onChange={(event) => onChange({ ...value, pairId: event.target.value })}
      >
        <option value="">{t.noPair}</option>
        {pairs.map((pair) => (
          <option key={pair.pairId} value={pair.pairId}>
            {pair.symbol}
          </option>
        ))}
      </Select>
      <Select
        label={t.timeframe}
        value={value.timeframe}
        onChange={(event) =>
          onChange({ ...value, timeframe: event.target.value as PlanTimeframe })
        }
      >
        {AI_TIMEFRAMES.map((timeframe) => (
          <option key={timeframe} value={timeframe}>
            {timeframe}
          </option>
        ))}
      </Select>
      <Select
        label={t.plan}
        value={value.planId}
        onChange={(event) => onChange({ ...value, planId: event.target.value })}
      >
        <option value="">{t.noPlan}</option>
        {plans.map((plan) => (
          <option key={plan.id} value={plan.id}>
            {(symbols.get(plan.pairId) ?? plan.market) +
              ' · ' +
              plan.direction +
              ' · ' +
              plan.entryPrice}
          </option>
        ))}
      </Select>
      <Checkbox
        label={performanceAllowed ? t.performance : t.performanceLocked}
        checked={performanceAllowed && value.includePerformance}
        disabled={!performanceAllowed}
        onChange={(event) =>
          onChange({ ...value, includePerformance: event.target.checked })
        }
      />
    </aside>
  );
}
