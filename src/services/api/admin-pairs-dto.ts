import type {
  AdminPair,
  ExchangeMarketInfo,
  ExchangeStatus,
  ExchangeSymbol,
  LeverageBracket,
  LeverageBracketInput,
  PairBrackets,
  PairSettings,
  PairStatus,
} from '../../types/domain';
import {
  decimal,
  flag,
  instant,
  integer,
  list,
  nullableDecimal,
  nullableInstant,
  nullableText,
  oneOf,
  record,
  text,
} from './decode';

/**
 * Decoders for `/admin/pairs/**` (UC-45, UC-46), checked against backend
 * develop @ dccfc6c: `AdminPairResponse` with its `ExchangeMarket`,
 * `ExchangeSymbolResponse`, `LeverageBracketsResponse` (`LeverageTier`),
 * `RegisterPairRequest`, `UpdatePairRequest` and `LeverageBracketsRequest`.
 */
const PAIR_STATUSES: readonly PairStatus[] = ['ACTIVE', 'INACTIVE'];
const EXCHANGE_STATUSES: readonly ExchangeStatus[] = [
  'TRADING',
  'NOT_TRADING',
  'DELISTED',
];

const nullableInteger = (value: unknown, name: string) =>
  value === null || value === undefined ? null : integer(value, name);

function exchangeMarket(value: unknown, name: string): ExchangeMarketInfo {
  const m = record(value, name);
  return {
    exchangeStatus:
      m.exchangeStatus === null || m.exchangeStatus === undefined
        ? null
        : oneOf(EXCHANGE_STATUSES, m.exchangeStatus, name + '.exchangeStatus'),
    exchangeStatusRaw: nullableText(
      m.exchangeStatusRaw,
      name + '.exchangeStatusRaw',
    ),
    tickSize: nullableDecimal(m.tickSize, name + '.tickSize'),
    stepSize: nullableDecimal(m.stepSize, name + '.stepSize'),
    minNotional: nullableDecimal(m.minNotional, name + '.minNotional'),
  };
}

export function decodeAdminPair(body: unknown): AdminPair {
  const value = record(body);
  return {
    pairId: text(value.pairId, 'pairId'),
    symbol: text(value.symbol, 'symbol'),
    baseAsset: nullableText(value.baseAsset, 'baseAsset'),
    quoteAsset: nullableText(value.quoteAsset, 'quoteAsset'),
    status: oneOf(PAIR_STATUSES, value.status, 'status'),
    spotEnabled: flag(value.spotEnabled, 'spotEnabled'),
    futuresEnabled: flag(value.futuresEnabled, 'futuresEnabled'),
    maxLeverage: nullableInteger(value.maxLeverage, 'maxLeverage'),
    displayOrder: integer(value.displayOrder, 'displayOrder'),
    spot: exchangeMarket(value.spot, 'spot'),
    futures: exchangeMarket(value.futures, 'futures'),
    bracketCount: integer(value.bracketCount, 'bracketCount'),
    lastSyncedAt: nullableInstant(value.lastSyncedAt, 'lastSyncedAt'),
    updatedAt: instant(value.updatedAt, 'updatedAt'),
  };
}

/** `GET /admin/pairs`: every pair, in display order. */
export function decodeAdminPairs(body: unknown): AdminPair[] {
  return list(body, 'pairs').map(decodeAdminPair);
}

export function decodeExchangeSymbols(body: unknown): ExchangeSymbol[] {
  return list(body, 'symbols').map((item) => {
    const value = record(item, 'symbol');
    return {
      symbol: text(value.symbol, 'symbol'),
      baseAsset: text(value.baseAsset, 'baseAsset'),
      quoteAsset: text(value.quoteAsset, 'quoteAsset'),
      spotTrading: flag(value.spotTrading, 'spotTrading'),
      futuresTrading: flag(value.futuresTrading, 'futuresTrading'),
    };
  });
}

function bracket(item: unknown): LeverageBracket {
  const value = record(item, 'bracket');
  return {
    bracketNo: integer(value.bracketNo, 'bracketNo'),
    notionalFloor: decimal(value.notionalFloor, 'notionalFloor'),
    notionalCap: decimal(value.notionalCap, 'notionalCap'),
    maxLeverage: integer(value.maxLeverage, 'maxLeverage'),
    maintenanceMarginRate: decimal(
      value.maintenanceMarginRate,
      'maintenanceMarginRate',
    ),
    maintenanceAmount: decimal(value.maintenanceAmount, 'maintenanceAmount'),
  };
}

export function decodePairBrackets(body: unknown): PairBrackets {
  const value = record(body);
  return {
    pairId: text(value.pairId, 'pairId'),
    symbol: text(value.symbol, 'symbol'),
    brackets: list(value.brackets, 'brackets').map(bracket),
  };
}

export const encodePairSettings = (settings: PairSettings) => ({
  status: settings.status,
  spotEnabled: settings.spotEnabled,
  futuresEnabled: settings.futuresEnabled,
  maxLeverage: settings.maxLeverage,
  displayOrder: settings.displayOrder,
});

/** The maintenance amounts are left out: the server works them out (BR-27). */
export const encodeBrackets = (brackets: readonly LeverageBracketInput[]) => ({
  brackets: brackets.map((row) => ({
    notionalFloor: row.notionalFloor,
    notionalCap: row.notionalCap,
    maxLeverage: row.maxLeverage,
    maintenanceMarginRate: row.maintenanceMarginRate,
  })),
});
