import type { AppNotification } from '../../types/domain';
import { devPlanId } from './trading-plan';

/**
 * DEVELOPMENT ONLY. The plan notices of T-046 as they would arrive if the
 * notification named its message (`messageCode`, `messageArgs`): MSG23
 * closed, MSG24 liquidated, MSG53 expired and MSG54 invalidated, each on a
 * fixture plan. The FE guide documents neither the fields nor MSG53 and
 * MSG54 yet, so these exist only here and in tests.
 */
export const DEV_PLAN_NOTIFICATIONS: readonly (Omit<
  AppNotification,
  'id' | 'readAt' | 'createdAt'
> & { minutesAgo: number })[] = [
  {
    type: 'PLAN',
    title: 'Position closed',
    content: 'BTCUSDT position closed by take profit at 63000. P/L: 29.88.',
    message: {
      code: 'MSG23',
      args: ['BTCUSDT', 'TAKE_PROFIT', '63000.000000000000', '29.87700000'],
    },
    reference: { type: 'PLAN', id: devPlanId(15) },
    read: false,
    minutesAgo: 30,
  },
  {
    type: 'PLAN',
    title: 'Position liquidated',
    content: 'SOLUSDT position was liquidated at 90.37. Loss: -20.02.',
    message: {
      code: 'MSG24',
      args: ['SOLUSDT', '90.370000000000', '-20.02296000'],
    },
    reference: { type: 'PLAN', id: devPlanId(17) },
    read: false,
    minutesAgo: 90,
  },
  {
    type: 'PLAN',
    title: 'Plan expired',
    content: 'Your SOLUSDT plan expired before its entry filled.',
    message: { code: 'MSG53', args: ['SOLUSDT'] },
    reference: { type: 'PLAN', id: devPlanId(7) },
    read: true,
    minutesAgo: 60 * 24 * 5,
  },
  {
    type: 'PLAN',
    title: 'Plan invalidated',
    content: 'Your SOLUSDT plan was invalidated.',
    message: { code: 'MSG54', args: ['SOLUSDT', 'TAKE_PROFIT_REACHED'] },
    reference: { type: 'PLAN', id: devPlanId(12) },
    read: true,
    minutesAgo: 60 * 24 * 5.5,
  },
];
