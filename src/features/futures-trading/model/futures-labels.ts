import type { Copy } from '../../../i18n/locales/en';

type FuturesCopy = Copy['futures'];

/** A balance change's kind in words; its code when it is a new one. */
export function incomeLabel(f: FuturesCopy, type: string): string {
  const labels: Record<string, string> = {
    TRANSFER: f.incomeTransfer,
    REALIZED_PNL: f.incomeRealized,
    FUNDING_FEE: f.incomeFunding,
    COMMISSION: f.incomeCommission,
    INSURANCE_CLEAR: f.incomeLiquidationFee,
    INSURANCE_COVER: f.incomeInsurance,
  };
  return labels[type] ?? type;
}

/** Why a position closed, in words; its code when it is a new one. */
export function closeReasonLabel(f: FuturesCopy, reason: string): string {
  const labels: Record<string, string> = {
    MANUAL: f.reasonManual,
    TAKE_PROFIT: f.reasonTakeProfit,
    STOP_LOSS: f.reasonStopLoss,
    LIQUIDATION: f.reasonLiquidation,
    REDUCE: f.reasonReduce,
    SYSTEM: f.reasonSystem,
  };
  return labels[reason] ?? reason;
}
