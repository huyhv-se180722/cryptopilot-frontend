/**
 * The split of the Futures screen between the chart above and the
 * positions and orders below: what the chart gives the panel takes, within
 * both bounds; both heights are remembered on the device.
 */
export interface SplitLayout {
  /** The chart's drawing height, px. */
  chart: number;
  /** The height of a tab's box in the panel, px. */
  panel: number;
}

export const SPLIT = {
  initial: { chart: 500, panel: 340 },
  chart: { min: 280, max: 820 },
  panel: { min: 140, max: 900 },
} as const;

const KEY = 'cryptopilot.trade.futures.split';

export function readSplit(): SplitLayout {
  try {
    const stored = JSON.parse(localStorage.getItem(KEY) ?? 'null') as unknown;
    if (
      stored &&
      typeof stored === 'object' &&
      'chart' in stored &&
      'panel' in stored
    ) {
      const { chart, panel } = stored as SplitLayout;
      return {
        chart: clamp(chart, SPLIT.chart),
        panel: clamp(panel, SPLIT.panel),
      };
    }
  } catch {
    // Nothing kept, or a private window: the default layout.
  }
  return { ...SPLIT.initial };
}

export function saveSplit(layout: SplitLayout) {
  try {
    localStorage.setItem(KEY, JSON.stringify(layout));
  } catch {
    // A private window keeps no layout; the default returns next time.
  }
}

function clamp(value: number, bounds: { min: number; max: number }) {
  return Math.round(Math.min(bounds.max, Math.max(bounds.min, value)));
}

/**
 * The layout after the bar moved `up` px (negative: down) from `start`:
 * the chart gives what the panel takes, as far as both bounds allow.
 */
export function moved(start: SplitLayout, up: number): SplitLayout {
  const most = Math.min(
    start.chart - SPLIT.chart.min,
    SPLIT.panel.max - start.panel,
  );
  const least = -Math.min(
    SPLIT.chart.max - start.chart,
    start.panel - SPLIT.panel.min,
  );
  const shift = Math.round(Math.max(least, Math.min(most, up)));
  return { chart: start.chart - shift, panel: start.panel + shift };
}
