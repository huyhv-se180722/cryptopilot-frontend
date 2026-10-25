import type { AdminPairService } from '../services/api/contracts';
import { ServiceError } from '../services/api/errors';
import type {
  AdminPair,
  ExchangeMarketInfo,
  ExchangeSymbol,
  LeverageBracket,
  LeverageBracketInput,
} from '../types/domain';
import { add, compare, multiply, subtract } from '../utils/decimal-math';
import { devPairs } from './fixtures/market';

/**
 * DEVELOPMENT ONLY. In-memory `/admin/pairs/**` for SCR-37 and SCR-38 with
 * the backend's refusals: a market the exchange does not trade
 * (`PAIR_NOT_TRADING`), a market switched off with open positions
 * (`PAIR_HAS_OPEN_POSITIONS`, MSG40; ETHUSDT Futures has them here), a
 * pair registered twice, a Futures market without its leverage ceiling,
 * a ceiling above the first bracket and broken brackets, field by field.
 * Brackets are scripted for BTCUSDT and ETHUSDT; a reload restores them.
 */
function refuse(
  status: number,
  code: string,
  messageCode: string,
  fieldErrors: Readonly<Record<string, string>> = {},
): never {
  throw new ServiceError('Development pair refusal.', 'HTTP_ERROR', status, {
    status,
    code,
    messageCode,
    messageArgs: [],
    fieldErrors,
  });
}

const listed = (tickSize: string, stepSize: string): ExchangeMarketInfo => ({
  exchangeStatus: 'TRADING',
  exchangeStatusRaw: 'TRADING',
  tickSize,
  stepSize,
  minNotional: '5',
});
const unlisted: ExchangeMarketInfo = {
  exchangeStatus: null,
  exchangeStatusRaw: null,
  tickSize: null,
  stepSize: null,
  minNotional: null,
};

/** Symbols the exchange trades that are not pairs yet. */
const EXCHANGE: readonly ExchangeSymbol[] = [
  {
    symbol: 'SUIUSDT',
    baseAsset: 'SUI',
    quoteAsset: 'USDT',
    spotTrading: true,
    futuresTrading: true,
  },
  {
    symbol: 'TONUSDT',
    baseAsset: 'TON',
    quoteAsset: 'USDT',
    spotTrading: true,
    futuresTrading: false,
  },
];

const HAS_OPEN_FUTURES = new Set(['ETHUSDT']);

/** Each bracket starts at the cap before it (BR-26), Binance's amounts (BR-27). */
function bracketsOf(
  rows: readonly LeverageBracketInput[],
): Record<string, string> | LeverageBracket[] {
  const errors: Record<string, string> = {};
  const out: LeverageBracket[] = [];
  rows.forEach((row, index) => {
    const field = `brackets[${index}].`;
    const previous = out[index - 1];
    if (compare(row.notionalFloor, previous?.notionalCap ?? '0') !== 0)
      errors[field + 'notionalFloor'] = 'MSG15';
    if (compare(row.notionalCap, row.notionalFloor) <= 0)
      errors[field + 'notionalCap'] = 'MSG15';
    if (row.maxLeverage < 1 || row.maxLeverage > 125)
      errors[field + 'maxLeverage'] = 'MSG15';
    else if (previous && row.maxLeverage > previous.maxLeverage)
      errors[field + 'maxLeverage'] = 'MSG15';
    if (
      compare(row.maintenanceMarginRate, '0') <= 0 ||
      compare(row.maintenanceMarginRate, '1') >= 0
    )
      errors[field + 'maintenanceMarginRate'] = 'MSG15';
    const amount = previous
      ? add(
          previous.maintenanceAmount,
          multiply(
            row.notionalFloor,
            subtract(row.maintenanceMarginRate, previous.maintenanceMarginRate),
          ),
        )
      : '0';
    out.push({ ...row, bracketNo: index + 1, maintenanceAmount: amount });
  });
  return Object.keys(errors).length ? errors : out;
}

const BTC_BRACKETS: readonly LeverageBracketInput[] = [
  {
    notionalFloor: '0',
    notionalCap: '50000',
    maxLeverage: 125,
    maintenanceMarginRate: '0.004',
  },
  {
    notionalFloor: '50000',
    notionalCap: '600000',
    maxLeverage: 100,
    maintenanceMarginRate: '0.005',
  },
  {
    notionalFloor: '600000',
    notionalCap: '3000000',
    maxLeverage: 75,
    maintenanceMarginRate: '0.0065',
  },
];
const ETH_BRACKETS: readonly LeverageBracketInput[] = [
  {
    notionalFloor: '0',
    notionalCap: '25000',
    maxLeverage: 100,
    maintenanceMarginRate: '0.005',
  },
  {
    notionalFloor: '25000',
    notionalCap: '300000',
    maxLeverage: 75,
    maintenanceMarginRate: '0.0065',
  },
];

export function createDevelopmentAdminPairs(
  now: () => number = Date.now,
): AdminPairService {
  const at = () => new Date(now()).toISOString();
  const futures = new Set(devPairs('futures').map((pair) => pair.symbol));
  const brackets = new Map<string, LeverageBracket[]>();
  const pairs = new Map<string, AdminPair>();
  devPairs('spot').forEach((pair, index) => {
    const onFutures = futures.has(pair.symbol);
    const scripted =
      pair.symbol === 'BTCUSDT'
        ? BTC_BRACKETS
        : pair.symbol === 'ETHUSDT'
          ? ETH_BRACKETS
          : [];
    const tiers = bracketsOf(scripted) as LeverageBracket[];
    brackets.set(pair.pairId as string, tiers);
    pairs.set(pair.pairId as string, {
      pairId: pair.pairId as string,
      symbol: pair.symbol,
      baseAsset: pair.baseAsset,
      quoteAsset: pair.quoteAsset,
      status: 'ACTIVE',
      spotEnabled: true,
      futuresEnabled: onFutures,
      maxLeverage: onFutures ? (tiers[0]?.maxLeverage ?? 20) : null,
      displayOrder: index + 1,
      spot: listed(pair.tickSize ?? '0.01', pair.stepSize ?? '0.001'),
      futures: onFutures
        ? listed(pair.tickSize ?? '0.01', pair.stepSize ?? '0.001')
        : unlisted,
      bracketCount: tiers.length,
      lastSyncedAt: new Date(now() - 3_600_000).toISOString(),
      updatedAt: new Date(now() - 86_400_000).toISOString(),
    });
  });
  const find = (pairId: string) =>
    pairs.get(pairId) ?? refuse(404, 'RESOURCE_NOT_FOUND', 'MSG41');
  const pause = () => new Promise((resolve) => setTimeout(resolve, 120));
  let registered = 0;

  return {
    async list({ q, status }) {
      await pause();
      return [...pairs.values()]
        .filter((pair) => !q || pair.symbol.includes(q.toUpperCase()))
        .filter((pair) => !status || pair.status === status)
        .sort((a, b) => a.displayOrder - b.displayOrder);
    },
    async exchangeSymbols(q) {
      await pause();
      const taken = new Set([...pairs.values()].map((pair) => pair.symbol));
      return EXCHANGE.filter(
        (item) =>
          !taken.has(item.symbol) && item.symbol.includes(q.toUpperCase()),
      );
    },
    async register(symbol) {
      await pause();
      const wanted = symbol.trim().toUpperCase();
      if ([...pairs.values()].some((pair) => pair.symbol === wanted))
        refuse(409, 'PAIR_ALREADY_REGISTERED', 'MSG43');
      const item = EXCHANGE.find((each) => each.symbol === wanted);
      if (!item) refuse(409, 'PAIR_NOT_TRADING', 'MSG43');
      const pairId = `0199a0f0-2222-7aaa-8bbb-${String(++registered).padStart(12, '0')}`;
      const pair: AdminPair = {
        pairId,
        symbol: item.symbol,
        baseAsset: item.baseAsset,
        quoteAsset: item.quoteAsset,
        status: 'INACTIVE',
        spotEnabled: false,
        futuresEnabled: false,
        maxLeverage: null,
        displayOrder: pairs.size + 1,
        spot: item.spotTrading ? listed('0.0001', '0.1') : unlisted,
        futures: item.futuresTrading ? listed('0.0001', '0.1') : unlisted,
        bracketCount: 0,
        lastSyncedAt: at(),
        updatedAt: at(),
      };
      pairs.set(pairId, pair);
      brackets.set(pairId, []);
      return pair;
    },
    async update(pairId, settings) {
      await pause();
      const pair = find(pairId);
      const errors: Record<string, string> = {};
      if (settings.displayOrder < 1) errors.displayOrder = 'MSG15';
      if (settings.futuresEnabled && settings.maxLeverage === null)
        errors.maxLeverage = 'MSG01';
      else if (
        settings.maxLeverage !== null &&
        (settings.maxLeverage < 1 || settings.maxLeverage > 125)
      )
        errors.maxLeverage = 'MSG15';
      const first = brackets.get(pairId)?.[0];
      if (
        !errors.maxLeverage &&
        settings.futuresEnabled &&
        first &&
        (settings.maxLeverage ?? 0) > first.maxLeverage
      )
        errors.maxLeverage = 'MSG15';
      if (Object.keys(errors).length)
        refuse(400, 'VALIDATION_FAILED', 'MSG01', errors);
      const active = settings.status === 'ACTIVE';
      if (active && settings.spotEnabled && !pair.spot.exchangeStatus)
        refuse(409, 'PAIR_NOT_TRADING', 'MSG43');
      if (active && settings.futuresEnabled && !pair.futures.exchangeStatus)
        refuse(409, 'PAIR_NOT_TRADING', 'MSG43');
      const futuresOn = pair.status === 'ACTIVE' && pair.futuresEnabled;
      if (
        futuresOn &&
        !(active && settings.futuresEnabled) &&
        HAS_OPEN_FUTURES.has(pair.symbol)
      )
        refuse(409, 'PAIR_HAS_OPEN_POSITIONS', 'MSG40');
      const next: AdminPair = {
        ...pair,
        ...settings,
        maxLeverage: settings.futuresEnabled
          ? settings.maxLeverage
          : pair.maxLeverage,
        updatedAt: at(),
      };
      pairs.set(pairId, next);
      return next;
    },
    async brackets(pairId) {
      await pause();
      const pair = find(pairId);
      return {
        pairId,
        symbol: pair.symbol,
        brackets: brackets.get(pairId) ?? [],
      };
    },
    async replaceBrackets(pairId, rows) {
      await pause();
      const pair = find(pairId);
      if (!pair.futures.exchangeStatus)
        refuse(409, 'PAIR_NOT_TRADING', 'MSG43');
      if (rows.length === 0 || rows.length > 50)
        refuse(400, 'VALIDATION_FAILED', 'MSG01', { brackets: 'MSG01' });
      const checked = bracketsOf(rows);
      if (!Array.isArray(checked))
        refuse(400, 'VALIDATION_FAILED', 'MSG01', checked);
      if (
        pair.maxLeverage !== null &&
        pair.maxLeverage > (checked[0]?.maxLeverage ?? 0)
      )
        refuse(400, 'VALIDATION_FAILED', 'MSG01', {
          'brackets[0].maxLeverage': 'MSG15',
        });
      brackets.set(pairId, checked);
      pairs.set(pairId, {
        ...pair,
        bracketCount: checked.length,
        updatedAt: at(),
      });
      return { pairId, symbol: pair.symbol, brackets: checked };
    },
  };
}
