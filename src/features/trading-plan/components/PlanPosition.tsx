import type { ReactNode } from 'react';
import { Badge } from '../../../components/ui/Badge';
import { NumericText } from '../../../components/ui/NumericText';
import { useCopy } from '../../../hooks/use-copy';
import { formatCopy } from '../../../i18n/copy';
import type {
  Decimal,
  PlanPosition,
  PositionLevelChange,
  TradingPlan,
} from '../../../types/domain';
import {
  formatInstantLocal,
  formatInstantUtc,
} from '../../../utils/instant-format';
import { Panel } from './PlanDetailPanels';
import { planAmount, planPrice, planQuantity } from './plan-format';

const when = (value: string) => (
  <time dateTime={value} title={formatInstantUtc(value)}>
    {formatInstantLocal(value)}
  </time>
);

function Rows({ rows }: { rows: readonly [string, ReactNode][] }) {
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
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

/**
 * SCR-18 position of an EXECUTED plan (UC-20, BR-34…BR-38): while OPEN the
 * fill, the unrealized P/L by the current price (no fees, no funding; Q-55)
 * and the levels the exits use now with the breakeven stop (D-124); once
 * CLOSED how and where it ended, with realized, fees, funding and the net
 * P/L as the headline (D-97), tagged provisional while a funding settlement
 * is missing. Every figure is the server's. `actions` holds what the Trader
 * can do with an open position.
 */
export function PlanPositionPanel({
  plan,
  actions,
}: {
  plan: TradingPlan;
  actions?: ReactNode;
}) {
  const copy = useCopy();
  const p = copy.plan;
  const position = plan.position;
  if (!position)
    return (
      <Panel id="plan-position-title" title={p.positionTitle}>
        <p className="text-xs text-muted">{p.positionNone}</p>
      </Panel>
    );
  const open = position.status === 'OPEN';
  return (
    <Panel
      id="plan-position-title"
      title={p.positionTitle}
      aside={
        <span className="flex items-center gap-2">
          <Badge tone={open ? 'info' : 'neutral'} withDot>
            {p[`position${position.status}`]}
          </Badge>
          {position.stopWidened && (
            <Badge tone="warning">{p.positionStopWidened}</Badge>
          )}
        </span>
      }
    >
      {open ? (
        <OpenPosition plan={plan} position={position} />
      ) : (
        <ClosedPosition plan={plan} position={position} />
      )}
      {position.levelChanges.length > 0 && (
        <LevelHistory changes={position.levelChanges} />
      )}
      {open && actions && (
        <div className="mt-4 flex flex-wrap gap-2">{actions}</div>
      )}
    </Panel>
  );
}

function price(value: Decimal | null, none: string) {
  return value === null ? none : <NumericText value={planPrice(value)} />;
}

function OpenPosition({
  plan,
  position,
}: {
  plan: TradingPlan;
  position: PlanPosition;
}) {
  const copy = useCopy();
  const p = copy.plan;
  const none = copy.market.noValue;
  const futures = plan.market === 'futures';
  const stop = position.stopLoss ?? plan.stopLoss;
  const take = position.takeProfit ?? plan.takeProfit;
  const rows: [string, ReactNode][] = [
    [p.positionFill, price(position.fillPrice, none)],
    [
      p.positionQuantity,
      <NumericText value={planQuantity(position.quantity)} />,
    ],
    [p.positionEntryTime, when(position.entryTime)],
    [p.positionEntryFee, <NumericText value={planAmount(position.entryFee)} />],
    [
      futures ? p.positionMarkPrice : p.positionLastPrice,
      price(position.currentPrice, none),
    ],
    [
      p.positionUnrealized,
      position.unrealizedPnl === null ? (
        none
      ) : (
        <NumericText value={planAmount(position.unrealizedPnl)} signed />
      ),
    ],
    [p.positionStopLoss, price(stop, none)],
    [p.positionTakeProfit, price(take, none)],
    ...(futures
      ? ([[p.positionLiquidation, price(position.liquidationPrice, none)]] as [
          string,
          ReactNode,
        ][])
      : []),
    [
      p.positionBreakeven,
      position.breakevenPrice === null ? (
        none
      ) : (
        <span>
          <NumericText value={planPrice(position.breakevenPrice)} />
          {position.breakevenProvisional && (
            <span className="ml-1 text-[10px] text-muted-dim">
              {p.provisional}
            </span>
          )}
        </span>
      ),
    ],
  ];
  return (
    <>
      <Rows rows={rows} />
      <p className="mt-2 text-[11px] text-muted-dim">
        {p.positionUnrealizedHint}
      </p>
      {position.levelsEffectiveFrom && (
        <p className="mt-1 text-[11px] text-muted-dim">
          {formatCopy(p.positionLevelsFrom, {
            time: formatInstantLocal(position.levelsEffectiveFrom),
          })}
        </p>
      )}
    </>
  );
}

function ClosedPosition({
  plan,
  position,
}: {
  plan: TradingPlan;
  position: PlanPosition;
}) {
  const copy = useCopy();
  const p = copy.plan;
  const none = copy.market.noValue;
  const amount = (value: Decimal | null, signed = false) =>
    value === null ? (
      none
    ) : (
      <NumericText value={planAmount(value)} signed={signed} />
    );
  const rows: [string, ReactNode][] = [
    [
      p.positionCloseReason,
      position.closeReason ? p[`close${position.closeReason}`] : none,
    ],
    [p.positionFill, price(position.fillPrice, none)],
    [p.positionExit, price(position.exitPrice, none)],
    [
      p.positionQuantity,
      <NumericText value={planQuantity(position.quantity)} />,
    ],
    [p.positionEntryTime, when(position.entryTime)],
    [p.positionExitTime, position.exitTime ? when(position.exitTime) : none],
    [p.positionRealized, amount(position.realizedPnl, true)],
    [p.positionFees, amount(position.feeAmount)],
    ...(plan.market === 'futures'
      ? ([[p.positionFunding, amount(position.fundingFeeAmount, true)]] as [
          string,
          ReactNode,
        ][])
      : []),
  ];
  return (
    <>
      <div className="mb-3 flex flex-wrap items-baseline gap-2">
        <span className="text-[11px] text-muted-dim">{p.positionNet}</span>
        <span className="text-lg font-semibold">
          {amount(position.netPnl, true)}
        </span>
        <span className="text-[11px] text-muted-dim">USDT</span>
        {position.provisional && <Badge tone="warning">{p.provisional}</Badge>}
      </div>
      <Rows rows={rows} />
      {position.provisional && (
        <p className="mt-2 text-[11px] text-muted-dim">{p.provisionalHint}</p>
      )}
    </>
  );
}

function LevelHistory({
  changes,
}: {
  changes: readonly PositionLevelChange[];
}) {
  const copy = useCopy();
  const p = copy.plan;
  const none = copy.market.noValue;
  const pair = (from: Decimal | null, to: Decimal | null) =>
    from === to || to === null
      ? null
      : `${from === null ? none : planPrice(from)} → ${planPrice(to)}`;
  return (
    <div className="mt-4">
      <h3 className="mb-2 text-[10px] font-semibold tracking-widest text-muted-x uppercase">
        {p.positionLevelHistory}
      </h3>
      <ol className="grid gap-1.5 text-[11px] text-fg-2">
        {changes.map((change) => {
          const stop = pair(change.oldStopLoss, change.newStopLoss);
          const take = pair(change.oldTakeProfit, change.newTakeProfit);
          return (
            <li key={change.changedAt} className="flex flex-wrap gap-x-3">
              <span className="text-muted-dim">{when(change.changedAt)}</span>
              {stop && (
                <span>
                  {p.positionStopLoss}{' '}
                  <span className="font-mono tabular-nums">{stop}</span>
                </span>
              )}
              {take && (
                <span>
                  {p.positionTakeProfit}{' '}
                  <span className="font-mono tabular-nums">{take}</span>
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
