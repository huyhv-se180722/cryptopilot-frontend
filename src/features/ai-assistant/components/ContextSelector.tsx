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

/** The value of a pair option: the market and the pair, one pair id per symbol (FEQ-01). */
function pairKey(market: MarketType, pairId: string) {
  return pairId === '' ? '' : market + ':' + pairId;
}

/**
 * The context selector of SCR-29: one pair list grouped by market (or no
 * pair, for a general question), the timeframe of a chosen pair or plan,
 * optionally one of the Trader's plans, and on PREMIUM the performance
 * summary (BR-62). Only what is chosen here goes with the question, never
 * personal data (BR-51).
 */
export function ContextSelector({
  value,
  spotPairs,
  futuresPairs,
  plans,
  performanceAllowed,
  onChange,
}: {
  value: AiContextValue;
  spotPairs: readonly MarketPair[];
  futuresPairs: readonly MarketPair[];
  plans: readonly TradingPlanSummary[];
  performanceAllowed: boolean;
  onChange: (next: AiContextValue) => void;
}) {
  const t = useCopy().aiAssistant;
  const symbols = new Map(
    [...futuresPairs, ...spotPairs].map((pair) => [pair.pairId, pair.symbol]),
  );
  const groups: readonly [MarketType, string, readonly MarketPair[]][] = [
    ['spot', 'Spot', spotPairs],
    ['futures', 'Futures', futuresPairs],
  ];
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
        label={t.pair}
        value={pairKey(value.market, value.pairId)}
        onChange={(event) => {
          const [market, pairId] = event.target.value.split(':');
          onChange(
            pairId
              ? { ...value, market: market as MarketType, pairId }
              : { ...value, pairId: '' },
          );
        }}
      >
        <option value="">{t.noPair}</option>
        {groups.map(
          ([market, label, pairs]) =>
            pairs.length > 0 && (
              <optgroup key={market} label={label}>
                {pairs.map((pair) => (
                  <option
                    key={pair.pairId}
                    value={pairKey(market, pair.pairId)}
                  >
                    {pair.symbol + ' · ' + label}
                  </option>
                ))}
              </optgroup>
            ),
        )}
      </Select>
      <Select
        label={t.timeframe}
        value={value.timeframe}
        disabled={value.pairId === '' && value.planId === ''}
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
