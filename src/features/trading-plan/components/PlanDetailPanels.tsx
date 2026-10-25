import type { ReactNode } from 'react';
import { AlertTriangle, Clock } from 'lucide-react';
import { NumericText } from '../../../components/ui/NumericText';
import { useCopy } from '../../../hooks/use-copy';
import { messageText } from '../../../i18n/messages';
import type {
  PlanSnapshot,
  PlanWarning,
  TradingPlan,
} from '../../../types/domain';
import { shiftDecimal, toFixedDecimal } from '../../../utils/decimal-format';
import {
  formatInstantLocal,
  formatInstantUtc,
} from '../../../utils/instant-format';
import { PlanStatusBadge, SeverityBadge } from './PlanBadges';
import { planAmount, planPrice, planQuantity, planRatio } from './plan-format';
import { warningText } from './plan-text';

export function Panel({
  id,
  title,
  aside,
  children,
}: {
  id: string;
  title: string;
  /** Shown at the end of the title row (e.g. an updating mark). */
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section
      aria-labelledby={id}
      className="rounded-xl border border-line bg-surface p-4"
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2
          id={id}
          className="text-[10px] font-semibold tracking-widest text-muted-x uppercase"
        >
          {title}
        </h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

function Rows({
  rows,
  single = false,
}: {
  rows: readonly [string, ReactNode][];
  /** One column, for a narrow side panel. */
  single?: boolean;
}) {
  return (
    <dl
      className={
        single
          ? 'grid grid-cols-1 gap-y-2'
          : 'grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2'
      }
    >
      {rows.map(([label, value]) => (
        <div
          key={label}
          className="flex items-baseline justify-between gap-3 border-b border-line pb-1.5"
        >
          <dt className="text-[11px] text-muted-dim">{label}</dt>
          <dd className="text-right text-xs text-fg">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

const when = (value: string) => (
  <time dateTime={value} title={formatInstantUtc(value)}>
    {formatInstantLocal(value)}
  </time>
);

/** SRS 3.5.3: the plan inputs as entered (prices at the pair's tick). */
export function PlanInputsPanel({ plan }: { plan: TradingPlan }) {
  const copy = useCopy();
  const p = copy.plan;
  const futures = plan.market === 'futures';
  const rows: [string, ReactNode][] = [
    [p.colMarket, futures ? copy.market.futures : copy.market.spot],
    [p.entryType, p[`entry${plan.entryType}`]],
    [p.entryPrice, <NumericText value={planPrice(plan.entryPrice)} />],
    [p.stopLoss, <NumericText value={planPrice(plan.stopLoss)} />],
    [p.takeProfit, <NumericText value={planPrice(plan.takeProfit)} />],
    [p.capital, <NumericText value={planAmount(plan.capital)} />],
    [p.riskPercent, <NumericText value={plan.riskPercent} suffix="%" />],
    ...(futures
      ? ([
          [p.leverage, <NumericText value={`${plan.leverage ?? 1}x`} />],
          [p.marginMode, plan.marginMode === 'ISOLATED' ? p.isolated : '—'],
        ] as [string, ReactNode][])
      : []),
    [p.expiresAt, plan.expiresAt ? when(plan.expiresAt) : p.noExpiry],
    ...(plan.invalidationReason
      ? ([[p.invalidationReason, p[`reason${plan.invalidationReason}`]]] as [
          string,
          ReactNode,
        ][])
      : []),
  ];
  return (
    <Panel id="plan-inputs-title" title={p.inputsTitle}>
      <Rows rows={rows} />
      {plan.note && (
        <p className="mt-3 text-xs text-fg-2">
          <span className="mr-1.5 text-[11px] text-muted-dim">{p.note}</span>
          {plan.note}
        </p>
      )}
    </Panel>
  );
}

/**
 * The calculation stored with the plan (BR-31) or the live one of SCR-17;
 * Futures adds margin, MMR and liquidation.
 */
export function PlanSnapshotRows({
  snapshot: s,
  single = false,
}: {
  snapshot: PlanSnapshot;
  single?: boolean;
}) {
  const p = useCopy().plan;
  const rows: [string, ReactNode][] = [
    [p.quantity, <NumericText value={planQuantity(s.positionQuantity)} />],
    [p.notional, <NumericText value={planAmount(s.notionalValue)} />],
    [p.riskAmount, <NumericText value={planAmount(s.riskAmount)} />],
    [p.rewardAmount, <NumericText value={planAmount(s.rewardAmount)} />],
    [p.riskReward, <NumericText value={planRatio(s.riskRewardRatio)} />],
    ...(s.initialMargin !== null
      ? ([
          [
            p.initialMargin,
            <NumericText value={planAmount(s.initialMargin)} />,
          ],
        ] as [string, ReactNode][])
      : []),
    ...(s.maintenanceMarginRateUsed !== null
      ? ([
          [
            p.maintenanceRate,
            <NumericText
              value={toFixedDecimal(
                shiftDecimal(s.maintenanceMarginRateUsed, 2),
                2,
              )}
              suffix="%"
            />,
          ],
        ] as [string, ReactNode][])
      : []),
    ...(s.estimatedLiquidationPrice !== null
      ? ([
          [
            p.liquidation,
            <NumericText value={planPrice(s.estimatedLiquidationPrice)} />,
          ],
        ] as [string, ReactNode][])
      : []),
  ];
  return <Rows rows={rows} single={single} />;
}

export function PlanSnapshotPanel({ plan }: { plan: TradingPlan }) {
  const p = useCopy().plan;
  return (
    <Panel id="plan-snapshot-title" title={p.snapshotTitle}>
      <PlanSnapshotRows snapshot={plan.snapshot} />
    </Panel>
  );
}

/** Warnings with their severity (MSG17, BR-28, BR-29), worded by type. */
export function PlanWarningsPanel({
  warnings,
  blocked,
  feeShareOfRisk = null,
}: {
  warnings: readonly PlanWarning[];
  /** Show the blocking hint (a DRAFT whose activation is blocked). */
  blocked: boolean;
  /** The snapshot's fee share, for HIGH_FEE_SHARE. */
  feeShareOfRisk?: string | null;
}) {
  const copy = useCopy();
  const p = copy.plan;
  return (
    <Panel id="plan-warnings-title" title={p.warningsTitle}>
      {warnings.length === 0 ? (
        <p className="text-xs text-muted">{p.noWarnings}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {warnings.map((warning, index) => {
            const text = warningText(copy, warning, feeShareOfRisk);
            return (
              <li
                key={(warning.rawType ?? warning.type) + index}
                className="flex items-start gap-2 text-xs text-fg-2"
              >
                <SeverityBadge severity={warning.severity} />
                <span className="sr-only">
                  {messageText(copy, 'MSG17', [], {
                    severity: p[`severity${warning.severity}`],
                    message: text,
                  })}
                </span>
                <span aria-hidden="true">{text}</span>
              </li>
            );
          })}
        </ul>
      )}
      {blocked && (
        <p className="mt-3 flex items-start gap-1.5 text-[11px] text-negative">
          <AlertTriangle
            size={12}
            aria-hidden="true"
            className="mt-0.5 shrink-0"
          />
          {p.blockedHint}
        </p>
      )}
    </Panel>
  );
}

/** Status changes, oldest first (D-67). */
export function PlanHistoryPanel({ plan }: { plan: TradingPlan }) {
  const p = useCopy().plan;
  return (
    <Panel id="plan-history-title" title={p.historyTitle}>
      <ol className="relative ml-1.5 border-l border-line">
        {plan.statusHistory.map((change, index) => (
          <li key={change.status + index} className="mb-3 ml-4 last:mb-0">
            <span
              aria-hidden="true"
              className="absolute -left-[5px] mt-1.5 size-2.5 rounded-full border-2 border-surface bg-primary"
            />
            <div className="flex flex-wrap items-center gap-2">
              <PlanStatusBadge status={change.status} />
              <span className="text-[11px] text-muted-dim">
                {when(change.at)}
              </span>
            </div>
          </li>
        ))}
      </ol>
    </Panel>
  );
}

/** SRS 3.5.3 live position of an executed plan; it waits for the matching engine. */
export function PlanPositionPanel() {
  const p = useCopy().plan;
  return (
    <Panel id="plan-position-title" title={p.positionTitle}>
      <p className="flex items-start gap-2 text-xs text-muted">
        <Clock size={14} aria-hidden="true" className="mt-0.5 shrink-0" />
        {p.positionWaiting}
      </p>
    </Panel>
  );
}
