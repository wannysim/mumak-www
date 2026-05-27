import { act, renderHook } from '@testing-library/react';

import { useProgressInterpolation } from '../hooks/use-progress-interpolation';

import '@testing-library/jest-dom';

describe('useProgressInterpolation', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('returns the server progress as-is when paused', () => {
    const nowSpy = jest.fn(() => 1000);
    const { result } = renderHook(() =>
      useProgressInterpolation({
        trackId: 'a',
        progressMs: 30_000,
        durationMs: 180_000,
        isPlaying: false,
        fetchedAt: 1000,
        now: nowSpy,
      })
    );

    expect(result.current.progressMs).toBe(30_000);

    act(() => {
      jest.advanceTimersByTime(5_000);
    });

    expect(result.current.progressMs).toBe(30_000);
  });

  it('interpolates progress every tick while playing', () => {
    let currentNow = 10_000;
    const { result } = renderHook(() =>
      useProgressInterpolation({
        trackId: 'a',
        progressMs: 5_000,
        durationMs: 60_000,
        isPlaying: true,
        fetchedAt: 10_000,
        now: () => currentNow,
      })
    );

    expect(result.current.progressMs).toBe(5_000);

    act(() => {
      currentNow = 11_000;
      jest.advanceTimersByTime(1_000);
    });
    expect(result.current.progressMs).toBe(6_000);

    act(() => {
      currentNow = 13_500;
      jest.advanceTimersByTime(1_000);
    });
    expect(result.current.progressMs).toBe(8_500);
  });

  it('clamps progress at the track duration', () => {
    let currentNow = 0;
    const { result } = renderHook(() =>
      useProgressInterpolation({
        trackId: 'a',
        progressMs: 9_500,
        durationMs: 10_000,
        isPlaying: true,
        fetchedAt: 0,
        now: () => currentNow,
      })
    );

    act(() => {
      currentNow = 5_000;
      jest.advanceTimersByTime(1_000);
    });

    expect(result.current.progressMs).toBe(10_000);
  });

  it('resets the baseline when the track changes', () => {
    let currentNow = 0;
    const { result, rerender } = renderHook(
      (props: Parameters<typeof useProgressInterpolation>[0]) => useProgressInterpolation(props),
      {
        initialProps: {
          trackId: 'a',
          progressMs: 30_000,
          durationMs: 60_000,
          isPlaying: true,
          fetchedAt: 0,
          now: () => currentNow,
        },
      }
    );

    act(() => {
      currentNow = 4_000;
      jest.advanceTimersByTime(1_000);
    });
    expect(result.current.progressMs).toBe(34_000);

    // 새 트랙으로 전환 — progress 0 부터 다시 시작
    rerender({
      trackId: 'b',
      progressMs: 0,
      durationMs: 120_000,
      isPlaying: true,
      fetchedAt: 5_000,
      now: () => currentNow,
    });

    expect(result.current.progressMs).toBe(0);

    act(() => {
      currentNow = 7_000;
      jest.advanceTimersByTime(1_000);
    });

    expect(result.current.progressMs).toBe(2_000);
  });

  it('returns null when progress data is missing', () => {
    const { result } = renderHook(() =>
      useProgressInterpolation({
        trackId: null,
        progressMs: null,
        durationMs: null,
        isPlaying: false,
        fetchedAt: 0,
      })
    );

    expect(result.current.progressMs).toBeNull();
    expect(result.current.durationMs).toBeNull();
  });

  it('updates the baseline when a new poll arrives (corrects drift)', () => {
    let currentNow = 0;
    const { result, rerender } = renderHook(
      (props: Parameters<typeof useProgressInterpolation>[0]) => useProgressInterpolation(props),
      {
        initialProps: {
          trackId: 'a',
          progressMs: 1_000,
          durationMs: 60_000,
          isPlaying: true,
          fetchedAt: 0,
          now: () => currentNow,
        },
      }
    );

    act(() => {
      currentNow = 4_000;
      jest.advanceTimersByTime(1_000);
    });
    expect(result.current.progressMs).toBe(5_000);

    // 서버가 6초 시점에 progress=10000 으로 응답 (사용자가 스크러빙 등으로 점프)
    rerender({
      trackId: 'a',
      progressMs: 10_000,
      durationMs: 60_000,
      isPlaying: true,
      fetchedAt: 6_000,
      now: () => currentNow,
    });

    expect(result.current.progressMs).toBe(10_000);

    act(() => {
      currentNow = 8_000;
      jest.advanceTimersByTime(1_000);
    });
    expect(result.current.progressMs).toBe(12_000);
  });

  it('stops interpolating when isPlaying flips to false', () => {
    let currentNow = 0;
    const { result, rerender } = renderHook(
      (props: Parameters<typeof useProgressInterpolation>[0]) => useProgressInterpolation(props),
      {
        initialProps: {
          trackId: 'a',
          progressMs: 1_000,
          durationMs: 60_000,
          isPlaying: true,
          fetchedAt: 0,
          now: () => currentNow,
        },
      }
    );

    act(() => {
      currentNow = 2_000;
      jest.advanceTimersByTime(1_000);
    });
    expect(result.current.progressMs).toBe(3_000);

    rerender({
      trackId: 'a',
      progressMs: 3_000,
      durationMs: 60_000,
      isPlaying: false,
      fetchedAt: 3_000,
      now: () => currentNow,
    });

    act(() => {
      currentNow = 10_000;
      jest.advanceTimersByTime(5_000);
    });

    expect(result.current.progressMs).toBe(3_000);
  });
});
