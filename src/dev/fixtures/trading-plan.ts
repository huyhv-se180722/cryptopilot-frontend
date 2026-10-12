import type { PlanStatus, PlanWarning, TradingPlan } from '../../types/domain';

/**
 * DEVELOPMENT ONLY. Labelled plans covering every status, both markets,
 * the three warning severities and a BLOCKING draft. Numbers are written
 * by hand to look like a risk calculation; they are not computed.
 */
const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const BTC_PAIR = '0199a0f0-1111-7aaa-8bbb-000000000001';
const ETH_PAIR = '0199a0f0-1111-7aaa-8bbb-000000000002';
const SOL_PAIR = '0199a0f0-1111-7aaa-8bbb-000000000004';

interface Seed {
  n: number;
  pairId: string;
  market: TradingPlan['market'];
  direction: TradingPlan['direction'];
  entryType: TradingPlan['entryType'];
  entry: string;
  stop: string;
  take: string;
  leverage: number | null;
  /** Status changes after creation, hours later each. */
  path: readonly PlanStatus[];
  createdDaysAgo: number;
  warnings?: readonly PlanWarning[];
  note?: string;
  quantity: string;
  notional: string;
  margin: string;
  risk: string;
  reward: string;
  rr: string;
  liquidation?: string;
}

const SEEDS: readonly Seed[] = [
  {
    n: 1,
    pairId: BTC_PAIR,
    market: 'spot',
    direction: 'LONG',
    entryType: 'LIMIT',
    entry: '62000.00',
    stop: '60000.00',
    take: '66000.00',
    leverage: null,
    path: [],
    createdDaysAgo: 0.1,
    note: 'Pullback to the 4h support (fixture).',
    quantity: '0.00500',
    notional: '310.0000000',
    margin: '310.00000000',
    risk: '10.00000000',
    reward: '20.00000000',
    rr: '2.00000000',
  },
  {
    n: 2,
    pairId: ETH_PAIR,
    market: 'spot',
    direction: 'LONG',
    entryType: 'LIMIT',
    entry: '2450.00',
    stop: '2400.00',
    take: '2510.00',
    leverage: null,
    path: [],
    createdDaysAgo: 1,
    warnings: [
      { type: 'LOW_RR', severity: 'WARNING' },
      { type: 'WIDE_STOP_LOSS', severity: 'INFO' },
    ],
    quantity: '0.2000',
    notional: '490.00000000',
    margin: '490.00000000',
    risk: '10.00000000',
    reward: '12.00000000',
    rr: '1.20000000',
  },
  {
    n: 3,
    pairId: SOL_PAIR,
    market: 'futures',
    direction: 'SHORT',
    entryType: 'LIMIT',
    entry: '150.00',
    stop: '170.00',
    take: '130.00',
    leverage: 20,
    path: [],
    createdDaysAgo: 2,
    warnings: [
      { type: 'SL_BEYOND_LIQUIDATION', severity: 'BLOCKING' },
      { type: 'HIGH_LEVERAGE', severity: 'WARNING' },
    ],
    quantity: '0.50',
    notional: '75.00000000',
    margin: '3.75000000',
    risk: '10.00000000',
    reward: '10.00000000',
    rr: '1.00000000',
    liquidation: '156.90',
  },
  {
    n: 4,
    pairId: BTC_PAIR,
    market: 'futures',
    direction: 'LONG',
    entryType: 'LIMIT',
    entry: '61500.0',
    stop: '60500.0',
    take: '64500.0',
    leverage: 5,
    path: ['ACTIVE'],
    createdDaysAgo: 3,
    quantity: '0.010',
    notional: '615.00000000',
    margin: '123.00000000',
    risk: '10.00000000',
    reward: '30.00000000',
    rr: '3.00000000',
    liquidation: '49507.5',
  },
  {
    n: 5,
    pairId: ETH_PAIR,
    market: 'spot',
    direction: 'LONG',
    entryType: 'MARKET',
    entry: '2510.00',
    stop: '2460.00',
    take: '2650.00',
    leverage: null,
    path: ['ACTIVE'],
    createdDaysAgo: 5,
    quantity: '0.2000',
    notional: '502.00000000',
    margin: '502.00000000',
    risk: '10.00000000',
    reward: '28.00000000',
    rr: '2.80000000',
  },
  {
    n: 6,
    pairId: BTC_PAIR,
    market: 'spot',
    direction: 'LONG',
    entryType: 'LIMIT',
    entry: '58000.00',
    stop: '56500.00',
    take: '61000.00',
    leverage: null,
    path: ['CANCELLED'],
    createdDaysAgo: 12,
    quantity: '0.00666',
    notional: '386.28000000',
    margin: '386.28000000',
    risk: '9.99000000',
    reward: '19.98000000',
    rr: '2.00000000',
  },
  {
    n: 7,
    pairId: SOL_PAIR,
    market: 'futures',
    direction: 'LONG',
    entryType: 'LIMIT',
    entry: '120.00',
    stop: '115.00',
    take: '135.00',
    leverage: 3,
    path: ['ACTIVE', 'EXPIRED'],
    createdDaysAgo: 40,
    quantity: '2.00',
    notional: '240.00000000',
    margin: '80.00000000',
    risk: '10.00000000',
    reward: '30.00000000',
    rr: '3.00000000',
    liquidation: '80.40',
  },
];

export function devPlanSeeds(now: number): TradingPlan[] {
  return SEEDS.map((seed) => {
    const created = now - seed.createdDaysAgo * DAY;
    const statuses: PlanStatus[] = ['DRAFT', ...seed.path];
    const status = statuses[statuses.length - 1] as PlanStatus;
    const warnings = seed.warnings ?? [];
    return {
      id: `0199a2c4-0000-7000-8000-00000000000${seed.n}`,
      pairId: seed.pairId,
      market: seed.market,
      direction: seed.direction,
      entryType: seed.entryType,
      entryPrice: seed.entry,
      stopLoss: seed.stop,
      takeProfit: seed.take,
      capital: '1000',
      riskPercent: '1',
      leverage: seed.leverage,
      marginMode: seed.market === 'futures' ? 'ISOLATED' : null,
      expiresAt:
        seed.entryType === 'LIMIT'
          ? new Date(created + 7 * DAY).toISOString()
          : null,
      note: seed.note ?? null,
      status,
      editable: status === 'DRAFT',
      snapshot: {
        positionQuantity: seed.quantity,
        notionalValue: seed.notional,
        initialMargin: seed.margin,
        maintenanceMarginRateUsed: seed.market === 'futures' ? '0.004' : null,
        riskAmount: seed.risk,
        rewardAmount: seed.reward,
        riskRewardRatio: seed.rr,
        estimatedLiquidationPrice: seed.liquidation ?? null,
      },
      warnings,
      blocksActivation: warnings.some(
        (warning) => warning.severity === 'BLOCKING',
      ),
      statusHistory: statuses.map((change, index) => ({
        status: change,
        at: new Date(created + index * 2 * HOUR).toISOString(),
      })),
    };
  });
}
