import type { Alert, AlertRule, WatchlistItem } from '../../types/domain';
import { DEV_PAIR_IDS } from './market';

/**
 * DEVELOPMENT ONLY. Labelled watchlist rows and alerts covering both
 * markets, every alert status, both types, a disabled pair (Q-29), an
 * unlabelled row and a long note. Pair ids match the plan fixtures.
 */
const HOUR = 3_600_000;
const DAY = 24 * HOUR;

const row = (
  n: number,
  symbol: string,
  label: string | null,
  note: string | null,
  daysAgo: number,
  now: number,
  listed: { spot: boolean; futures: boolean } = { spot: true, futures: true },
): WatchlistItem => ({
  id: `0199a1b2-0000-7000-8000-00000000000${n}`,
  pairId: DEV_PAIR_IDS[symbol] as string,
  symbol,
  spotListed: listed.spot,
  futuresListed: listed.futures,
  label,
  note,
  sortOrder: n - 1,
  activeAlerts: 0,
  addedAt: new Date(now - daysAgo * DAY).toISOString(),
});

export function devWatchlistSeeds(now: number): WatchlistItem[] {
  return [
    row(1, 'BTCUSDT', 'Majors', 'Watching the 60k support (fixture).', 9, now),
    row(2, 'ETHUSDT', 'Majors', null, 8, now),
    row(
      3,
      'SOLUSDT',
      'Momentum',
      'Development note long enough to wrap on a phone: breakout retest above the weekly range high, wait for volume confirmation before any plan.',
      6,
      now,
    ),
    row(4, 'DOGEUSDT', null, null, 3, now, { spot: true, futures: false }),
    row(5, 'MATICUSDT', null, 'Delisted pair kept by Q-29.', 30, now, {
      spot: false,
      futures: false,
    }),
  ];
}

const PRICE: AlertRule = {
  market: 'spot',
  type: 'PRICE',
  indicator: null,
  timeframe: null,
  condition: 'CROSS_ABOVE',
  threshold: '65000.000000000000',
  triggerMode: 'ONCE',
  cooldownMinutes: null,
  notifyEmail: false,
  notifyPush: false,
  expiresAt: null,
};

export function devAlertSeeds(
  now: number,
  rows: readonly WatchlistItem[],
): Alert[] {
  const of = (symbol: string) =>
    rows.find((item) => item.symbol === symbol) as WatchlistItem;
  const alert = (
    n: number,
    symbol: string,
    rule: Partial<AlertRule>,
    state: Partial<Alert> & { createdDaysAgo: number },
  ): Alert => {
    const item = of(symbol);
    const { createdDaysAgo, ...rest } = state;
    return {
      ...PRICE,
      ...rule,
      id: `0199a3d4-0000-7000-8000-00000000000${n}`,
      watchlistId: item.id,
      pairId: item.pairId,
      symbol,
      status: 'ACTIVE',
      triggerCount: 0,
      lastTriggeredAt: null,
      createdAt: new Date(now - createdDaysAgo * DAY).toISOString(),
      ...rest,
    };
  };
  return [
    alert(
      1,
      'BTCUSDT',
      { expiresAt: new Date(now + 20 * DAY).toISOString() },
      { createdDaysAgo: 1 },
    ),
    alert(
      2,
      'BTCUSDT',
      {
        type: 'INDICATOR',
        indicator: 'RSI_14',
        timeframe: '4h',
        condition: 'LESS_THAN',
        threshold: '30.000000000000',
        triggerMode: 'ONCE_PER_BAR',
        notifyPush: true,
      },
      { createdDaysAgo: 2, triggerCount: 2, lastTriggeredAt: iso(now, -30) },
    ),
    alert(
      3,
      'ETHUSDT',
      {
        condition: 'LESS_THAN',
        threshold: '2200.000000000000',
        triggerMode: 'EVERY_TIME',
        cooldownMinutes: 60,
      },
      { createdDaysAgo: 4, status: 'PAUSED' },
    ),
    alert(
      4,
      'SOLUSDT',
      {
        market: 'futures',
        type: 'INDICATOR',
        indicator: 'OPEN_INTEREST_CHANGE',
        timeframe: '1h',
        condition: 'GREATER_THAN',
        threshold: '5.000000000000',
      },
      {
        createdDaysAgo: 5,
        status: 'TRIGGERED',
        triggerCount: 1,
        lastTriggeredAt: iso(now, -26 * 60),
      },
    ),
    alert(
      5,
      'DOGEUSDT',
      { threshold: '0.150000000000', expiresAt: iso(now, -2 * 24 * 60) },
      { createdDaysAgo: 12, status: 'EXPIRED' },
    ),
    alert(
      6,
      'ETHUSDT',
      {
        type: 'INDICATOR',
        indicator: 'EMA_CROSS',
        timeframe: '1h',
        condition: 'CROSS_ABOVE',
        threshold: null,
      },
      { createdDaysAgo: 3 },
    ),
  ];
}

/** An instant `minutes` from now (negative = in the past). */
function iso(now: number, minutes: number) {
  return new Date(now + minutes * 60_000).toISOString();
}
