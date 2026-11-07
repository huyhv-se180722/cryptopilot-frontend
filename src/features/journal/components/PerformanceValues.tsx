import { NumericText } from '../../../components/ui/NumericText';
import { useCopy } from '../../../hooks/use-copy';
import type { Decimal } from '../../../types/domain';
import { fractionToPercent } from '../../../utils/decimal-format';
import {
  planAmount,
  planRatio,
} from '../../trading-plan/components/plan-format';

/** A null is "nothing to compute", shown as a dash, never as 0. */
function Dash() {
  const copy = useCopy();
  return <span className="text-muted-dim">{copy.market.noValue}</span>;
}

/** An amount in USDT: signed and coloured by its sign unless `plain`. */
export function AmountValue({
  value,
  plain = false,
}: {
  value: Decimal | null;
  plain?: boolean;
}) {
  if (value === null) return <Dash />;
  return (
    <NumericText signed={!plain} value={planAmount(value)} suffix=" USDT" />
  );
}

export function RatioValue({ value }: { value: Decimal | null }) {
  if (value === null) return <Dash />;
  return <NumericText value={planRatio(value)} />;
}

/** A fraction from 0 to 1 as a percent. */
export function PercentValue({ value }: { value: Decimal | null }) {
  if (value === null) return <Dash />;
  return <NumericText value={fractionToPercent(value, 2)} suffix="%" />;
}
