const DECIMAL = /^([+-]?)(\d*)(?:\.(\d*))?$/;

/**
 * Rounds a decimal string half-up (away from zero) to `places` fraction
 * digits without converting it to a float (display only, CR-02).
 * Input that is not a plain decimal comes back unchanged.
 */
export function toFixedDecimal(value: string, places: number): string {
  const match = DECIMAL.exec(value.trim());
  if (!match || (!match[2] && !match[3])) return value;
  const sign = match[1] === '-' ? '-' : '';
  const fraction = (match[3] ?? '').padEnd(places + 1, '0');
  const digits = ((match[2] || '0') + fraction.slice(0, places)).split('');
  if (Number(fraction[places]) >= 5) {
    let i = digits.length - 1;
    while (i >= 0 && digits[i] === '9') digits[i--] = '0';
    if (i < 0) digits.unshift('1');
    else digits[i] = String(Number(digits[i]) + 1);
  }
  const whole = digits
    .slice(0, digits.length - places)
    .join('')
    .replace(/^0+(?=\d)/, '');
  const rounded =
    places > 0 ? whole + '.' + digits.slice(-places).join('') : whole;
  return /^[0.]+$/.test(rounded) ? rounded : sign + rounded;
}

/** Significant fraction digits of a step such as a tick size ("0.01000000" → 2). */
export function decimalPlaces(step: string | null): number {
  const fraction = step?.split('.')[1]?.replace(/0+$/, '') ?? '';
  return fraction.length;
}

/** "1234567.5" → "1,234,567.5": groups the integer part only. */
export function groupThousands(value: string): string {
  const [whole = '', fraction] = value.split('.');
  const sign = whole.startsWith('-') ? '-' : '';
  const digits = whole
    .replace(/^[+-]/, '')
    .replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return sign + digits + (fraction !== undefined ? '.' + fraction : '');
}

/** A price at the pair's tick precision (CR-02), grouped for reading. */
export function formatPrice(value: string, tickSize: string | null): string {
  return groupThousands(toFixedDecimal(value, decimalPlaces(tickSize)));
}

/** Moves the decimal point `places` to the right (× 10^places), exactly. */
export function shiftDecimal(value: string, places: number): string {
  const match = DECIMAL.exec(value.trim());
  if (!match || (!match[2] && !match[3])) return value;
  const sign = match[1] === '-' ? '-' : '';
  const fraction = (match[3] ?? '').padEnd(places, '0');
  const whole = ((match[2] || '0') + fraction.slice(0, places)).replace(
    /^0+(?=\d)/,
    '',
  );
  const rest = fraction.slice(places);
  return sign + whole + (rest ? '.' + rest : '');
}

/** A fraction as a percent ("0.0001" → "0.0100") with `places` digits. */
export function fractionToPercent(value: string, places: number): string {
  return toFixedDecimal(shiftDecimal(value, 2), places);
}

const UNITS = [
  { digits: 13, suffix: 'T' },
  { digits: 10, suffix: 'B' },
  { digits: 7, suffix: 'M' },
  { digits: 4, suffix: 'K' },
] as const;

/** "1139455120.42" → "1.14B": a volume in K / M / B / T, two decimals. */
export function compactDecimal(value: string): string {
  const match = DECIMAL.exec(value.trim());
  if (!match || (!match[2] && !match[3])) return value;
  const whole = (match[2] || '0').replace(/^0+(?=\d)/, '');
  const unit = UNITS.find((candidate) => whole.length >= candidate.digits);
  if (!unit) return groupThousands(toFixedDecimal(value, 2));
  const point = whole.length - (unit.digits - 1);
  const shifted = whole.slice(0, point) + '.' + whole.slice(point);
  return (
    (match[1] === '-' ? '-' : '') + toFixedDecimal(shifted, 2) + unit.suffix
  );
}

/** Orders two decimal strings without converting them to floats. */
export function compareDecimal(a: string, b: string): number {
  const parse = (value: string) => {
    const match = DECIMAL.exec(value.trim());
    const negative = match?.[1] === '-';
    const whole = (match?.[2] || '0').replace(/^0+(?=\d)/, '');
    const fraction = (match?.[3] ?? '').replace(/0+$/, '');
    const zero = /^0*$/.test(whole) && fraction === '';
    return { negative: negative && !zero, whole, fraction };
  };
  const x = parse(a);
  const y = parse(b);
  if (x.negative !== y.negative) return x.negative ? -1 : 1;
  const direction = x.negative ? -1 : 1;
  if (x.whole.length !== y.whole.length)
    return (x.whole.length - y.whole.length) * direction;
  const width = Math.max(x.fraction.length, y.fraction.length);
  const left = x.whole + x.fraction.padEnd(width, '0');
  const right = y.whole + y.fraction.padEnd(width, '0');
  return left === right ? 0 : (left < right ? -1 : 1) * direction;
}

/** a − b of two decimal strings, exactly (e.g. the spread ask − bid). */
export function subtractDecimal(a: string, b: string): string {
  const parse = (value: string) => {
    const match = DECIMAL.exec(value.trim());
    if (!match || (!match[2] && !match[3])) return null;
    return {
      negative: match[1] === '-',
      whole: match[2] || '0',
      fraction: match[3] ?? '',
    };
  };
  const x = parse(a);
  const y = parse(b);
  if (!x || !y) return a;
  const places = Math.max(x.fraction.length, y.fraction.length);
  const scaled = (n: NonNullable<typeof x>) =>
    (n.negative ? -1n : 1n) * BigInt(n.whole + n.fraction.padEnd(places, '0'));
  const difference = scaled(x) - scaled(y);
  const negative = difference < 0n;
  const digits = (negative ? -difference : difference)
    .toString()
    .padStart(places + 1, '0');
  const whole = digits.slice(0, digits.length - places);
  const fraction = places > 0 ? '.' + digits.slice(-places) : '';
  return (negative ? '-' : '') + whole + fraction;
}
