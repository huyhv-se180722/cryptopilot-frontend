import type { OrderStatus } from '../../../types/domain';

/**
 * Asking the gateway again can still change a PENDING order (paid, or past
 * its window) and an EXPIRED one paid late; the backend returns PAID and
 * FAILED orders unchanged, so the button is not offered for them.
 */
export const canReconcile = (status: OrderStatus) =>
  status === 'PENDING' || status === 'EXPIRED';

/** The gateway's message is JSON text: indented when it parses, else as sent. */
export function prettyPayload(payload: string | null): string | null {
  if (payload === null || payload.trim() === '') return null;
  try {
    return JSON.stringify(JSON.parse(payload), null, 2);
  } catch {
    return payload;
  }
}

/** `YYYY-MM-DD` days compare as text; an open end never conflicts. */
export const rangeInvalid = (from: string, to: string) =>
  from !== '' && to !== '' && from > to;
