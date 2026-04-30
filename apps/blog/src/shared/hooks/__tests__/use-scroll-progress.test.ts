import { act, renderHook } from '@testing-library/react';

import { useScrollProgress } from '../use-scroll-progress';

describe('useScrollProgress', () => {
  let scrollY: number;
  let innerHeight: number;
  let scrollHeight: number;

  beforeEach(() => {
    scrollY = 0;
    innerHeight = 800;
    scrollHeight = 2400;

    Object.defineProperty(window, 'scrollY', {
      get: () => scrollY,
      configurable: true,
    });
    Object.defineProperty(window, 'innerHeight', {
      get: () => innerHeight,
      configurable: true,
    });
    Object.defineProperty(document.documentElement, 'scrollHeight', {
      get: () => scrollHeight,
      configurable: true,
    });

    jest.spyOn(window, 'requestAnimationFrame').mockImplementation((cb: FrameRequestCallback) => {
      cb(0);
      return 1;
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const simulateScroll = (y: number) => {
    act(() => {
      scrollY = y;
      window.dispatchEvent(new Event('scroll'));
    });
  };

  it('initial progress is 0 when at top of document', () => {
    const { result } = renderHook(() => useScrollProgress());

    expect(result.current).toBe(0);
  });

  it('reports 50% when scrolled half way through scrollable area', () => {
    const { result } = renderHook(() => useScrollProgress());

    // scrollable = 2400 - 800 = 1600. 50% = 800.
    simulateScroll(800);

    expect(result.current).toBe(50);
  });

  it('clamps to 100% at the bottom of the document', () => {
    const { result } = renderHook(() => useScrollProgress());

    // scrollable = 1600 → scrollY beyond that should clamp.
    simulateScroll(2000);

    expect(result.current).toBe(100);
  });

  it('clamps to 0% when scrollY is negative (e.g. iOS bounce)', () => {
    const { result } = renderHook(() => useScrollProgress());

    simulateScroll(-200);

    expect(result.current).toBe(0);
  });

  it('returns 100 immediately when content fits within viewport', () => {
    scrollHeight = 600;
    innerHeight = 800;

    const { result } = renderHook(() => useScrollProgress());

    expect(result.current).toBe(100);
  });

  it('updates on resize events', () => {
    const { result } = renderHook(() => useScrollProgress());

    act(() => {
      scrollY = 800;
      window.dispatchEvent(new Event('resize'));
    });

    expect(result.current).toBe(50);
  });

  it('removes scroll and resize listeners on unmount', () => {
    const removeEventListenerSpy = jest.spyOn(window, 'removeEventListener');

    const { unmount } = renderHook(() => useScrollProgress());
    unmount();

    expect(removeEventListenerSpy).toHaveBeenCalledWith('scroll', expect.any(Function));
    expect(removeEventListenerSpy).toHaveBeenCalledWith('resize', expect.any(Function));
  });

  it('uses passive listeners for scroll and resize', () => {
    const addEventListenerSpy = jest.spyOn(window, 'addEventListener');

    renderHook(() => useScrollProgress());

    expect(addEventListenerSpy).toHaveBeenCalledWith('scroll', expect.any(Function), { passive: true });
    expect(addEventListenerSpy).toHaveBeenCalledWith('resize', expect.any(Function), { passive: true });
  });

  it('coalesces concurrent scroll events with rAF (only one frame schedules)', () => {
    const rafSpy = jest.spyOn(window, 'requestAnimationFrame').mockImplementation(() => 1);
    renderHook(() => useScrollProgress());
    rafSpy.mockClear();

    act(() => {
      window.dispatchEvent(new Event('scroll'));
      window.dispatchEvent(new Event('scroll'));
      window.dispatchEvent(new Event('scroll'));
    });

    expect(rafSpy).toHaveBeenCalledTimes(1);
  });
});
