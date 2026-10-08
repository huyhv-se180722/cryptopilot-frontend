import { classNames } from '../../utils/class-names';
import { signOf, withSign } from '../../utils/decimal-sign';

const toneClass = {
  positive: 'text-positive',
  negative: 'text-negative',
  zero: 'text-fg-2',
} as const;

/**
 * Tabular monospace number. With `signed`, positive values get "+" and
 * green, negative values red — the sign is always shown, never colour alone.
 * Values are pre-formatted decimal strings; no float conversion happens here.
 */
export function NumericText({
  value,
  signed = false,
  suffix,
  className,
}: {
  value: string;
  signed?: boolean;
  suffix?: string;
  className?: string;
}) {
  const sign = signOf(value);
  return (
    <span
      data-numeric
      className={classNames(
        'font-mono tabular-nums',
        signed ? toneClass[sign] : undefined,
        className,
      )}
    >
      {signed ? withSign(value) : value}
      {suffix}
    </span>
  );
}
