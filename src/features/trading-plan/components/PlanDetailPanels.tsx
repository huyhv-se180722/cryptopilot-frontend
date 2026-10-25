import type { ReactNode } from 'react';
import { AlertTriangle, Clock, Info } from 'lucide-react';
import { NumericText } from '../../../components/ui/NumericText';
import { useCopy } from '../../../hooks/use-copy';
import { messageText } from '../../../i18n/messages';
import type {
  PlanSnapshot,
  PlanWarning,
  TradingPlan,
} from '../../../types/domain';
import {
  fractionToPercent,
  shiftDecimal,
  toFixedDecimal,
  trimDecimal,
} from '../../../utils/decimal-format';
import { compare } from '../../../utils/decimal-math';
import {
  formatInstantLocal,
  formatInstantUtc,
  formatInstantUtc7,
} from '../../../utils/instant-format';
import { Badge } from '../../../components/ui/Badge';
import { FreshnessBadge } from '../../market/components/FreshnessBadge';
import { PlanStatusBadge, SeverityBadge } from './PlanBadges';
import {
  planAmount,
  planPnl,
  planPrice,
  planQuantity,
  planRatio,
  pnlTone,
} from './plan-format';
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

/**
 * The setup score taken at activation with its preset (TP-A). A null score
 * is not an error and never 0: before activation it is still to be taken,
 * after it the score could not be read.
 */
function SetupScore({ plan }: { plan: TradingPlan }) {
  const p = useCopy().plan;
  if (plan.setupScoreAtPlan === null)
    return (
      <span className="text-muted-dim">
        {plan.status === 'DRAFT' ? p.scoreAtActivation : p.scoreNotAvailable}
      </span>
    );
  const [style = '', version = ''] = (plan.setupScorePreset ?? '').split(' ');
  const preset =
    style === 'SCALPING' || style === 'DAY_TRADING' || style === 'SWING'
      ? `${p[`preset${style}`]}${version ? ' ' + version : ''}`
      : plan.setupScorePreset;
  return (
    <span>
      <NumericText value={toFixedDecimal(plan.setupScoreAtPlan, 0)} />
      {preset && <span className="ml-1.5 text-muted-dim">{preset}</span>}
    </span>
  );
}

/** SRS 3.5.3: the plan inputs as entered (prices at the pair's tick). */
export function PlanInputsPanel({ plan }: { plan: TradingPlan }) {
  const copy = useCopy();
  const p = copy.plan;
  const dash = copy.market.noValue;
  const futures = plan.market === 'futures';
  const rows: [string, ReactNode][] = [
    [p.colMarket, futures ? copy.market.futures : copy.market.spot],
    [p.entryType, p[`entry${plan.entryType}`]],
    [
      plan.entryType === 'STOP' ? p.stopPrice : p.entryPrice,
      <NumericText value={planPrice(plan.entryPrice)} />,
    ],
    ...(plan.expectedFillPrice &&
    compare(plan.expectedFillPrice, plan.entryPrice) !== 0
      ? ([
          [
            p.expectedFill,
            <NumericText value={planPrice(plan.expectedFillPrice)} />,
          ],
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
    [
      p.invalidationPrice,
      plan.invalidationPrice ? (
        <NumericText value={planPrice(plan.invalidationPrice)} />
      ) : (
        dash
      ),
    ],
    [
      p.maxDeviation,
      plan.maxEntryDeviationR ? (
        <NumericText
          value={trimDecimal(plan.maxEntryDeviationR, 0)}
          suffix=" R"
        />
      ) : (
        dash
      ),
    ],
    [p.timeframeField, plan.analysisTimeframe],
    [p.scoreAtPlan, <SetupScore plan={plan} />],
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
 * Futures adds margin, MMR and liquidation. "Real loss at stop loss" sits
 * next to the risk and "R:R after fees" next to the R:R, then the fee
 * breakdown (TP-0); a plan saved before TP-0 shows a dash for them. The
 * figures come from the server, never computed here.
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
  const dash = copy.market.noValue;
  const amount = (value: string | null) =>
    value === null ? dash : <NumericText value={planAmount(value)} />;
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
        dash
      ) : (
        <NumericText value={planRatio(s.netRiskReward)} />
      ),
    ],
    [p.feeEntry, amount(s.estimatedEntryFee)],
    [p.feeStopLoss, amount(s.estimatedStopLossExitFee)],
    [p.feeTakeProfit, amount(s.estimatedTakeProfitExitFee)],
    [p.feeSlippage, amount(s.estimatedSlippage)],
    [
      p.feeShare,
      s.feeShareOfRisk === null ? (
        dash
      ) : (
        <NumericText
          value={fractionToPercent(s.feeShareOfRisk, 2)}
          suffix="%"
        />
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
  return (
    <>
      <Rows rows={rows} single={single} />
      <p className="mt-2 flex items-start gap-1.5 text-[10px] leading-relaxed text-muted-dim">
        <Info size={11} aria-hidden="true" className="mt-0.5 shrink-0" />
        <span title={p.feesTooltip}>{p.feesTooltip}</span>
      </p>
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
              {change.status === 'INVALIDATED' && plan.invalidationReason && (
                <span className="text-[11px] text-fg-2">
                  {p[`reason${plan.invalidationReason}`]}
                </span>
              )}
            </div>
          </li>
        ))}
      </ol>
    </Panel>
  );
}

/**
 * The position of an EXECUTED plan (SRS 3.5.3, T-048a): fill price,
 * quantity, entry time (UTC+7), entry fee and, on Futures, the
 * liquidation price; while OPEN the current price (Futures mark, Spot
 * last) and the unrealized P/L without fees or funding (Q-55), with the
 * Live / Delayed badge of its 10 s refresh, and a dash when the server has
 * no current price. A plan filled before T-048a has no position block.
 */
export function PlanPositionPanel({
  plan,
  freshness,
  actions,
}: {
  plan: TradingPlan;
  freshness: 'live' | 'delayed';
  /** E.g. Close position, under the rows of an OPEN position. */
  actions?: ReactNode;
}) {
  const copy = useCopy();
  const p = copy.plan;
  const dash = copy.market.noValue;
  const position = plan.position;
  if (!position)
    return (
      <Panel id="plan-position-title" title={p.positionTitle}>
        <p className="flex items-start gap-2 text-xs text-muted">
          <Clock size={14} aria-hidden="true" className="mt-0.5 shrink-0" />
          {p.positionMissing}
        </p>
      </Panel>
    );
  const open = position.status === 'OPEN';
  const rows: [string, ReactNode][] = [
    [p.fillPrice, <NumericText value={planPrice(position.fillPrice)} />],
    [
      p.positionQuantity,
      <NumericText value={planQuantity(position.quantity)} />,
    ],
    [
      p.entryTime,
      <time
        dateTime={position.entryTime}
        title={formatInstantUtc(position.entryTime)}
      >
        {formatInstantUtc7(position.entryTime)}
      </time>,
    ],
    [p.entryFee, <NumericText value={planAmount(position.entryFee)} />],
    ...(plan.market === 'futures'
      ? ([
          [
            p.positionLiquidation,
            position.liquidationPrice ? (
              <NumericText value={planPrice(position.liquidationPrice)} />
            ) : (
              dash
            ),
          ],
        ] as [string, ReactNode][])
      : []),
    ...(open
      ? ([
          [
            p.currentPrice,
            position.currentPrice ? (
              <NumericText value={planPrice(position.currentPrice)} />
            ) : (
              dash
            ),
          ],
          [p.unrealizedPnl, <Pnl value={position.unrealizedPnl} />],
        ] as [string, ReactNode][])
      : []),
  ];
  return (
    <Panel
      id="plan-position-title"
      title={p.positionTitle}
      aside={
        <span className="flex items-center gap-2">
          <Badge tone={open ? 'info' : 'neutral'} withDot>
            {p[`position${position.status}`]}
          </Badge>
          {open && <FreshnessBadge freshness={freshness} />}
        </span>
      }
    >
      <Rows rows={rows} />
      {open && position.currentPrice === null && (
        <p className="mt-2 text-[11px] text-muted-dim">{p.positionNoPrice}</p>
      )}
      {actions && <div className="mt-3">{actions}</div>}
    </Panel>
  );
}

/** A signed P/L in green or red, a dash when unknown (never 0). */
export function Pnl({ value }: { value: string | null }) {
  const dash = useCopy().market.noValue;
  if (value === null) return <>{dash}</>;
  const tone = pnlTone(value);
  return (
    <span
      className={
        tone === 'positive'
          ? 'text-positive'
          : tone === 'negative'
            ? 'text-negative'
            : undefined
      }
    >
      <NumericText value={planPnl(value)} />
    </span>
  );
}
