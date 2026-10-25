import type { Copy } from '../../../i18n/locales/en';
import { formatCopy } from '../../../i18n/copy';
import { groupThousands, toFixedDecimal } from '../../../utils/decimal-format';

/** Business days are UTC+7 (CR-01), whatever the browser's time zone. */
const BUSINESS_OFFSET_MS = 7 * 3_600_000;

/** The business day `daysBack` days before today, e.g. 2026-10-01. */
export function businessDay(daysBack: number, now = Date.now()): string {
  return new Date(now + BUSINESS_OFFSET_MS - daysBack * 86_400_000)
    .toISOString()
    .slice(0, 10);
}

/** VND has no minor unit on screen: whole dong, grouped. */
export const vnd = (value: string) => groupThousands(toFixedDecimal(value, 0));

const COLUMN_KEYS = [
  'newUsers',
  'paidOrders',
  'revenue',
  'newPosts',
  'newComments',
  'aiQuestions',
] as const;
type KnownColumn = (typeof COLUMN_KEYS)[number];
const known = (column: string): column is KnownColumn =>
  (COLUMN_KEYS as readonly string[]).includes(column);

/** The header of a report column; `revenue:<package>` names its package. */
export function columnLabel(copy: Copy, column: string): string {
  const t = copy.adminOverview;
  if (column.startsWith('revenue:'))
    return formatCopy(t.colRevenueOf, { code: column.slice(8) });
  return known(column) ? t[`col${column}`] : column;
}

/** Revenue columns are VND; the others are counts. */
export const isMoneyColumn = (column: string) =>
  column === 'revenue' || column.startsWith('revenue:');
