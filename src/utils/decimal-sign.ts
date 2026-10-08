export type Sign = 'positive' | 'negative' | 'zero';

const ZERO = /^[+-]?0*(?:\.0*)?$/;

/** Sign of a decimal string without converting it to a float. */
export function signOf(value: string): Sign {
  const trimmed = value.trim();
  if (ZERO.test(trimmed)) return 'zero';
  return trimmed.startsWith('-') ? 'negative' : 'positive';
}

/** Adds an explicit "+" to positive values; negatives keep their "-". */
export function withSign(value: string): string {
  const trimmed = value.trim();
  return signOf(trimmed) === 'positive' && !trimmed.startsWith('+')
    ? '+' + trimmed
    : trimmed;
}
