import type { Copy } from '../../../i18n/locales/en';
import { messageText } from '../../../i18n/messages';
import type { AppNotification } from '../../../types/domain';
import { compare } from '../../../utils/decimal-math';
import {
  groupThousands,
  toFixedDecimal,
  trimDecimal,
} from '../../../utils/decimal-format';
import { pairLabel } from '../../../utils/pair-label';

/** The plan notices the client words itself (T-046, T-047). */
const PLAN_MESSAGES = ['MSG23', 'MSG24', 'MSG53', 'MSG54'] as const;
type PlanMessage = (typeof PLAN_MESSAGES)[number];
const isPlanMessage = (code: string): code is PlanMessage =>
  (PLAN_MESSAGES as readonly string[]).includes(code);

const DECIMAL = /^-?\d+(\.\d+)?$/;
const price = (value: string) =>
  DECIMAL.test(value) ? groupThousands(trimDecimal(value, 2)) : value;
/** The net P/L with its sign, in USDT with 2 decimals. */
function pnl(value: string): string {
  if (!DECIMAL.test(value)) return value;
  const amount = groupThousands(toFixedDecimal(value.replace(/^-/, ''), 2));
  if (/^[0.,]+$/.test(amount)) return amount;
  return (compare(value, '0') < 0 ? '-' : '+') + amount;
}

/**
 * The words of a notification (SCR-15). A plan notice that names its
 * message is worded here from its arguments, in the SRS order: MSG23
 * closed `[pair, reason, price, pnl]`, MSG24 liquidated `[pair, price,
 * pnl]`, MSG53 expired `[pair]`, MSG54 invalidated `[pair, reason]`; a
 * reason code the client knows is put in words. Every other notification
 * shows the server's title and text.
 */
export function notificationText(
  copy: Copy,
  notification: AppNotification,
): { title: string; content: string } {
  const message = notification.message;
  if (!message || !isPlanMessage(message.code))
    return { title: notification.title, content: notification.content };
  const n = copy.notifications;
  const [pair = '', ...rest] = message.args;
  const label = pairLabel(pair);
  const reasonOf = (code: string) =>
    (n as Record<string, string>)[`reason${code}`] ?? code;
  switch (message.code) {
    case 'MSG23': {
      const [reason = '', at = '', net = ''] = rest;
      return {
        title: n.titleMSG23,
        content: messageText(copy, 'MSG23', [], {
          pair: label,
          reason: reasonOf(reason),
          price: price(at),
          pnl: pnl(net),
        }),
      };
    }
    case 'MSG24': {
      const [at = '', net = ''] = rest;
      return {
        title: n.titleMSG24,
        content: messageText(copy, 'MSG24', [], {
          pair: label,
          price: price(at),
          pnl: pnl(net),
        }),
      };
    }
    case 'MSG53':
      return {
        title: n.titleMSG53,
        content: messageText(copy, 'MSG53', [], { pair: label }),
      };
    case 'MSG54':
      return {
        title: n.titleMSG54,
        content: messageText(copy, 'MSG54', [], {
          pair: label,
          reason: reasonOf(rest[0] ?? ''),
        }),
      };
  }
}
