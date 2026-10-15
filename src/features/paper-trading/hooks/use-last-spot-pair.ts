import { useEffect } from 'react';

const STORAGE_KEY = 'cp-trade-spot-pair';

/**
 * The Spot pair last opened on the trading screen, remembered on this device
 * so that coming back to /trade/spot reopens it as an exchange does. Without
 * storage (private window, blocked site data) the screen opens the first pair.
 */
export function readLastSpotPair(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

/** Remembers `symbol` as the last Spot pair while the screen shows it. */
export function useRememberSpotPair(symbol: string) {
  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, symbol);
    } catch {
      // Not remembered; the next visit opens the first pair.
    }
  }, [symbol]);
}
