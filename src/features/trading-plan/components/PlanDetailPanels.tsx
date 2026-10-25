import type { ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';
import { NumericText } from '../../../components/ui/NumericText';
import { useCopy } from '../../../hooks/use-copy';
import { formatCopy } from '../../../i18n/copy';
import { messageText } from '../../../i18n/messages';
import type {
  PlanSnapshot,
  PlanWarning,
  TradingPlan,
} from '../../../types/domain';
import {
  shiftDecimal,
  toFixedDecimal,
  trimDecimal,
} from '../../../utils/decimal-format';
import {
  formatInstantLocal,
  formatInstantUtc,
} from '../../../utils/instant-format';
import { PlanStatusBadge, SeverityBadge } from './PlanBadges';
import {
  planAmount,
  planPrice,
  planQuantity,
  planRatio,
  planShare,
  shownExpectedFill,
} from './plan-format';

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

/**
 * SRS 3.5.3: the plan inputs as entered (prices at the pair's tick), with
 * its validity (D-111): the invalidation price, its own deviation limit,
 * the analysis timeframe and, once activated, the setup score taken then
 * under its preset ("—" when none could be read; never computed here).
 */
export function PlanInputsPanel({ plan }: { plan: TradingPlan }) {
  const copy = useCopy();
  const p = copy.plan;
  const futures = plan.market === 'futures';
  const none = copy.market.noValue;
  const score = plan.setupScoreAtPlan;
  const expectedFill = shownExpectedFill(
    plan.entryPrice,
    plan.expectedFillPrice,
  );
  const rows: [string, ReactNode][] = [
    [p.colMarket, futures ? copy.market.futures : copy.market.spot],
    [p.entryType, p[`entry${plan.entryType}`]],
    [
      plan.entryType === 'STOP' ? p.stopEntryPrice : p.entryPrice,
      <NumericText value={planPrice(plan.entryPrice)} />,
    ],
    ...(expectedFill
      ? ([
          [p.expectedFill, <NumericText value={planPrice(expectedFill)} />],
        ] as [string, ReactNode][])
      : []),
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
    ...(plan.invalidationPrice
      ? ([
          [
            p.invalidationPrice,
            <NumericText value={planPrice(plan.invalidationPrice)} />,
          ],
        ] as [string, ReactNode][])
      : []),
    ...(plan.maxEntryDeviationR
      ? ([
          [
            p.maxDeviation,
            <NumericText
              value={formatCopy(p.deviationValue, {
                value: trimDecimal(plan.maxEntryDeviationR, 0),
              })}
            />,
          ],
        ] as [string, ReactNode][])
      : []),
    ...(plan.analysisTimeframe
      ? ([[p.timeframeField, plan.analysisTimeframe]] as [string, ReactNode][])
      : []),
    ...(plan.status !== 'DRAFT'
      ? ([
          [
            p.setupScoreAtPlan,
            score === null ? (
              none
            ) : (
              <NumericText
                value={
                  plan.setupScorePreset
                    ? formatCopy(p.setupScoreValue, {
                        score,
                        preset: plan.setupScorePreset,
                      })
                    : score
                }
              />
            ),
          ],
        ] as [string, ReactNode][])
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
 * Futures adds margin, MMR and liquidation. The real loss and the reward /
 * risk after fees sit beside the figures they correct, with the costs
 * below them (BR-29, D-116); a plan saved before the costs shows "—".
 */
export function PlanSnapshotRows({
  snapshot: s,
  single = false,
}: {
  snapshot: PlanSnapshot;
  single?: boolean;
}) {
  const copy = useCopy();
  const p = copy.plan;
  const none = copy.market.noValue;
  const amount = (value: string | null) =>
    value === null ? none : <NumericText value={planAmount(value)} />;
  const rows: [string, ReactNode][] = [
    [p.quantity, <NumericText value={planQuantity(s.positionQuantity)} />],
    [p.notional, <NumericText value={planAmount(s.notionalValue)} />],
    [p.riskAmount, <NumericText value={planAmount(s.riskAmount)} />],
    [p.lossAtStopLoss, amount(s.lossAtStopLoss)],
    [p.rewardAmount, <NumericText value={planAmount(s.rewardAmount)} />],
    [p.riskReward, <NumericText value={planRatio(s.riskRewardRatio)} />],
    [
      p.netRiskReward,
      s.netRiskReward === null ? (
        none
      ) : (
        <NumericText value={planRatio(s.netRiskReward)} />
      ),
    ],
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
  const costs: [string, ReactNode][] = [
    [p.entryFee, amount(s.estimatedEntryFee)],
    [p.stopLossExitFee, amount(s.estimatedStopLossExitFee)],
    [p.takeProfitExitFee, amount(s.estimatedTakeProfitExitFee)],
    [p.slippage, amount(s.estimatedSlippage)],
    [
      p.feeShare,
      s.feeShareOfRisk === null ? (
        none
      ) : (
        <NumericText value={planShare(s.feeShareOfRisk)} suffix="%" />
      ),
    ],
  ];
  return (
    <>
      <Rows rows={rows} single={single} />
      {s.lossAtStopLoss !== null && (
        <div className="mt-4">
          <h3 className="mb-2 text-[10px] font-semibold tracking-widest text-muted-x uppercase">
            {p.costsTitle}
          </h3>
          <Rows rows={costs} single={single} />
          <p className="mt-2 text-[10px] leading-relaxed text-muted-dim">
            {p.costsNote}
          </p>
        </div>
      )}
    </>
  );
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
  /** Words HIGH_FEE_SHARE with the share the snapshot answered. */
  feeShareOfRisk?: string | null;
}) {
  const copy = useCopy();
  const p = copy.plan;
  const wording = (warning: PlanWarning) =>
    warning.type === 'HIGH_FEE_SHARE' && feeShareOfRisk !== null
      ? formatCopy(p.warningFeeShareValue, {
          share: planShare(feeShareOfRisk),
        })
      : p[`warning${warning.type}`];
  return (
    <Panel id="plan-warnings-title" title={p.warningsTitle}>
      {warnings.length === 0 ? (
        <p className="text-xs text-muted">{p.noWarnings}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {warnings.map((warning) => (
            <li
              key={warning.type}
              className="flex items-start gap-2 text-xs text-fg-2"
            >
              <SeverityBadge severity={warning.severity} />
              <span className="sr-only">
                {messageText(copy, 'MSG17', [], {
                  severity: p[`severity${warning.severity}`],
                  message: wording(warning),
                })}
              </span>
              <span aria-hidden="true">{wording(warning)}</span>
            </li>
          ))}
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

/** Status changes, oldest first (D-67); INVALIDATED says why (BR-68). */
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
            {change.status === 'INVALIDATED' && plan.invalidationReason && (
              <p className="mt-1 text-xs text-fg-2">
                {p[`reason${plan.invalidationReason}`]}
              </p>
            )}
          </li>
        ))}
      </ol>
    </Panel>
  );
}
