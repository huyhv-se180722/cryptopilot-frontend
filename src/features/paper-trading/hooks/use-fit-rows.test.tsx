// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useFitRows } from './use-fit-rows';

type Resize = (entries: { contentRect: { height: number } }[]) => void;

describe('useFitRows (TR-F2)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('answers the fallback until measured, then the rows that fit up to the max', () => {
    let resize: Resize = () => undefined;
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(callback: Resize) {
          resize = callback;
        }
        observe() {}
        disconnect() {}
      },
    );
    const { result } = renderHook(() => useFitRows(20, 12));
    expect(result.current.rows).toBe(12);

    act(() => result.current.measure(document.createElement('div')));
    act(() => resize([{ contentRect: { height: 250 } }]));
    expect(result.current.rows).toBe(12);
    act(() => resize([{ contentRect: { height: 170 } }]));
    expect(result.current.rows).toBe(8);
    act(() => resize([{ contentRect: { height: 900 } }]));
    expect(result.current.rows).toBe(20);
    act(() => resize([{ contentRect: { height: 5 } }]));
    expect(result.current.rows).toBe(1);
  });
});
