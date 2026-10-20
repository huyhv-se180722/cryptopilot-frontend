import { describe, expect, it } from 'vitest';
import { labelsShown } from './chart-labels';

describe('labelsShown (BR-14 levels beside the price)', () => {
  it('hides a level label that would sit on the last price label', () => {
    expect(labelsShown([{ y: 210, yields: true }], [200])).toEqual([false]);
    expect(labelsShown([{ y: 218, yields: true }], [200])).toEqual([true]);
  });

  it('lets the first of two close levels keep its label', () => {
    expect(
      labelsShown(
        [
          { y: 300, yields: true },
          { y: 290, yields: true },
        ],
        [100],
      ),
    ).toEqual([true, false]);
  });

  it('never hides a line that does not yield, and makes levels give way to it', () => {
    expect(labelsShown([{ y: 150, yields: true }, { y: 155 }], [])).toEqual([
      false,
      true,
    ]);
  });

  it('shows a line off the scale and any label when nothing else is near', () => {
    expect(
      labelsShown(
        [
          { y: null, yields: true },
          { y: 500, yields: true },
        ],
        [100],
      ),
    ).toEqual([true, true]);
  });
});
