import type { ReactNode } from 'react';
import { NumericText } from '../../../components/ui/NumericText';
import { useCopy } from '../../../hooks/use-copy';
import { formatCopy } from '../../../i18n/copy';
import type { TradingPlan } from '../../../types/domain';
import { trimDecimal } from '../../../utils/decimal-format';
import { planAmount, planPrice, planRatio } from './plan-format';
import { PriceLadder } from './PriceLadder';

function Figure({
  label,
  tone,
  children,
  note,
}: {
  label: string;
  tone?: 'positive' | 'negative';
  children: ReactNode;
  note?: ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <dt className="text-[10.5px] font-semibold tracking-[0.06em] text-muted uppercase">
        {label}
      </dt>
      <dd
        className={
          'm-0 font-mono text-lg leading-tight font-semibold ' +
          (tone === 'positive'
            ? 'text-positive'
            : tone === 'negative'
              ? 'text-negative'
              : 'text-fg')
        }
      >
        {children}
        {note && (
          <span className="ml-1 font-sans text-[11.5px] font-normal text-muted-dim">
            {note}
          </span>
        )}
      </dd>
    </div>
  );
}

/**
 * The plan at a glance (SCR-18, T-139 wave C): its stop loss, entry and
 * take profit on one ladder with their prices, and the four figures of
 * the stored calculation that decide it (BR-31): reward / risk, the risk
 * with its share of the capital, the reward, and reward / risk after the
 * estimated costs ("—" for a plan saved before them, D-116). Read from
 * the plan only; nothing is computed here.
 */
export function PlanSummary({ plan }: { plan: TradingPlan }) {
  const copy = useCopy();
  const p = copy.plan;
  const s = plan.snapshot;
  const price = (value: string) => planPrice(value);
  return (
    <dl className="m-0 grid grid-cols-2 gap-x-6 gap-y-4 md:grid-cols-4 xl:grid-cols-[minmax(0,2fr)_repeat(4,minmax(0,1fr))] xl:items-center">
      <div className="col-span-2 min-w-0 md:col-span-4 xl:col-span-1">
        <dt className="sr-only">{p.ladderTitle}</dt>
        <dd className="m-0">
          <PriceLadder
            stopLoss={plan.stopLoss}
            entry={plan.entryPrice}
            takeProfit={plan.takeProfit}
            label={formatCopy(p.ladderLabel, {
              stopLoss: price(plan.stopLoss),
              entry: price(plan.entryPrice),
              takeProfit: price(plan.takeProfit),
            })}
            className="h-6 w-full"
          />
          <span
            aria-hidden="true"
            className="mt-1 flex justify-between gap-2 font-mono text-[11px] text-muted"
          >
            <span className="text-negative">
              {'SL ' + price(plan.stopLoss)}
            </span>
            <span>{p.ladderEntry + ' ' + price(plan.entryPrice)}</span>
            <span className="text-positive">
              {'TP ' + price(plan.takeProfit)}
            </span>
          </span>
        </dd>
      </div>
      <Figure label={p.riskReward}>
        <NumericText value={planRatio(s.riskRewardRatio)} />
      </Figure>
      <Figure
        label={p.riskAmount}
        tone="negative"
        note={formatCopy(p.ofCapital, {
          percent: trimDecimal(plan.riskPercent, 0),
        })}
      >
        <NumericText value={'−' + planAmount(s.riskAmount)} />
      </Figure>
      <Figure label={p.rewardAmount} tone="positive">
        <NumericText value={'+' + planAmount(s.rewardAmount)} />
      </Figure>
      <Figure label={p.netRiskReward}>
        {s.netRiskReward === null ? (
          copy.market.noValue
        ) : (
          <NumericText value={planRatio(s.netRiskReward)} />
        )}
      </Figure>
    </dl>
  );
}
