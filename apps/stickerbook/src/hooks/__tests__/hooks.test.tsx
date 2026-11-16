import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { resizeViewport, stubReducedMotion } from '@/test/browser';

import { useFrameLoop } from '../use-frame-loop';
import { usePrefersReducedMotion } from '../use-reduced-motion';
import { useViewportSize } from '../use-viewport-size';

describe('hooks', () => {
  it('should treat a missing matchMedia as full motion', () => {
    const { result } = renderHook(() => usePrefersReducedMotion());
    expect(result.current).toBe(false);
  });

  it('should follow prefers-reduced-motion changes', () => {
    const motion = stubReducedMotion(false);
    const { result, unmount } = renderHook(() => usePrefersReducedMotion());
    expect(result.current).toBe(false);
    motion.set(true);
    expect(result.current).toBe(true);
    unmount();
  });

  it('should report the window size and keep the same object until it changes', () => {
    const { result } = renderHook(() => useViewportSize());
    const first = result.current;
    expect(first).toEqual({ width: 1024, height: 768 });
    resizeViewport(1024, 768);
    expect(result.current).toBe(first);
    resizeViewport(390, 844);
    expect(result.current).toEqual({ width: 390, height: 844 });
  });

  it('should report the root font size when the page sets one', () => {
    document.documentElement.style.fontSize = '15px';
    try {
      const { result } = renderHook(() => useViewportSize());
      resizeViewport(390, 844);
      expect(result.current).toEqual({ width: 390, height: 844, rootFontPx: 15 });
    } finally {
      document.documentElement.style.fontSize = '';
    }
  });

  it('should run frames only while active and stop on cleanup', () => {
    vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame'] });
    const onFrame = vi.fn();
    const { rerender, unmount } = renderHook(({ active }) => useFrameLoop(active, onFrame), {
      initialProps: { active: false },
    });
    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(onFrame).not.toHaveBeenCalled();
    rerender({ active: true });
    act(() => {
      vi.advanceTimersByTime(100);
    });
    const calls = onFrame.mock.calls.length;
    expect(calls).toBeGreaterThan(3);
    const times = onFrame.mock.calls.map(([time]) => time as number);
    expect(times).toEqual(times.toSorted((a, b) => a - b));
    rerender({ active: false });
    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(onFrame).toHaveBeenCalledTimes(calls);
    unmount();
  });
});
