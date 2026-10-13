// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useFrameState } from './use-frame-state';

/** Animation frames that run only when the test says so (a hidden tab runs none). */
function holdFrames() {
  const frames = new Map<number, FrameRequestCallback>();
  let next = 1;
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
    frames.set(next, callback);
    return next++;
  });
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation((id) => {
    frames.delete(id);
  });
  return {
    pending: () => frames.size,
    run: () => {
      const due = [...frames.values()];
      frames.clear();
      due.forEach((callback) => callback(performance.now()));
    },
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useFrameState', () => {
  it('folds updates as they arrive and paints the newest once a frame', () => {
    const frames = holdFrames();
    const { result } = renderHook(() => useFrameState(() => 0));
    const apply = vi.fn((value: number) => value + 1);

    // A tab hidden for a while: thousands of messages and no frame.
    act(() => {
      for (let i = 0; i < 5_000; i++) result.current[1](apply);
    });
    // Applied on arrival, not queued for the frame; one frame requested.
    expect(apply).toHaveBeenCalledTimes(5_000);
    expect(frames.pending()).toBe(1);
    expect(result.current[0]).toBe(0);

    act(() => frames.run());
    expect(result.current[0]).toBe(5_000);

    act(() => result.current[1]((value) => value * 2));
    act(() => frames.run());
    expect(result.current[0]).toBe(10_000);
  });

  it('drops the waiting frame at unmount', () => {
    const frames = holdFrames();
    const { result, unmount } = renderHook(() => useFrameState(() => 'a'));
    act(() => result.current[1](() => 'b'));
    unmount();
    expect(frames.pending()).toBe(0);
  });
});
