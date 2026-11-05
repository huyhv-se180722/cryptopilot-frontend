import type { ReactNode } from 'react';
import { ChartCandlestick, MessageCircle } from 'lucide-react';
import { Checkbox } from '../../../components/ui/Checkbox';
import { Select } from '../../../components/ui/Select';
import { useCopy } from '../../../hooks/use-copy';
import { classNames } from '../../../utils/class-names';
import {
  AI_TIMEFRAMES,
  type AiContextValue,
  type AskMode,
} from '../ai-context';
import type {
  MarketPair,
  MarketType,
  PlanTimeframe,
  TradingPlanSummary,
} from '../../../types/domain';

function ModeCard({
  mode,
  selected,
  icon,
  title,
  hint,
  onPick,
}: {
  mode: AskMode;
  selected: boolean;
  icon: ReactNode;
  title: string;
  hint: string;
  onPick: (mode: AskMode) => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={() => onPick(mode)}
      className={classNames(
        'flex min-w-0 flex-1 items-start gap-2.5 rounded-lg border p-3 text-left transition-colors',
        selected
          ? 'border-primary bg-primary-soft'
          : 'border-line bg-surface hover:bg-raised',
      )}
    >
      <span
        aria-hidden="true"
        className={classNames(
          'mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-md',
          selected ? 'bg-primary text-white' : 'bg-raised text-fg-2',
        )}
      >
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-fg">{title}</span>
        <span className="mt-0.5 block text-xs text-fg-2">{hint}</span>
      </span>
    </button>
  );
}

/**
 * The top of SCR-29: how the Trader asks. A general question reads no
 * market data; "analyse a coin" opens the market, pair and timeframe of the
 * analysis that goes with the question. A plan and, on PREMIUM, the
 * performance summary can go with either (BR-62). Never personal data
 * (BR-51).
 */
export function AskContext({
  value,
  pairs,
  plans,
  symbolOf,
  performanceAllowed,
  onChange,
}: {
  value: AiContextValue;
  /** The pairs of the chosen market. */
  pairs: readonly MarketPair[];
  plans: readonly TradingPlanSummary[];
  symbolOf: (pairId: string) => string | undefined;
  performanceAllowed: boolean;
  onChange: (next: AiContextValue) => void;
}) {
  const t = useCopy().aiAssistant;
  return (
    <section
      aria-label={t.askTitle}
      className="grid gap-3 rounded-lg border border-line bg-surface p-3"
    >
      <h2 className="m-0 text-sm font-semibold text-fg">{t.askTitle}</h2>
      <div
        role="radiogroup"
        aria-label={t.askTitle}
        className="flex flex-col gap-2 sm:flex-row"
      >
        <ModeCard
          mode="general"
          selected={value.mode === 'general'}
          icon={<MessageCircle size={15} />}
          title={t.modeGeneral}
          hint={t.modeGeneralHint}
          onPick={(mode) => onChange({ ...value, mode })}
        />
        <ModeCard
          mode="pair"
          selected={value.mode === 'pair'}
          icon={<ChartCandlestick size={15} />}
          title={t.modePair}
          hint={t.modePairHint}
          onPick={(mode) => onChange({ ...value, mode })}
        />
      </div>
      {value.mode === 'pair' && (
        <div className="grid gap-2 sm:grid-cols-3">
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
            onChange={(event) =>
              onChange({ ...value, pairId: event.target.value })
            }
          >
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
              onChange({
                ...value,
                timeframe: event.target.value as PlanTimeframe,
              })
            }
          >
            {AI_TIMEFRAMES.map((timeframe) => (
              <option key={timeframe} value={timeframe}>
                {timeframe}
              </option>
            ))}
          </Select>
        </div>
      )}
      <div className="grid gap-2 border-t border-line pt-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
        <Select
          label={t.extras + ' · ' + t.plan}
          value={value.planId}
          onChange={(event) =>
            onChange({ ...value, planId: event.target.value })
          }
        >
          <option value="">{t.noPlan}</option>
          {plans.map((plan) => (
            <option key={plan.id} value={plan.id}>
              {(symbolOf(plan.pairId) ?? plan.market) +
                ' · ' +
                plan.direction +
                ' · ' +
                plan.entryPrice}
            </option>
          ))}
        </Select>
        <Checkbox
          className="sm:pb-2"
          label={performanceAllowed ? t.performance : t.performanceLocked}
          checked={performanceAllowed && value.includePerformance}
          disabled={!performanceAllowed}
          onChange={(event) =>
            onChange({ ...value, includePerformance: event.target.checked })
          }
        />
      </div>
      <p className="m-0 text-[11px] text-muted-dim">{t.privacy}</p>
    </section>
  );
}
