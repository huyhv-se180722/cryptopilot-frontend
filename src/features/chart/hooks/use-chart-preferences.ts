import { useCallback, useState } from 'react';

export const CHART_ITEMS = [
  'sma20',
  'ema20',
  'ema50',
  'ema200',
  'bollinger',
  'volume',
  'rsi',
  'macd',
] as const;
export type ChartItem = (typeof CHART_ITEMS)[number];
export type ChartToggles = Readonly<Record<ChartItem, boolean>>;

const STORAGE_KEY = 'cp-chart-items';

/** Everything SRS 3.3.2 lists is shown until the Trader hides it. */
const DEFAULTS: ChartToggles = {
  sma20: true,
  ema20: true,
  ema50: true,
  ema200: true,
  bollinger: true,
  volume: true,
  rsi: true,
  macd: true,
};

function read(): ChartToggles {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    const stored: unknown = JSON.parse(raw);
    if (typeof stored !== 'object' || stored === null) return DEFAULTS;
    const values = stored as Record<string, unknown>;
    return Object.fromEntries(
      CHART_ITEMS.map((item) => [
        item,
        typeof values[item] === 'boolean' ? values[item] : DEFAULTS[item],
      ]),
    ) as ChartToggles;
  } catch {
    return DEFAULTS;
  }
}

/**
 * The overlays and panels the Trader shows, remembered on this device
 * (SRS 3.3.2). Storage may be unavailable (private window, blocked site
 * data): the choice then lasts for the page only.
 */
export function useChartPreferences() {
  const [toggles, setToggles] = useState<ChartToggles>(read);
  const toggle = useCallback((item: ChartItem) => {
    setToggles((current) => {
      const next = { ...current, [item]: !current[item] };
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // Not remembered on this device; the screen still follows it.
      }
      return next;
    });
  }, []);
  return { toggles, toggle };
}
