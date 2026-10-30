import { describe, expect, it } from 'vitest';
import { moved, SPLIT } from './split-layout';

describe('the split between the chart and the positions panel', () => {
  it('gives the panel what the chart gives up, in both directions', () => {
    expect(moved({ chart: 500, panel: 340 }, 100)).toEqual({
      chart: 400,
      panel: 440,
    });
    expect(moved({ chart: 500, panel: 340 }, -100)).toEqual({
      chart: 600,
      panel: 240,
    });
  });

  it('stops where the chart or the panel reaches its bound', () => {
    expect(moved({ chart: 300, panel: 340 }, 100)).toEqual({
      chart: SPLIT.chart.min,
      panel: 360,
    });
    expect(moved({ chart: 500, panel: 150 }, -100)).toEqual({
      chart: 510,
      panel: SPLIT.panel.min,
    });
  });
});
