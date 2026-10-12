const QUOTES = ['USDT', 'USDC', 'FDUSD'] as const;

/**
 * "BTCUSDT" → "BTC/USDT" when only the symbol is known (watchlist and
 * alert rows carry no base / quote asset). Other symbols stay unchanged.
 */
export function pairLabel(symbol: string): string {
  const quote = QUOTES.find(
    (q) => symbol.endsWith(q) && symbol.length > q.length,
  );
  return quote ? `${symbol.slice(0, -quote.length)}/${quote}` : symbol;
}
