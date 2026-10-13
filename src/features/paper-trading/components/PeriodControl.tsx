import { SegmentedControl } from '../../../components/ui/SegmentedControl';
import { useCopy } from '../../../hooks/use-copy';
import type { Period } from '../model/period';

/** 7D · 30D · 90D · All, as the exchange's history filters. */
export function PeriodControl({
  value,
  onChange,
}: {
  value: Period;
  onChange: (period: Period) => void;
}) {
  const p = useCopy().paper;
  return (
    <SegmentedControl
      label={p.filterPeriod}
      value={value}
      onChange={onChange}
      options={[
        { value: '7', label: p.period7 },
        { value: '30', label: p.period30 },
        { value: '90', label: p.period90 },
        { value: 'all', label: p.periodAll },
      ]}
    />
  );
}
