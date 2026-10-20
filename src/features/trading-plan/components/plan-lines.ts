import type { ChartPriceLine } from '../../chart/components/AnalysisChart';
import type { Decimal, TradingPlan } from '../../../types/domain';

/** The words of the lines, from the copy. */
export interface PlanLineLabels {
  entry: string;
  stopLoss: string;
  takeProfit: string;
  liquidation: string;
}

/** A plan's prices; null for one not known (yet). */
export interface PlanPrices {
  entry: Decimal | null;
  stopLoss: Decimal | null;
  takeProfit: Decimal | null;
  liquidation: Decimal | null;
}

/**
 * Prices as chart lines (SCR-17, SCR-18): entry, stop loss, take profit and
 * the estimated liquidation price, each only when known. The entry is
 * solid; exits and liquidation are dashed.
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
  ];
}

/**
 * A saved plan's lines (SCR-18); the estimated liquidation price of the
 * snapshot on Futures when the server gave one.
 */
export function planLines(
  plan: TradingPlan,
  labels: PlanLineLabels,
): ChartPriceLine[] {
  return priceLines(
    {
      entry: plan.entryPrice,
      stopLoss: plan.stopLoss,
      takeProfit: plan.takeProfit,
      liquidation:
        plan.market === 'futures'
          ? plan.snapshot.estimatedLiquidationPrice
          : null,
    },
    labels,
  );
}
