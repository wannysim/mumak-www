import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { resizeViewport, stubReducedMotion } from '@/test/browser';

import { useFrameLoop } from '../use-frame-loop';
import { usePrefersReducedMotion } from '../use-reduced-motion';
import { useSafeAreaInsets } from '../use-safe-area-insets';
import { useSceneLight } from '../use-scene-light';
import { useViewportSize } from '../use-viewport-size';

describe('hooks', () => {
  it('should read the device safe area and follow it when the window changes', () => {
    const { result, unmount } = renderHook(() => useSafeAreaInsets());
    // jsdom에는 safe area가 없다(데스크톱과 같다).
    expect(result.current).toEqual({ top: 0, right: 0, bottom: 0, left: 0 });
    const first = result.current;
    const real = window.getComputedStyle.bind(window);
    const spy = vi.spyOn(window, 'getComputedStyle').mockImplementation((element, pseudo) => {
      const style = real(element, pseudo);
      // 훅의 측정 요소(body에 붙인 숨은 요소)만 아이폰 세로 safe area를 돌려준다.
      if (element.parentElement === document.body && element.getAttribute('aria-hidden') === 'true') {
        return {
          ...style,
          paddingTop: '59px',
          paddingRight: '0px',
          paddingBottom: '34px',
          paddingLeft: 'auto',
        } as CSSStyleDeclaration;
      }
      return style;
    });
    act(() => {
      window.dispatchEvent(new Event('resize'));
    });
    expect(result.current).toEqual({ top: 59, right: 0, bottom: 34, left: 0 });
    expect(result.current).not.toBe(first);
    const second = result.current;
    act(() => {
      window.dispatchEvent(new Event('resize'));
    });
    expect(result.current).toBe(second);
    spy.mockRestore();
    unmount();
  });

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
  it('should light the book from the device clock and follow it minute by minute', () => {
    vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] });
    // 춘분 오전 8시 59분 30초: 해가 왼쪽에 있다.
    vi.setSystemTime(new Date(2026, 2, 20, 8, 59, 30));
    const { result, unmount } = renderHook(() => useSceneLight());
    const morning = result.current;
    expect(morning.direction.x).toBeLessThan(0);
    // 같은 분 안에서는 같은 빛(같은 객체)이다.
    act(() => {
      vi.advanceTimersByTime(20_000);
    });
    expect(result.current).toBe(morning);
    // 일곱 시간 뒤(오후 4시)에는 해가 오른쪽으로 넘어갔다.
    act(() => {
      vi.advanceTimersByTime(7 * 60 * 60_000);
    });
    expect(result.current.direction.x).toBeGreaterThan(0);
    unmount();
  });

  it('should preview another time of day with ?at= on the dev server', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 2, 20, 9, 0));
    window.history.replaceState(null, '', '/?at=16:30');
    try {
      const { result, unmount } = renderHook(() => useSceneLight());
      expect(result.current.direction.x).toBeGreaterThan(0);
      unmount();
      window.history.replaceState(null, '', '/?at=2026-03-20T07:30');
      const morning = renderHook(() => useSceneLight());
      expect(morning.result.current.direction.x).toBeLessThan(0);
      morning.unmount();
    } finally {
      window.history.replaceState(null, '', '/');
    }
  });
});
