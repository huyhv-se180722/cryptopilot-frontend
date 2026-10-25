import type {
  CandleTimeframe,
  InvalidationReason,
  PlanPosition,
  PlanSnapshot,
  PlanStatus,
  PlanWarning,
  TradingPlan,
} from '../../types/domain';

/**
 * DEVELOPMENT ONLY. Labelled plans covering every status (INVALIDATED with
 * each reason), the three entry types, both markets, the warning
 * severities with HIGH_FEE_SHARE, a BLOCKING draft, a MARKET plan whose
 * expected fill differs from its reference price, and EXECUTED plans with
 * an OPEN position (one without a current price) and CLOSED ones (each
 * close reason, one with its funding still provisional). Numbers
 * are written by hand to look like a risk calculation; they are not
 * computed.
 */
const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const BTC_PAIR = '0199a0f0-1111-7aaa-8bbb-000000000001';
const ETH_PAIR = '0199a0f0-1111-7aaa-8bbb-000000000002';
const SOL_PAIR = '0199a0f0-1111-7aaa-8bbb-000000000004';
/** Prices and quantities come padded to the backend column scale (12). */
const scale12 = (value: string) => {
  const [whole, fraction = ''] = value.split('.');
  return `${whole}.${fraction.padEnd(12, '0')}`;
};

/** The seven TP-0 figures, in the snapshot's order; absent = saved before TP-0. */
type Costs = readonly [
  entryFee: string,
  stopLossExitFee: string,
  takeProfitExitFee: string,
  slippage: string,
  lossAtStopLoss: string,
  feeShareOfRisk: string,
  netRiskReward: string,
];

interface Seed {
  n: number;
  pairId: string;
  market: TradingPlan['market'];
  direction: TradingPlan['direction'];
  entryType: TradingPlan['entryType'];
  entry: string;
  /** MARKET only: the price the quantity was sized on. */
  expectedFill?: string;
  stop: string;
  take: string;
  leverage: number | null;
  /** Status changes after creation, hours later each. */
  path: readonly PlanStatus[];
  createdDaysAgo: number;
  warnings?: readonly PlanWarning[];
  note?: string;
  invalidationPrice?: string;
  maxDeviation?: string;
  timeframe?: CandleTimeframe;
  reason?: InvalidationReason;
  score?: readonly [score: string | null, preset: string | null];
  quantity: string;
  notional: string;
  margin: string;
  risk: string;
  reward: string;
  rr: string;
  liquidation?: string;
  costs?: Costs;
  position?: Omit<PlanPosition, 'quantity'>;
}

const OPEN = {
  exitPrice: null,
  exitTime: null,
  closeReason: null,
  realizedPnl: null,
  feeAmount: null,
  fundingFeeAmount: null,
  netPnl: null,
  provisional: false,
} as const;

/** A CLOSED position's shape; the seed adds the numbers (exit an hour after the fill). */
const closed = (closeReason: NonNullable<PlanPosition['closeReason']>) => ({
  status: 'CLOSED' as const,
  currentPrice: null,
  unrealizedPnl: null,
  exitTime: '',
  closeReason,
  provisional: false,
});

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
    timeframe: '4h',
    quantity: '0.00500',
    notional: '310.0000000',
    margin: '310.00000000',
    risk: '10.00000000',
    reward: '20.00000000',
    rr: '2.00000000',
    costs: [
      '0.31000000',
      '0.30000000',
      '0.33000000',
      '0.00000000',
      '10.61000000',
      '0.06100000',
      '1.82469369',
    ],
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
    costs: [
      '0.49000000',
      '0.48000000',
      '0.50200000',
      '0.00000000',
      '10.97000000',
      '0.09700000',
      '1.00095700',
    ],
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
    costs: [
      '0.01500000',
      '0.04250000',
      '0.01300000',
      '0.00000000',
      '10.05750000',
      '0.00575000',
      '0.99006710',
    ],
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
    invalidationPrice: '63500.0',
    timeframe: '1h',
    score: ['59.00', 'DAY_TRADING v1'],
    quantity: '0.010',
    notional: '615.00000000',
    margin: '123.00000000',
    risk: '10.00000000',
    reward: '30.00000000',
    rr: '3.00000000',
    liquidation: '49507.5',
    costs: [
      '0.12300000',
      '0.30250000',
      '0.12900000',
      '0.00000000',
      '10.42550000',
      '0.04255000',
      '2.84339830',
    ],
  },
  {
    n: 5,
    pairId: ETH_PAIR,
    market: 'spot',
    direction: 'LONG',
    entryType: 'MARKET',
    entry: '2510.00',
    expectedFill: '2510.00',
    stop: '2460.00',
    take: '2650.00',
    leverage: null,
    path: ['ACTIVE'],
    createdDaysAgo: 5,
    // A score that could not be read at activation: shown as not available.
    score: [null, null],
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
  {
    n: 8,
    pairId: BTC_PAIR,
    market: 'spot',
    direction: 'LONG',
    entryType: 'STOP',
    entry: '64000.00',
    stop: '63000.00',
    take: '67000.00',
    leverage: null,
    path: [],
    createdDaysAgo: 0.2,
    note: 'Breakout above the range high (fixture).',
    invalidationPrice: '61000.00',
    timeframe: '1h',
    quantity: '0.01000',
    notional: '640.00000000',
    margin: '640.00000000',
    risk: '10.00000000',
    reward: '30.00000000',
    rr: '3.00000000',
    costs: [
      '0.64000000',
      '0.63000000',
      '0.67000000',
      '0.00000000',
      '11.27000000',
      '0.12700000',
      '2.47826087',
    ],
  },
  {
    n: 9,
    pairId: ETH_PAIR,
    market: 'spot',
    direction: 'LONG',
    entryType: 'LIMIT',
    entry: '2450.00',
    stop: '2445.00',
    take: '2470.00',
    leverage: null,
    path: [],
    createdDaysAgo: 0.3,
    note: 'Tight stop: fees weigh on the risk (fixture).',
    warnings: [{ type: 'HIGH_FEE_SHARE', severity: 'WARNING' }],
    quantity: '2.0000',
    notional: '4900.00000000',
    margin: '4900.00000000',
    risk: '10.00000000',
    reward: '40.00000000',
    rr: '4.00000000',
    costs: [
      '4.90000000',
      '4.89000000',
      '4.94000000',
      '0.00000000',
      '19.79000000',
      '0.97900000',
      '2.60778443',
    ],
  },
  {
    n: 10,
    pairId: BTC_PAIR,
    market: 'futures',
    direction: 'LONG',
    entryType: 'MARKET',
    entry: '62000.0',
    expectedFill: '62006.2',
    stop: '61000.0',
    take: '65000.0',
    leverage: 5,
    path: ['ACTIVE', 'EXECUTED'],
    createdDaysAgo: 1.5,
    maxDeviation: '0.5',
    timeframe: '1h',
    score: ['64.50', 'DAY_TRADING v1'],
    quantity: '0.010',
    notional: '620.06200000',
    margin: '124.01240000',
    risk: '10.00000000',
    reward: '29.93800000',
    rr: '2.99380000',
    liquidation: '49914.9',
    costs: [
      '0.31003100',
      '0.30500000',
      '0.13000000',
      '0.06200000',
      '10.67703100',
      '0.06770310',
      '2.75281950',
    ],
    position: {
      ...OPEN,
      status: 'OPEN',
      fillPrice: scale12('62006.2'),
      entryTime: '',
      entryFee: '0.31003100',
      liquidationPrice: scale12('49914.9'),
      currentPrice: '62480.0',
      unrealizedPnl: '4.73800000',
    },
  },
  {
    n: 11,
    pairId: ETH_PAIR,
    market: 'spot',
    direction: 'LONG',
    entryType: 'LIMIT',
    entry: '2400.00',
    stop: '2350.00',
    take: '2550.00',
    leverage: null,
    path: ['ACTIVE', 'EXECUTED'],
    createdDaysAgo: 2.5,
    score: ['48.00', 'SWING v1'],
    quantity: '0.2000',
    notional: '480.00000000',
    margin: '480.00000000',
    risk: '10.00000000',
    reward: '30.00000000',
    rr: '3.00000000',
    costs: [
      '0.48000000',
      '0.47000000',
      '0.51000000',
      '0.00000000',
      '10.95000000',
      '0.09500000',
      '2.65296804',
    ],
    // No price cached: the current price and the P/L show a dash.
    position: {
      ...OPEN,
      status: 'OPEN',
      fillPrice: scale12('2400.00'),
      entryTime: '',
      entryFee: '0.48000000',
      liquidationPrice: null,
      currentPrice: null,
      unrealizedPnl: null,
    },
  },
  {
    n: 12,
    pairId: SOL_PAIR,
    market: 'futures',
    direction: 'LONG',
    entryType: 'LIMIT',
    entry: '140.00',
    stop: '135.00',
    take: '150.00',
    leverage: 3,
    path: ['ACTIVE', 'INVALIDATED'],
    createdDaysAgo: 6,
    reason: 'TAKE_PROFIT_REACHED',
    quantity: '2.00',
    notional: '280.00000000',
    margin: '93.33333333',
    risk: '10.00000000',
    reward: '20.00000000',
    rr: '2.00000000',
    liquidation: '93.80',
  },
  {
    n: 13,
    pairId: BTC_PAIR,
    market: 'spot',
    direction: 'LONG',
    entryType: 'STOP',
    entry: '65000.00',
    stop: '63500.00',
    take: '69500.00',
    leverage: null,
    path: ['ACTIVE', 'INVALIDATED'],
    createdDaysAgo: 8,
    reason: 'STOP_LOSS_REACHED',
    quantity: '0.00666',
    notional: '432.90000000',
    margin: '432.90000000',
    risk: '9.99000000',
    reward: '29.97000000',
    rr: '3.00000000',
  },
  {
    n: 14,
    pairId: ETH_PAIR,
    market: 'spot',
    direction: 'LONG',
    entryType: 'LIMIT',
    entry: '2300.00',
    stop: '2250.00',
    take: '2450.00',
    leverage: null,
    path: ['ACTIVE', 'INVALIDATED'],
    createdDaysAgo: 9,
    invalidationPrice: '2600.00',
    reason: 'INVALIDATION_PRICE',
    quantity: '0.2000',
    notional: '460.00000000',
    margin: '460.00000000',
    risk: '10.00000000',
    reward: '30.00000000',
    rr: '3.00000000',
  },
  {
    n: 15,
    pairId: BTC_PAIR,
    market: 'spot',
    direction: 'LONG',
    entryType: 'LIMIT',
    entry: '60000.00',
    stop: '59000.00',
    take: '63000.00',
    leverage: null,
    path: ['ACTIVE', 'EXECUTED'],
    createdDaysAgo: 4,
    quantity: '0.01000',
    notional: '600.00000000',
    margin: '600.00000000',
    risk: '10.00000000',
    reward: '30.00000000',
    rr: '3.00000000',
    position: {
      ...closed('TAKE_PROFIT'),
      fillPrice: scale12('60000.00'),
      entryTime: '',
      entryFee: '0.06000000',
      liquidationPrice: null,
      exitPrice: scale12('63000.00'),
      realizedPnl: '30.00000000',
      feeAmount: '0.12300000',
      fundingFeeAmount: null,
      netPnl: '29.87700000',
    },
  },
  {
    n: 16,
    pairId: ETH_PAIR,
    market: 'spot',
    direction: 'LONG',
    entryType: 'STOP',
    entry: '2500.00',
    stop: '2450.00',
    take: '2650.00',
    leverage: null,
    path: ['ACTIVE', 'EXECUTED'],
    createdDaysAgo: 4.5,
    quantity: '0.2000',
    notional: '500.00000000',
    margin: '500.00000000',
    risk: '10.00000000',
    reward: '30.00000000',
    rr: '3.00000000',
    position: {
      ...closed('STOP_LOSS'),
      fillPrice: scale12('2500.00'),
      entryTime: '',
      entryFee: '0.50000000',
      liquidationPrice: null,
      exitPrice: scale12('2449.75'),
      realizedPnl: '-10.05000000',
      feeAmount: '0.98995000',
      fundingFeeAmount: null,
      netPnl: '-11.03995000',
    },
  },
  {
    n: 17,
    pairId: SOL_PAIR,
    market: 'futures',
    direction: 'LONG',
    entryType: 'MARKET',
    entry: '100.00',
    stop: '89.00',
    take: '120.00',
    leverage: 10,
    path: ['ACTIVE', 'EXECUTED'],
    createdDaysAgo: 5.5,
    quantity: '2.00',
    notional: '200.00000000',
    margin: '20.00000000',
    risk: '22.00000000',
    reward: '40.00000000',
    rr: '1.81818182',
    liquidation: '90.37',
    // The guide's T-048b example (case (c), a liquidation).
    position: {
      ...closed('LIQUIDATION'),
      fillPrice: scale12('100.00'),
      entryTime: '',
      entryFee: '0.04000000',
      liquidationPrice: scale12('90.37'),
      exitPrice: scale12('90.37'),
      realizedPnl: '-19.26000000',
      feeAmount: '0.76296000',
      fundingFeeAmount: '0.00000000',
      netPnl: '-20.02296000',
    },
  },
  {
    n: 18,
    pairId: BTC_PAIR,
    market: 'futures',
    direction: 'SHORT',
    entryType: 'LIMIT',
    entry: '63000.0',
    stop: '64000.0',
    take: '60000.0',
    leverage: 5,
    path: ['ACTIVE', 'EXECUTED'],
    createdDaysAgo: 7,
    quantity: '0.010',
    notional: '630.00000000',
    margin: '126.00000000',
    risk: '10.00000000',
    reward: '30.00000000',
    rr: '3.00000000',
    liquidation: '75348.0',
    // Closed by the Trader while a funding settlement is still missing.
    position: {
      ...closed('MANUAL'),
      fillPrice: scale12('63000.0'),
      entryTime: '',
      entryFee: '0.12600000',
      liquidationPrice: scale12('75348.0'),
      exitPrice: scale12('62500.0'),
      realizedPnl: '5.00000000',
      feeAmount: '0.43850000',
      fundingFeeAmount: '-0.02000000',
      netPnl: '4.54150000',
      provisional: true,
    },
  },
];

function snapshotOf(seed: Seed): PlanSnapshot {
  const [entryFee, slFee, tpFee, slippage, loss, share, netRr] = seed.costs ?? [
    null,
    null,
    null,
    null,
    null,
    null,
    null,
  ];
  return {
    positionQuantity: scale12(seed.quantity),
    notionalValue: seed.notional,
    initialMargin: seed.market === 'futures' ? seed.margin : null,
    maintenanceMarginRateUsed: seed.market === 'futures' ? '0.004' : null,
    riskAmount: seed.risk,
    rewardAmount: seed.reward,
    riskRewardRatio: seed.rr,
    estimatedLiquidationPrice: seed.liquidation
      ? scale12(seed.liquidation)
      : null,
    estimatedEntryFee: entryFee,
    estimatedStopLossExitFee: slFee,
    estimatedTakeProfitExitFee: tpFee,
    estimatedSlippage: slippage,
    lossAtStopLoss: loss,
    feeShareOfRisk: share,
    netRiskReward: netRr,
  };
}

/** The id of fixture plan `n`. */
export const devPlanId = (n: number) =>
  `0199a2c4-0000-7000-8000-${String(n).padStart(12, '0')}`;

export function devPlanSeeds(now: number): TradingPlan[] {
  return SEEDS.map((seed) => {
    const created = now - seed.createdDaysAgo * DAY;
    const statuses: PlanStatus[] = ['DRAFT', ...seed.path];
    const status = statuses[statuses.length - 1] as PlanStatus;
    const warnings = seed.warnings ?? [];
    const history = statuses.map((change, index) => ({
      status: change,
      at: new Date(created + index * 2 * HOUR).toISOString(),
    }));
    const activated = statuses.includes('ACTIVE');
    const filled = history.find((change) => change.status === 'EXECUTED');
    return {
      id: devPlanId(seed.n),
      pairId: seed.pairId,
      market: seed.market,
      direction: seed.direction,
      entryType: seed.entryType,
      entryPrice: scale12(seed.entry),
      expectedFillPrice: seed.expectedFill ? scale12(seed.expectedFill) : null,
      plannedEntryPrice: scale12(seed.entry),
      stopLoss: scale12(seed.stop),
      takeProfit: scale12(seed.take),
      capital: '1000',
      riskPercent: '1',
      leverage: seed.leverage,
      marginMode: seed.market === 'futures' ? 'ISOLATED' : null,
      expiresAt:
        seed.entryType === 'MARKET'
          ? null
          : new Date(created + 7 * DAY).toISOString(),
      note: seed.note ?? null,
      invalidationPrice: seed.invalidationPrice
        ? scale12(seed.invalidationPrice)
        : null,
      maxEntryDeviationR: seed.maxDeviation ?? null,
      analysisTimeframe: seed.timeframe ?? '1h',
      status,
      invalidationReason: seed.reason ?? null,
      setupScoreAtPlan: activated ? (seed.score?.[0] ?? '55.00') : null,
      setupScorePreset: activated
        ? (seed.score?.[1] ?? 'DAY_TRADING v1')
        : null,
      editable: status === 'DRAFT',
      snapshot: snapshotOf(seed),
      warnings,
      blocksActivation: warnings.some(
        (warning) => warning.severity === 'BLOCKING',
      ),
      statusHistory: history,
      position:
        seed.position && filled
          ? {
              ...seed.position,
              quantity: scale12(seed.quantity),
              entryTime: filled.at,
              exitTime:
                seed.position.status === 'CLOSED'
                  ? new Date(Date.parse(filled.at) + HOUR).toISOString()
                  : null,
            }
          : null,
    };
  });
}
