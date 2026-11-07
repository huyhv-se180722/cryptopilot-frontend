import type { ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { useCopy } from '../../../hooks/use-copy';
import { classNames } from '../../../utils/class-names';
import {
  groupThousands,
  toFixedDecimal,
  trimDecimal,
} from '../../../utils/decimal-format';
import { AI_TIMEFRAMES, baseOf, type AiContextValue } from '../ai-context';
import type {
  MarketPair,
  MarketType,
  TradingPlanSummary,
} from '../../../types/domain';

function Segmented<T extends string>({
  label,
  options,
  value,
  mono = false,
  onPick,
}: {
  label: string;
  options: readonly { value: T; label: string }[];
  value: T;
  mono?: boolean;
  onPick: (value: T) => void;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className="inline-flex gap-0.5 rounded-[10px] bg-raised-hover p-[3px]"
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={selected}
            onClick={() => onPick(option.value)}
            className={classNames(
              'h-[30px] rounded-lg px-3 text-xs',
              mono && 'font-mono',
              selected
                ? 'bg-surface font-semibold text-fg shadow-sm'
                : 'text-muted hover:text-fg-2',
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

const MARKETS: readonly { value: MarketType; label: string }[] = [
  { value: 'spot', label: 'Spot' },
  { value: 'futures', label: 'Futures' },
];

/**
 * The market page's context bar (SCR-29): the coin, its market and the
 * timeframe the assistant analyses, with live figures beside them. Only
 * the analysis of that pair goes with the question (BR-51).
 */
export function MarketContextBar({
  value,
  pairs,
  symbol,
  live,
  onChange,
}: {
  value: AiContextValue;
  /** The pairs of the chosen market. */
  pairs: readonly MarketPair[];
  symbol: string | undefined;
  /** The live price, RSI and setup score of the pair, drawn on the right. */
  live?: ReactNode;
  onChange: (next: AiContextValue) => void;
}) {
  const t = useCopy().aiAssistant;
  return (
    <div className="flex flex-wrap items-center gap-2.5 border-b border-line bg-surface-alt px-4 py-2.5 sm:px-5">
      <div className="relative inline-flex h-9 items-center gap-2 rounded-[10px] border border-line-strong bg-surface pr-8 pl-1.5 focus-within:ring-2 focus-within:ring-primary-soft">
        <span
          aria-hidden="true"
          className="inline-flex size-6 items-center justify-center rounded-full bg-[#f7931a] text-[10px] font-bold text-white"
        >
          {symbol ? baseOf(symbol).slice(0, 1) : '·'}
        </span>
        <select
          aria-label={t.pair}
          value={value.pairId}
          onChange={(event) =>
            onChange({ ...value, pairId: event.target.value })
          }
          className="absolute inset-0 cursor-pointer opacity-0"
        >
          {pairs.map((pair) => (
            <option key={pair.pairId} value={pair.pairId}>
              {pair.symbol}
            </option>
          ))}
        </select>
        <span aria-hidden="true" className="text-[13px] font-semibold text-fg">
          {symbol ? baseOf(symbol) : '…'}
          {symbol && symbol !== baseOf(symbol) && (
            <span className="font-medium text-muted-dim">
              {'/' + symbol.slice(baseOf(symbol).length)}
            </span>
          )}
        </span>
        <ChevronDown
          size={13}
          aria-hidden="true"
          className="pointer-events-none absolute right-2.5 text-muted"
        />
      </div>
      <Segmented
        label={t.market}
        options={MARKETS}
        value={value.market}
        onPick={(market) => onChange({ ...value, market, pairId: '' })}
      />
      <Segmented
        label={t.timeframe}
        mono
        options={AI_TIMEFRAMES.map((timeframe) => ({
          value: timeframe,
          label: timeframe,
        }))}
        value={value.timeframe}
        onPick={(timeframe) => onChange({ ...value, timeframe })}
      />
      <span className="hidden flex-1 md:block" />
      {live}
    </div>
  );
}

/** One live figure of the market bar. */
export function LiveFigure({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <span className="flex flex-col">
      <span className="text-[10.5px] text-muted-dim">{label}</span>
      <span className="font-mono text-sm font-semibold text-fg">
        {children}
      </span>
    </span>
  );
}

function number(value: string) {
  return groupThousands(trimDecimal(value, 0));
}

/**
 * The "my plan and performance" page's context bar (SCR-29): one of the
 * Trader's plans as a card (the native list opens on it), and the
 * performance summary on PREMIUM (BR-62). The capital, the amounts and the
 * note never go with the question (BR-51).
 */
export function MineContextBar({
  value,
  plans,
  symbolOf,
  planTimeframe,
  performanceAllowed,
  onChange,
}: {
  value: AiContextValue;
  plans: readonly TradingPlanSummary[];
  symbolOf: (pairId: string) => string | undefined;
  /** The chosen plan's timeframe, once read. */
  planTimeframe: string | undefined;
  performanceAllowed: boolean;
  onChange: (next: AiContextValue) => void;
}) {
  const t = useCopy().aiAssistant;
  const plan = plans.find((item) => item.id === value.planId);
  const symbol = plan ? (symbolOf(plan.pairId) ?? '') : '';
  return (
    <div className="flex flex-wrap items-stretch gap-2.5 border-b border-line bg-surface-alt px-4 py-3 sm:px-5">
      <div
        className={classNames(
          'relative flex min-h-[58px] min-w-0 flex-[1_1_360px] items-center gap-3 rounded-xl border bg-surface px-3 py-2.5 focus-within:ring-2 focus-within:ring-purple-soft',
          plan ? 'border-[1.5px] border-purple' : 'border-line-strong',
        )}
      >
        <select
          aria-label={t.plan}
          value={value.planId}
          aria-describedby="ai-plan-hint"
          onChange={(event) =>
            onChange({ ...value, planId: event.target.value })
          }
          className="absolute inset-0 cursor-pointer opacity-0"
        >
          <option value="">{t.noPlan}</option>
          {plans.map((item) => (
            <option key={item.id} value={item.id}>
              {(symbolOf(item.pairId) ?? item.market) +
                ' · ' +
                item.direction +
                ' · ' +
                item.entryPrice}
            </option>
          ))}
        </select>
        {plan ? (
          <>
            <span
              className={classNames(
                'rounded-md px-2 py-0.5 font-mono text-[11px] font-bold',
                plan.direction === 'LONG'
                  ? 'bg-positive-soft text-positive'
                  : 'bg-negative-soft text-negative',
              )}
            >
              {plan.direction}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-semibold text-fg">
                {baseOf(symbol) +
                  '/' +
                  symbol.slice(baseOf(symbol).length) +
                  ' · ' +
                  (plan.market === 'futures' ? 'Futures' : 'Spot') +
                  (planTimeframe ? ' · ' + planTimeframe : '')}
              </span>
              <span className="mt-0.5 block truncate font-mono text-[11px] text-muted">
                {'Entry ' +
                  number(plan.entryPrice) +
                  ' · SL ' +
                  number(plan.stopLoss) +
                  ' · TP ' +
                  number(plan.takeProfit) +
                  ' · R:R ' +
                  toFixedDecimal(plan.riskRewardRatio, 2)}
              </span>
            </span>
            <span className="hidden rounded-full bg-purple-soft px-2 py-0.5 text-[11px] font-semibold text-purple sm:inline">
              {plan.status}
            </span>
          </>
        ) : (
          <span className="min-w-0 flex-1">
            <span className="block text-[13px] font-semibold text-fg">
              {t.choosePlan}
            </span>
            <span
              id="ai-plan-hint"
              className="mt-0.5 block text-[11px] text-muted"
            >
              {plans.length === 0 ? t.noPlans : t.planHint}
            </span>
          </span>
        )}
        <ChevronDown
          size={14}
          aria-hidden="true"
          className="pointer-events-none shrink-0 text-muted"
        />
      </div>
      <label
        className={classNames(
          'flex min-w-0 flex-[1_1_260px] cursor-pointer items-center gap-3 rounded-xl border border-line-strong bg-surface px-3 py-2.5',
          !performanceAllowed && 'cursor-not-allowed opacity-60',
        )}
      >
        <input
          type="checkbox"
          checked={performanceAllowed && value.includePerformance}
          disabled={!performanceAllowed}
          onChange={(event) =>
            onChange({ ...value, includePerformance: event.target.checked })
          }
          className="size-4 shrink-0 accent-purple"
        />
        <span className="min-w-0">
          <span className="block text-[13px] font-semibold text-fg">
            {performanceAllowed ? t.performance : t.performanceLocked}
          </span>
          <span className="mt-0.5 block text-[11px] text-muted">
            {t.performanceHint}
          </span>
        </span>
      </label>
    </div>
  );
}
