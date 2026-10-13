import type { MarketPair, MarketType } from '../../types/domain';

/**
 * DEVELOPMENT ONLY. Labelled pairs and starting prices for building
 * SCR-01 and SCR-09 without the backend. Prices are round illustrative
 * numbers, not market data.
 */
interface DevPairSeed {
  base: string;
  name: string;
  tickSize: string;
  stepSize: string;
  price: number;
}

const SEEDS: readonly DevPairSeed[] = [
  {
    base: 'BTC',
    name: 'Bitcoin',
    tickSize: '0.01',
    stepSize: '0.00001',
    price: 63000,
  },
  {
    base: 'ETH',
    name: 'Ethereum',
    tickSize: '0.01',
    stepSize: '0.0001',
    price: 2500,
  },
  { base: 'BNB', name: 'BNB', tickSize: '0.01', stepSize: '0.001', price: 580 },
  {
    base: 'SOL',
    name: 'Solana',
    tickSize: '0.01',
    stepSize: '0.001',
    price: 145,
  },
  {
    base: 'XRP',
    name: 'XRP',
    tickSize: '0.0001',
    stepSize: '0.1',
    price: 0.52,
  },
  {
    base: 'ADA',
    name: 'Cardano',
    tickSize: '0.0001',
    stepSize: '0.1',
    price: 0.35,
  },
  {
    base: 'DOGE',
    name: 'Dogecoin',
    tickSize: '0.00001',
    stepSize: '1',
    price: 0.11,
  },
  {
    base: 'LINK',
    name: 'Chainlink',
    tickSize: '0.001',
    stepSize: '0.01',
    price: 11.2,
  },
];

/** Futures lists fewer pairs, as an admin may enable a subset. */
const FUTURES = new Set(['BTC', 'ETH', 'BNB', 'SOL', 'XRP']);

export function devPairs(market: MarketType): readonly MarketPair[] {
  return SEEDS.filter(
    (seed) => market === 'spot' || FUTURES.has(seed.base),
  ).map((seed, index) => ({
    symbol: seed.base + 'USDT',
    market,
    baseAsset: seed.base,
    quoteAsset: 'USDT',
    baseAssetName: seed.name + ' (fixture)',
    logoUrl: null,
    tickSize: seed.tickSize,
    stepSize: seed.stepSize,
    displayOrder: index + 1,
  }));
}

export function devStartPrice(symbol: string): number {
  return SEEDS.find((seed) => seed.base + 'USDT' === symbol)?.price ?? 1;
}

export function devTickSize(symbol: string): string {
  return (
    SEEDS.find((seed) => seed.base + 'USDT' === symbol)?.tickSize ?? '0.01'
  );
}
