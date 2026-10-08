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
