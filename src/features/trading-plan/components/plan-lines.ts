import type { ChartPriceLine } from '../../chart/components/AnalysisChart';
import type { Decimal, TradingPlan } from '../../../types/domain';

/** The words of the lines, from the copy. */
export interface PlanLineLabels {
  entry: string;
  stopLoss: string;
  takeProfit: string;
  liquidation: string;
  invalidation: string;
  fill: string;
}

/** A plan's prices; null for one not known (yet). */
export interface PlanPrices {
  entry: Decimal | null;
  stopLoss: Decimal | null;
  takeProfit: Decimal | null;
  liquidation: Decimal | null;
  /** TP-A: the level that invalidates a waiting plan. */
  invalidation: Decimal | null;
  /** The actual entry fill, once the plan is EXECUTED. */
  fill: Decimal | null;
}

/**
 * Prices as chart lines (SCR-17, SCR-18): entry, stop loss, take profit,
 * the liquidation price, the invalidation price and the fill, each only
 * when known. The entry and the fill are solid; the others dashed.
 */
export function priceLines(
  prices: PlanPrices,
  labels: PlanLineLabels,
): ChartPriceLine[] {
  const line = (
    id: string,
    price: Decimal | null,
    label: string,
    tone: ChartPriceLine['tone'],
    dashed: boolean,
  ): ChartPriceLine[] => (price ? [{ id, price, label, tone, dashed }] : []);
  return [
    ...line('entry', prices.entry, labels.entry, 'primary', false),
    ...line('fill', prices.fill, labels.fill, 'primary', false),
    ...line('stop-loss', prices.stopLoss, labels.stopLoss, 'negative', true),
    ...line(
      'take-profit',
      prices.takeProfit,
      labels.takeProfit,
      'positive',
      true,
    ),
    ...line(
      'liquidation',
      prices.liquidation,
      labels.liquidation,
      'warning',
      true,
    ),
    ...line(
      'invalidation',
      prices.invalidation,
      labels.invalidation,
      'warning',
      true,
    ),
  ];
}

/**
 * A saved plan's lines (SCR-18): on Futures the position's liquidation
 * price once filled, else the snapshot's estimate; the invalidation price
 * while the plan waits for its entry; the fill price once filled.
 */
export function planLines(
  plan: TradingPlan,
  labels: PlanLineLabels,
): ChartPriceLine[] {
  const position = plan.position;
  return priceLines(
    {
      entry: plan.entryPrice,
      stopLoss: plan.stopLoss,
      takeProfit: plan.takeProfit,
      liquidation:
        plan.market === 'futures'
          ? (position?.liquidationPrice ??
            plan.snapshot.estimatedLiquidationPrice)
          : null,
      invalidation: position ? null : plan.invalidationPrice,
      fill: position?.fillPrice ?? null,
    },
    labels,
  );
}
