import { SegmentedControl } from '../../../components/ui/SegmentedControl';
import type { ChartTimeframe } from '../../../types/domain';
import { classNames } from '../../../utils/class-names';

/** The buttons of a long list; the rest go in the list beside them. */
const QUICK: readonly ChartTimeframe[] = ['1m', '15m', '1h', '4h', '1d'];

/**
 * The chart's timeframe. Up to five are buttons; a longer list (the trading
 * chart's sixteen, TR-35) keeps the common ones as buttons and offers every
 * one in a list, which names the chosen one when it is not a button.
 */
export function TimeframePicker<T extends ChartTimeframe>({
  label,
  moreLabel,
  value,
  onChange,
  options,
}: {
  label: string;
  moreLabel: string;
  value: T;
  onChange: (value: T) => void;
  options: readonly T[];
}) {
  const quick =
    options.length <= QUICK.length
      ? options
      : options.filter((option) => QUICK.includes(option));
  const segmented = (
    <SegmentedControl
      label={label}
      value={value}
      onChange={onChange}
      options={quick.map((option) => ({ value: option, label: option }))}
    />
  );
  if (quick.length === options.length) return segmented;
  const other = !quick.includes(value);
  return (
    <div className="flex items-center gap-1.5">
      {segmented}
      <select
        aria-label={moreLabel}
        value={other ? value : ''}
        onChange={(event) => {
          const next = options.find((option) => option === event.target.value);
          if (next) onChange(next);
        }}
        className={classNames(
          'h-7 rounded-lg border bg-raised px-1.5 text-xs font-medium pointer-coarse:h-9',
          other
            ? 'border-primary-line text-primary'
            : 'border-line text-muted-dim',
        )}
      >
        <option value="" disabled>
          {moreLabel}
        </option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </div>
  );
}
