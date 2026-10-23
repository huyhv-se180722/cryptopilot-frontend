import type { Copy } from '../../../i18n/locales/en';

/** The reasons the backend gives for how an order ended (develop 612b201). */
const REASONS = [
  'OCO_OTHER_EXECUTED',
  'PAIR_NOT_TRADING',
  'NOT_FILLABLE_ON_ARRIVAL',
  'POST_ONLY_WOULD_TAKE',
  'INSUFFICIENT_BALANCE',
  'DEPTH_EXHAUSTED',
] as const;
type Reason = (typeof REASONS)[number];
const isReason = (value: string): value is Reason =>
  (REASONS as readonly string[]).includes(value);

/**
 * Why an order ended other than by filling, in words, or undefined. The
 * backend sends a short code, not an enum; one the web does not know shows
 * nothing rather than the code.
 */
export function orderReasonText(
  copy: Copy,
  reason: string | null,
): string | undefined {
  return reason && isReason(reason) ? copy.paper[`reason${reason}`] : undefined;
}
