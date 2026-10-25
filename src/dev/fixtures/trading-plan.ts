import type {
  PlanInvalidationReason,
  PlanPosition,
  PlanStatus,
  PlanTimeframe,
  PlanWarning,
  TradingPlan,
} from '../../types/domain';

/**
 * DEVELOPMENT ONLY. Labelled plans covering every status, both markets,
 * the three warning severities, a BLOCKING draft, a STOP entry and an
 * INVALIDATED plan (D-111), the costs of D-116 (with HIGH_FEE_SHARE on a
 * tight stop, and none on plans saved before them), an EXECUTED plan with
 * its OPEN position and one closed by its stop loss after a level change
 * (T-048a, T-048b, D-124). Numbers are written by
 * hand to look like a risk calculation; they are not computed, the setup
 * score at activation and the costs included.
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

/** The seven cost figures of a snapshot, in the snapshot's own order. */
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
  invalidation?: string;
  deviationR?: string;
  timeframe?: PlanTimeframe;
  reason?: PlanInvalidationReason;
  /** Taken at activation; absent = none could be read. */
  score?: string;
  /** Absent = saved before the costs were answered. */
  costs?: Costs;
  /** MARKET only: the reference price moved by the slippage. */
  expectedFill?: string;
  /** EXECUTED only: the position, `entryTime` hours after creation. */
  position?: (created: number) => PlanPosition;
}

const OPEN_LEVELS = {
  exitPrice: null,
  exitTime: null,
  closeReason: null,
  realizedPnl: null,
  feeAmount: null,
  fundingFeeAmount: null,
  netPnl: null,
  provisional: false,
  stopWidened: false,
  levelChangeCount: 0,
  levelChanges: [],
  levelWarnings: [],
  levelsEffectiveFrom: null,
} as const;

const SEEDS: readonly Seed[] = [
  {
    n: 11,
    pairId: BTC_PAIR,
    market: 'spot',
    direction: 'LONG',
    entryType: 'LIMIT',
    entry: '61500.00',
    stop: '60500.00',
    take: '64500.00',
    leverage: null,
    path: ['ACTIVE', 'EXECUTED'],
    createdDaysAgo: 1.5,
    note: 'Filled on the retest; position open (fixture).',
    quantity: '0.01000',
    notional: '615.0000000',
    margin: '615.00000000',
    risk: '10.00000000',
    reward: '30.00000000',
    rr: '3.00000000',
    score: '68',
    position: (created) => ({
      ...OPEN_LEVELS,
      status: 'OPEN',
      fillPrice: '61500.000000000000',
      quantity: '0.010000000000',
      entryTime: new Date(created + 4 * HOUR).toISOString(),
      entryFee: '0.61500000',
      liquidationPrice: null,
      currentPrice: '62050.00',
      unrealizedPnl: '5.50000000',
      stopLoss: '60500.000000000000',
      takeProfit: '64500.000000000000',
      originalStopLoss: '60500.000000000000',
      originalTakeProfit: '64500.000000000000',
      breakevenPrice: '61685.00',
      breakevenProvisional: false,
    }),
  },
  {
    n: 12,
    pairId: ETH_PAIR,
    market: 'futures',
    direction: 'SHORT',
    entryType: 'STOP',
    entry: '2400.00',
    stop: '2460.00',
    take: '2250.00',
    leverage: 5,
    path: ['ACTIVE', 'EXECUTED'],
    createdDaysAgo: 3,
    note: 'Breakdown short, stopped out after moving the stop (fixture).',
    quantity: '0.166',
    notional: '398.40000000',
    margin: '79.68000000',
    risk: '9.96000000',
    reward: '24.90000000',
    rr: '2.50000000',
    liquidation: '2867.5',
    position: (created) => ({
      status: 'CLOSED',
      fillPrice: '2401.20',
      quantity: '0.166000000000',
      entryTime: new Date(created + 4 * HOUR).toISOString(),
      entryFee: '0.19929960',
      liquidationPrice: '2867.48',
      currentPrice: null,
      unrealizedPnl: null,
      exitPrice: '2441.22',
      exitTime: new Date(created + 30 * HOUR).toISOString(),
      closeReason: 'STOP_LOSS',
      realizedPnl: '-6.64332000',
      feeAmount: '0.40195212',
      fundingFeeAmount: '0.03120000',
      netPnl: '-7.01407212',
      provisional: false,
      stopLoss: '2440.00',
      takeProfit: '2250.00',
      originalStopLoss: '2460.00',
      originalTakeProfit: '2250.00',
      stopWidened: false,
      levelChangeCount: 1,
      levelChanges: [
        {
          changedAt: new Date(created + 20 * HOUR).toISOString(),
          oldStopLoss: '2460.00',
          oldTakeProfit: '2250.00',
          newStopLoss: '2440.00',
          newTakeProfit: '2250.00',
        },
      ],
      breakevenPrice: null,
      breakevenProvisional: false,
      levelWarnings: [],
      levelsEffectiveFrom: new Date(created + 20 * HOUR + 60_000).toISOString(),
    }),
  },
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
      '1.00346399',
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
    expectedFill: '2510.00',
    costs: [
      '0.50200000',
      '0.49200000',
      '0.53000000',
      '0.00000000',
      '10.99400000',
      '0.09940000',
      '2.45302892',
    ],
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
    pairId: ETH_PAIR,
    market: 'spot',
    direction: 'LONG',
    entryType: 'LIMIT',
    entry: '2400.00',
    stop: '2320.00',
    take: '2640.00',
    leverage: null,
    path: ['ACTIVE', 'INVALIDATED'],
    createdDaysAgo: 3,
    note: 'Buy the retest unless the breakout runs away (fixture).',
    quantity: '0.1250',
    notional: '300.00000000',
    margin: '300.00000000',
    risk: '10.00000000',
    reward: '30.00000000',
    rr: '3.00000000',
    invalidation: '2600.00',
    deviationR: '0.5',
    timeframe: '4h',
    reason: 'INVALIDATION_PRICE',
    score: '64.00',
  },
  {
    n: 9,
    pairId: BTC_PAIR,
    market: 'spot',
    direction: 'LONG',
    entryType: 'STOP',
    entry: '70000.00',
    stop: '68000.00',
    take: '76000.00',
    leverage: null,
    path: [],
    createdDaysAgo: 1,
    note: 'Breakout over the range high (fixture).',
    quantity: '0.00500',
    notional: '350.00000000',
    margin: '350.00000000',
    risk: '10.00000000',
    reward: '30.00000000',
    rr: '3.00000000',
    invalidation: '64000.00',
    timeframe: '1h',
    costs: [
      '0.35000000',
      '0.34000000',
      '0.38000000',
      '0.00000000',
      '10.69000000',
      '0.06900000',
      '2.73526660',
    ],
  },
  {
    n: 10,
    pairId: BTC_PAIR,
    market: 'futures',
    direction: 'LONG',
    entryType: 'MARKET',
    entry: '62000.0',
    stop: '61900.0',
    take: '62300.0',
    leverage: 10,
    path: [],
    createdDaysAgo: 0.2,
    note: 'Scalp on a tight stop: the fees weigh on it (fixture).',
    warnings: [
      { type: 'HIGH_FEE_SHARE', severity: 'WARNING' },
      { type: 'HIGH_LEVERAGE', severity: 'WARNING' },
    ],
    quantity: '0.100',
    notional: '6200.31000000',
    margin: '620.03100000',
    risk: '10.00000000',
    reward: '29.69000000',
    rr: '2.96900000',
    liquidation: '56051.9',
    timeframe: '15m',
    expectedFill: '62003.1',
    costs: [
      '3.10015500',
      '3.09500000',
      '1.24600000',
      '0.30950000',
      '16.50465500',
      '0.65046550',
      '1.51213436',
    ],
  },
];

/** The dev profile's trading style is SWING, so its preset is SWING. */
const DEV_PRESET = 'SWING v1';

export function devPlanSeeds(now: number): TradingPlan[] {
  return SEEDS.map((seed) => {
    const created = now - seed.createdDaysAgo * DAY;
    const statuses: PlanStatus[] = ['DRAFT', ...seed.path];
    const status = statuses[statuses.length - 1] as PlanStatus;
    const warnings = seed.warnings ?? [];
    return {
      id: `0199a2c4-0000-7000-8000-${String(seed.n).padStart(12, '0')}`,
      pairId: seed.pairId,
      market: seed.market,
      direction: seed.direction,
      entryType: seed.entryType,
      entryPrice: scale12(seed.entry),
      expectedFillPrice: seed.expectedFill ? scale12(seed.expectedFill) : null,
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
      plannedEntryPrice: scale12(seed.entry),
      invalidationPrice: seed.invalidation ? scale12(seed.invalidation) : null,
      maxEntryDeviationR: seed.deviationR ?? null,
      analysisTimeframe: seed.timeframe ?? '4h',
      status,
      invalidationReason: seed.reason ?? null,
      setupScoreAtPlan: statuses.includes('ACTIVE')
        ? (seed.score ?? null)
        : null,
      setupScorePreset: statuses.includes('ACTIVE') ? DEV_PRESET : null,
      editable: status === 'DRAFT',
      snapshot: {
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
        estimatedEntryFee: seed.costs?.[0] ?? null,
        estimatedStopLossExitFee: seed.costs?.[1] ?? null,
        estimatedTakeProfitExitFee: seed.costs?.[2] ?? null,
        estimatedSlippage: seed.costs?.[3] ?? null,
        lossAtStopLoss: seed.costs?.[4] ?? null,
        feeShareOfRisk: seed.costs?.[5] ?? null,
        netRiskReward: seed.costs?.[6] ?? null,
      },
      warnings,
      blocksActivation: warnings.some(
        (warning) => warning.severity === 'BLOCKING',
      ),
      statusHistory: statuses.map((change, index) => ({
        status: change,
        at: new Date(created + index * 2 * HOUR).toISOString(),
      })),
      position:
        status === 'EXECUTED' && seed.position ? seed.position(created) : null,
    };
  });
}
