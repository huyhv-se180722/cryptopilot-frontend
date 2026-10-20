import type { ChartPriceLine } from '../../chart/components/AnalysisChart';
import type { TradingPlan } from '../../../types/domain';

/** The words of the lines, from the copy. */
export interface PlanLineLabels {
  entry: string;
  stopLoss: string;
  takeProfit: string;
  liquidation: string;
}

/**
 * The plan's prices as chart lines (SCR-18): entry, stop loss and take
 * profit, and on Futures the estimated liquidation price of the snapshot
 * when the server gave one. The entry is solid; exits and liquidation are
 * dashed.
 */
export function planLines(
  plan: TradingPlan,
  labels: PlanLineLabels,
): ChartPriceLine[] {
  const liquidation = plan.snapshot.estimatedLiquidationPrice;
  return [
    {
      id: 'entry',
      price: plan.entryPrice,
      label: labels.entry,
      tone: 'primary',
      dashed: false,
    },
    {
      id: 'stop-loss',
      price: plan.stopLoss,
      label: labels.stopLoss,
      tone: 'negative',
      dashed: true,
    },
    {
      id: 'take-profit',
      price: plan.takeProfit,
      label: labels.takeProfit,
      tone: 'positive',
      dashed: true,
    },
    ...(plan.market === 'futures' && liquidation
      ? [
          {
            id: 'liquidation',
            price: liquidation,
            label: labels.liquidation,
            tone: 'warning' as const,
            dashed: true,
          },
        ]
      : []),
  ];
}
