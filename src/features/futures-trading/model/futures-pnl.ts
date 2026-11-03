import type { FuturesIncome } from '../../../types/futures';
import { add } from '../../../utils/decimal-math';

const DAY_MS = 86_400_000;

/** The start of the last `days` days before `now`, ISO 8601 UTC. */
export function daysBefore(now: number, days: number): string {
  return new Date(now - days * DAY_MS).toISOString();
}

/** Each kind of balance change summed: realized PnL, funding, fees. */
export function sumIncome(rows: readonly FuturesIncome[]) {
  let realized = '0';
  let funding = '0';
  let fees = '0';
  for (const row of rows) {
    if (row.incomeType === 'REALIZED_PNL') realized = add(realized, row.income);
    else if (row.incomeType === 'FUNDING_FEE')
      funding = add(funding, row.income);
    else if (row.incomeType !== 'TRANSFER') fees = add(fees, row.income);
  }
  return { realized, funding, fees, net: add(add(realized, funding), fees) };
}
