import type { JournalTrade } from '../../types/domain';
import { add, multiply, subtract } from '../../utils/decimal-math';
import { DEV_PAIR_IDS } from './market';

const DAY = 86_400_000;

export interface DevStrategy {
  id: string;
  name: string;
}
const BREAKOUT: DevStrategy = {
  id: '0199a0f0-2222-7aaa-8bbb-000000000001',
  name: 'Breakout (fixture)',
};
const PULLBACK: DevStrategy = {
  id: '0199a0f0-2222-7aaa-8bbb-000000000002',
  name: 'Pullback (fixture)',
};

/** A journal row and what only the statistics read. */
export interface DevTrade extends JournalTrade {
  strategy: DevStrategy | null;
  risk: string;
}

interface Seed {
  symbol: string;
  market: 'spot' | 'futures';
  direction?: 'LONG' | 'SHORT';
  entry: string;
  exit: string;
  quantity: string;
  daysAgo: number;
  strategy?: DevStrategy;
  manual?: boolean;
  provisional?: boolean;
}

const SEEDS: readonly Seed[] = [
  {
    symbol: 'BTCUSDT',
    market: 'spot',
    entry: '60000',
    exit: '61500',
    quantity: '0.01',
    daysAgo: 62,
    strategy: BREAKOUT,
  },
  {
    symbol: 'ETHUSDT',
    market: 'spot',
    entry: '3000',
    exit: '2940',
    quantity: '0.5',
    daysAgo: 55,
    strategy: PULLBACK,
  },
  {
    symbol: 'SOLUSDT',
    market: 'futures',
    direction: 'SHORT',
    entry: '150',
    exit: '142',
    quantity: '2',
    daysAgo: 41,
    strategy: BREAKOUT,
  },
  {
    symbol: 'BTCUSDT',
    market: 'futures',
    entry: '62000',
    exit: '61200',
    quantity: '0.02',
    daysAgo: 33,
  },
  {
    symbol: 'ETHUSDT',
    market: 'futures',
    entry: '3100',
    exit: '3055',
    quantity: '0.4',
    daysAgo: 26,
    strategy: PULLBACK,
  },
  {
    symbol: 'BNBUSDT',
    market: 'spot',
    entry: '580',
    exit: '604',
    quantity: '1',
    daysAgo: 19,
    strategy: PULLBACK,
  },
  {
    symbol: 'XRPUSDT',
    market: 'spot',
    entry: '0.6',
    exit: '0.6',
    quantity: '100',
    daysAgo: 14,
  },
  {
    symbol: 'BTCUSDT',
    market: 'spot',
    entry: '63000',
    exit: '64400',
    quantity: '0.01',
    daysAgo: 9,
    strategy: BREAKOUT,
  },
  {
    symbol: 'SOLUSDT',
    market: 'spot',
    entry: '140',
    exit: '137',
    quantity: '3',
    daysAgo: 6,
    manual: true,
  },
  {
    symbol: 'ETHUSDT',
    market: 'futures',
    direction: 'SHORT',
    entry: '3200',
    exit: '3120',
    quantity: '0.3',
    daysAgo: 3,
    strategy: BREAKOUT,
    provisional: true,
  },
  {
    symbol: 'BTCUSDT',
    market: 'futures',
    entry: '64000',
    exit: '',
    quantity: '0.01',
    daysAgo: 1,
    strategy: PULLBACK,
  },
];

function trade(seed: Seed, index: number, now: number): DevTrade {
  const direction = seed.direction ?? 'LONG';
  const futures = seed.market === 'futures';
  const entryTime = new Date(now - seed.daysAgo * DAY).toISOString();
  const closed = seed.exit !== '';
  const notional = multiply(seed.entry, seed.quantity);
  const entryFee = multiply(notional, '0.001');
  const move =
    direction === 'LONG'
      ? subtract(seed.exit || seed.entry, seed.entry)
      : subtract(seed.entry, seed.exit || seed.entry);
  const realized = multiply(move, seed.quantity);
  const fees = add(entryFee, entryFee);
  const funding = futures ? '-0.25' : null;
  const net = subtract(add(realized, funding ?? '0'), fees);
  return {
    id: `0199a0f0-3333-7aaa-8bbb-${String(index + 1).padStart(12, '0')}`,
    planId: seed.manual ? null : 'dev-plan-executed',
    pairId: DEV_PAIR_IDS[seed.symbol] as string,
    market: seed.market,
    direction,
    source: seed.manual ? 'MANUAL' : 'SIMULATED',
    status: closed ? 'CLOSED' : 'OPEN',
    leverage: futures ? 5 : null,
    entryPrice: seed.entry,
    quantity: seed.quantity,
    entryTime,
    entryFee: seed.manual ? null : entryFee,
    stopLoss: multiply(seed.entry, direction === 'LONG' ? '0.97' : '1.03'),
    takeProfit: multiply(seed.entry, direction === 'LONG' ? '1.06' : '0.94'),
    exitPrice: closed ? seed.exit : null,
    exitTime: closed
      ? new Date(now - seed.daysAgo * DAY + 3 * 3_600_000).toISOString()
      : null,
    closeReason: closed
      ? seed.exit > seed.entry === (direction === 'LONG')
        ? 'TAKE_PROFIT'
        : 'STOP_LOSS'
      : null,
    realizedPnl: closed ? realized : null,
    feeAmount: closed ? fees : null,
    fundingFeeAmount: closed ? funding : null,
    netPnl: closed ? net : null,
    provisional: closed && seed.provisional === true,
    strategy: seed.strategy ?? null,
    risk: multiply(notional, '0.03'),
  };
}

/** DEVELOPMENT ONLY. Labelled trades, the latest entry first. */
export function devJournalTrades(now: number): readonly DevTrade[] {
  return SEEDS.map((seed, index) => trade(seed, index, now)).reverse();
}
